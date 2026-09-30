import "server-only";
import { asc, count, eq, inArray, sql } from "drizzle-orm";
import type { Viewer } from "@/lib/auth/session";
import { type AvatarKey, isAvatarKey } from "@/lib/avatars";
import type { Database } from "@/lib/db/client";
import { category, prediction, question, questionOption, season, user } from "@/lib/db/schema";
import { type PredictionState, predictionState } from "@/lib/game/prediction-state";
import { type QuestionStatus, questionStatus } from "@/lib/game/question-status";
import { seasonAt, seasonEnd, seasonStartFromLocalDate, suggestedSeasonLabel, utcToParisLocalDate } from "@/lib/game/time";
import { type EditRules, editRules } from "@/lib/services/questions";
import { type QuestionKind, kindOf } from "@/lib/validation/question";
import { getPrizes, type PrizeView } from "./content";
import { getPredictionStates, getQuestionPredictionsForViewer, type PredictionAnswer } from "./questions";

// Reads of the back office (architecture §7.4, §8.3). Admin only. Before the closing, they
// never carry a prediction value (§6.6): the follow-up only shows states.

type ViewerRole = Pick<Viewer, "id" | "role">;

function assertAdmin(viewer: ViewerRole): void {
  if (viewer.role !== "admin") throw new Error("FORBIDDEN: admin reads only");
}

const byName = new Intl.Collator("fr", { sensitivity: "base" });

function avatarOf(value: string | null): AvatarKey {
  return value && isAvatarKey(value) ? value : "maillot-bleu-uni";
}

type PlayerRef = { id: string; name: string; avatar: AvatarKey };

/** Accounts that can play: not disabled (admins play too). */
async function activePlayers(db: Database): Promise<PlayerRef[]> {
  const rows = await db
    .select({ id: user.id, name: user.name, avatar: user.avatar })
    .from(user)
    .where(sql`${user.banned} is not true`);
  return rows.map((row) => ({ ...row, avatar: avatarOf(row.avatar) })).sort((a, b) => byName.compare(a.name, b.name));
}

type QuestionRow = typeof question.$inferSelect;

