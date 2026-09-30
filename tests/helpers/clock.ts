// Date maker for tests (architecture §9.2): makeClock("2026-10-21T16:00:00Z").at("+2h").

const UNITS_MS = { ms: 1, s: 1000, min: 60_000, h: 3_600_000, d: 86_400_000 } as const;
const OFFSET = /^([+-])(\d+(?:\.\d+)?)(ms|s|min|h|d)$/;

export type Clock = {
  now: Date;
  /** `now` shifted by an offset such as "+2h", "-1d", "+30min", "-1ms". */
  at(offset: string): Date;
};

export function makeClock(iso: string): Clock {
  const now = new Date(iso);
  if (Number.isNaN(now.getTime())) throw new RangeError(`Invalid date: ${iso}`);
  return {
    now,
    at(offset) {
      const match = OFFSET.exec(offset);
      if (!match) throw new RangeError(`Invalid offset: ${offset}`);
      const [, sign, amount, unit] = match;
      const ms = Number(amount) * UNITS_MS[unit as keyof typeof UNITS_MS];
      return new Date(now.getTime() + (sign === "-" ? -ms : ms));
    },
  };
}
