import "server-only";
import { and, asc, count, eq, inArray, max, ne, notInArray, type SQL } from "drizzle-orm";
import type { Viewer } from "@/lib/auth/session";
import { type AvatarKey, isAvatarKey } from "@/lib/avatars";
import type { Database } from "@/lib/db/client";
import { category, prediction, predictionEvent, question, questionExtension, questionOption, season, user } from "@/lib/db/schema";
import { JOKERS_PER_SEASON } from "@/lib/game/constants";
import { type PredictionState, predictionState } from "@/lib/game/prediction-state";
import { type QuestionStatus, questionStatus, questionStatusFor } from "@/lib/game/question-status";
import { isNew, newReference } from "@/lib/game/visits";
import { kindOf, type QuestionKind } from "@/lib/validation/question";
import { getPlayerResults } from "./badges";

// Reads of the questions and predictions (architecture §6.6, §7.4). Before the closing, the others'
// values never leave the server, not even for the admin, who plays too: a player only reads their
// own prediction, and the admin only receives states (to do, saved, validated), read by queries
// that do not select any value. getQuestionPredictionsForViewer is the only read of the others'
// predictions for display; the other reads only select the viewer's own rows, except to compute
// the viewer's malus on a resolved question, whose values are public.
//
// v1.2: the status that counts is the one of the question for the viewer (`questionStatusFor`): an
// extension keeps a closed question open for one player (§5.14). Until the result, the predictions
// of a closed question are only shown to whoever predicted it, and the prediction of a player whose
// extension runs stays hidden from the others.

type ViewerRole = Pick<Viewer, "id" | "role">;
/** The "Nouveau" badge needs the visit dates of the viewer (§5.9). */
type PlayerViewer = Pick<Viewer, "id" | "role" | "lastSeenAt" | "previousVisitAt">;

export type PredictionAnswer = { valueNumber: number | null; optionId: number | null; joker: boolean };

export type PredictionView = {
  predictionId: number;
  userId: string;
  name: string;
  avatar: AvatarKey;
  /** Disabled account: shown with "(inactif)". */
  inactive: boolean;
  state: PredictionState;
  validatedAt: Date | null;
  /** The answer, only when the viewer may see it (§6.6); otherwise null. */
  answer: PredictionAnswer | null;
};

const byName = new Intl.Collator("fr", { sensitivity: "base" });

function avatarOf(value: string | null): AvatarKey {
  return value && isAvatarKey(value) ? value : "maillot-bleu-uni";
}

const PLAYER_COLUMNS = {
  predictionId: prediction.id,
  userId: prediction.userId,
  name: user.name,
  avatar: user.avatar,
  banned: user.banned,
};

/** State of each prediction of these questions, without any value or joker (admin follow-up). */
export async function getPredictionStates(
  db: Database,
  questionIds: number[],
): Promise<{ questionId: number; userId: string; validatedAt: Date | null }[]> {
  if (questionIds.length === 0) return [];
  return db
    .select({ questionId: prediction.questionId, userId: prediction.userId, validatedAt: prediction.validatedAt })
    .from(prediction)
    .where(inArray(prediction.questionId, questionIds));
}

/** Deadlines of the extensions of these questions, by question then player (§5.14). */
export async function getExtensions(db: Database, questionIds: number[]): Promise<Map<number, Map<string, Date>>> {
  const map = new Map<number, Map<string, Date>>();
  if (questionIds.length === 0) return map;
  const rows = await db
    .select({ questionId: questionExtension.questionId, userId: questionExtension.userId, closesAt: questionExtension.closesAt })
    .from(questionExtension)
    .where(inArray(questionExtension.questionId, questionIds));
  for (const { questionId, userId, closesAt } of rows) {
    if (!map.has(questionId)) map.set(questionId, new Map());
    map.get(questionId)!.set(userId, closesAt);
  }
  return map;
}

/** The extension of one player, in the shape `questionStatusFor` takes. */
export function extensionOf(extensions: Map<string, Date> | undefined, userId: string): { closesAt: Date } | null {
  const closesAt = extensions?.get(userId);
  return closesAt ? { closesAt } : null;
}

