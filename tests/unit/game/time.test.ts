import { describe, expect, it } from "vitest";
import {
  parisLocalToUtc,
  previousSeasonLabel,
  seasonBounds,
  seasonLabelFor,
  TIME_ZONE,
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

  it("reads midnight on 1 October as the start of the season", () => {
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

describe("seasonLabelFor", () => {
  it("T4: 23:59:59 in Paris on 30 September belongs to the ending season", () => {
    expect(seasonLabelFor(utc("2026-09-30T21:59:59Z"))).toBe("2025-2026");
  });

  it("T5: 00:00 in Paris on 1 October starts the new season", () => {
    expect(seasonLabelFor(utc("2026-09-30T22:00:00Z"))).toBe("2026-2027");
  });

  it("T6: a date in spring belongs to the season that started the previous October", () => {
    expect(seasonLabelFor(utc("2027-05-31T10:00:00Z"))).toBe("2026-2027");
  });

  it("uses Paris time in winter too (31 December and 1 January)", () => {
    expect(seasonLabelFor(utc("2026-12-31T22:59:59Z"))).toBe("2026-2027");
    expect(seasonLabelFor(utc("2026-12-31T23:00:00Z"))).toBe("2026-2027");
    expect(seasonLabelFor(utc("2027-01-15T12:00:00Z"))).toBe("2026-2027");
  });
});

describe("seasonBounds", () => {
  it("T7: runs from 1 October 00:00 to the next 1 October 00:00, Paris time", () => {
    const { startsAt, endsAt } = seasonBounds("2026-2027");
    expect(startsAt.toISOString()).toBe("2026-09-30T22:00:00.000Z");
    expect(endsAt.toISOString()).toBe("2027-09-30T22:00:00.000Z");
  });

  it("is consistent with seasonLabelFor at both ends", () => {
    const { startsAt, endsAt } = seasonBounds("2026-2027");
    expect(seasonLabelFor(startsAt)).toBe("2026-2027");
    expect(seasonLabelFor(new Date(endsAt.getTime() - 1))).toBe("2026-2027");
    expect(seasonLabelFor(endsAt)).toBe("2027-2028");
  });

  it.each(["2026", "2026-2028", "2026-2025", "26-27", " 2026-2027", "abcd-efgh"])("rejects the label %j", (label) => {
    expect(() => seasonBounds(label)).toThrow(RangeError);
  });
});

describe("previousSeasonLabel", () => {
  it("gives the season before", () => {
    expect(previousSeasonLabel("2026-2027")).toBe("2025-2026");
  });

  it("rejects an invalid label", () => {
    expect(() => previousSeasonLabel("2026")).toThrow(RangeError);
  });
});

describe("time zone", () => {
  it("T8: tests run in UTC, and the rules still use Paris time", () => {
    expect(process.env.TZ).toBe("UTC");
    expect(new Date("2026-10-21T16:00:00Z").getHours()).toBe(16);
    expect(TIME_ZONE).toBe("Europe/Paris");
  });
});
