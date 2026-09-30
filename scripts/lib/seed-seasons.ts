import { seasonStartFromLocalDate, suggestedSeasonLabel, utcToParisLocalDate } from "../../src/lib/game/time";

// Seasons of the development and end-to-end data set (architecture §9.6), apart from the seed so
// that the end-to-end tests can read them without loading the database layer.

/** 1 October at 00:00, Paris time, of `year`. */
const octoberFirst = (year: number) => seasonStartFromLocalDate(`${year}-10-01`);

/** The seed's seasons: the one containing `now` and the one before, both starting on 1 October. */
export function seedSeasons(now: Date) {
  const year = Number(utcToParisLocalDate(now).slice(0, 4));
  const currentStart = octoberFirst(year) <= now ? octoberFirst(year) : octoberFirst(year - 1);
  const previousStart = octoberFirst(Number(utcToParisLocalDate(currentStart).slice(0, 4)) - 1);
  return {
    previous: { label: suggestedSeasonLabel(previousStart), startsAt: previousStart },
    current: { label: suggestedSeasonLabel(currentStart), startsAt: currentStart },
  };
}