/** Players whose extension still runs on a question that is open or closed: their prediction is hidden (§6.6). */
export function runningExtensions(
  q: { status: "draft" | "published" | "cancelled"; opensAt: Date | null; closesAt: Date | null; resolvedAt: Date | null },
  extensions: Map<string, Date> | undefined,
  now: Date,
): { userId: string; closesAt: Date }[] {
  const status = questionStatus(q, now);
  if (status !== "open" && status !== "closed") return [];
  return [...(extensions ?? new Map<string, Date>())]
    .filter(([, closesAt]) => now < closesAt)
    .map(([userId, closesAt]) => ({ userId, closesAt }));
}

/**
 * Predictions of a question as `viewer` may see them at `now` (§6.6, v1.2), with the status of the
 * question for the viewer (an extension keeps it open for them):
 * - draft or scheduled: null for a player (the question does not exist for them), none for the admin;
 * - open for the viewer: a player only gets their own prediction; the admin gets every state, without values;
 * - closed for the viewer, who has a prediction: every answer, with jokers and names, except those of
 *   the players whose extension runs (the admin gets their state only);
 * - closed for the viewer, who has no prediction: nothing for a player ("Les pronos s'afficheront au
 *   résultat"); states only for the admin;
 * - resolved: everyone gets every answer;
 * - cancelled: nothing for a player; states only for the admin.
 * Null as well when the question does not exist.
 */
export async function getQuestionPredictionsForViewer(
  db: Database,
  viewer: ViewerRole,
  questionId: number,
  now: Date,
): Promise<PredictionView[] | null> {
  const [row] = await db
    .select({ status: question.status, opensAt: question.opensAt, closesAt: question.closesAt, resolvedAt: question.resolvedAt })
    .from(question)
    .where(eq(question.id, questionId));
  if (!row) return null;
  const status: QuestionStatus = questionStatus(row, now);
  const isAdmin = viewer.role === "admin";
  if (status === "draft" || status === "scheduled") return isAdmin ? [] : null;

  const extensions = (await getExtensions(db, [questionId])).get(questionId);
  const statusOf = (userId: string) => questionStatusFor(row, extensionOf(extensions, userId), now);
  const viewerStatus = statusOf(viewer.id);
  const ofQuestion = eq(prediction.questionId, questionId);

  /** Rows with their answer. */
  const withValues = async (where: SQL | undefined): Promise<PredictionView[]> => {
    const rows = await db
      .select({
        ...PLAYER_COLUMNS,
        validatedAt: prediction.validatedAt,
        valueNumber: prediction.valueNumber,
        optionId: prediction.optionId,
        joker: prediction.joker,
      })
      .from(prediction)
      .innerJoin(user, eq(user.id, prediction.userId))
      .where(and(ofQuestion, where));
    return rows.map((r) => ({
      predictionId: r.predictionId,
      userId: r.userId,
      name: r.name,
      avatar: avatarOf(r.avatar),
      inactive: r.banned === true,
      state: predictionState(r, statusOf(r.userId)),
      validatedAt: r.validatedAt,
      answer: { valueNumber: r.valueNumber, optionId: r.optionId, joker: r.joker },
    }));
  };
  /** States only: no value column is selected. */
  const statesOnly = async (where: SQL | undefined): Promise<PredictionView[]> => {
    const rows = await db
      .select({ ...PLAYER_COLUMNS, validatedAt: prediction.validatedAt })
      .from(prediction)
      .innerJoin(user, eq(user.id, prediction.userId))
      .where(and(ofQuestion, where));
    return rows.map((r) => ({
      predictionId: r.predictionId,
      userId: r.userId,
      name: r.name,
      avatar: avatarOf(r.avatar),
      inactive: r.banned === true,
      state: predictionState(r, statusOf(r.userId)),
      validatedAt: r.validatedAt,
      answer: null,
    }));
  };

  let views: PredictionView[];
  if (status === "resolved") {
    views = await withValues(undefined);
  } else if (status === "cancelled") {
    // Player: the predictions are not shown (§8.3).
    views = isAdmin ? await statesOnly(undefined) : [];
  } else if (viewerStatus === "open") {
    // Open for the viewer (open question, or their own extension runs): a player only reads their own row.
    views = isAdmin ? await statesOnly(undefined) : await withValues(eq(prediction.userId, viewer.id));
  } else {
    const [own] = await db
      .select({ id: prediction.id })
      .from(prediction)
      .where(and(ofQuestion, eq(prediction.userId, viewer.id)));
    if (!own) {
      // No prediction: the others' are shown at the result (decision of 02/10/2026).
      views = isAdmin ? await statesOnly(undefined) : [];
    } else {
      const hidden = runningExtensions(row, extensions, now).map(({ userId }) => userId);
      views = await withValues(hidden.length > 0 ? notInArray(prediction.userId, hidden) : undefined);
      if (isAdmin && hidden.length > 0) views.push(...(await statesOnly(inArray(prediction.userId, hidden))));
    }
  }
  return views.sort((a, b) => byName.compare(a.name, b.name));
}

