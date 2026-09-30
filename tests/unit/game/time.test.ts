import { describe, expect, it } from "vitest";
import {
  parisLocalToUtc,
  previousSeason,
  seasonAt,
  seasonEnd,
  seasonStartFromLocalDate,
  suggestedSeasonLabel,
  TIME_ZONE,
  utcToParisLocalDate,
  utcToParisLocalInput,
} from "@/lib/game/time";

const utc = (iso: string) => new Date(iso);

describe("parisLocalToUtc", () => {
  it("T1: reads summer time (UTC+2)", () => {
    expect(parisLocalToUtc("2026-10-21T18:00").toISOString()).toBe("2026-10-21T16:00:00.000Z");
  });

  it("T2: reads winter time (UTC+1)", () => {
    expect(parisLocalToUtc("2026-11-15T18:00").toISOString()).toBe("2026-11-15T17:00:00.000Z");
  });

  it("handles both sides of the October clock change", () => {
    // Clocks go back at 03:00 on 25 Oct 2026 (Paris).
    expect(parisLocalToUtc("2026-10-24T12:00").toISOString()).toBe("2026-10-24T10:00:00.000Z");
    expect(parisLocalToUtc("2026-10-26T12:00").toISOString()).toBe("2026-10-26T11:00:00.000Z");
  });

  it("reads midnight on 1 October", () => {
    expect(parisLocalToUtc("2026-10-01T00:00").toISOString()).toBe("2026-09-30T22:00:00.000Z");
  });

  it.each(["", "2026-10-21", "2026-10-21 18:00", "2026-10-21T18:00:00", "21/10/2026 18:00", "2026-13-01T10:00", "2026-02-30T10:00", "2026-10-21T24:00"])(
    "rejects %j",
    (value) => {
      expect(() => parisLocalToUtc(value)).toThrow(RangeError);
    },
  );
});

describe("utcToParisLocalInput", () => {
  it("T3: gives the Paris local value of a UTC date", () => {
    expect(utcToParisLocalInput(utc("2026-10-21T16:00:00Z"))).toBe("2026-10-21T18:00");
  });

  it("round-trips with parisLocalToUtc, in summer and in winter", () => {
    for (const value of ["2026-10-21T18:00", "2026-11-15T09:05", "2027-06-01T00:00"]) {
      expect(utcToParisLocalInput(parisLocalToUtc(value))).toBe(value);
    }
  });

  it("gives the Paris date, not the UTC date, around midnight", () => {
    expect(utcToParisLocalInput(utc("2026-09-30T22:30:00Z"))).toBe("2026-10-01T00:30");
  });
});

describe("seasons created by the admin (v1.1)", () => {
  // Vectors T4 to T7: season A starts on 29 September 2025, season B on 1 October 2026.
  const A = { name: "A", startsAt: seasonStartFromLocalDate("2025-09-29") };
  const B = { name: "B", startsAt: seasonStartFromLocalDate("2026-10-01") };
  // Deliberately out of order: the functions do not rely on the order of the list.
  const seasons = [B, A];

  it("T4: 23:59:59 in Paris on 30 September belongs to the ending season", () => {
    expect(seasonAt(seasons, utc("2026-09-30T21:59:59Z"))).toBe(A);
  });

  it("T5: 00:00 in Paris on the start day begins the new season", () => {
    expect(seasonAt(seasons, utc("2026-09-30T22:00:00Z"))).toBe(B);
  });

  it("T6: a date before the first season has no season", () => {
    expect(seasonAt(seasons, utc("2025-09-28T12:00:00Z"))).toBeNull();
    expect(seasonAt(seasons, utc("2025-09-28T21:59:59.999Z"))).toBeNull();
    expect(seasonAt(seasons, utc("2025-09-28T22:00:00Z"))).toBe(A);
  });

  it("T7: the last season has no end: it goes on until the next one is created", () => {
    expect(seasonAt(seasons, utc("2031-01-01T00:00:00Z"))).toBe(B);
    expect(seasonEnd(seasons, B)).toBeNull();
    expect(seasonEnd(seasons, A)).toEqual(B.startsAt);
  });

  it("finds no season in an empty list", () => {
    expect(seasonAt([], utc("2026-10-14T07:00:00Z"))).toBeNull();
  });

  it("gives the previous season, or null for the first one", () => {
    expect(previousSeason(seasons, B)).toBe(A);
    expect(previousSeason(seasons, A)).toBeNull();
    const C = { name: "C", startsAt: seasonStartFromLocalDate("2027-09-06") };
    expect(previousSeason([C, A, B], C)).toBe(B);
    expect(seasonEnd([C, A, B], B)).toEqual(C.startsAt);
    expect(seasonAt([C, A, B], utc("2027-09-05T21:59:59Z"))).toBe(B);
    expect(seasonAt([C, A, B], utc("2027-09-05T22:00:00Z"))).toBe(C);
  });
});

describe("seasonStartFromLocalDate", () => {
  it("reads the day as 00:00 in Paris, in summer and in winter", () => {
    expect(seasonStartFromLocalDate("2026-10-01").toISOString()).toBe("2026-09-30T22:00:00.000Z");
    expect(seasonStartFromLocalDate("2027-01-04").toISOString()).toBe("2027-01-03T23:00:00.000Z");
  });

  it("T9: the day after the switch to summer time starts at 22:00 UTC", () => {
    expect(seasonStartFromLocalDate("2027-03-29").toISOString()).toBe("2027-03-28T22:00:00.000Z");
  });

  it("round-trips with utcToParisLocalDate", () => {
    for (const value of ["2026-10-01", "2027-03-28", "2027-03-29", "2027-10-31", "2028-02-29"]) {
      expect(utcToParisLocalDate(seasonStartFromLocalDate(value))).toBe(value);
    }
  });

  it.each(["", "2026-10-01T00:00", "01/10/2026", "2026-13-01", "2026-02-30", "2027-02-29", " 2026-10-01"])("rejects %j", (value) => {
    expect(() => seasonStartFromLocalDate(value)).toThrow(RangeError);
  });
});

describe("utcToParisLocalDate", () => {
  it("gives the Paris day, not the UTC day, around midnight", () => {
    expect(utcToParisLocalDate(utc("2026-09-30T21:59:59Z"))).toBe("2026-09-30");
    expect(utcToParisLocalDate(utc("2026-09-30T22:00:00Z"))).toBe("2026-10-01");
  });
});

describe("suggestedSeasonLabel", () => {
  it("names the season after the Paris year of its start", () => {
    expect(suggestedSeasonLabel(seasonStartFromLocalDate("2026-10-01"))).toBe("2026-2027");
    expect(suggestedSeasonLabel(seasonStartFromLocalDate("2027-09-06"))).toBe("2027-2028");
    // 1 January 2027 at 00:00 in Paris is still 31 December 2026 in UTC.
    expect(suggestedSeasonLabel(seasonStartFromLocalDate("2027-01-01"))).toBe("2027-2028");
  });
});

describe("time zone", () => {
  it("T8: tests run in UTC, and the rules still use Paris time", () => {
    expect(process.env.TZ).toBe("UTC");
    expect(new Date("2026-10-21T16:00:00Z").getHours()).toBe(16);
    expect(TIME_ZONE).toBe("Europe/Paris");
  });
});
