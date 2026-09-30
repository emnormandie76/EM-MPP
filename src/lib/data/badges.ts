import "server-only";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import type { Viewer } from "@/lib/auth/session";
import type { Database } from "@/lib/db/client";
import { prediction, question, season, seasonStanding } from "@/lib/db/schema";
import {
  type BadgeInput,
  type BadgeKey,
  type BadgeResult,
  badgeName,
  badgesOnQuestion,
  computeBadges,
  type EarnedBadge,
} from "@/lib/game/badges";
import { type PredictionScore, scoreQuestion } from "@/lib/game/scoring";

// A player's results and badges (architecture §5.8), deduced from the resolved questions, whose
// predictions are public, and from the palmarès. Nothing is stored.

type ViewerRole = Pick<Viewer, "id" | "role">;

type ScoredAnswer = { userId: string; valueNumber: number | null; optionId: number | null; joker: boolean };

/** One resolved question the player predicted, with their answer and score. */
export type PlayerResult = {
  questionId: number;
  seasonId: number;
  title: string;
  type: "number" | "choice";
  unit: string | null;
  resolvedAt: Date;
  resultNumber: number | null;
  resultOptionId: number | null;
  score: PredictionScore<ScoredAnswer>;
};

/**
 * The player's results on the resolved questions (published, not cancelled), every season. The
 * podium needs everyone's predictions on those questions: their values are public once resolved.
 */
export async function getPlayerResults(db: Database, _viewer: ViewerRole, userId: string): Promise<PlayerResult[]> {
  const played = await db
    .select({
      id: question.id,
      seasonId: question.seasonId,
      title: question.title,
      type: question.type,
      priceIsRight: question.priceIsRight,
      unit: question.unit,
      coefficient: question.coefficient,
      resultNumber: question.resultNumber,
      resultOptionId: question.resultOptionId,
      resolvedAt: question.resolvedAt,
    })
    .from(question)
    .innerJoin(prediction, and(eq(prediction.questionId, question.id), eq(prediction.userId, userId)))
    .where(and(eq(question.status, "published"), isNotNull(question.resolvedAt), isNotNull(question.seasonId)));
  if (played.length === 0) return [];

  const answers = await db
    .select({
      questionId: prediction.questionId,
      userId: prediction.userId,
      valueNumber: prediction.valueNumber,
      optionId: prediction.optionId,
      joker: prediction.joker,
    })
    .from(prediction)
    .where(inArray(prediction.questionId, played.map(({ id }) => id)));

  return played.map((q) => {
    const scores = scoreQuestion(
      q,
      answers.filter(({ questionId }) => questionId === q.id),
    );
    return {
      questionId: q.id,
      seasonId: q.seasonId!,
      title: q.title,
      type: q.type,
      unit: q.unit,
      resolvedAt: q.resolvedAt!,
      resultNumber: q.resultNumber,
      resultOptionId: q.resultOptionId,
      score: scores.find(({ prediction: p }) => p.userId === userId)!,
    };
  });
}

function badgeResults(results: readonly PlayerResult[]): BadgeResult[] {
  return results.map(({ questionId, seasonId, type, resolvedAt, resultOptionId, score }) => ({
    questionId,
    seasonId,
    questionType: type,
    resolvedAt,
    joker: score.prediction.joker,
    bullseye: score.bullseye,
    podiumRank: score.podiumRank,
    correctChoice: type === "choice" && score.prediction.optionId === resultOptionId,
  }));
}

async function badgeInput(db: Database, userId: string, results: readonly PlayerResult[]): Promise<BadgeInput> {
  const predicted = await db.select({ questionId: prediction.questionId }).from(prediction).where(eq(prediction.userId, userId));
  const proclaimed = await db
    .select({ id: season.id, proclaimedAt: season.proclaimedAt, rank: seasonStanding.rank })
    .from(season)
    .leftJoin(seasonStanding, and(eq(seasonStanding.seasonId, season.id), eq(seasonStanding.userId, userId)))
    .where(isNotNull(season.proclaimedAt));
  const questions =
    proclaimed.length === 0
      ? []
      : await db
          .select({ id: question.id, seasonId: question.seasonId })
          .from(question)
          .where(and(eq(question.status, "published"), inArray(question.seasonId, proclaimed.map(({ id }) => id))));
  return {
    results: badgeResults(results),
    predictedQuestionIds: predicted.map(({ questionId }) => questionId),
    proclaimedSeasons: proclaimed.map(({ id, proclaimedAt, rank }) => ({
      seasonId: id,
      proclaimedAt: proclaimedAt!,
      questionIds: questions.filter(({ seasonId }) => seasonId === id).map(({ id: questionId }) => questionId),
      rank,
    })),
  };
}

export type BadgeView = EarnedBadge & { name: string };

/** The 6 badges of a player, earned or not, in display order (§5.8, profile). */
export async function getPlayerBadges(
  db: Database,
  viewer: ViewerRole,
  userId: string,
  results?: readonly PlayerResult[],
): Promise<BadgeView[]> {
  const own = results ?? (await getPlayerResults(db, viewer, userId));
  const earned = computeBadges(await badgeInput(db, userId, own));
  return earned.map((badge) => ({ ...badge, name: badgeName(badge.key) }));
}

/** Badges the player earned on one resolved question (ResultPanel, §8.2). */
export async function getBadgesOnQuestion(db: Database, viewer: ViewerRole, userId: string, questionId: number): Promise<BadgeKey[]> {
  return badgesOnQuestion(badgeResults(await getPlayerResults(db, viewer, userId)), questionId);
}