// ---------------------------------------------------------------------------------------------
// The player's side (§8.3 accueil, /pronos, /questions, /questions/[id])

type QuestionRow = typeof question.$inferSelect;
type OptionView = { id: number; label: string };

/** The viewer's own prediction. */
export type MyPrediction = {
  valueNumber: number | null;
  optionId: number | null;
  joker: boolean;
  validatedAt: Date | null;
  /** Latest time the answer was saved. */
  savedAt: Date;
};

/** A question as a player sees it, with their own prediction only. */
export type PlayerQuestion = {
  id: number;
  title: string;
  description: string | null;
  categoryName: string;
  kind: QuestionKind;
  type: "number" | "choice";
  unit: string | null;
  /** Malus of a wrong answer, for a choice (v1.2); null for a number. */
  wrongAnswerMalus: number | null;
  source: string;
  coefficient: number;
  opensAt: Date;
  closesAt: Date;
  expectedResultAt: Date | null;
  /** The viewer's own deadline while their extension runs (§5.14), else null. */
  extendedUntil: Date | null;
  /** When the question closes for the viewer: their extension's deadline, or the closing. */
  deadline: Date;
  options: OptionView[];
  help: { biUrl: string | null; lastYear: string | null; hint: string | null };
  /** Opened since the viewer's last visit (§5.9); an extended question shows "Prolongée pour toi" instead. */
  isNew: boolean;
  mine: MyPrediction | null;
  state: PredictionState;
  /**
   * Jokers the viewer has left in the season of the question, this question's own included (§5.4);
   * null when the season does not allow jokers (v1.2).
   */
  jokersLeft: number | null;
};

async function questionRows(db: Database, where: SQL | undefined) {
  return db
    .select({ question, categoryName: category.name })
    .from(question)
    .innerJoin(category, eq(category.id, question.categoryId))
    .where(where);
}

async function optionsOf(db: Database, questionIds: number[]): Promise<Map<number, OptionView[]>> {
  const map = new Map<number, OptionView[]>();
  if (questionIds.length === 0) return map;
  const rows = await db
    .select({ questionId: questionOption.questionId, id: questionOption.id, label: questionOption.label })
    .from(questionOption)
    .where(inArray(questionOption.questionId, questionIds))
    .orderBy(asc(questionOption.questionId), asc(questionOption.position));
  for (const { questionId, id, label } of rows) map.set(questionId, [...(map.get(questionId) ?? []), { id, label }]);
  return map;
}

/** The viewer's predictions on these questions; no one else's row is read. */
async function myPredictions(db: Database, userId: string, questionIds: number[]): Promise<Map<number, MyPrediction>> {
  const map = new Map<number, MyPrediction>();
  if (questionIds.length === 0) return map;
  const rows = await db
    .select({
      id: prediction.id,
      questionId: prediction.questionId,
      valueNumber: prediction.valueNumber,
      optionId: prediction.optionId,
      joker: prediction.joker,
      validatedAt: prediction.validatedAt,
      updatedAt: prediction.updatedAt,
    })
    .from(prediction)
    .where(and(eq(prediction.userId, userId), inArray(prediction.questionId, questionIds)));
  const saves = await db
    .select({ predictionId: predictionEvent.predictionId, savedAt: max(predictionEvent.createdAt) })
    .from(predictionEvent)
    .where(and(eq(predictionEvent.ownerId, userId), eq(predictionEvent.type, "saved"), inArray(predictionEvent.questionId, questionIds)))
    .groupBy(predictionEvent.predictionId);
  const savedAt = new Map(saves.map((row) => [row.predictionId, row.savedAt]));
  for (const { id, questionId, updatedAt, ...answer } of rows) {
    map.set(questionId, { ...answer, savedAt: savedAt.get(id) ?? updatedAt });
  }
  return map;
}

