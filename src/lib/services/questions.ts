import { and, asc, count, eq, gt, inArray, max } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/lib/db/client";
import { category, prediction, question, questionExtension, questionOption } from "@/lib/db/schema";
import { formatDateTime, formatNumber } from "@/lib/format";
import { COEFFICIENTS } from "@/lib/game/constants";
import { parseNumberInput } from "@/lib/game/number-input";
import { type QuestionStatus, questionStatus } from "@/lib/game/question-status";
import { seasonAt } from "@/lib/game/time";
import {
  createQuestionSchema,
  dateErrors,
  kindOf,
  localDateTimeSchema,
  QUESTION_MESSAGES,
  type QuestionShape,
  shapeOf,
  updateQuestionSchema,
} from "@/lib/validation/question";
import {
  type Actor,
  authorize,
  ERROR_MESSAGES,
  type ErrorCode,
  fail,
  type Failure,
  fieldErrorsOf,
  isFailure,
  ok,
  type Result,
} from "./result";
import { seasonsForQuestions } from "./seasons";

// Questions of the back office (architecture §5.11, §7.3). Statuses are computed from the dates
// (§5.2): nothing is written at opening or closing time. The season of a question is the one of
// its closing date among the seasons created by the admin (§5.1), read before the question is
// locked (lock order of services/seasons.ts).

type QuestionRow = typeof question.$inferSelect;

const NOT_FOUND = "Cette question n'existe pas.";
const notFound = () => fail("NOT_FOUND", NOT_FOUND);

// ---------------------------------------------------------------------------------------------
// Editing rules (§5.11)

/** What may still change, given the status and whether predictions exist; null means free. */
export type EditRules = {
  /** Type, title, description, unit, answers, malus of a wrong answer, source, coefficient. */
  content: ErrorCode | null;
  /** Category, help and expected result date: locked only once cancelled. */
  other: ErrorCode | null;
  opensAt: ErrorCode | null;
  closesAt: ErrorCode | null;
  /** With predictions, the closing may only move later (and stay in the same season). */
  closesLaterOnly: boolean;
};

export function editRules(status: QuestionStatus, predictionCount: number): EditRules {
  if (status === "cancelled") {
    const code = "QUESTION_CANCELLED";
    return { content: code, other: code, opensAt: code, closesAt: code, closesLaterOnly: false };
  }
  if (status === "closed" || status === "resolved") {
    const code = "QUESTION_CLOSED";
    return { content: code, other: null, opensAt: code, closesAt: code, closesLaterOnly: false };
  }
  if (predictionCount > 0) {
    // Predictions exist only once the question has opened.
    const code = "QUESTION_LOCKED";
    return { content: code, other: null, opensAt: code, closesAt: null, closesLaterOnly: true };
  }
  return { content: null, other: null, opensAt: null, closesAt: null, closesLaterOnly: false };
}

/**
 * Why a question cannot be published (§5.11), or an empty list. `proclaimedSeasonIds`: a question
 * that would close in a proclaimed season would never count (decision of 30/09/2026).
 */
export function publicationProblems(
  row: Pick<QuestionRow, "type" | "opensAt" | "closesAt" | "expectedResultAt" | "coefficient" | "seasonId" | "wrongAnswerMalus">,
  optionLabels: readonly string[],
  now: Date,
  proclaimedSeasonIds: ReadonlySet<number> = new Set(),
): string[] {
  const problems: string[] = [];
  if (!row.opensAt) problems.push("Il manque la date d'ouverture.");
  if (!row.closesAt) problems.push("Il manque la date de clôture.");
  if (row.opensAt && row.closesAt && row.opensAt >= row.closesAt) problems.push(QUESTION_MESSAGES.closesBeforeOpens);
  if (row.closesAt && row.closesAt <= now) problems.push("La clôture est déjà passée.");
  if (row.closesAt && row.seasonId === null) problems.push(ERROR_MESSAGES.NO_SEASON);
  if (row.seasonId !== null && proclaimedSeasonIds.has(row.seasonId)) problems.push(ERROR_MESSAGES.CLOSING_IN_PROCLAIMED_SEASON);
  if (row.closesAt && row.expectedResultAt && row.expectedResultAt < row.closesAt) {
    problems.push(QUESTION_MESSAGES.resultBeforeCloses);
  }
  if (!(COEFFICIENTS as readonly number[]).includes(row.coefficient)) problems.push(QUESTION_MESSAGES.coefficient);
  if (row.type === "choice") {
    // The database guarantees the malus of a wrong answer of a choice question.
    const shape = shapeOf("choice", null, optionLabels, row.wrongAnswerMalus);
    if (!shape.ok) problems.push(shape.message);
  }
  return problems;
}

