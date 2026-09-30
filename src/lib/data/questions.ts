import "server-only";
import { and, asc, count, eq, inArray, max, ne, type SQL } from "drizzle-orm";
import type { Viewer } from "@/lib/auth/session";
import { type AvatarKey, isAvatarKey } from "@/lib/avatars";
import type { Database } from "@/lib/db/client";
import { category, prediction, predictionEvent, question, questionOption, user } from "@/lib/db/schema";
import { JOKERS_PER_SEASON } from "@/lib/game/constants";
import { type PredictionState, predictionState } from "@/lib/game/prediction-state";
import { type QuestionStatus, questionStatus } from "@/lib/game/question-status";
import { scoreQuestion } from "@/lib/game/scoring";
import { isNew, newReference } from "@/lib/game/visits";
import { kindOf, type QuestionKind } from "@/lib/validation/question";

// Reads of the questions and predictions (architecture §6.6, §7.4). Before the closing, the others'
// values never leave the server, not even for the admin, who plays too: a player only reads their
// own prediction, and the admin only receives states (to do, saved, validated), read by queries
// that do not select any value. getQuestionPredictionsForViewer is the only read of the others'
// predictions for display; the other reads only select the viewer's own rows, except to compute
// the viewer's points on a resolved question, whose values are public.

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

/**
 * Predictions of a question as `viewer` may see them at `now` (§6.6):
 * - draft or scheduled: null for a player (the question does not exist for them), none for the admin;
 * - open: a player only gets their own prediction; the admin gets every state, without values;
 * - closed or resolved: everyone gets every answer, with jokers and names;
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

  const revealed = status === "closed" || status === "resolved";
  let views: PredictionView[];
  if (revealed || (status === "open" && !isAdmin)) {
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
      // Open question: a player only reads their own row.
      .where(and(eq(prediction.questionId, questionId), revealed ? undefined : eq(prediction.userId, viewer.id)));
    views = rows.map((r) => ({
      predictionId: r.predictionId,
      userId: r.userId,
      name: r.name,
      avatar: avatarOf(r.avatar),
      inactive: r.banned === true,
      state: predictionState(r, status),
      validatedAt: r.validatedAt,
      answer: { valueNumber: r.valueNumber, optionId: r.optionId, joker: r.joker },
    }));
  } else if (isAdmin) {
    // Open or cancelled, admin: states only. No value column is selected.
    const rows = await db
      .select({ ...PLAYER_COLUMNS, validatedAt: prediction.validatedAt })
      .from(prediction)
      .innerJoin(user, eq(user.id, prediction.userId))
      .where(eq(prediction.questionId, questionId));
    views = rows.map((r) => ({
      predictionId: r.predictionId,
      userId: r.userId,
      name: r.name,
      avatar: avatarOf(r.avatar),
      inactive: r.banned === true,
      state: predictionState(r, status),
      validatedAt: r.validatedAt,
      answer: null,
    }));
  } else {
    // Cancelled, player: the predictions are not shown (§8.3).
    views = [];
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
  priceIsRight: boolean;
  unit: string | null;
  source: string;
  coefficient: number;
  opensAt: Date;
  closesAt: Date;
  expectedResultAt: Date | null;
  options: OptionView[];
  help: { biUrl: string | null; lastYear: string | null; hint: string | null };
  /** Opened since the viewer's last visit (§5.9). */
  isNew: boolean;
  mine: MyPrediction | null;
  state: PredictionState;
  /** Jokers the viewer has left in the season of the question, this question's own included (§5.4). */
  jokersLeft: number;
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

/** Jokers the viewer has left in `seasonId` (the current season on the home page). */
export async function getJokersLeft(db: Database, viewer: ViewerRole, seasonId: number | null): Promise<number> {
  if (seasonId === null) return JOKERS_PER_SEASON;
  return Math.max(0, JOKERS_PER_SEASON - ((await jokersBySeason(db, viewer.id)).get(seasonId) ?? 0));
}

type Loaded = { rows: { question: QuestionRow; categoryName: string }[]; options: Map<number, OptionView[]>; mine: Map<number, MyPrediction>; jokers: Map<number, number> };

async function load(db: Database, viewer: ViewerRole, rows: Loaded["rows"]): Promise<Loaded> {
  const ids = rows.map(({ question: q }) => q.id);
  return { rows, options: await optionsOf(db, ids), mine: await myPredictions(db, viewer.id, ids), jokers: await jokersBySeason(db, viewer.id) };
}

function toPlayerQuestion(
  { question: q, categoryName }: Loaded["rows"][number],
  loaded: Loaded,
  status: QuestionStatus,
  reference: Date | null,
): PlayerQuestion {
  const options = loaded.options.get(q.id) ?? [];
  const mine = loaded.mine.get(q.id) ?? null;
  return {
    id: q.id,
    title: q.title,
    description: q.description,
    categoryName,
    kind: kindOf(q, options.map(({ label }) => label)),
    type: q.type,
    priceIsRight: q.priceIsRight,
    unit: q.unit,
    source: q.source,
    coefficient: q.coefficient,
    // Visible questions are published: they always have both dates.
    opensAt: q.opensAt!,
    closesAt: q.closesAt!,
    expectedResultAt: q.expectedResultAt,
    options,
    help: { biUrl: q.helpBiUrl, lastYear: q.helpLastYear, hint: q.helpHint },
    isNew: status === "open" && isNew(q.opensAt!, reference),
    mine,
    state: predictionState(mine, status),
    jokersLeft: Math.max(0, JOKERS_PER_SEASON - (q.seasonId === null ? 0 : (loaded.jokers.get(q.seasonId) ?? 0))),
  };
}

