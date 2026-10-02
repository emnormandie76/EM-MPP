import { and, count, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/lib/db/client";
import { prediction, prize, question, season, seasonStanding, user } from "@/lib/db/schema";
import { formatCount, formatDate } from "@/lib/format";
import { computeStandings, seasonPlayers } from "@/lib/game/standings";
import { seasonAt, seasonEnd } from "@/lib/game/time";
import { prizesSchema, seasonNameSchema, seasonStartSchema } from "@/lib/validation/content";
import { isUniqueViolation } from "./db-errors";
import { type Actor, authorize, ERROR_MESSAGES, fail, type Failure, fieldErrorsOf, isFailure, ok, type Result } from "./result";

// Seasons, prizes and proclamation (architecture §5.1, §5.12, §5.13, §7.3). Seasons are created by
// the admin (v1.1): each one ends where the next one starts, and a question belongs to the season
// of its closing date. A change of the seasons recomputes the season of the questions in the same
// transaction. Each season allows jokers or not (v1.2).
//
// Locks: a change of the seasons (proclamation included) locks the season table (EXCLUSIVE), then
// the questions. The question services read the seasons with FOR SHARE before locking their
// question (`seasonsForQuestions`): a question never gets its season from a list being changed,
// and the locks are always taken in the same order. setJoker reads them the same way, so that the
// jokers of a season are not taken away while one is being posed.

type SeasonRow = typeof season.$inferSelect;
type SeasonShape = Pick<SeasonRow, "id" | "startsAt" | "proclaimedAt">;

const NOT_FOUND = "Cette saison n'existe pas.";
const notFound = () => fail("NOT_FOUND", NOT_FOUND);
const nameTaken = () => fail("SEASON_NAME_TAKEN", undefined, { label: "Cette saison existe déjà." });
const startTaken = () => fail("SEASON_START_TAKEN", undefined, { startsOn: "Une saison commence déjà ce jour-là." });

/** The seasons, for a question service that sets a season: waits while the list is being changed. */
export async function seasonsForQuestions(db: Database): Promise<SeasonRow[]> {
  return db.select().from(season).for("share");
}

async function lockSeasons(db: Database): Promise<SeasonRow[]> {
  await db.execute(sql`lock table ${season} in exclusive mode`);
  return db.select().from(season);
}

async function isNameTaken(db: Database, label: string, exceptId?: number): Promise<boolean> {
  const rows = await db
    .select({ id: season.id })
    .from(season)
    .where(and(sql`lower(${season.label}) = lower(${label})`, exceptId ? ne(season.id, exceptId) : undefined))
    .limit(1);
  return rows.length > 0;
}

/** "« A », « B » et 2 autres". */
function titles(rows: { title: string }[]): string {
  const shown = rows.slice(0, 2).map(({ title }) => `« ${title} »`);
  const others = rows.length - shown.length;
  return others > 0 ? `${shown.join(", ")} et ${others === 1 ? "1 autre" : `${others} autres`}` : shown.join(" et ");
}

/** A question whose season would change: from `from` to `to` (null: no season). */
type Move = { id: number; title: string; status: "draft" | "published" | "cancelled"; to: number | null; from: number | null };

/**
 * Questions whose season changes once the seasons are `next` (§4.5), and the refusal if one of them
 * cannot move (§5.13): it has predictions (its jokers count in its season); it is published or
 * cancelled and would be left without a season, or would enter or leave a proclaimed season
 * (decision of 30/09/2026). Drafts follow their closing date freely. The questions are locked.
 */
async function plannedMoves(
  tx: Database,
  next: readonly SeasonShape[],
  messages: { predictions: string },
): Promise<{ moves: Move[] } | Failure> {
  const rows = await tx
    .select({ id: question.id, title: question.title, status: question.status, closesAt: question.closesAt, seasonId: question.seasonId })
    .from(question)
    .where(isNotNull(question.closesAt))
    .for("update");
  const moves: Move[] = [];
  for (const row of rows) {
    const to = seasonAt(next, row.closesAt!)?.id ?? null;
    if (to !== row.seasonId) moves.push({ id: row.id, title: row.title, status: row.status, to, from: row.seasonId });
  }
  if (moves.length === 0) return { moves };

  const counts = await tx
    .select({ questionId: prediction.questionId, n: count() })
    .from(prediction)
    .where(inArray(prediction.questionId, moves.map(({ id }) => id)))
    .groupBy(prediction.questionId);
  const withPredictions = moves.filter(({ id }) => counts.some(({ questionId }) => questionId === id));
  if (withPredictions.length > 0) {
    return fail("SEASON_CHANGE_REFUSED", `${messages.predictions} (${titles(withPredictions)}).`);
  }

  const played = moves.filter(({ status }) => status !== "draft");
  const orphans = played.filter(({ to }) => to === null);
  if (orphans.length > 0) {
    return fail("SEASON_CHANGE_REFUSED", `Des questions publiées se retrouveraient sans saison (${titles(orphans)}).`);
  }
  const proclaimed = new Set(next.filter(({ proclaimedAt }) => proclaimedAt !== null).map(({ id }) => id));
  const frozen = played.filter(({ from, to }) => (from !== null && proclaimed.has(from)) || (to !== null && proclaimed.has(to)));
  if (frozen.length > 0) {
    return fail("SEASON_CHANGE_REFUSED", `Des questions entreraient dans une saison proclamée ou en sortiraient (${titles(frozen)}).`);
  }
  return { moves };
}

async function applyMoves(tx: Database, moves: Move[], seasonIdOf: (id: number | null) => number | null, now: Date) {
  for (const move of moves) {
    await tx
      .update(question)
      .set({ seasonId: seasonIdOf(move.to), updatedAt: now })
      .where(eq(question.id, move.id));
  }
}

// ---------------------------------------------------------------------------------------------
// Create, update, delete (§5.13)

const seasonInput = z.object({ label: seasonNameSchema, startsOn: seasonStartSchema, jokersEnabled: z.boolean().optional() });

/** Placeholder id of the season being created, while its moves are planned. */
const NEW_SEASON = -1;

/**
 * New season, with its name, start day and whether it allows jokers (yes by default). It takes its
 * place in the list and takes over, from the season before it, the questions that close from its
 * start on. `moved`: questions that changed season.
 */
export async function createSeason(
  db: Database,
  actor: Actor | null,
  input: unknown,
  now: Date,
): Promise<Result<{ id: number; moved: number }>> {
  const me = authorize(actor, { admin: true });
  if (isFailure(me)) return me;
  const parsed = seasonInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT", undefined, fieldErrorsOf(parsed.error.issues));
  const { label, startsOn: startsAt, jokersEnabled = true } = parsed.data;

  try {
    return await db.transaction(async (tx) => {
      const seasons = await lockSeasons(tx);
      if (await isNameTaken(tx, label)) return nameTaken();
      if (seasons.some((row) => row.startsAt.getTime() === startsAt.getTime())) return startTaken();

      const planned = await plannedMoves(tx, [...seasons, { id: NEW_SEASON, startsAt, proclaimedAt: null }], {
        predictions: "Des questions avec des pronos clôturent après cette date : elles changeraient de saison",
      });
      if (isFailure(planned)) return planned;

      const [row] = await tx.insert(season).values({ label, startsAt, jokersEnabled, createdAt: now }).returning({ id: season.id });
      await applyMoves(tx, planned.moves, (id) => (id === NEW_SEASON ? row.id : id), now);
      return ok({ id: row.id, moved: planned.moves.length });
    });
  } catch (error) {
    // Two admins creating the same season at once: the unique indexes decide.
    if (isUniqueViolation(error)) return fail("SEASON_NAME_TAKEN", "Cette saison existe déjà, ou une saison commence ce jour-là.");
    throw error;
  }
}

const updateInput = seasonInput.partial().extend({ seasonId: z.coerce.number().int().positive() });

/** Whether a joker is posed on a question of the season that is not cancelled (a cancelled one gave it back). */
async function jokersPosed(tx: Database, seasonId: number): Promise<boolean> {
  const [row] = await tx
    .select({ n: count() })
    .from(prediction)
    .innerJoin(question, eq(question.id, prediction.questionId))
    .where(and(eq(question.seasonId, seasonId), ne(question.status, "cancelled"), eq(prediction.joker, true)));
  return row.n > 0;
}

/**
 * Renames a season, moves its start day, which stays strictly between the starts of the seasons
 * around it, and allows or takes away its jokers; an absent field keeps its value. The questions
 * that change season are recomputed. A proclaimed season keeps its start day and its jokers setting,
 * but can still be renamed. The jokers cannot be taken away once one is posed in the season (v1.2).
 */
export async function updateSeason(
  db: Database,
  actor: Actor | null,
  input: unknown,
  now: Date,
): Promise<Result<{ id: number; moved: number }>> {
  const me = authorize(actor, { admin: true });
  if (isFailure(me)) return me;
  const parsed = updateInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT", undefined, fieldErrorsOf(parsed.error.issues));
  const { seasonId } = parsed.data;

  try {
    return await db.transaction(async (tx) => {
      const seasons = await lockSeasons(tx);
      const current = seasons.find(({ id }) => id === seasonId);
      if (!current) return notFound();
      const { label = current.label, startsOn: startsAt = current.startsAt, jokersEnabled = current.jokersEnabled } = parsed.data;
      if (await isNameTaken(tx, label, current.id)) return nameTaken();

      if (jokersEnabled !== current.jokersEnabled) {
        if (current.proclaimedAt) {
          const message = "Cette saison est proclamée : le réglage des jokers ne peut plus changer.";
          return fail("SEASON_PROCLAIMED", message, { jokersEnabled: message });
        }
        if (!jokersEnabled && (await jokersPosed(tx, current.id))) {
          return fail("JOKERS_IN_USE", undefined, { jokersEnabled: ERROR_MESSAGES.JOKERS_IN_USE });
        }
      }

      let moves: Move[] = [];
      if (startsAt.getTime() !== current.startsAt.getTime()) {
        if (current.proclaimedAt) {
          const message = "Cette saison est proclamée : sa date de début ne peut plus changer.";
          return fail("SEASON_PROCLAIMED", message, { startsOn: message });
        }
        const others = seasons.filter(({ id }) => id !== current.id);
        const before = others.filter((row) => row.startsAt < current.startsAt).sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())[0];
        const after = others.filter((row) => row.startsAt > current.startsAt).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0];
        if ((before && startsAt <= before.startsAt) || (after && startsAt >= after.startsAt)) {
          const bounds = [before ? `après le ${formatDate(before.startsAt)}` : null, after ? `avant le ${formatDate(after.startsAt)}` : null];
          const message = `La date de début doit rester entre celle de la saison précédente et celle de la suivante : ${bounds.filter(Boolean).join(" et ")}.`;
          return fail("SEASON_ORDER", message, { startsOn: message });
        }
        const planned = await plannedMoves(tx, [...others, { ...current, startsAt }], {
          predictions: "Des questions avec des pronos changeraient de saison avec cette date",
        });
        if (isFailure(planned)) return planned;
        moves = planned.moves;
      }

      await tx.update(season).set({ label, startsAt, jokersEnabled }).where(eq(season.id, current.id));
      await applyMoves(tx, moves, (id) => id, now);
      return ok({ id: current.id, moved: moves.length });
    });
  } catch (error) {
    if (isUniqueViolation(error)) return nameTaken();
    throw error;
  }
}

