import "server-only";
import { asc, desc, eq, lte } from "drizzle-orm";
import type { Viewer } from "@/lib/auth/session";
import type { Database } from "@/lib/db/client";
import { announcement, prize, season } from "@/lib/db/schema";

// Announcements, prizes and the current season, visible to every signed-in account (architecture
// §7.4). The palmarès arrives in step 7.

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