// ---------------------------------------------------------------------------------------------
// Shared reads (always inside the caller's transaction)

async function lockQuestion(db: Database, questionId: number): Promise<QuestionRow | undefined> {
  const [row] = await db.select().from(question).where(eq(question.id, questionId)).for("update");
  return row;
}

async function optionsOf(db: Database, questionId: number) {
  return db
    .select({ id: questionOption.id, label: questionOption.label })
    .from(questionOption)
    .where(eq(questionOption.questionId, questionId))
    .orderBy(asc(questionOption.position));
}

async function predictionCounts(db: Database, questionIds: number[]): Promise<Map<number, number>> {
  if (questionIds.length === 0) return new Map();
  const rows = await db
    .select({ questionId: prediction.questionId, n: count() })
    .from(prediction)
    .where(inArray(prediction.questionId, questionIds))
    .groupBy(prediction.questionId);
  return new Map(rows.map(({ questionId, n }) => [questionId, n]));
}

/** The category exists and, unless it is the one the question already has, is not archived. */
async function categoryProblem(db: Database, categoryId: number, currentId?: number): Promise<Failure | null> {
  const [row] = await db.select().from(category).where(eq(category.id, categoryId));
  if (!row) return fail("INVALID_INPUT", undefined, { categoryId: QUESTION_MESSAGES.category });
  if (row.archivedAt && row.id !== currentId) {
    return fail("CATEGORY_ARCHIVED", undefined, { categoryId: ERROR_MESSAGES.CATEGORY_ARCHIVED });
  }
  return null;
}

async function replaceOptions(db: Database, questionId: number, labels: readonly string[]): Promise<void> {
  await db.delete(questionOption).where(eq(questionOption.questionId, questionId));
  if (labels.length > 0) {
    await db.insert(questionOption).values(labels.map((label, index) => ({ questionId, label, position: index + 1 })));
  }
}

/** Seasons whose final standings are proclaimed: no question may enter them any more. */
function proclaimedIds(seasons: readonly { id: number; proclaimedAt: Date | null }[]): Set<number> {
  return new Set(seasons.filter(({ proclaimedAt }) => proclaimedAt !== null).map(({ id }) => id));
}

const MINUTE_MS = 60_000;
/**
 * Dates are typed to the minute (`datetime-local`), while a stored date may carry seconds (seed,
 * scripts): a date sent back unchanged from the form is the same minute.
 */
const sameMinute = (a: Date | null, b: Date | null) =>
  (a === null ? null : Math.floor(a.getTime() / MINUTE_MS)) === (b === null ? null : Math.floor(b.getTime() / MINUTE_MS));
const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((item, i) => item === b[i]);

// ---------------------------------------------------------------------------------------------
// Create and update

/**
 * New draft: category, kind, title and source are required, and the malus of a wrong answer for a
 * choice (v1.2); dates are optional (§5.11).
 */