const idInput = z.object({ seasonId: z.coerce.number().int().positive() });

/**
 * Deletes a season that is not proclaimed and has no question (drafts included), with its prizes.
 * No question changes season: none belongs to it.
 */
export async function deleteSeason(db: Database, actor: Actor | null, input: unknown): Promise<Result> {
  const me = authorize(actor, { admin: true });
  if (isFailure(me)) return me;
  const parsed = idInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");

  return db.transaction(async (tx) => {
    const seasons = await lockSeasons(tx);
    const current = seasons.find(({ id }) => id === parsed.data.seasonId);
    if (!current) return notFound();
    if (current.proclaimedAt) return fail("SEASON_PROCLAIMED", "Cette saison est proclamée : elle ne peut pas être supprimée.");
    const [attached] = await tx.select({ n: count() }).from(question).where(eq(question.seasonId, current.id));
    if (attached.n > 0) return fail("SEASON_HAS_QUESTIONS");

    await tx.delete(prize).where(eq(prize.seasonId, current.id));
    await tx.delete(season).where(eq(season.id, current.id));
    return ok();
  });
}

// ---------------------------------------------------------------------------------------------
// Prizes

const prizesInput = z.object({
  seasonId: z.coerce.number().int().positive(),
  prizes: prizesSchema,
});