/** Answers of the given questions, by question, in order. */
async function optionsByQuestion(db: Database, questionIds: number[]): Promise<Map<number, { id: number; label: string }[]>> {
  const map = new Map<number, { id: number; label: string }[]>();
  if (questionIds.length === 0) return map;
  const rows = await db
    .select({ questionId: questionOption.questionId, id: questionOption.id, label: questionOption.label })
    .from(questionOption)
    .where(inArray(questionOption.questionId, questionIds))
    .orderBy(asc(questionOption.questionId), asc(questionOption.position));
  for (const { questionId, id, label } of rows) map.set(questionId, [...(map.get(questionId) ?? []), { id, label }]);
  return map;
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

// ---------------------------------------------------------------------------------------------
// Dashboard

export type Laggard = PlayerRef & { state: Exclude<PredictionState, "validated"> };

export type DashboardQuestion = {
  id: number;
  title: string;
  categoryName: string;
  opensAt: Date;
  closesAt: Date;
  expectedResultAt: Date | null;
};

export type AdminDashboard = {
  /** Open questions, closing soonest first: "validés x / N" and who has not validated yet. */
  open: (DashboardQuestion & { validated: number; total: number; laggards: Laggard[] })[];
  /** Closed questions waiting for their result, oldest closing first. */
  toResolve: DashboardQuestion[];
  /** Scheduled questions, opening soonest first. */
  upcoming: DashboardQuestion[];
};

export async function getAdminDashboard(db: Database, viewer: ViewerRole, now: Date): Promise<AdminDashboard> {
  assertAdmin(viewer);
  const rows = await db
    .select({ question, categoryName: category.name })
    .from(question)
    .innerJoin(category, eq(category.id, question.categoryId))
    .where(eq(question.status, "published"));

  const withStatus = rows.map(({ question: q, categoryName }) => ({
    status: questionStatus(q, now),
    view: {
      id: q.id,
      title: q.title,
      categoryName,
      opensAt: q.opensAt!,
      closesAt: q.closesAt!,
      expectedResultAt: q.expectedResultAt,
    },
  }));
  const pick = (status: QuestionStatus) => withStatus.filter((item) => item.status === status).map(({ view }) => view);
  const byTime = (key: "opensAt" | "closesAt") => (a: DashboardQuestion, b: DashboardQuestion) =>
    a[key].getTime() - b[key].getTime() || a.id - b.id;

  const openQuestions = pick("open").sort(byTime("closesAt"));
  const players = await activePlayers(db);
  const states = await getPredictionStates(db, openQuestions.map(({ id }) => id));
  const open = openQuestions.map((q) => {
    const validatedAt = new Map(states.filter((s) => s.questionId === q.id).map((s) => [s.userId, s.validatedAt]));
    const laggards: Laggard[] = [];
    let validated = 0;
    for (const player of players) {
      const state = predictionState(validatedAt.has(player.id) ? { validatedAt: validatedAt.get(player.id)! } : null, "open");
      if (state === "validated") validated += 1;
      else laggards.push({ ...player, state });
    }
    return { ...q, validated, total: players.length, laggards };
  });

  return { open, toResolve: pick("closed").sort(byTime("closesAt")), upcoming: pick("scheduled").sort(byTime("opensAt")) };
}

// ---------------------------------------------------------------------------------------------
// Questions list

export const QUESTION_STATUSES: readonly QuestionStatus[] = ["draft", "scheduled", "open", "closed", "resolved", "cancelled"];

export type AdminQuestionFilters = {
  status?: QuestionStatus;
  /** A season label, or "none" for the questions without a season (no closing date, or none covering it). */
  season?: string;
  categoryId?: number;
};

export type AdminQuestionRow = {
  id: number;
  title: string;
  categoryName: string;
  kind: QuestionKind;
  coefficient: number;
  status: QuestionStatus;
  opensAt: Date | null;
  closesAt: Date | null;
  expectedResultAt: Date | null;
  seasonLabel: string | null;
  predictionCount: number;
};

export type CategoryChoice = { id: number; name: string; archived: boolean };

export type AdminQuestionsList = {
  rows: AdminQuestionRow[];
  /** Names of the seasons that have at least one question, latest start first. */
  seasons: string[];
  categories: CategoryChoice[];
};

async function categoryChoices(db: Database): Promise<CategoryChoice[]> {
  const rows = await db.select().from(category);
  return rows
    .map(({ id, name, archivedAt }) => ({ id, name, archived: archivedAt !== null }))
    .sort((a, b) => Number(a.archived) - Number(b.archived) || byName.compare(a.name, b.name));
}

/** Every question matching the filters, newest first. */
export async function getAdminQuestionsList(
  db: Database,
  viewer: ViewerRole,
  filters: AdminQuestionFilters,
  now: Date,
): Promise<AdminQuestionsList> {
  assertAdmin(viewer);
  const rows = await db
    .select({ question, categoryName: category.name, seasonLabel: season.label, seasonStartsAt: season.startsAt })
    .from(question)
    .innerJoin(category, eq(category.id, question.categoryId))
    .leftJoin(season, eq(season.id, question.seasonId));
  const ids = rows.map(({ question: q }) => q.id);
  const options = await optionsByQuestion(db, ids);
  const counts = await predictionCounts(db, ids);

  const all: AdminQuestionRow[] = rows.map(({ question: q, categoryName, seasonLabel }) => ({
    id: q.id,
    title: q.title,
    categoryName,
    kind: kindOf(q, (options.get(q.id) ?? []).map(({ label }) => label)),
    coefficient: q.coefficient,
    status: questionStatus(q, now),
    opensAt: q.opensAt,
    closesAt: q.closesAt,
    expectedResultAt: q.expectedResultAt,
    seasonLabel,
    predictionCount: counts.get(q.id) ?? 0,
  }));
  const categoryIdOf = new Map(rows.map(({ question: q }) => [q.id, q.categoryId]));
  const filtered = all
    .filter((row) => !filters.status || row.status === filters.status)
    .filter((row) => !filters.season || (filters.season === "none" ? row.seasonLabel === null : row.seasonLabel === filters.season))
    .filter((row) => !filters.categoryId || categoryIdOf.get(row.id) === filters.categoryId)
    .sort((a, b) => b.id - a.id);

  const starts = new Map<string, number>();
  for (const { seasonLabel, seasonStartsAt } of rows) if (seasonLabel && seasonStartsAt) starts.set(seasonLabel, seasonStartsAt.getTime());
  const seasons = [...starts.keys()].sort((a, b) => starts.get(b)! - starts.get(a)!);
  return { rows: filtered, seasons, categories: await categoryChoices(db) };
}

// ---------------------------------------------------------------------------------------------
// One question

export type TrackingRow = {
  userId: string;
  name: string;
  avatar: AvatarKey;
  inactive: boolean;
  state: PredictionState;
  validatedAt: Date | null;
  /** Only after the closing (§6.6). */
  answer: PredictionAnswer | null;
};

export type AdminQuestion = {
  question: QuestionRow & {
    kind: QuestionKind;
    computedStatus: QuestionStatus;
    categoryName: string;
    seasonLabel: string | null;
    duplicatedFrom: { id: number; title: string } | null;
  };
  options: { id: number; label: string }[];
  predictionCount: number;
  rules: EditRules;
  /** Active categories, plus the question's own if it is archived. */
  categories: CategoryChoice[];
  /** False while the admin has not created any season: nothing can be published (§5.13). */
  seasonsExist: boolean;
  /** Follow-up of the players (§8.3), once the question is published; null for a draft. */
  tracking: TrackingRow[] | null;
};

export async function getAdminQuestion(db: Database, viewer: ViewerRole, questionId: number, now: Date): Promise<AdminQuestion | null> {
  assertAdmin(viewer);
  const [row] = await db
    .select({ question, categoryName: category.name, seasonLabel: season.label })
    .from(question)
    .innerJoin(category, eq(category.id, question.categoryId))
    .leftJoin(season, eq(season.id, question.seasonId))
    .where(eq(question.id, questionId));
  if (!row) return null;
  const q = row.question;
  const options = (await optionsByQuestion(db, [q.id])).get(q.id) ?? [];
  const predictionCount = (await predictionCounts(db, [q.id])).get(q.id) ?? 0;
  const status = questionStatus(q, now);

  let duplicatedFrom: AdminQuestion["question"]["duplicatedFrom"] = null;
  if (q.duplicatedFromId !== null) {
    const [original] = await db
      .select({ id: question.id, title: question.title })
      .from(question)
      .where(eq(question.id, q.duplicatedFromId));
    duplicatedFrom = original ?? null;
  }

  let tracking: TrackingRow[] | null = null;
  if (q.status !== "draft") {
    const predictions = (await getQuestionPredictionsForViewer(db, viewer, q.id, now)) ?? [];
    const byUser = new Map(predictions.map((p) => [p.userId, p]));
    const players = await activePlayers(db);
    tracking = [
      ...players.map(
        (player): TrackingRow =>
          byUser.get(player.id) ?? {
            userId: player.id,
            name: player.name,
            avatar: player.avatar,
            inactive: false,
            state: "todo",
            validatedAt: null,
            answer: null,
          },
      ),
      // Disabled accounts only appear with a prediction.
      ...predictions.filter((p) => p.inactive),
    ].sort((a, b) => byName.compare(a.name, b.name));
  }

  const categories = (await categoryChoices(db)).filter((choice) => !choice.archived || choice.id === q.categoryId);
  const seasonsExist = await anySeason(db);
  return {
    question: {
      ...q,
      kind: kindOf(q, options.map(({ label }) => label)),
      computedStatus: status,
      categoryName: row.categoryName,
      seasonLabel: row.seasonLabel,
      duplicatedFrom,
    },
    options,
    predictionCount,
    rules: editRules(status, predictionCount),
    categories,
    seasonsExist,
    tracking,
  };
}

async function anySeason(db: Database): Promise<boolean> {
  const rows = await db.select({ id: season.id }).from(season).limit(1);
  return rows.length > 0;
}

/** Whether the admin has created a season yet: the creation form invites to create the first one. */
export async function hasSeasons(db: Database, viewer: ViewerRole): Promise<boolean> {
  assertAdmin(viewer);
  return anySeason(db);
}

/** Categories offered by the creation form: the active ones. */
export async function getActiveCategories(db: Database, viewer: ViewerRole): Promise<CategoryChoice[]> {
  assertAdmin(viewer);
  return (await categoryChoices(db)).filter((choice) => !choice.archived);
}

// ---------------------------------------------------------------------------------------------
// Categories and seasons

export type AdminCategory = { id: number; name: string; archivedAt: Date | null; questionCount: number };

/** Active categories first, then archived ones, each by name. */
export async function getCategoriesAdmin(db: Database, viewer: ViewerRole): Promise<AdminCategory[]> {
  assertAdmin(viewer);
  const rows = await db
    .select({ id: category.id, name: category.name, archivedAt: category.archivedAt, questionCount: count(question.id) })
    .from(category)
    .leftJoin(question, eq(question.categoryId, category.id))
    .groupBy(category.id);
  return rows.sort(
    (a, b) => Number(a.archivedAt !== null) - Number(b.archivedAt !== null) || byName.compare(a.name, b.name),
  );
}

export type AdminSeason = {
  id: number;
  label: string;
  startsAt: Date;
  /** Start of the next season (exclusive), or null for the last one, which goes on (§5.1). */
  endsAt: Date | null;
  proclaimedAt: Date | null;
  isCurrent: boolean;
  /** Published questions that are not cancelled. */
  questionsTotal: number;
  questionsResolved: number;
  /** Every question attached, drafts and cancelled ones included: then the season cannot be deleted. */
  questionsAttached: number;
  prizes: PrizeView[];
};

export type SeasonsAdmin = {
  /** Latest start first. */
  seasons: AdminSeason[];
  /** The season containing `now`, or null (no season yet, or before the first one). */
  current: AdminSeason | null;
  /** The current season is the last one created: time to create the next one (§5.13). */
  remindNext: boolean;
  /** Prefill of the creation form: a year after the latest start, or today (Paris day, `YYYY-MM-DD`). */
  suggestedStart: string;
  suggestedLabel: string;
};

/** Same day a year later; 29 February becomes 28 February. */
function nextYearDay(day: string): string {
  const [year, month, date] = day.split("-");
  return `${Number(year) + 1}-${month}-${month === "02" && date === "29" ? "28" : date}`;
}

/** Every season, latest start first, with its end, its questions and its prizes (§8.3 /admin/saisons). */
export async function getSeasonsAdmin(db: Database, viewer: ViewerRole, now: Date): Promise<SeasonsAdmin> {
  assertAdmin(viewer);
  const rows = await db.select().from(season);
  const counts = await db
    .select({
      seasonId: question.seasonId,
      attached: count(),
      total: sql<number>`count(*) filter (where ${question.status} = 'published')`.mapWith(Number),
      resolved: sql<number>`count(${question.resolvedAt}) filter (where ${question.status} = 'published')`.mapWith(Number),
    })
    .from(question)
    .groupBy(question.seasonId);
  const countsOf = new Map(counts.map(({ seasonId, ...values }) => [seasonId, values]));

  const current = seasonAt(rows, now);
  const seasons: AdminSeason[] = [];
  for (const row of [...rows].sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())) {
    seasons.push({
      id: row.id,
      label: row.label,
      startsAt: row.startsAt,
      endsAt: seasonEnd(rows, row),
      proclaimedAt: row.proclaimedAt,
      isCurrent: row.id === current?.id,
      questionsTotal: countsOf.get(row.id)?.total ?? 0,
      questionsResolved: countsOf.get(row.id)?.resolved ?? 0,
      questionsAttached: countsOf.get(row.id)?.attached ?? 0,
      prizes: await getPrizes(db, viewer, row.id),
    });
  }

  const latest = seasons.at(0);
  const suggestedStart = latest ? nextYearDay(utcToParisLocalDate(latest.startsAt)) : utcToParisLocalDate(now);
  return {
    seasons,
    current: seasons.find(({ isCurrent }) => isCurrent) ?? null,
    remindNext: latest?.isCurrent === true,
    suggestedStart,
    suggestedLabel: suggestedSeasonLabel(seasonStartFromLocalDate(suggestedStart)),
  };
}
