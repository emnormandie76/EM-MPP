import { tz } from "@date-fns/tz";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// Step 3 moves this constant to src/lib/game/time.ts.
const TIME_ZONE = "Europe/Paris";
const paris = tz(TIME_ZONE);

const numberFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

/** "2 450", "2 450,5" (narrow no-break space, decimal comma). */
export function formatNumber(n: number): string {
  return numberFormat.format(n);
}

/** Day and month in Paris time: "21 oct.", "1er oct.". */
function formatDayMonth(date: Date): string {
  const day = Number(format(date, "d", { in: paris }));
  const month = format(date, "MMM", { locale: fr, in: paris });
  return `${day === 1 ? "1er" : day} ${month}`;
}

/** "mer. 21 oct. à 18 h", "dim. 15 nov. à 18 h 30" (Paris time). */
export function formatDateTime(date: Date): string {
  const weekday = format(date, "EEE", { locale: fr, in: paris });
  const hour = format(date, "H", { in: paris });
  const minutes = format(date, "mm", { in: paris });
  const time = minutes === "00" ? `${hour} h` : `${hour} h ${minutes}`;
  return `${weekday} ${formatDayMonth(date)} à ${time}`;
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