export async function createQuestion(
  db: Database,
  actor: Actor | null,
  input: unknown,
  now: Date,
): Promise<Result<{ id: number }>> {
  const me = authorize(actor, { admin: true });
  if (isFailure(me)) return me;
  const parsed = createQuestionSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT", undefined, fieldErrorsOf(parsed.error.issues));
  const data = parsed.data;

  const shaped = shapeOf(data.kind, data.unit, data.options, data.wrongAnswerMalus);
  if (!shaped.ok) return fail("INVALID_INPUT", undefined, { [shaped.field]: shaped.message });
  const dates = { opensAt: data.opensAt ?? null, closesAt: data.closesAt ?? null, expectedResultAt: data.expectedResultAt ?? null };
  const errors = dateErrors(dates);
  if (Object.keys(errors).length > 0) return fail("INVALID_INPUT", undefined, errors);

  return db.transaction(async (tx) => {
    const seasons = await seasonsForQuestions(tx);
    const problem = await categoryProblem(tx, data.categoryId);
    if (problem) return problem;
    const { type, unit, options, wrongAnswerMalus } = shaped.shape;
    const [row] = await tx
      .insert(question)
      .values({
        // A draft may close where no season exists yet: it cannot be published until one does.
        seasonId: dates.closesAt ? (seasonAt(seasons, dates.closesAt)?.id ?? null) : null,
        categoryId: data.categoryId,
        type,
        wrongAnswerMalus,
        title: data.title,
        description: data.description ?? null,
        unit,
        source: data.source,
        helpBiUrl: data.helpBiUrl ?? null,
        helpLastYear: data.helpLastYear ?? null,
        helpHint: data.helpHint ?? null,
        ...dates,
        coefficient: data.coefficient ?? 1,
        status: "draft",
        createdBy: me.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: question.id });
    await replaceOptions(tx, row.id, options);
    return ok({ id: row.id });
  });
}

/**
 * Changes the fields present in `input`; absent fields keep their value. A field locked by §5.11
 * may be sent unchanged, but not changed: the refusal says to cancel and create a new question.
 */
