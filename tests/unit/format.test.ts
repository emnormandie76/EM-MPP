import { describe, expect, it } from "vitest";
import {
  formatChatDay,
  formatCount,
  formatDate,
  formatDateTime,
  formatMalus,
  formatNumber,
  formatPercent,
  formatRelative,
  formatTime,
  lowerFirst,
  malusText,
  parisDayKey,
  rankSuffix,
} from "@/lib/format";

const NBSP = " ";

describe("formatMalus", () => {
  it("shows a malus in hundredths as a positive number with at most 2 decimals (v1.2)", () => {
    expect(formatMalus(25_050)).toBe("250,5");
    expect(formatMalus(5)).toBe("0,05");
    expect(formatMalus(0)).toBe("0");
    expect(formatMalus(2_400_000)).toBe(`24${NBSP}000`);
    expect(malusText(25_000)).toBe("250 de malus");
  });
});

describe("formatNumber", () => {
  it("groups thousands with a no-break space, not the narrow one, too thin to see (R-07)", () => {
    expect(formatNumber(2450)).toBe(`2${NBSP}450`);
    expect(formatNumber(1234567)).toBe(`1${NBSP}234${NBSP}567`);
    expect(formatNumber(1027)).not.toContain(" ");
  });

  it("uses a decimal comma and at most 2 decimals", () => {
    expect(formatNumber(2450.5)).toBe(`2${NBSP}450,5`);
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

  it("given now, shows the year of a date from another year only (R-08)", () => {
    const now = new Date("2026-10-01T10:00:00Z");
    expect(formatDateTime(new Date("2025-11-29T22:00:00Z"), now)).toBe("sam. 29 nov. 2025 à 23 h");
    expect(formatDateTime(new Date("2027-01-15T17:30:00Z"), now)).toBe("ven. 15 janv. 2027 à 18 h 30");
    expect(formatDateTime(new Date("2026-10-21T16:00:00Z"), now)).toBe("mer. 21 oct. à 18 h");
  });

  it("compares the years in Paris time", () => {
    // 31 Dec 2026 23:30 UTC is already 1 Jan 2027 in Paris.
    const newYear = new Date("2026-12-31T23:30:00Z");
    expect(formatDateTime(newYear, new Date("2027-01-02T12:00:00Z"))).toBe("ven. 1er janv. à 0 h 30");
    expect(formatDateTime(newYear, new Date("2026-12-31T12:00:00Z"))).toBe("ven. 1er janv. 2027 à 0 h 30");
  });
});

describe("lowerFirst", () => {
  it("puts the first letter in lower case, for a reason after a colon (R-06)", () => {
    expect(lowerFirst("La clôture est déjà passée. Il manque la date d'ouverture.")).toBe("la clôture est déjà passée. Il manque la date d'ouverture.");
    expect(lowerFirst("Écris un nombre.")).toBe("écris un nombre.");
    expect(lowerFirst("")).toBe("");
  });
});

describe("formatDate", () => {
  it("shows the Paris day, with 1er for the first of the month", () => {
    // 1 October 00:00 in Paris is still 30 September in UTC.
    expect(formatDate(new Date("2026-09-30T22:00:00Z"))).toBe("1er oct. 2026");
    expect(formatDate(new Date("2027-09-30T21:59:59Z"))).toBe("30 sept. 2027");
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

describe("formatPercent", () => {
  it("writes a ratio as a French percentage, with at most one decimal", () => {
    expect(formatPercent(0.04)).toBe("4 %");
    expect(formatPercent(0.048)).toBe("4,8 %");
    expect(formatPercent(0.004)).toBe("0,4 %");
    expect(formatPercent(0.0104)).toBe("1 %");
    expect(formatPercent(0)).toBe("0 %");
  });
});

describe("rankSuffix", () => {
  it("writes 1er, then 2e, 3e…", () => {
    expect([1, 2, 3, 10, 21].map((rank) => `${rank}${rankSuffix(rank)}`)).toEqual(["1er", "2e", "3e", "10e", "21e"]);
  });
});

describe("formatTime and formatChatDay (chat, §8.3)", () => {
  it("gives the Paris time, with minutes only when there are some", () => {
    expect(formatTime(new Date("2026-10-21T12:32:00Z"))).toBe("14 h 32");
    expect(formatTime(new Date("2026-11-15T17:00:00Z"))).toBe("18 h");
    expect(formatTime(new Date("2026-10-21T22:05:00Z"))).toBe("0 h 05");
  });

  it("names today and yesterday in Paris days, then the date, with the year if needed", () => {
    const now = new Date("2026-10-21T10:00:00Z");
    expect(formatChatDay(new Date("2026-10-20T22:30:00Z"), now)).toBe("Aujourd'hui");
    expect(formatChatDay(new Date("2026-10-20T21:59:00Z"), now)).toBe("Hier");
    expect(formatChatDay(new Date("2026-10-19T21:59:00Z"), now)).toBe("lun. 19 oct.");
    expect(formatChatDay(new Date("2025-12-31T12:00:00Z"), now)).toBe("mer. 31 déc. 2025");
  });

  it("finds yesterday across a change of time", () => {
    // Sunday 25 October 2026 has 25 hours in Paris; Monday 00:30 is 23:30 UTC on Sunday.
    expect(formatChatDay(new Date("2026-10-25T00:30:00Z"), new Date("2026-10-25T23:30:00Z"))).toBe("Hier");
    // Sunday 28 March 2027 has 23 hours; Monday 0:30 in Paris is 22:30 UTC on Sunday.
    expect(formatChatDay(new Date("2027-03-27T23:30:00Z"), new Date("2027-03-28T22:30:00Z"))).toBe("Hier");
  });

  it("keys the Paris day of a date", () => {
    expect(parisDayKey(new Date("2026-09-30T22:30:00Z"))).toBe("2026-10-01");
  });
});
