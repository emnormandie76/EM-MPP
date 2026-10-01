import "server-only";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import type { Viewer } from "@/lib/auth/session";
import type { Database } from "@/lib/db/client";
import { question } from "@/lib/db/schema";
import type { BadgeKey } from "@/lib/game/badges";
import { choiceDistribution, numberCrowd, relativeGap } from "@/lib/game/crowd";
import { type PredictionScore, scoreQuestion } from "@/lib/game/scoring";
import { getBadgesOnQuestion } from "./badges";
import { getQuestionDetail, getQuestionPredictionsForViewer, type PredictionAnswer, type PredictionView, type QuestionDetail } from "./questions";

// What a question shows once closed (architecture §5.7, §6.6, §8.3): everyone's predictions, the
// wisdom of the crowd and, once resolved, the points of each player. The predictions come from
// getQuestionPredictionsForViewer, the only read of the others' predictions, which reveals them
// only after the closing.

type PlayerViewer = Pick<Viewer, "id" | "role" | "lastSeenAt" | "previousVisitAt">;

export type ResultScore = Omit<PredictionScore, "prediction">;

/** One prediction of a closed question; `score` once the question is resolved. */
export type ResultRow = Omit<PredictionView, "answer"> & {
  answer: PredictionAnswer;
  isViewer: boolean;
  score: ResultScore | null;
};

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
  /** Closed: by name. Resolved: by total, highest first, then by name. */
  rows: ResultRow[];
  mine: ResultRow | null;
  /** Null without any prediction. */
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

  const scores: (ResultScore | null)[] = q.result
    ? scoreQuestion(
        { type: q.type, priceIsRight: q.priceIsRight, coefficient: q.coefficient, resultNumber: q.result.valueNumber, resultOptionId: q.result.optionId },
        answered.map(({ answer }) => answer),
      ).map(({ basePoints, podiumRank, podiumBonus, bullseye, relativeError, wentOver, total }) => ({
        basePoints,
        podiumRank,
        podiumBonus,
        bullseye,
        relativeError,
        wentOver,
        total,
      }))
    : answered.map(() => null);
  const rows: ResultRow[] = answered.map((view, index) => ({ ...view, isViewer: view.userId === viewer.id, score: scores[index] }));
  rows.sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0) || byName.compare(a.name, b.name));
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
  return { rows, mine, crowd, badges };
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