export async function updateQuestion(
  db: Database,
  actor: Actor | null,
  input: unknown,
  now: Date,
): Promise<Result<{ id: number }>> {
  const me = authorize(actor, { admin: true });
  if (isFailure(me)) return me;
  const parsed = updateQuestionSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT", undefined, fieldErrorsOf(parsed.error.issues));
  const patch = parsed.data;

  return db.transaction(async (tx) => {
    const seasons = await seasonsForQuestions(tx);
    const current = await lockQuestion(tx, patch.questionId);
    if (!current) return notFound();
    const currentOptions = (await optionsOf(tx, current.id)).map(({ label }) => label);
    const predictions = (await predictionCounts(tx, [current.id])).get(current.id) ?? 0;
    const rules = editRules(questionStatus(current, now), predictions);

    let shape: QuestionShape = {
      type: current.type,
      unit: current.unit,
      options: currentOptions,
      wrongAnswerMalus: current.wrongAnswerMalus,
    };
    if (patch.kind !== undefined || patch.options !== undefined || patch.unit !== undefined || patch.wrongAnswerMalus !== undefined) {
      // A number switched to a choice needs the malus of a wrong answer; a choice switched to a number loses it.
      const shaped = shapeOf(
        patch.kind ?? kindOf(current, currentOptions),
        patch.unit !== undefined ? patch.unit : current.unit,
        patch.options ?? currentOptions,
        patch.wrongAnswerMalus !== undefined ? patch.wrongAnswerMalus : current.wrongAnswerMalus,
      );
      if (!shaped.ok) return fail("INVALID_INPUT", undefined, { [shaped.field]: shaped.message });
      shape = shaped.shape;
    }
    const pick = <K extends keyof typeof patch & keyof QuestionRow>(key: K) =>
      (patch[key] !== undefined ? patch[key] : current[key]) as QuestionRow[K];
    // A date sent back in the same minute keeps its exact stored value.
    const pickDate = (key: "opensAt" | "closesAt" | "expectedResultAt") => {
      const sent = pick(key);
      return sameMinute(sent, current[key]) ? current[key] : sent;
    };
    const next = {
      categoryId: pick("categoryId"),
      type: shape.type,
      wrongAnswerMalus: shape.wrongAnswerMalus,
      title: pick("title"),
      description: pick("description"),
      unit: shape.unit,
      source: pick("source"),
      coefficient: pick("coefficient"),
      helpBiUrl: pick("helpBiUrl"),
      helpLastYear: pick("helpLastYear"),
      helpHint: pick("helpHint"),
      opensAt: pickDate("opensAt"),
      closesAt: pickDate("closesAt"),
      expectedResultAt: pickDate("expectedResultAt"),
    };

    const optionsChanged = !sameList(shape.options, currentOptions);
    const contentChanged =
      optionsChanged ||
      (["type", "wrongAnswerMalus", "title", "description", "unit", "source", "coefficient"] as const).some(
        (key) => next[key] !== current[key],
      );
    const otherChanged =
      (["categoryId", "helpBiUrl", "helpLastYear", "helpHint"] as const).some((key) => next[key] !== current[key]) ||
      next.expectedResultAt !== current.expectedResultAt;
    const opensChanged = next.opensAt !== current.opensAt;
    const closesChanged = next.closesAt !== current.closesAt;
    const seasonId = closesChanged ? (next.closesAt ? (seasonAt(seasons, next.closesAt)?.id ?? null) : null) : current.seasonId;
    if (!contentChanged && !otherChanged && !opensChanged && !closesChanged) return ok({ id: current.id });

    // Locks (§5.11).
    if (contentChanged && rules.content) return fail(rules.content);
    if (otherChanged && rules.other) return fail(rules.other);
    if (opensChanged && rules.opensAt) return fail(rules.opensAt, undefined, { opensAt: ERROR_MESSAGES[rules.opensAt] });
    if (closesChanged && rules.closesAt) return fail(rules.closesAt, undefined, { closesAt: ERROR_MESSAGES[rules.closesAt] });
    if (closesChanged && rules.closesLaterOnly) {
      const later = next.closesAt !== null && current.closesAt !== null && next.closesAt > current.closesAt;
      if (!later) {
        const message = "Des pronos existent : la clôture peut seulement être repoussée.";
        return fail("QUESTION_LOCKED", message, { closesAt: message });
      }
      // A joker counts in the season of its question: a question with predictions keeps its season.
      if (seasonId !== current.seasonId) {
        const message = "Des pronos existent : la clôture ne peut pas passer sur une autre saison.";
        return fail("QUESTION_LOCKED", message, { closesAt: message });
      }
    }

    // Consistency of the resulting question.
    if (next.categoryId !== current.categoryId) {
      const problem = await categoryProblem(tx, next.categoryId, current.categoryId);
      if (problem) return problem;
    }
    const errors = dateErrors(next);
    if (current.status === "published") {
      if (!next.opensAt) errors.opensAt = "Une question publiée garde sa date d'ouverture.";
      if (!next.closesAt) errors.closesAt = "Une question publiée garde sa date de clôture.";
      else if (closesChanged && next.closesAt <= now) errors.closesAt ??= QUESTION_MESSAGES.closesInPast;
      else if (seasonId === null) errors.closesAt ??= ERROR_MESSAGES.NO_SEASON;
      else if (closesChanged && proclaimedIds(seasons).has(seasonId)) errors.closesAt ??= ERROR_MESSAGES.CLOSING_IN_PROCLAIMED_SEASON;
    }
    if (Object.keys(errors).length > 0) return fail("INVALID_INPUT", undefined, errors);

    await tx
      .update(question)
      .set({ ...next, seasonId, updatedAt: now })
      .where(eq(question.id, current.id));
    if (optionsChanged) await replaceOptions(tx, current.id, shape.options);
    return ok({ id: current.id });
  });
}

// ---------------------------------------------------------------------------------------------
// Selections: publication and dates in series

export type QuestionRef = { id: number; title: string };
export type BatchReport = {
  succeeded: QuestionRef[];
  /** Already in the requested state (publication only). */
  unchanged: QuestionRef[];
  failed: (QuestionRef & { reasons: string[] })[];
};

const selectionSchema = z
  .array(z.coerce.number().int().positive(), "Sélectionne au moins une question.")
  .min(1, "Sélectionne au moins une question.")
  .max(200, "Sélectionne 200 questions au plus.")
  .transform((ids) => [...new Set(ids)]);