/** The viewer's own extensions, by question (§5.14). */
async function myExtensions(db: Database, userId: string): Promise<Map<number, Date>> {
  const rows = await db
    .select({ questionId: questionExtension.questionId, closesAt: questionExtension.closesAt })
    .from(questionExtension)
    .where(eq(questionExtension.userId, userId));
  return new Map(rows.map(({ questionId, closesAt }) => [questionId, closesAt]));
}

/** Jokers posed by the viewer, by season, on questions that are not cancelled (§5.4). */
async function jokersBySeason(db: Database, userId: string): Promise<Map<number, number>> {
  const rows = await db
    .select({ seasonId: question.seasonId, n: count() })
    .from(prediction)
    .innerJoin(question, eq(question.id, prediction.questionId))
    .where(and(eq(prediction.userId, userId), eq(prediction.joker, true), ne(question.status, "cancelled")))
    .groupBy(question.seasonId);
  return new Map(rows.flatMap(({ seasonId, n }) => (seasonId === null ? [] : [[seasonId, n] as const])));
}

/** Seasons that do not allow jokers (v1.2, §5.13). */
async function seasonsWithoutJokers(db: Database): Promise<Set<number>> {
  const rows = await db.select({ id: season.id }).from(season).where(eq(season.jokersEnabled, false));
  return new Set(rows.map(({ id }) => id));
}

/**
 * Jokers the viewer has left in a season (the current one on the home page); null when the season
 * does not allow jokers (v1.2). Without a season, the full count.
 */
export async function getJokersLeft(
  db: Database,
  viewer: ViewerRole,
  current: { id: number; jokersEnabled: boolean } | null,
): Promise<number | null> {
  if (current === null) return JOKERS_PER_SEASON;
  if (!current.jokersEnabled) return null;
  return Math.max(0, JOKERS_PER_SEASON - ((await jokersBySeason(db, viewer.id)).get(current.id) ?? 0));
}

type Loaded = {
  rows: { question: QuestionRow; categoryName: string }[];
  options: Map<number, OptionView[]>;
  mine: Map<number, MyPrediction>;
  jokers: Map<number, number>;
  noJokers: Set<number>;
};

async function load(db: Database, viewer: ViewerRole, rows: Loaded["rows"]): Promise<Loaded> {
  const ids = rows.map(({ question: q }) => q.id);
  return {
    rows,
    options: await optionsOf(db, ids),
    mine: await myPredictions(db, viewer.id, ids),
    jokers: await jokersBySeason(db, viewer.id),
    noJokers: await seasonsWithoutJokers(db),
  };
}

function toPlayerQuestion(
  { question: q, categoryName }: Loaded["rows"][number],
  loaded: Loaded,
  status: QuestionStatus,
  extension: Date | null,
  reference: Date | null,
): PlayerQuestion {
  const options = loaded.options.get(q.id) ?? [];
  const mine = loaded.mine.get(q.id) ?? null;
  // The question is open for the viewer thanks to their extension (open questions included: PR10).
  const extendedUntil = status === "open" && extension !== null && extension > q.closesAt! ? extension : null;
  const jokersAllowed = q.seasonId !== null && !loaded.noJokers.has(q.seasonId);
  return {
    id: q.id,
    title: q.title,
    description: q.description,
    categoryName,
    kind: kindOf(q, options.map(({ label }) => label)),
    type: q.type,
    unit: q.unit,
    wrongAnswerMalus: q.wrongAnswerMalus,
    source: q.source,
    coefficient: q.coefficient,
    // Visible questions are published: they always have both dates.
    opensAt: q.opensAt!,
    closesAt: q.closesAt!,
    expectedResultAt: q.expectedResultAt,
    extendedUntil,
    deadline: extendedUntil ?? q.closesAt!,
    options,
    help: { biUrl: q.helpBiUrl, lastYear: q.helpLastYear, hint: q.helpHint },
    isNew: status === "open" && extendedUntil === null && isNew(q.opensAt!, reference),
    mine,
    state: predictionState(mine, status),
    jokersLeft: jokersAllowed ? Math.max(0, JOKERS_PER_SEASON - (loaded.jokers.get(q.seasonId!) ?? 0)) : null,
  };
}

