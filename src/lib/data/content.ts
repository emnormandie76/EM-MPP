import "server-only";
import { asc, desc, eq, isNotNull, lte } from "drizzle-orm";
import type { Viewer } from "@/lib/auth/session";
import { type AvatarKey, isAvatarKey } from "@/lib/avatars";
import type { Database } from "@/lib/db/client";
import { announcement, prize, season, seasonStanding, user } from "@/lib/db/schema";

// Announcements, prizes, the current season and the palmarès, visible to every signed-in account
// (architecture §7.4).

type ViewerRole = Pick<Viewer, "id" | "role">;

export type AnnouncementView = { id: number; body: string; createdAt: Date; updatedAt: Date };

/** Newest first; the home page shows the 3 latest (§8.3). */
export async function getAnnouncements(
  db: Database,
  _viewer: ViewerRole,
  { limit }: { limit?: number } = {},
): Promise<AnnouncementView[]> {
  const query = db
    .select({ id: announcement.id, body: announcement.body, createdAt: announcement.createdAt, updatedAt: announcement.updatedAt })
    .from(announcement)
    .orderBy(desc(announcement.createdAt), desc(announcement.id));
  return limit === undefined ? query : query.limit(limit);
}

export type PrizeView = { id: number; rankLabel: string; description: string };

/** Prizes of a season, in display order. */
export async function getPrizes(db: Database, _viewer: ViewerRole, seasonId: number): Promise<PrizeView[]> {
  return db
    .select({ id: prize.id, rankLabel: prize.rankLabel, description: prize.description })
    .from(prize)
    .where(eq(prize.seasonId, seasonId))
    .orderBy(asc(prize.position), asc(prize.id));
}

export type CurrentSeason = { id: number; label: string; startsAt: Date };

/**
 * The season containing `now` (§5.1): the latest start not after it. Null while the admin has not
 * created a season, or before the first one. Footer and /lots.
 */
export async function getCurrentSeason(db: Database, _viewer: ViewerRole, now: Date): Promise<CurrentSeason | null> {
  const [row] = await db
    .select({ id: season.id, label: season.label, startsAt: season.startsAt })
    .from(season)
    .where(lte(season.startsAt, now))
    .orderBy(desc(season.startsAt))
    .limit(1);
  return row ?? null;
}

export type PalmaresRow = {
  userId: string;
  /** The name of the proclamation day ("Ancien joueur n" once anonymized). */
  name: string;
  avatar: AvatarKey;
  rank: number;
  points: number;
  bullseyes: number;
  meanError: number | null;
  questionsPlayed: number;
  isViewer: boolean;
};

export type PalmaresSeason = {
  id: number;
  label: string;
  proclaimedAt: Date;
  /** Final standings, by rank, then name (French order). */
  rows: PalmaresRow[];
  prizes: PrizeView[];
};

const byName = new Intl.Collator("fr", { sensitivity: "base" });

/**
 * The palmarès (§5.12): every proclaimed season, latest first, with its frozen final standings and
 * its prizes. Only `season_standing` is read, never a recomputation.
 */
export async function getPalmares(db: Database, viewer: ViewerRole): Promise<PalmaresSeason[]> {
  const seasons = await db
    .select({ id: season.id, label: season.label, startsAt: season.startsAt, proclaimedAt: season.proclaimedAt })
    .from(season)
    .where(isNotNull(season.proclaimedAt))
    .orderBy(desc(season.startsAt));
  const palmares: PalmaresSeason[] = [];
  for (const { id, label, proclaimedAt } of seasons) {
    const rows = await db
      .select({
        userId: seasonStanding.userId,
        name: seasonStanding.nameSnapshot,
        avatar: user.avatar,
        rank: seasonStanding.rank,
        points: seasonStanding.points,
        bullseyes: seasonStanding.bullseyes,
        meanError: seasonStanding.meanError,
        questionsPlayed: seasonStanding.questionsPlayed,
      })
      .from(seasonStanding)
      .innerJoin(user, eq(user.id, seasonStanding.userId))
      .where(eq(seasonStanding.seasonId, id));
    palmares.push({
      id,
      label,
      proclaimedAt: proclaimedAt!,
      rows: rows
        .map((row) => ({ ...row, avatar: isAvatarKey(row.avatar) ? row.avatar : ("maillot-bleu-uni" as const), isViewer: row.userId === viewer.id }))
        .sort((a, b) => a.rank - b.rank || byName.compare(a.name, b.name)),
      prizes: await getPrizes(db, viewer, id),
    });
  }
  return palmares;
}
