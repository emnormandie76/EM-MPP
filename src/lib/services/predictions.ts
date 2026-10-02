import { and, count, eq, ne } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/lib/db/client";
import { prediction, predictionEvent, question, questionExtension, questionOption, user } from "@/lib/db/schema";
import { JOKERS_PER_SEASON } from "@/lib/game/constants";
import { parseNumberInput } from "@/lib/game/number-input";
import { questionStatusFor } from "@/lib/game/question-status";
import { type Actor, authorize, ERROR_MESSAGES, fail, type Failure, isFailure, ok, type Result } from "./result";
import { seasonsForQuestions } from "./seasons";

// Predictions of the players (architecture §5.4, §7.3). A prediction is saved (still editable) or
// validated (final); a saved prediction counts as validated at the closing, without any write.
// Each action writes one event of the history, which is never changed.
//
// "Open" means open for the owner of the prediction (v1.2, §5.2): a closed question stays open for a
// player whose extension still runs (§5.14).
//
// Locks, always in this order (§5.4): for setJoker only, the seasons (FOR SHARE, to read whether
// they allow jokers while no updateSeason takes them away); the question (FOR SHARE: an admin cannot
// change it, nor a season move it, while a prediction arrives); the owner's extension on it, if any
// (FOR SHARE); the owner's user row (FOR NO KEY UPDATE: the writes on one player's predictions run
// one at a time, so a double click cannot pose a third joker); then the prediction (FOR UPDATE).
// NO KEY UPDATE rather than UPDATE: it does not block the foreign key checks of the events written
// meanwhile for the same player.

type QuestionRow = Pick<
  typeof question.$inferSelect,
  "id" | "type" | "status" | "opensAt" | "closesAt" | "resolvedAt" | "seasonId"
>;
type PredictionRow = typeof prediction.$inferSelect;
type EventType = (typeof predictionEvent.$inferInsert)["type"];

const questionIdSchema = z.coerce.number().int().positive();

const answerInput = z.object({
  questionId: questionIdSchema,
  /** Number question: the value as typed (§5.3). */
  rawValue: z.string().optional(),
  /** Choice question: one of its answers. */
  optionId: z.coerce.number().int().positive().optional(),
});

type Answer = { valueNumber: number | null; optionId: number | null };

/**
 * The question, locked FOR SHARE, then the owner's extension on it (FOR SHARE), if the question is
 * open for the owner at `now`. An unknown question is "not open" too, without saying it does not exist.
 */
async function openQuestion(tx: Database, questionId: number, ownerId: string, now: Date): Promise<QuestionRow | Failure> {
  const [row] = await tx
    .select({
      id: question.id,
      type: question.type,
      status: question.status,
      opensAt: question.opensAt,
      closesAt: question.closesAt,
      resolvedAt: question.resolvedAt,
      seasonId: question.seasonId,
    })
    .from(question)
    .where(eq(question.id, questionId))
    .for("share");
  if (!row) return fail("QUESTION_NOT_OPEN");
  const [extension] = await tx
    .select({ closesAt: questionExtension.closesAt })
    .from(questionExtension)
    .where(and(eq(questionExtension.questionId, questionId), eq(questionExtension.userId, ownerId)))
    .for("share");
  if (questionStatusFor(row, extension ?? null, now) !== "open") return fail("QUESTION_NOT_OPEN");
  return row;
}

async function lockPlayer(tx: Database, userId: string): Promise<void> {
  await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for("no key update");
}

async function lockPrediction(tx: Database, questionId: number, userId: string): Promise<PredictionRow | undefined> {
  const [row] = await tx
    .select()
    .from(prediction)
    .where(and(eq(prediction.questionId, questionId), eq(prediction.userId, userId)))
    .for("update");
  return row;
}