async function lockSelection(db: Database, ids: number[]): Promise<Map<number, QuestionRow>> {
  const rows = await db.select().from(question).where(inArray(question.id, ids)).for("update");
  return new Map(rows.map((row) => [row.id, row]));
}

/** Publishes each selected draft that passes the checks of §5.11; the report says why the others failed. */
export async function publishQuestions(
  db: Database,
  actor: Actor | null,
  input: unknown,
  now: Date,
): Promise<Result<BatchReport>> {
  const me = authorize(actor, { admin: true });
  if (isFailure(me)) return me;
  const parsed = z.object({ questionIds: selectionSchema }).safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT", undefined, fieldErrorsOf(parsed.error.issues));
  const ids = parsed.data.questionIds;

  return db.transaction(async (tx) => {
    // The seasons before the questions (lock order of services/seasons.ts): no proclamation meanwhile.
    const proclaimed = proclaimedIds(await seasonsForQuestions(tx));
    const rows = await lockSelection(tx, ids);
    const report: BatchReport = { succeeded: [], unchanged: [], failed: [] };
    for (const id of ids) {
      const row = rows.get(id);
      if (!row) {
        report.failed.push({ id, title: `Question ${id}`, reasons: [NOT_FOUND] });
        continue;
      }
      const ref = { id, title: row.title };
      if (row.status === "published") {
        report.unchanged.push(ref);
        continue;
      }
      if (row.status === "cancelled") {
        report.failed.push({ ...ref, reasons: ["Question annulée."] });
        continue;
      }
      const labels = (await optionsOf(tx, id)).map(({ label }) => label);
      const problems = publicationProblems(row, labels, now, proclaimed);
      if (problems.length > 0) {
        report.failed.push({ ...ref, reasons: problems });
        continue;
      }
      await tx.update(question).set({ status: "published", updatedAt: now }).where(eq(question.id, id));
      report.succeeded.push(ref);
    }
    return ok(report);
  });
}

const datesInput = z.object({
  questionIds: selectionSchema,
  opensAt: localDateTimeSchema,
  closesAt: localDateTimeSchema,
  /** Empty: each question keeps its own expected result date. */
  expectedResultAt: localDateTimeSchema.optional(),
});

/**
 * Dates in series (§5.11): the same opening, closing and, if given, expected result date on each
 * selected question without predictions. The questions stay as they are (draft or published); a
 * published question needs a season for the new closing date.
 */
export async function setQuestionDates(
  db: Database,
  actor: Actor | null,
  input: unknown,
  now: Date,
): Promise<Result<BatchReport>> {
  const me = authorize(actor, { admin: true });
  if (isFailure(me)) return me;
  const parsed = datesInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT", undefined, fieldErrorsOf(parsed.error.issues));
  const { questionIds: ids, opensAt, closesAt, expectedResultAt = null } = parsed.data;

  const errors: Record<string, string> = dateErrors({ opensAt, closesAt, expectedResultAt });
  if (!opensAt) errors.opensAt = "Indique la date d'ouverture.";
  if (!closesAt) errors.closesAt = "Indique la date de clôture.";
  else if (closesAt <= now) errors.closesAt ??= QUESTION_MESSAGES.closesInPast;
  if (!opensAt || !closesAt || Object.keys(errors).length > 0) return fail("INVALID_INPUT", undefined, errors);

  return db.transaction(async (tx) => {
    const seasons = await seasonsForQuestions(tx);
    const seasonId = seasonAt(seasons, closesAt)?.id ?? null;
    const inProclaimedSeason = seasonId !== null && proclaimedIds(seasons).has(seasonId);
    const rows = await lockSelection(tx, ids);
    const predictions = await predictionCounts(tx, ids);
    const report: BatchReport = { succeeded: [], unchanged: [], failed: [] };
    for (const id of ids) {
      const row = rows.get(id);
      if (!row) {
        report.failed.push({ id, title: `Question ${id}`, reasons: [NOT_FOUND] });
        continue;
      }
      const ref = { id, title: row.title };
      const status = questionStatus(row, now);
      const expected = expectedResultAt ?? row.expectedResultAt;
      let reason: string | null = null;
      if (status === "cancelled") reason = "Question annulée.";
      else if (status === "closed" || status === "resolved") reason = "Question déjà clôturée.";
      else if ((predictions.get(id) ?? 0) > 0) reason = "Des pronos existent : change ses dates depuis la page de la question.";
      else if (expected && expected < closesAt) reason = "Sa date de résultat prévue est avant la nouvelle clôture.";
      else if (row.status === "published" && seasonId === null) reason = ERROR_MESSAGES.NO_SEASON;
      else if (row.status === "published" && inProclaimedSeason) reason = ERROR_MESSAGES.CLOSING_IN_PROCLAIMED_SEASON;
      if (reason) {
        report.failed.push({ ...ref, reasons: [reason] });
        continue;
      }
      await tx
        .update(question)
        .set({ opensAt, closesAt, expectedResultAt: expected, seasonId, updatedAt: now })
        .where(eq(question.id, id));
      report.succeeded.push(ref);
    }
    return ok(report);
  });
}

