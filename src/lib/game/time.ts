import { TZDate } from "@date-fns/tz";

// Time zone, seasons and date conversions (architecture §5.1). Dates are stored in UTC;
// every display and every input uses Paris time, whatever the server's time zone.

export const TIME_ZONE = "Europe/Paris";

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const SEASON_LABEL = /^(\d{4})-(\d{4})$/;

/** First month of a season (October), zero-based as in `Date`. */
const SEASON_START_MONTH = 9;

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

/** Season of `date`, `YYYY-YYYY`: it starts on 1 October at 00:00, Paris time. */
export function seasonLabelFor(date: Date): string {
  const paris = new TZDate(date.getTime(), TIME_ZONE);
  const startYear = paris.getMonth() >= SEASON_START_MONTH ? paris.getFullYear() : paris.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
}

function seasonStartYear(label: string): number {
  const match = SEASON_LABEL.exec(label);
  if (!match || Number(match[2]) !== Number(match[1]) + 1) {
    throw new RangeError(`Invalid season label: ${JSON.stringify(label)}`);
  }
  return Number(match[1]);
}

function seasonStart(year: number): Date {
  return new Date(new TZDate(year, SEASON_START_MONTH, 1, 0, 0, TIME_ZONE).getTime());
}

/** From 1 October 00:00 (inclusive) to the next 1 October 00:00 (exclusive), Paris time. */
export function seasonBounds(label: string): { startsAt: Date; endsAt: Date } {
  const year = seasonStartYear(label);
  return { startsAt: seasonStart(year), endsAt: seasonStart(year + 1) };
}

export function previousSeasonLabel(label: string): string {
  const year = seasonStartYear(label);
  return `${year - 1}-${year}`;
}
