import { describe, expect, it } from "vitest";
import { countdownParts, isUrgent, URGENT_THRESHOLD_MS } from "@/lib/game/countdown";

const S = 1000;
const MIN = 60 * S;
const H = 60 * MIN;
const D = 24 * H;

describe("countdownParts", () => {
  it("splits into days, hours, minutes and seconds, 2 digits each except days", () => {
    expect(countdownParts(3 * D + 7 * H + 45 * MIN + 10 * S)).toEqual({ d: 3, h: "07", m: "45", s: "10", label: "3 j 07:45:10" });
  });

  it("drops the days from the label under one day", () => {
    expect(countdownParts(7 * H + 5 * MIN + 9 * S)).toEqual({ d: 0, h: "07", m: "05", s: "09", label: "07:05:09" });
  });

  it("rounds up to the second: it only shows 00:00:00 once the time is up", () => {
    expect(countdownParts(1).label).toBe("00:00:01");
    expect(countdownParts(S - 1).label).toBe("00:00:01");
    expect(countdownParts(S).label).toBe("00:00:01");
    expect(countdownParts(S + 1).label).toBe("00:00:02");
    expect(countdownParts(D).label).toBe("1 j 00:00:00");
  });

  it("counts a negative or zero duration as 0", () => {
    expect(countdownParts(0)).toEqual({ d: 0, h: "00", m: "00", s: "00", label: "00:00:00" });
    expect(countdownParts(-5 * MIN)).toEqual(countdownParts(0));
  });

  it("handles long durations", () => {
    expect(countdownParts(123 * D + 23 * H + 59 * MIN + 59 * S).label).toBe("123 j 23:59:59");
  });
});

describe("isUrgent", () => {
  it("is urgent under 48 h, not at or beyond, and not once closed", () => {
    expect(URGENT_THRESHOLD_MS).toBe(48 * H);
    expect(isUrgent(48 * H - 1)).toBe(true);
    expect(isUrgent(S)).toBe(true);
    expect(isUrgent(48 * H)).toBe(false);
    expect(isUrgent(3 * D)).toBe(false);
    expect(isUrgent(0)).toBe(false);
  });
});
