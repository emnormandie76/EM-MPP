import "server-only";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import type { Viewer } from "@/lib/auth/session";
import type { AvatarKey } from "@/lib/avatars";
import type { Database } from "@/lib/db/client";
import { question } from "@/lib/db/schema";
import type { BadgeKey } from "@/lib/game/badges";
import { choiceDistribution, numberCrowd, relativeGap } from "@/lib/game/crowd";
import { type PredictionScore, scoreQuestion } from "@/lib/game/scoring";
import { getBadgesOnQuestion } from "./badges";
import { getQuestionDetail, getQuestionPredictionsForViewer, type PredictionAnswer, type PredictionView, type QuestionDetail } from "./questions";
import { getSeasonPlayers } from "./standings";

// What a question shows once closed (architecture §5.7, §6.6, §8.3): the predictions the viewer may
// see, the wisdom of the crowd and, once resolved, the malus of each player, absent players included
// (v1.2). The predictions come from getQuestionPredictionsForViewer, the only read of the others'
// predictions: before the result, it shows them only to whoever predicted the question, and hides
// those of the players whose extension runs.

type PlayerViewer = Pick<Viewer, "id" | "role" | "lastSeenAt" | "previousVisitAt">;

export type ResultScore = Omit<PredictionScore, "prediction">;

/** One prediction of a closed question; `score` once the question is resolved. */
export type ResultRow = Omit<PredictionView, "answer"> & {
  answer: PredictionAnswer;
  isViewer: boolean;
  score: ResultScore | null;
};

/** A player of the standings without a prediction on a resolved question, with the malus of the absence. */
export type AbsentRow = { userId: string; name: string; avatar: AvatarKey; inactive: boolean; isViewer: boolean; malus: number };

export type NumberCrowdView = {
  kind: "number";
  count: number;
  mean: number;
  median: number;
  displayMean: number;
  displayMedian: number;
  /** Relative gaps of the mean and the median to the real value, once resolved (null if it is 0). */
  meanGap: number | null;
  medianGap: number | null;
};

export type ChoiceCrowdView = {
  kind: "choice";
  count: number;
  shares: { optionId: number; label: string; count: number; percent: number; isAnswer: boolean; isMine: boolean }[];
};

export type QuestionResults = {
  /** Closed: by name. Resolved: by malus, the smallest first, then by name. */
  rows: ResultRow[];
  mine: ResultRow | null;
  /** Resolved: the players of the standings without a prediction, by name (v1.2). */
  absents: AbsentRow[];
  /** Resolved: the malus of an absence, in hundredths (the worst prediction's); null before. */
  absentMalus: number | null;
  /** Null without any visible prediction. */
  crowd: NumberCrowdView | ChoiceCrowdView | null;
  /** Badges the viewer earned on this question, once resolved. */
  badges: BadgeKey[];
};

const byName = new Intl.Collator("fr", { sensitivity: "base" });

/**
 * Results of a closed or resolved question for `viewer`. Null for any other status: before the
 * closing, the others' predictions never leave the server (§6.6).
 */
export async function getQuestionResults(db: Database, viewer: PlayerViewer, q: QuestionDetail, now: Date): Promise<QuestionResults | null> {
  if (q.status !== "closed" && q.status !== "resolved") return null;
  const views = await getQuestionPredictionsForViewer(db, viewer, q.id, now);
  if (!views) return null;
  const answered = views.flatMap((view) => (view.answer ? [{ ...view, answer: view.answer }] : []));

  let scores: (ResultScore | null)[] = answered.map(() => null);
  let absents: AbsentRow[] = [];
  let absentMalus: number | null = null;
  if (q.result) {
    // Resolved: every prediction is visible (§6.6), so the malus of an absence is the true one.
    const scored = scoreQuestion(
      { type: q.type, coefficient: q.coefficient, resultNumber: q.result.valueNumber, resultOptionId: q.result.optionId, wrongAnswerMalus: q.wrongAnswerMalus },
      answered.map(({ answer }) => answer),
    );
    scores = scored.scores.map(({ baseMalus, total, bullseye, relativeError, podiumRank }) => ({ baseMalus, total, bullseye, relativeError, podiumRank }));
    absentMalus = scored.absentMalus;
    const predicted = new Set(answered.map(({ userId }) => userId));
    const seasonId = await seasonOf(db, q.id);
    absents = (seasonId === null ? [] : await getSeasonPlayers(db, seasonId))
      .filter(({ id }) => !predicted.has(id))
      .map((player) => ({ userId: player.id, name: player.name, avatar: player.avatar, inactive: player.inactive, isViewer: player.id === viewer.id, malus: scored.absentMalus }))
      .sort((a, b) => byName.compare(a.name, b.name));
  }
  const rows: ResultRow[] = answered.map((view, index) => ({ ...view, isViewer: view.userId === viewer.id, score: scores[index] }));
  rows.sort((a, b) => (a.score?.total ?? 0) - (b.score?.total ?? 0) || byName.compare(a.name, b.name));
  const mine = rows.find(({ isViewer }) => isViewer) ?? null;

  let crowd: QuestionResults["crowd"] = null;
  if (rows.length > 0 && q.type === "number") {
    const stats = numberCrowd(rows.map(({ answer }) => answer.valueNumber!))!;
    const real = q.result?.valueNumber ?? null;
    crowd = {
      kind: "number",
      ...stats,
      meanGap: real === null ? null : relativeGap(stats.mean, real),
      medianGap: real === null ? null : relativeGap(stats.median, real),
    };
  } else if (rows.length > 0) {
    const shares = choiceDistribution(
      q.options.map(({ id }) => id),
      rows.map(({ answer }) => answer.optionId),
    );
    crowd = {
      kind: "choice",
      count: rows.length,
      shares: shares.map((share) => ({
        ...share,
        label: q.options.find(({ id }) => id === share.optionId)!.label,
        isAnswer: q.result?.optionId === share.optionId,
        isMine: mine?.answer.optionId === share.optionId,
      })),
    };
  }

  const badges = q.status === "resolved" && mine ? await getBadgesOnQuestion(db, viewer, viewer.id, q.id) : [];
  return { rows, mine, absents, absentMalus, crowd, badges };
}

async function seasonOf(db: Database, questionId: number): Promise<number | null> {
  const [row] = await db.select({ seasonId: question.seasonId }).from(question).where(eq(question.id, questionId));
  return row?.seasonId ?? null;
}

export type LatestResult = { question: QuestionDetail; results: QuestionResults };

/** The latest resolved question (first entry of its result), for the home page (§8.3, block 4). */
export async function getLatestResult(db: Database, viewer: PlayerViewer, now: Date): Promise<LatestResult | null> {
  const [latest] = await db
    .select({ id: question.id })
    .from(question)
    .where(and(eq(question.status, "published"), isNotNull(question.resolvedAt)))
    .orderBy(desc(question.resolvedAt), desc(question.id))
    .limit(1);
  if (!latest) return null;
  const detail = await getQuestionDetail(db, viewer, latest.id, now);
  if (!detail) return null;
  const results = await getQuestionResults(db, viewer, detail, now);
  return results ? { question: detail, results } : null;
}