// ---------------------------------------------------------------------------------------------
// One question: duplicate, cancel, delete, resolve

const idInput = z.object({ questionId: z.coerce.number().int().positive() });

/** The result as text: "2 450 candidatures", or the label of the right answer. */
function formattedResult(row: QuestionRow, options: { id: number; label: string }[]): string | null {
  if (row.type === "number") {
    if (row.resultNumber === null) return null;
    return row.unit ? `${formatNumber(row.resultNumber)} ${row.unit}` : formatNumber(row.resultNumber);
  }
  return options.find(({ id }) => id === row.resultOptionId)?.label ?? null;
}

/**
 * Copy in draft, without dates (§5.11): same category, kind, title, description, unit, source,
 * help, coefficient, answers and malus of a wrong answer; not the extensions. When the original is
 * resolved, its result becomes "last year's value".
 */
export async function duplicateQuestion(
  db: Database,
  actor: Actor | null,
  input: unknown,
  now: Date,
): Promise<Result<{ id: number }>> {
  const me = authorize(actor, { admin: true });
  if (isFailure(me)) return me;
  const parsed = idInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");

  return db.transaction(async (tx) => {
    const [original] = await tx.select().from(question).where(eq(question.id, parsed.data.questionId));
    if (!original) return notFound();
    const options = await optionsOf(tx, original.id);
    const lastYear = questionStatus(original, now) === "resolved" ? formattedResult(original, options) : null;
    const [copy] = await tx
      .insert(question)
      .values({
        categoryId: original.categoryId,
        type: original.type,
        wrongAnswerMalus: original.wrongAnswerMalus,
        title: original.title,
        description: original.description,
        unit: original.unit,
        source: original.source,
        helpBiUrl: original.helpBiUrl,
        helpLastYear: lastYear ?? original.helpLastYear,
        helpHint: original.helpHint,
        coefficient: original.coefficient,
        status: "draft",
        duplicatedFromId: original.id,
        createdBy: me.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: question.id });
    await replaceOptions(tx, copy.id, options.map(({ label }) => label));
    return ok({ id: copy.id });
  });
}

/**
 * Cancels a published question, whatever its status (§5.11): no one takes a malus on it, absent
 * players included, and its jokers are given back, since jokers are only counted on questions that
 * are not cancelled. Its extensions are of no use any more, and stay. A draft is deleted instead.
 */
export async function cancelQuestion(db: Database, actor: Actor | null, input: unknown, now: Date): Promise<Result> {
  const me = authorize(actor, { admin: true });
  if (isFailure(me)) return me;
  const parsed = idInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");

  return db.transaction(async (tx) => {
    const row = await lockQuestion(tx, parsed.data.questionId);
    if (!row) return notFound();
    if (row.status === "draft") return fail("NOT_CANCELLABLE");
    if (row.status === "cancelled") return fail("ALREADY_CANCELLED");
    await tx.update(question).set({ status: "cancelled", cancelledAt: now, updatedAt: now }).where(eq(question.id, row.id));
    return ok();
  });
}