/** The answer read from the input, according to the type of the question. */
async function readAnswer(
  tx: Database,
  row: QuestionRow,
  input: { rawValue?: string; optionId?: number },
): Promise<Answer | Failure> {
  if (row.type === "number") {
    const value = parseNumberInput(input.rawValue ?? "");
    if (!value.ok) return fail("INVALID_VALUE", value.message, { rawValue: value.message });
    return { valueNumber: value.value, optionId: null };
  }
  const [option] =
    input.optionId === undefined
      ? []
      : await tx
          .select({ id: questionOption.id })
          .from(questionOption)
          .where(and(eq(questionOption.id, input.optionId), eq(questionOption.questionId, row.id)));
  if (!option) return fail("INVALID_OPTION", undefined, { optionId: ERROR_MESSAGES.INVALID_OPTION });
  return { valueNumber: null, optionId: option.id };
}

async function addEvent(tx: Database, row: PredictionRow, actorId: string, type: EventType, now: Date): Promise<void> {
  await tx.insert(predictionEvent).values({
    predictionId: row.id,
    questionId: row.questionId,
    ownerId: row.userId,
    actorId,
    type,
    valueNumber: row.valueNumber,
    optionId: row.optionId,
    joker: row.joker,
    createdAt: now,
  });
}

/** Creates or updates the player's prediction with `answer`, and writes the `saved` event. */
async function saveAnswer(
  tx: Database,
  current: PredictionRow | undefined,
  questionId: number,
  userId: string,
  answer: Answer,
  now: Date,
): Promise<PredictionRow> {
  const [row] = current
    ? await tx
        .update(prediction)
        .set({ ...answer, updatedAt: now })
        .where(eq(prediction.id, current.id))
        .returning()
    : await tx
        .insert(prediction)
        .values({ questionId, userId, ...answer, createdAt: now, updatedAt: now })
        .returning();
  await addEvent(tx, row, userId, "saved", now);
  return row;
}

/** Jokers the player has posed in `seasonId`, on questions that are not cancelled, except `exceptQuestionId`. */
async function jokersUsed(tx: Database, userId: string, seasonId: number | null, exceptQuestionId: number): Promise<number> {
  if (seasonId === null) return 0;
  const [row] = await tx
    .select({ n: count() })
    .from(prediction)
    .innerJoin(question, eq(question.id, prediction.questionId))
    .where(
      and(
        eq(prediction.userId, userId),
        eq(prediction.joker, true),
        eq(question.seasonId, seasonId),
        ne(question.status, "cancelled"),
        ne(question.id, exceptQuestionId),
      ),
    );
  return row.n;
}

export type SavedPrediction = { predictionId: number };

/**
 * Saves the player's prediction on an open question: a value read as typed (§5.3), or one of the
 * question's answers. Refused once the prediction is validated.
 */
export async function savePrediction(
  db: Database,
  actor: Actor | null,
  input: unknown,
  now: Date,
): Promise<Result<SavedPrediction>> {
  const me = authorize(actor);
  if (isFailure(me)) return me;
  const parsed = answerInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  const { questionId } = parsed.data;

  return db.transaction(async (tx) => {
    const row = await openQuestion(tx, questionId, me.id, now);
    if (isFailure(row)) return row;
    await lockPlayer(tx, me.id);
    const current = await lockPrediction(tx, questionId, me.id);
    if (current?.validatedAt) return fail("ALREADY_VALIDATED");
    const answer = await readAnswer(tx, row, parsed.data);
    if (isFailure(answer)) return answer;

    const saved = await saveAnswer(tx, current, questionId, me.id, answer, now);
    return ok({ predictionId: saved.id });
  });
}

/**
 * Validates the player's prediction: final from now on. With a value (the "Valider" button always
 * sends the value shown), it is saved first, in the same transaction.
 */
export async function validatePrediction(
  db: Database,
  actor: Actor | null,
  input: unknown,
  now: Date,
): Promise<Result<SavedPrediction>> {
  const me = authorize(actor);
  if (isFailure(me)) return me;
  const parsed = answerInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  const { questionId, rawValue, optionId } = parsed.data;

  return db.transaction(async (tx) => {
    const row = await openQuestion(tx, questionId, me.id, now);
    if (isFailure(row)) return row;
    await lockPlayer(tx, me.id);
    let current = await lockPrediction(tx, questionId, me.id);
    if (current?.validatedAt) return fail("ALREADY_VALIDATED");

    const withAnswer = row.type === "number" ? rawValue !== undefined : optionId !== undefined;
    if (withAnswer) {
      const answer = await readAnswer(tx, row, parsed.data);
      if (isFailure(answer)) return answer;
      current = await saveAnswer(tx, current, questionId, me.id, answer, now);
    }
    if (!current) return fail("NO_PREDICTION");

    const [validated] = await tx
      .update(prediction)
      .set({ validatedAt: now, updatedAt: now })
      .where(eq(prediction.id, current.id))
      .returning();
    await addEvent(tx, validated, me.id, "validated", now);
    return ok({ predictionId: validated.id });
  });
}

