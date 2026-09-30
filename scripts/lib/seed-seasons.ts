import { seasonStartFromLocalDate, suggestedSeasonLabel, utcToParisLocalDate } from "../../src/lib/game/time";

// Seasons of the development and end-to-end data set (architecture §9.6), apart from the seed so
// that the end-to-end tests can read them without loading the database layer.

/** 1 October at 00:00, Paris time, of `year`. */
const octoberFirst = (year: number) => seasonStartFromLocalDate(`${year}-10-01`);

const season = (startsAt: Date) => ({ label: suggestedSeasonLabel(startsAt), startsAt });

/**
 * The seed's seasons, all starting on 1 October: the one containing `now` (current), the one before
 * (previous, proclaimed) and the one before that (older, ready to be proclaimed: decision of
 * 30/09/2026).
 */
export function seedSeasons(now: Date) {
  const year = Number(utcToParisLocalDate(now).slice(0, 4));
  const currentStart = octoberFirst(year) <= now ? octoberFirst(year) : octoberFirst(year - 1);
  const currentYear = Number(utcToParisLocalDate(currentStart).slice(0, 4));
  return {
    older: season(octoberFirst(currentYear - 2)),
    previous: season(octoberFirst(currentYear - 1)),
    current: season(currentStart),
  };
}
