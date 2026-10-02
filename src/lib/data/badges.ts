import "server-only";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import type { Viewer } from "@/lib/auth/session";
import type { Database } from "@/lib/db/client";
import { prediction, question, season, seasonStanding, user } from "@/lib/db/schema";
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
import { seasonPlayers } from "@/lib/game/standings";
import { seasonEnd } from "@/lib/game/time";

// A player's results and badges (architecture §5.8), deduced from the resolved questions, whose
// predictions are public, and from the palmarès. Nothing is stored.

type ViewerRole = Pick<Viewer, "id" | "role">;

type ScoredAnswer = { userId: string; valueNumber: number | null; optionId: number | null; joker: boolean };

/** One resolved question of a season the player is part of, with their answer and malus, or their absence. */
export type PlayerResult = {
  questionId: number;
  seasonId: number;
  title: string;
  type: "number" | "choice";
  unit: string | null;
  coefficient: number;
  resolvedAt: Date;
  resultNumber: number | null;
  resultOptionId: number | null;
  /** The player's scored prediction; null without one (an absence, v1.2). */
  score: PredictionScore<ScoredAnswer> | null;
  /** Malus taken on the question, in hundredths: the prediction's, or the malus of the absence. */
  malus: number;
};

/**
 * The player's results on the resolved questions (published, not cancelled), every season (v1.2):
 * the questions they predicted, and, in the seasons whose standings list them (§5.6: created before
 * the end of the season or with a prediction in it; a disabled account only with a prediction),
 * the questions they did not predict, with the malus of their absence. The malus need everyone's
 * predictions on those questions: their values are public once resolved.
 */
export async function getPlayerResults(db: Database, _viewer: ViewerRole, userId: string): Promise<PlayerResult[]> {
  const [account] = await db.select({ createdAt: user.createdAt, banned: user.banned }).from(user).where(eq(user.id, userId));
  if (!account) return [];
  const resolved = await db
    .select({
      id: question.id,
      seasonId: question.seasonId,
      title: question.title,
      type: question.type,
      unit: question.unit,
      coefficient: question.coefficient,
      wrongAnswerMalus: question.wrongAnswerMalus,
      resultNumber: question.resultNumber,
      resultOptionId: question.resultOptionId,
      resolvedAt: question.resolvedAt,
    })
    .from(question)
    .where(and(eq(question.status, "published"), isNotNull(question.resolvedAt), isNotNull(question.seasonId)));
  if (resolved.length === 0) return [];

  const answers = await db
    .select({
      questionId: prediction.questionId,
      userId: prediction.userId,
      valueNumber: prediction.valueNumber,
      optionId: prediction.optionId,
      joker: prediction.joker,
    })
    .from(prediction)
    .where(inArray(prediction.questionId, resolved.map(({ id }) => id)));

  // Seasons whose standings list the player, as /classement computes them.
  const seasons = await db.select().from(season);
  const played = await db
    .select({ seasonId: question.seasonId })
    .from(prediction)
    .innerJoin(question, eq(question.id, prediction.questionId))
    .where(and(eq(prediction.userId, userId), eq(question.status, "published")));
  const playedSeasons = new Set(played.map(({ seasonId }) => seasonId));
  const listedIn = new Set(
    seasons
      .filter((row) => {
        const tookPart = playedSeasons.has(row.id);
        if (account.banned && !tookPart) return false;
        return seasonPlayers([{ id: userId, createdAt: account.createdAt }], seasonEnd(seasons, row), tookPart ? new Set([userId]) : new Set()).length > 0;
      })
      .map(({ id }) => id),
  );

  return resolved.flatMap((q) => {
    const { scores, absentMalus } = scoreQuestion(
      q,
      answers.filter(({ questionId }) => questionId === q.id),
    );
    const score = scores.find(({ prediction: p }) => p.userId === userId) ?? null;
    if (!score && !listedIn.has(q.seasonId!)) return [];
    return [
      {
        questionId: q.id,
        seasonId: q.seasonId!,
        title: q.title,
        type: q.type,
        unit: q.unit,
        coefficient: q.coefficient,
        resolvedAt: q.resolvedAt!,
        resultNumber: q.resultNumber,
        resultOptionId: q.resultOptionId,
        score,
        malus: score ? score.total : absentMalus,
      },
    ];
  });
}

/** Badges only count the questions the player predicted. */
function badgeResults(results: readonly PlayerResult[]): BadgeResult[] {
  return results.flatMap(({ questionId, seasonId, type, resolvedAt, resultOptionId, score }) =>
    score
      ? [
          {
            questionId,
            seasonId,
            questionType: type,
            resolvedAt,
            joker: score.prediction.joker,
            bullseye: score.bullseye,
            podiumRank: score.podiumRank,
            correctChoice: type === "choice" && score.prediction.optionId === resultOptionId,
          },
        ]
      : [],
  );
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