const jokerInput = z.object({ questionId: questionIdSchema, enabled: z.boolean() });

export type JokerState = { joker: boolean; jokersLeft: number };

/**
 * Poses or removes the joker of a saved prediction, not validated yet, when the season of the
 * question allows jokers (v1.2). At most JOKERS_PER_SEASON jokers per player in the season of the
 * question, on questions that are not cancelled: a joker posed on a question later cancelled is
 * given back.
 */
export async function setJoker(
  db: Database,
  actor: Actor | null,
  input: unknown,
  now: Date,
): Promise<Result<JokerState>> {
  const me = authorize(actor);
  if (isFailure(me)) return me;
  const parsed = jokerInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  const { questionId, enabled } = parsed.data;

  return db.transaction(async (tx) => {
    const seasons = await seasonsForQuestions(tx);
    const row = await openQuestion(tx, questionId, me.id, now);
    if (isFailure(row)) return row;
    // An open question is published, hence in a season: the season decides, for posing and removing.
    if (!seasons.find(({ id }) => id === row.seasonId)?.jokersEnabled) return fail("JOKERS_DISABLED");
    await lockPlayer(tx, me.id);
    const current = await lockPrediction(tx, questionId, me.id);
    if (!current) return fail("NO_PREDICTION");
    if (current.validatedAt) return fail("ALREADY_VALIDATED");

    const others = await jokersUsed(tx, me.id, row.seasonId, questionId);
    const left = (joker: boolean) => Math.max(0, JOKERS_PER_SEASON - others - (joker ? 1 : 0));
    if (current.joker === enabled) return ok({ joker: enabled, jokersLeft: left(enabled) });
    if (enabled && others >= JOKERS_PER_SEASON) return fail("NO_JOKER_LEFT");

    const [changed] = await tx
      .update(prediction)
      .set({ joker: enabled, updatedAt: now })
      .where(eq(prediction.id, current.id))
      .returning();
    await addEvent(tx, changed, me.id, enabled ? "joker_on" : "joker_off", now);
    return ok({ joker: enabled, jokersLeft: left(enabled) });
  });
}

const unlockInput = z.object({ predictionId: z.coerce.number().int().positive() });

/**
 * The admin unlocks a validated prediction, at the player's request, while the question is open for
 * the player (before the closing, or during their extension): the player can change it again. The
 * event names the admin as the actor.
 */
export async function unlockPrediction(db: Database, actor: Actor | null, input: unknown, now: Date): Promise<Result> {
  const me = authorize(actor, { admin: true });
  if (isFailure(me)) return me;
  const parsed = unlockInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  const notFound = () => fail("NOT_FOUND", "Ce prono n'existe pas.");

  return db.transaction(async (tx) => {
    // Question and owner never change: read them first, to take the locks in the usual order.
    const [target] = await tx
      .select({ questionId: prediction.questionId, userId: prediction.userId })
      .from(prediction)
      .where(eq(prediction.id, parsed.data.predictionId));
    if (!target) return notFound();
    const row = await openQuestion(tx, target.questionId, target.userId, now);
    if (isFailure(row)) return fail("QUESTION_NOT_OPEN", "La question n'est plus ouverte : ce prono ne peut plus être déverrouillé.");
    await lockPlayer(tx, target.userId);
    const current = await lockPrediction(tx, target.questionId, target.userId);
    if (!current) return notFound();
    if (!current.validatedAt) return fail("NOT_VALIDATED");

    const [unlocked] = await tx
      .update(prediction)
      .set({ validatedAt: null, updatedAt: now })
      .where(eq(prediction.id, current.id))
      .returning();
    await addEvent(tx, unlocked, me.id, "unlocked", now);
    return ok();
  });
}