export type PrizeInput = z.infer<typeof prizesInput>["prizes"][number];

/**
 * Replaces the prizes of a season, in the given order (§8.3 /admin/saisons). Only an existing
 * season that is not proclaimed: the palmarès of a proclaimed season is frozen.
 */
export async function upsertPrizes(
  db: Database,
  actor: Actor | null,
  input: unknown,
): Promise<Result<{ seasonId: number; count: number }>> {
  const me = authorize(actor, { admin: true });
  if (isFailure(me)) return me;
  const parsed = prizesInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT", undefined, fieldErrorsOf(parsed.error.issues));
  const { seasonId, prizes } = parsed.data;

  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(season).where(eq(season.id, seasonId)).for("update");
    if (!row) return notFound();
    if (row.proclaimedAt) return fail("SEASON_PROCLAIMED");

    await tx.delete(prize).where(eq(prize.seasonId, row.id));
    if (prizes.length > 0) {
      await tx
        .insert(prize)
        .values(prizes.map((item, index) => ({ seasonId: row.id, ...item, position: index + 1 })));
    }
    return ok({ seasonId: row.id, count: prizes.length });
  });
}

// ---------------------------------------------------------------------------------------------
// Proclamation (§5.12)

export type ProclamationState = {
  proclaimed: boolean;
  /** Published questions of the season, cancelled ones excluded. */
  publishedCount: number;
  resolvedCount: number;
};

