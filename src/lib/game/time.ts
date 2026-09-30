import { TZDate } from "@date-fns/tz";

// Time zone, date conversions and seasons (architecture §5.1). Dates are stored in UTC;
// every display and every input uses Paris time, whatever the server's time zone.

export const TIME_ZONE = "Europe/Paris";

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Reads the value of an `<input type="datetime-local">` (`YYYY-MM-DDTHH:mm`) as a Paris time. */
export function parisLocalToUtc(value: string): Date {
  const match = LOCAL_INPUT.exec(value);
  if (!match) throw new RangeError(`Invalid local date-time: ${JSON.stringify(value)}`);
  const [year, month, day, hours, minutes] = match.slice(1).map(Number);
  // Rejects 30 February, 24:00, minute 60… by checking that the calendar keeps the values.
  const calendar = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  const valid =
    calendar.getUTCFullYear() === year &&
    calendar.getUTCMonth() === month - 1 &&
    calendar.getUTCDate() === day &&
    calendar.getUTCHours() === hours &&
    calendar.getUTCMinutes() === minutes;
  if (!valid) throw new RangeError(`Invalid local date-time: ${JSON.stringify(value)}`);
  return new Date(new TZDate(year, month - 1, day, hours, minutes, TIME_ZONE).getTime());
}

/** The Paris local value of `date`, to prefill an `<input type="datetime-local">`. */
export function utcToParisLocalInput(date: Date): string {
  const paris = new TZDate(date.getTime(), TIME_ZONE);
  const day = `${paris.getFullYear()}-${pad(paris.getMonth() + 1)}-${pad(paris.getDate())}`;
  return `${day}T${pad(paris.getHours())}:${pad(paris.getMinutes())}`;
}

/** The Paris day of `date`, `YYYY-MM-DD`, to prefill an `<input type="date">`. */
export function utcToParisLocalDate(date: Date): string {
  return utcToParisLocalInput(date).slice(0, 10);
}

// Seasons (v1.1): created by the admin with a name and a start day. They follow one another with
// no gap and no overlap: each one ends where the next one starts (exclusive), and the last one has
// no end until the next one is created. The functions receive the seasons read by the caller, in
// any order.

type SeasonStart = { startsAt: Date };

/** Reads an `<input type="date">` value (`YYYY-MM-DD`) as 00:00 that day, Paris time: a season start. */
export function seasonStartFromLocalDate(value: string): Date {
  const match = LOCAL_DATE.exec(value);
  if (!match) throw new RangeError(`Invalid local date: ${JSON.stringify(value)}`);
  return parisLocalToUtc(`${value}T00:00`);
}

/** The season of `date`: the latest start not after it; null before the first season. */
export function seasonAt<S extends SeasonStart>(seasons: readonly S[], date: Date): S | null {
  let found: S | null = null;
  for (const season of seasons) {
    const start = season.startsAt.getTime();
    if (start <= date.getTime() && (found === null || start > found.startsAt.getTime())) found = season;
  }
  return found;
}

/** The end of `season` (exclusive): the start of the next season, or null for the last one. */
export function seasonEnd<S extends SeasonStart>(seasons: readonly S[], season: S): Date | null {
  let end: Date | null = null;
  for (const other of seasons) {
    const start = other.startsAt.getTime();
    if (start > season.startsAt.getTime() && (end === null || start < end.getTime())) end = other.startsAt;
  }
  return end;
}

/** The season just before `season`, or null for the first one. */
export function previousSeason<S extends SeasonStart>(seasons: readonly S[], season: S): S | null {
  return seasonAt(
    seasons.filter((other) => other.startsAt.getTime() < season.startsAt.getTime()),
    season.startsAt,
  );
}

/** Default name offered by the creation form: `YYYY-YYYY` after the Paris year of the start. */
export function suggestedSeasonLabel(startsAt: Date): string {
  const year = new TZDate(startsAt.getTime(), TIME_ZONE).getFullYear();
  return `${year}-${year + 1}`;
}