const byDeadline = (a: PlayerQuestion, b: PlayerQuestion) => a.deadline.getTime() - b.deadline.getTime() || a.id - b.id;

/**
 * The questions open for the viewer, their own extensions included, closing soonest first (at the
 * viewer's deadline), with the viewer's own prediction (§8.3 accueil, /pronos).
 */
export async function getOpenQuestionsForViewer(db: Database, viewer: PlayerViewer, now: Date): Promise<PlayerQuestion[]> {
  const extensions = await myExtensions(db, viewer.id);
  const rows = (await questionRows(db, eq(question.status, "published"))).filter(
    ({ question: q }) => playerStatus(q, extensions.get(q.id) ?? null, now) === "open",
  );
  const loaded = await load(db, viewer, rows);
  const reference = newReference(viewer, now);
  return rows.map((row) => toPlayerQuestion(row, loaded, "open", extensions.get(row.question.id) ?? null, reference)).sort(byDeadline);
}

/**
 * A cancelled question is shown to players only if it had opened when it was cancelled; one
 * cancelled while scheduled was never seen, and stays hidden like a scheduled one (decision of
 * 30/09/2026).
 */
function cancelledAfterOpening(q: QuestionRow, now: Date): boolean {
  return q.opensAt !== null && (q.cancelledAt ?? now) >= q.opensAt;
}

/**
 * Status of a question for a player (with their extension, v1.2), or null when it does not exist for
 * them (§6.6).
 */
function playerStatus(q: QuestionRow, extension: Date | null, now: Date): Exclude<QuestionStatus, "draft" | "scheduled"> | null {
  const status = questionStatusFor(q, extension ? { closesAt: extension } : null, now);
  if (status === "draft" || status === "scheduled") return null;
  if (status === "cancelled" && !cancelledAfterOpening(q, now)) return null;
  return status;
}

export const QUESTION_LIST_TABS = ["open", "closed", "resolved", "cancelled"] as const;
export type QuestionListTab = (typeof QUESTION_LIST_TABS)[number];

export type QuestionListItem = {
  id: number;
  title: string;
  categoryName: string;
  kind: QuestionKind;
  coefficient: number;
  status: QuestionListTab;
  closesAt: Date;
  /** The viewer's deadline while their extension runs, else null. */
  extendedUntil: Date | null;
  expectedResultAt: Date | null;
  resolvedAt: Date | null;
  cancelledAt: Date | null;
  state: PredictionState;
  /**
   * The viewer's malus once the question is resolved, in hundredths: their prediction's, or the malus
   * of their absence (v1.2); null when they are not part of the standings of its season.
   */
  myMalus: number | null;
  /** The malus is the one of an absence: no prediction. */
  absent: boolean;
};

export type QuestionsList = { tab: QuestionListTab; counts: Record<QuestionListTab, number>; items: QuestionListItem[] };

const newestFirst = (date: (item: QuestionListItem) => Date | null) => (a: QuestionListItem, b: QuestionListItem) =>
  (date(b)?.getTime() ?? 0) - (date(a)?.getTime() ?? 0) || b.id - a.id;

const TAB_ORDER: Record<QuestionListTab, (a: QuestionListItem, b: QuestionListItem) => number> = {
  open: (a, b) => (a.extendedUntil ?? a.closesAt).getTime() - (b.extendedUntil ?? b.closesAt).getTime() || a.id - b.id,
  closed: newestFirst(({ closesAt }) => closesAt),
  resolved: newestFirst(({ resolvedAt }) => resolvedAt),
  cancelled: newestFirst(({ cancelledAt }) => cancelledAt),
};

/**
 * Questions of one tab of /questions, with the count of each tab (§8.3). A question that the viewer's
 * extension keeps open is in "Ouvertes", not in "En attente du résultat".
 */