/** Why the final standings of a season cannot be proclaimed yet (§5.12), or null. */
export function proclamationBlocker({ proclaimed, publishedCount, resolvedCount }: ProclamationState): string | null {
  if (proclaimed) return ERROR_MESSAGES.ALREADY_PROCLAIMED;
  if (publishedCount === 0) return "Aucune question n'a été publiée dans cette saison.";
  const waiting = publishedCount - resolvedCount;
  if (waiting > 0) {
    return `${formatCount(waiting, "question publiée n'a", "questions publiées n'ont")} pas encore de résultat : la proclamation se fait une fois toutes les questions résolues.`;
  }
  return null;
}

/**
 * Freezes the final standings of a season (§5.12): computed as the standings page does (§5.6),
 * copied into `season_standing` with the names of the day, then `proclaimed_at = now`. Since v1.2,
 * the total malus goes to the `malus` column and `points` stays null. Only once every published
 * question of the season is resolved (no extension runs then: it would have prevented the result).
 * Irreversible: a later correction of a result does not change the palmarès.
 */
export async function proclaimSeason(
  db: Database,
  actor: Actor | null,
  input: unknown,
  now: Date,
): Promise<Result<{ seasonId: number; standings: number }>> {
  const me = authorize(actor, { admin: true });
  if (isFailure(me)) return me;
  const parsed = idInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");

  return db.transaction(async (tx) => {
    const seasons = await lockSeasons(tx);
    const current = seasons.find(({ id }) => id === parsed.data.seasonId);
    if (!current) return notFound();
    const questions = await tx
      .select({
        id: question.id,
        type: question.type,
        coefficient: question.coefficient,
        wrongAnswerMalus: question.wrongAnswerMalus,
        resultNumber: question.resultNumber,
        resultOptionId: question.resultOptionId,
        resolvedAt: question.resolvedAt,
      })
      .from(question)
      .where(and(eq(question.seasonId, current.id), eq(question.status, "published")))
      .for("share");
    const resolved = questions.flatMap((q) => (q.resolvedAt ? [{ ...q, resolvedAt: q.resolvedAt }] : []));
    const blocker = proclamationBlocker({
      proclaimed: current.proclaimedAt !== null,
      publishedCount: questions.length,
      resolvedCount: resolved.length,
    });
    if (blocker) return fail(current.proclaimedAt ? "ALREADY_PROCLAIMED" : "NOT_PROCLAIMABLE", blocker);

    const predictions = await tx
      .select({
        questionId: prediction.questionId,
        userId: prediction.userId,
        valueNumber: prediction.valueNumber,
        optionId: prediction.optionId,
        joker: prediction.joker,
      })
      .from(prediction)
      .where(inArray(prediction.questionId, resolved.map(({ id }) => id)));
    const accounts = await tx.select({ id: user.id, name: user.name, banned: user.banned, createdAt: user.createdAt }).from(user);
    // As on /classement: the accounts created after the end of the season are not part of it.
    const players = seasonPlayers(accounts, seasonEnd(seasons, current), new Set(predictions.map(({ userId }) => userId)));
    const rows = computeStandings({
      questions: resolved,
      predictions,
      players: players.map(({ id, name, banned }) => ({ id, name, banned: banned === true })),
    });

    if (rows.length > 0) {
      await tx.insert(seasonStanding).values(
        rows.map((row) => ({
          seasonId: current.id,
          userId: row.userId,
          rank: row.rank,
          malus: row.malus / 100,
          bullseyes: row.bullseyes,
          meanError: row.meanError,
          questionsPlayed: row.questionsPlayed,
          nameSnapshot: row.name,
        })),
      );
    }
    await tx.update(season).set({ proclaimedAt: now }).where(eq(season.id, current.id));
    return ok({ seasonId: current.id, standings: rows.length });
  });
}