/** Deletes a draft without predictions; any other question is cancelled instead. */
export async function deleteDraftQuestion(db: Database, actor: Actor | null, input: unknown): Promise<Result> {
  const me = authorize(actor, { admin: true });
  if (isFailure(me)) return me;
  const parsed = idInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");

  return db.transaction(async (tx) => {
    const row = await lockQuestion(tx, parsed.data.questionId);
    if (!row) return notFound();
    const predictions = (await predictionCounts(tx, [row.id])).get(row.id) ?? 0;
    if (row.status !== "draft" || predictions > 0) return fail("NOT_DELETABLE");
    // Copies made from this draft forget where they came from.
    await tx.update(question).set({ duplicatedFromId: null }).where(eq(question.duplicatedFromId, row.id));
    await tx.delete(question).where(eq(question.id, row.id));
    return ok();
  });
}

const resolveInput = idInput.extend({
  rawValue: z.string().optional(),
  optionId: z.coerce.number().int().positive().optional(),
});

/**
 * Real value or right answer (§5.11), once the question is closed and no extension runs on it (v1.2,
 * §5.14): the extended player must not answer once the result is known. The first entry sets
 * `resolved_at`; a later different entry is a correction, dated by `corrected_at`. Entering the
 * same result again changes nothing. The question is locked before its extensions are read
 * (FOR UPDATE: it waits for the extension services, which lock it too).
 */
export async function resolveQuestion(
  db: Database,
  actor: Actor | null,
  input: unknown,
  now: Date,
): Promise<Result<{ corrected: boolean; unchanged: boolean }>> {
  const me = authorize(actor, { admin: true });
  if (isFailure(me)) return me;
  const parsed = resolveInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  const { questionId, rawValue, optionId } = parsed.data;

  return db.transaction(async (tx) => {
    const row = await lockQuestion(tx, questionId);
    if (!row) return notFound();
    const status = questionStatus(row, now);
    if (status === "cancelled") return fail("QUESTION_CANCELLED");
    if (status !== "closed" && status !== "resolved") return fail("RESULT_TOO_EARLY");
    const [running] = await tx
      .select({ closesAt: max(questionExtension.closesAt) })
      .from(questionExtension)
      .where(and(eq(questionExtension.questionId, row.id), gt(questionExtension.closesAt, now)));
    if (running?.closesAt) {
      return fail("EXTENSION_RUNNING", `Un joueur a une prolongation jusqu'au ${formatDateTime(running.closesAt, now)} : attends sa fin ou annule-la.`);
    }

    let result: { resultNumber: number | null; resultOptionId: number | null };
    if (row.type === "number") {
      const value = parseNumberInput(rawValue ?? "");
      if (!value.ok) return fail("INVALID_VALUE", value.message, { rawValue: value.message });
      result = { resultNumber: value.value, resultOptionId: null };
    } else {
      const options = await optionsOf(tx, row.id);
      if (optionId === undefined || !options.some(({ id }) => id === optionId)) {
        return fail("INVALID_OPTION", undefined, { optionId: ERROR_MESSAGES.INVALID_OPTION });
      }
      result = { resultNumber: null, resultOptionId: optionId };
    }

    const sameNumber =
      row.resultNumber !== null &&
      result.resultNumber !== null &&
      Math.round(row.resultNumber * 100) === Math.round(result.resultNumber * 100);
    const unchanged = row.resolvedAt !== null && (row.type === "number" ? sameNumber : row.resultOptionId === result.resultOptionId);
    if (unchanged) return ok({ corrected: false, unchanged: true });

    const corrected = row.resolvedAt !== null;
    await tx
      .update(question)
      .set({ ...result, ...(corrected ? { correctedAt: now } : { resolvedAt: now }), updatedAt: now })
      .where(eq(question.id, row.id));
    return ok({ corrected, unchanged: false });
  });
}