export async function getQuestionsList(db: Database, viewer: ViewerRole, tab: QuestionListTab, now: Date): Promise<QuestionsList> {
  const extensions = await myExtensions(db, viewer.id);
  const rows = (await questionRows(db, ne(question.status, "draft"))).flatMap((row) => {
    const status = playerStatus(row.question, extensions.get(row.question.id) ?? null, now);
    return status ? [{ ...row, status }] : [];
  });
  const counts = Object.fromEntries(QUESTION_LIST_TABS.map((key) => [key, rows.filter(({ status }) => status === key).length])) as Record<QuestionListTab, number>;
  const selected = rows.filter(({ status }) => status === tab);
  const loaded = await load(db, viewer, selected);
  const results = tab === "resolved" ? new Map((await getPlayerResults(db, viewer, viewer.id)).map((result) => [result.questionId, result])) : new Map();

  const items = selected.map(({ question: q, categoryName, status }): QuestionListItem => {
    const options = loaded.options.get(q.id) ?? [];
    const extension = extensions.get(q.id) ?? null;
    const result = results.get(q.id);
    return {
      id: q.id,
      title: q.title,
      categoryName,
      kind: kindOf(q, options.map(({ label }) => label)),
      coefficient: q.coefficient,
      status,
      closesAt: q.closesAt!,
      extendedUntil: status === "open" && extension !== null && extension > q.closesAt! ? extension : null,
      expectedResultAt: q.expectedResultAt,
      resolvedAt: q.resolvedAt,
      cancelledAt: q.cancelledAt,
      state: predictionState(loaded.mine.get(q.id) ?? null, status),
      myMalus: result?.malus ?? null,
      absent: result !== undefined && result.score === null,
    };
  });
  return { tab, counts, items: items.sort(TAB_ORDER[tab]) };
}

export type QuestionDetail = PlayerQuestion & {
  status: QuestionListTab;
  resolvedAt: Date | null;
  correctedAt: Date | null;
  cancelledAt: Date | null;
  /** The real value or the right answer, once resolved. */
  result: { valueNumber: number | null; optionId: number | null } | null;
  /**
   * Extensions of other players that run on this question, closed for the viewer (§6.6): their
   * number and the latest deadline, without names. Null when there is none.
   */
  othersExtended: { count: number; until: Date } | null;
};

/**
 * Whether the page of a question exists for players (§6.6, §8.3), from its row alone: the layout
 * of /questions/[id] answers 404 before the page streams its loading skeleton (a streamed page
 * can no longer change its status code). The same for every viewer, admin included.
 */
export async function isQuestionVisible(db: Database, questionId: number, now: Date): Promise<boolean> {
  const [row] = await db.select().from(question).where(eq(question.id, questionId));
  return row !== undefined && playerStatus(row, null, now) !== null;
}

/**
 * One question for the player pages (§8.3 /questions/[id]). Null when it does not exist for the
 * viewer: draft, scheduled, or cancelled before it opened (404). The admin has the back office for
 * those.
 */
export async function getQuestionDetail(db: Database, viewer: PlayerViewer, questionId: number, now: Date): Promise<QuestionDetail | null> {
  const [row] = await questionRows(db, eq(question.id, questionId));
  if (!row) return null;
  const q = row.question;
  const extensions = (await getExtensions(db, [q.id])).get(q.id);
  const extension = extensions?.get(viewer.id) ?? null;
  const status = playerStatus(q, extension, now);
  if (!status) return null;
  const loaded = await load(db, viewer, [row]);
  const others = status === "closed" ? runningExtensions(q, extensions, now).filter(({ userId }) => userId !== viewer.id) : [];
  return {
    ...toPlayerQuestion(row, loaded, status, extension, newReference(viewer, now)),
    status,
    resolvedAt: q.resolvedAt,
    correctedAt: q.correctedAt,
    cancelledAt: q.cancelledAt,
    result: status === "resolved" ? { valueNumber: q.resultNumber, optionId: q.resultOptionId } : null,
    othersExtended:
      others.length === 0
        ? null
        : { count: others.length, until: new Date(Math.max(...others.map(({ closesAt }) => closesAt.getTime()))) },
  };
}
