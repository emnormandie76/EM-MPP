import { tz } from "@date-fns/tz";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { TIME_ZONE } from "./game/time";

const paris = tz(TIME_ZONE);

const numberFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
/** Thousands separator: Intl gives a narrow no-break space, too thin to see in the site's fonts. */
const NARROW_NBSP = " ";
const NBSP = " ";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

/**
 * "2 450", "2 450,5": decimal comma, and a no-break space between thousands. The narrow one that
 * Intl gives could not be seen ("1027" for 1 027; test report of 01/10/2026, R-07).
 */
export function formatNumber(n: number): string {
  return numberFormat.format(n).replaceAll(NARROW_NBSP, NBSP);
}

/**
 * A malus given in hundredths (§5.5, v1.2), as a positive number with at most 2 decimals: 25050
 * gives "250,5". Never with a minus sign: the word "malus" says it all.
 */
export function formatMalus(hundredths: number): string {
  return formatNumber(hundredths / 100);
}

/** "250,5 de malus". */
export function malusText(hundredths: number): string {
  return `${formatMalus(hundredths)} de malus`;
}

/** The first letter in lower case: a reason after a colon (« pas publiée : la clôture… », R-06). */
export function lowerFirst(text: string): string {
  return text.charAt(0).toLocaleLowerCase("fr-FR") + text.slice(1);
}

const percentFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** A ratio as a percentage with at most one decimal: 0.048 → "4,8 %" (no-break space before %). */
export function formatPercent(ratio: number): string {
  return `${percentFormat.format(ratio * 100)} %`;
}

/** Day and month in Paris time: "21 oct.", "1er oct.". */
function formatDayMonth(date: Date): string {
  const day = Number(format(date, "d", { in: paris }));
  const month = format(date, "MMM", { locale: fr, in: paris });
  return `${day === 1 ? "1er" : day} ${month}`;
}

/** "1er oct. 2026", "30 sept. 2027" (Paris time). */
export function formatDate(date: Date): string {
  return `${formatDayMonth(date)} ${format(date, "yyyy", { in: paris })}`;
}

/** "18 h", "18 h 30" (Paris time). */
export function formatTime(date: Date): string {
  const hour = format(date, "H", { in: paris });
  const minutes = format(date, "mm", { in: paris });
  return minutes === "00" ? `${hour} h` : `${hour} h ${minutes}`;
}

/** "mer. 21 oct.", with the year when `now` is given and the date is of another year (R-08). */
function formatWeekday(date: Date, now?: Date): string {
  const weekday = format(date, "EEE", { locale: fr, in: paris });
  const year = format(date, "yyyy", { in: paris });
  const day = now && year !== format(now, "yyyy", { in: paris }) ? formatDate(date) : formatDayMonth(date);
  return `${weekday} ${day}`;
}

/**
 * "mer. 21 oct. à 18 h", "dim. 15 nov. à 18 h 30" (Paris time). Given `now`, a date of another
 * year carries it: "sam. 29 nov. 2025 à 23 h" (past seasons; test report of 01/10/2026, R-08).
 */
export function formatDateTime(date: Date, now?: Date): string {
  return `${formatWeekday(date, now)} à ${formatTime(date)}`;
}

/** The Paris day of a date, "2026-10-21": two dates of the same day have the same key. */
export function parisDayKey(date: Date): string {
  return format(date, "yyyy-MM-dd", { in: paris });
}

/**
 * Day separator of the chat (§8.3): "Aujourd'hui", "Hier", then "mer. 21 oct.", with the year when
 * it is not the current one (Paris days).
 */
export function formatChatDay(date: Date, now: Date): string {
  const day = parisDayKey(date);
  if (day === parisDayKey(now)) return "Aujourd'hui";
  if (day === parisDayKey(subDays(now, 1, { in: paris }))) return "Hier";
  return formatWeekday(date, now);
}

/** "il y a 2 h", or the Paris date after a week. Future dates read "à l'instant". */
export function formatRelative(date: Date, now: Date): string {
  const elapsed = now.getTime() - date.getTime();
  if (elapsed < MINUTE_MS) return "à l'instant";
  if (elapsed < HOUR_MS) return `il y a ${Math.floor(elapsed / MINUTE_MS)} min`;
  if (elapsed < DAY_MS) return `il y a ${Math.floor(elapsed / HOUR_MS)} h`;
  if (elapsed < WEEK_MS) return `il y a ${Math.floor(elapsed / DAY_MS)} j`;
  return `le ${formatDayMonth(date)}`;
}

/** "1 ajoutée", "3 ajoutées", "0 invalide": in French, the plural starts at 2. */
export function formatCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count >= 2 ? plural : singular}`;
}

/** Suffix of a rank: "1er", "2e", "10e". */
export function rankSuffix(rank: number): string {
  return rank === 1 ? "er" : "e";
}
