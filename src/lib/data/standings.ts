import "server-only";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import type { Viewer } from "@/lib/auth/session";
import { type AvatarKey, isAvatarKey } from "@/lib/avatars";
import type { Database } from "@/lib/db/client";
import { prediction, question, season, user } from "@/lib/db/schema";
import { defaultSeason, type SeasonSummary, type StandingRowWithMovement, withMovement } from "@/lib/game/standings";

// Season standings (architecture §5.6, §7.4), recomputed on every read from the predictions of the
// resolved questions, whose values are public. The predictions of the other questions of the
// season are read without any value: they only tell whether a disabled account took part.

type ViewerRole = Pick<Viewer, "id" | "role">;

export type StandingView = StandingRowWithMovement & { avatar: AvatarKey; isViewer: boolean };

export type SeasonRef = { id: number; label: string; startsAt: Date; proclaimed: boolean };

export type Standings = {
  /** The season shown; null while no season contains `now` (empty state). */
  season: SeasonRef | null;
  /** Resolved questions of the season: 0 means no standings yet. */
  resolvedCount: number;
  rows: StandingView[];
};

type Summary = SeasonSummary & SeasonRef;

/** Every season with its published and resolved questions (cancelled ones excluded). */
async function seasonSummaries(db: Database): Promise<Summary[]> {
  const seasons = await db.select().from(season);
  const questions = await db
    .select({ seasonId: question.seasonId, resolvedAt: question.resolvedAt })
    .from(question)
    .where(and(eq(question.status, "published"), isNotNull(question.seasonId)));
  return seasons.map((row) => {
    const own = questions.filter(({ seasonId }) => seasonId === row.id);
    return {
      id: row.id,
      label: row.label,
      startsAt: row.startsAt,
      proclaimed: row.proclaimedAt !== null,
      publishedCount: own.length,
      resolvedCount: own.filter(({ resolvedAt }) => resolvedAt !== null).length,
    };
  });
}

/**
 * Standings of a season with the movement since the previous result (§5.6). Without `seasonId`, the
 * season shown by default: the current one, or the previous one while the current one has no
 * result and the previous one is not proclaimed.
 */
export async function getStandings(
  db: Database,
  viewer: ViewerRole,
  { seasonId }: { seasonId?: number },
  now: Date,
): Promise<Standings> {
  const summaries = await seasonSummaries(db);
  const chosen = seasonId === undefined ? defaultSeason(now, summaries) : (summaries.find(({ id }) => id === seasonId) ?? null);
  if (!chosen) return { season: null, resolvedCount: 0, rows: [] };
  const seasonRef: SeasonRef = { id: chosen.id, label: chosen.label, startsAt: chosen.startsAt, proclaimed: chosen.proclaimed };

  const questions = await db
    .select({
      id: question.id,
      type: question.type,
      priceIsRight: question.priceIsRight,
      coefficient: question.coefficient,
      resultNumber: question.resultNumber,
      resultOptionId: question.resultOptionId,
      resolvedAt: question.resolvedAt,
    })
    .from(question)
    .where(and(eq(question.seasonId, chosen.id), eq(question.status, "published")));
  const resolved = questions.flatMap((q) => (q.resolvedAt ? [{ ...q, resolvedAt: q.resolvedAt }] : []));
  const resolvedIds = resolved.map(({ id }) => id);
  const otherIds = questions.filter(({ resolvedAt }) => resolvedAt === null).map(({ id }) => id);

  const scored =
    resolvedIds.length === 0
      ? []
      : await db
          .select({ questionId: prediction.questionId, userId: prediction.userId, valueNumber: prediction.valueNumber, optionId: prediction.optionId, joker: prediction.joker })
          .from(prediction)
          .where(inArray(prediction.questionId, resolvedIds));
  // No value is read on the questions that are not resolved.
  const tookPart =
    otherIds.length === 0
      ? []
      : (
          await db
            .select({ questionId: prediction.questionId, userId: prediction.userId })
            .from(prediction)
            .where(inArray(prediction.questionId, otherIds))
        ).map((row) => ({ ...row, valueNumber: null, optionId: null, joker: false }));

  const players = await db.select({ id: user.id, name: user.name, banned: user.banned, avatar: user.avatar }).from(user);
  const avatars = new Map(players.map(({ id, avatar }) => [id, isAvatarKey(avatar) ? avatar : ("maillot-bleu-uni" as const)]));
  const rows = withMovement({
    questions: resolved,
    predictions: [...scored, ...tookPart],
    players: players.map(({ id, name, banned }) => ({ id, name, banned: banned === true })),
  });
  return {
    season: seasonRef,
    resolvedCount: resolved.length,
    rows: rows.map((row) => ({ ...row, avatar: avatars.get(row.userId)!, isViewer: row.userId === viewer.id })),
  };
}
