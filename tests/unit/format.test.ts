import { describe, expect, it } from "vitest";
import { formatCount, formatDateTime, formatNumber, formatRelative } from "@/lib/format";

const NARROW_NBSP = " ";

describe("formatNumber", () => {
  it("groups thousands with a narrow no-break space", () => {
    expect(formatNumber(2450)).toBe(`2${NARROW_NBSP}450`);
  });

  it("uses a decimal comma and at most 2 decimals", () => {
    expect(formatNumber(2450.5)).toBe(`2${NARROW_NBSP}450,5`);
    expect(formatNumber(12.345)).toBe("12,35");
  });

  it("formats small and zero values", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(250)).toBe("250");
  });
});

describe("formatDateTime", () => {
  it("shows Paris summer time without minutes", () => {
    expect(formatDateTime(new Date("2026-10-21T16:00:00Z"))).toBe("mer. 21 oct. à 18 h");
  });

  it("shows Paris winter time with minutes", () => {
    expect(formatDateTime(new Date("2026-11-15T17:30:00Z"))).toBe("dim. 15 nov. à 18 h 30");
  });

  it("writes the first day of the month as 1er", () => {
    expect(formatDateTime(new Date("2026-10-01T07:05:00Z"))).toBe("jeu. 1er oct. à 9 h 05");
  });

  it("uses the Paris date, not the UTC date, around midnight", () => {
    // 22:30 UTC on 30 Sept is 00:30 on 1 Oct in Paris.
    expect(formatDateTime(new Date("2026-09-30T22:30:00Z"))).toBe("jeu. 1er oct. à 0 h 30");
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-10-21T16:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  it("says 'à l'instant' under a minute, and for future dates", () => {
    expect(formatRelative(ago(30_000), now)).toBe("à l'instant");
    expect(formatRelative(new Date(now.getTime() + HOUR), now)).toBe("à l'instant");
  });

  it("counts minutes, then hours, then days", () => {
    expect(formatRelative(ago(5 * MIN), now)).toBe("il y a 5 min");
    expect(formatRelative(ago(59 * MIN), now)).toBe("il y a 59 min");
    expect(formatRelative(ago(2 * HOUR), now)).toBe("il y a 2 h");
    expect(formatRelative(ago(23 * HOUR + 59 * MIN), now)).toBe("il y a 23 h");
    expect(formatRelative(ago(3 * DAY), now)).toBe("il y a 3 j");
  });

  it("gives the Paris date after a week", () => {
    expect(formatRelative(ago(7 * DAY), now)).toBe("le 14 oct.");
    expect(formatRelative(new Date("2026-09-30T22:30:00Z"), now)).toBe("le 1er oct.");
  });
});

describe("formatCount", () => {
  it("uses the plural from 2, as in French", () => {
    expect(formatCount(0, "invalide")).toBe("0 invalide");
    expect(formatCount(1, "ajoutée")).toBe("1 ajoutée");
    expect(formatCount(3, "ajoutée")).toBe("3 ajoutées");
    expect(formatCount(2, "déjà présente")).toBe("2 déjà présentes");
    expect(formatCount(2, "œil", "yeux")).toBe("2 yeux");
  });
});
