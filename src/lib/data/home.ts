import "server-only";
import type { Viewer } from "@/lib/auth/session";
import type { Database } from "@/lib/db/client";
import { type AnnouncementView, getAnnouncements, getCurrentSeason } from "./content";
import { getJokersLeft, getOpenQuestionsForViewer, type PlayerQuestion } from "./questions";
import { getLatestResult, type LatestResult } from "./results";
import { getStandings, type Standings, type StandingView } from "./standings";

// Home page (architecture §7.4, §8.3): announcements, welcome and progress, rank, points and
// jokers, the next closings, the top of the standings and the latest result.

type PlayerViewer = Pick<Viewer, "id" | "role" | "lastSeenAt" | "previousVisitAt">;

export const HOME_ANNOUNCEMENTS = 3;
export const HOME_CLOSINGS = 5;
export const HOME_TOP = 6;

export type HomeData = {
  announcements: AnnouncementView[];
  /** Open questions and how many of them the viewer has validated. */
  progress: { open: number; validated: number };
  /** The next closings, soonest first. */
  closingSoon: PlayerQuestion[];
  standings: Omit<Standings, "rows"> & {
    top: StandingView[];
    /** The viewer's row, when they are not in the top rows. */
    mine: StandingView | null;
    /** The viewer's row, wherever they are. */
    me: StandingView | null;
  };
  /** Jokers left in the current season (§5.4). */
  jokersLeft: number;
  /** The latest resolved question, or null before the first result. */
  latestResult: LatestResult | null;
};

export async function getHomeData(db: Database, viewer: PlayerViewer, now: Date): Promise<HomeData> {
  const announcements = await getAnnouncements(db, viewer, { limit: HOME_ANNOUNCEMENTS });
  const open = await getOpenQuestionsForViewer(db, viewer, now);
  const { rows, ...standings } = await getStandings(db, viewer, {}, now);
  const current = await getCurrentSeason(db, viewer, now);

  const top = rows.slice(0, HOME_TOP);
  const me = rows.find(({ isViewer }) => isViewer) ?? null;
  return {
    announcements,
    progress: { open: open.length, validated: open.filter(({ state }) => state === "validated").length },
    closingSoon: open.slice(0, HOME_CLOSINGS),
    standings: { ...standings, top, me, mine: me && !top.includes(me) ? me : null },
    jokersLeft: await getJokersLeft(db, viewer, current?.id ?? null),
    latestResult: await getLatestResult(db, viewer, now),
  };
}