const byClosing = (a: PlayerQuestion, b: PlayerQuestion) => a.closesAt.getTime() - b.closesAt.getTime() || a.id - b.id;

/** The open questions, closing soonest first, with the viewer's own prediction (§8.3 accueil, /pronos). */
export async function getOpenQuestionsForViewer(db: Database, viewer: PlayerViewer, now: Date): Promise<PlayerQuestion[]> {
  const rows = (await questionRows(db, eq(question.status, "published"))).filter(
    ({ question: q }) => questionStatus(q, now) === "open",
  );
  const loaded = await load(db, viewer, rows);
  const reference = newReference(viewer, now);
  return rows.map((row) => toPlayerQuestion(row, loaded, "open", reference)).sort(byClosing);
}

/**
 * A cancelled question is shown to players only if it had opened when it was cancelled; one
 * cancelled while scheduled was never seen, and stays hidden like a scheduled one (decision of
 * 30/09/2026).
 */
function cancelledAfterOpening(q: QuestionRow, now: Date): boolean {
  return q.opensAt !== null && (q.cancelledAt ?? now) >= q.opensAt;
}

/** Status of a question for a player, or null when it does not exist for them (§6.6). */
function playerStatus(q: QuestionRow, now: Date): Exclude<QuestionStatus, "draft" | "scheduled"> | null {
  const status = questionStatus(q, now);
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
  expectedResultAt: Date | null;
  resolvedAt: Date | null;
  cancelledAt: Date | null;
  state: PredictionState;
  /** The viewer's points once the question is resolved; null without a prediction. */
  myPoints: number | null;
};

export type QuestionsList = { tab: QuestionListTab; counts: Record<QuestionListTab, number>; items: QuestionListItem[] };

/** The viewer's points on each resolved question they played; the values of a resolved question are public. */
async function myPointsOn(db: Database, userId: string, resolved: QuestionRow[]): Promise<Map<number, number>> {
  const points = new Map<number, number>();
  const ids = resolved.map(({ id }) => id);
  if (ids.length === 0) return points;
  const rows = await db
    .select({ questionId: prediction.questionId, userId: prediction.userId, valueNumber: prediction.valueNumber, optionId: prediction.optionId, joker: prediction.joker })
    .from(prediction)
    .where(inArray(prediction.questionId, ids));
  for (const q of resolved) {
    if (q.resultNumber === null && q.resultOptionId === null) continue;
    const scores = scoreQuestion(q, rows.filter(({ questionId }) => questionId === q.id));
    const mine = scores.find(({ prediction: p }) => p.userId === userId);
    if (mine) points.set(q.id, mine.total);
  }
  return points;
}

const newestFirst = (date: (item: QuestionListItem) => Date | null) => (a: QuestionListItem, b: QuestionListItem) =>
  (date(b)?.getTime() ?? 0) - (date(a)?.getTime() ?? 0) || b.id - a.id;

const TAB_ORDER: Record<QuestionListTab, (a: QuestionListItem, b: QuestionListItem) => number> = {
  open: (a, b) => a.closesAt.getTime() - b.closesAt.getTime() || a.id - b.id,
  closed: newestFirst(({ closesAt }) => closesAt),
  resolved: newestFirst(({ resolvedAt }) => resolvedAt),
  cancelled: newestFirst(({ cancelledAt }) => cancelledAt),
};

/** Questions of one tab of /questions, with the count of each tab (§8.3). */
export async function getQuestionsList(db: Database, viewer: ViewerRole, tab: QuestionListTab, now: Date): Promise<QuestionsList> {
  const rows = (await questionRows(db, ne(question.status, "draft"))).flatMap((row) => {
    const status = playerStatus(row.question, now);
    return status ? [{ ...row, status }] : [];
  });
  const counts = Object.fromEntries(QUESTION_LIST_TABS.map((key) => [key, rows.filter(({ status }) => status === key).length])) as Record<QuestionListTab, number>;
  const selected = rows.filter(({ status }) => status === tab);
  const loaded = await load(db, viewer, selected);
  const points = tab === "resolved" ? await myPointsOn(db, viewer.id, selected.map(({ question: q }) => q)) : new Map<number, number>();

  const items = selected.map(({ question: q, categoryName, status }): QuestionListItem => {
    const options = loaded.options.get(q.id) ?? [];
    return {
      id: q.id,
      title: q.title,
      categoryName,
      kind: kindOf(q, options.map(({ label }) => label)),
      coefficient: q.coefficient,
      status,
      closesAt: q.closesAt!,
      expectedResultAt: q.expectedResultAt,
      resolvedAt: q.resolvedAt,
      cancelledAt: q.cancelledAt,
      state: predictionState(loaded.mine.get(q.id) ?? null, status),
      myPoints: points.get(q.id) ?? null,
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
};

/**
 * One question for the player pages (§8.3 /questions/[id]). Null when it does not exist for the
 * viewer: draft, scheduled, or cancelled before it opened (404). The admin has the back office for
 * those.
 */
export async function getQuestionDetail(db: Database, viewer: PlayerViewer, questionId: number, now: Date): Promise<QuestionDetail | null> {
  const [row] = await questionRows(db, eq(question.id, questionId));
  if (!row) return null;
  const status = playerStatus(row.question, now);
  if (!status) return null;
  const loaded = await load(db, viewer, [row]);
  const q = row.question;
  return {
    ...toPlayerQuestion(row, loaded, status, newReference(viewer, now)),
    status,
    resolvedAt: q.resolvedAt,
    correctedAt: q.correctedAt,
    cancelledAt: q.cancelledAt,
    result: status === "resolved" ? { valueNumber: q.resultNumber, optionId: q.resultOptionId } : null,
  };
}

