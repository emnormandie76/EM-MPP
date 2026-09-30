// Countdown to the closing of a question (architecture §5.10).

/** Under this remaining time, the countdown turns "hot". */
export const URGENT_THRESHOLD_MS = 48 * 60 * 60 * 1000;

export type CountdownParts = { d: number; h: string; m: string; s: string; label: string };

function twoDigits(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * "3 j 07:45:10". Seconds are rounded up, so 00:00:00 only shows once the question is closed.
 * A negative duration counts as 0.
 */
export function countdownParts(ms: number): CountdownParts {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(total / 86_400);
  const h = twoDigits(Math.floor((total % 86_400) / 3600));
  const m = twoDigits(Math.floor((total % 3600) / 60));
  const s = twoDigits(total % 60);
  const clock = `${h}:${m}:${s}`;
  return { d, h, m, s, label: d > 0 ? `${d} j ${clock}` : clock };
}

export function isUrgent(remainingMs: number): boolean {
  return remainingMs > 0 && remainingMs < URGENT_THRESHOLD_MS;
}
