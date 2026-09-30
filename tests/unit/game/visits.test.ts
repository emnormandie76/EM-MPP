import { describe, expect, it } from "vitest";
import { isNew, NEW_VISIT_GAP_MS, newReference, nextVisitFields } from "@/lib/game/visits";

const now = new Date("2026-10-15T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("newReference and isNew", () => {
  it("V1: no badge before the first visit is recorded", () => {
    const reference = newReference({ lastSeenAt: null, previousVisitAt: null }, now);
    expect(reference).toBeNull();
    expect(isNew(ago(HOUR), reference)).toBe(false);
  });

  it("V2: last seen 2 h ago, question opened 1 h ago: badge", () => {
    const reference = newReference({ lastSeenAt: ago(2 * HOUR), previousVisitAt: ago(3 * DAY) }, now);
    expect(reference).toEqual(ago(2 * HOUR));
    expect(isNew(ago(HOUR), reference)).toBe(true);
  });

  it("V3: last seen 10 min ago (same visit), previous visit 3 days ago, question opened yesterday: badge", () => {
    const reference = newReference({ lastSeenAt: ago(10 * MIN), previousVisitAt: ago(3 * DAY) }, now);
    expect(reference).toEqual(ago(3 * DAY));
    expect(isNew(ago(DAY), reference)).toBe(true);
  });

  it("V4: question opened before the reference: no badge", () => {
    const reference = newReference({ lastSeenAt: ago(2 * HOUR), previousVisitAt: null }, now);
    expect(isNew(ago(3 * HOUR), reference)).toBe(false);
    expect(isNew(ago(2 * HOUR), reference)).toBe(false);
  });

  it("keeps the same visit up to exactly 30 minutes", () => {
    expect(NEW_VISIT_GAP_MS).toBe(30 * MIN);
    const user = { lastSeenAt: ago(30 * MIN), previousVisitAt: ago(DAY) };
    expect(newReference(user, now)).toEqual(ago(DAY));
    expect(newReference({ ...user, lastSeenAt: ago(30 * MIN + 1) }, now)).toEqual(ago(30 * MIN + 1));
  });

  it("gives no badge during the first visit (no previous visit yet)", () => {
    expect(newReference({ lastSeenAt: ago(5 * MIN), previousVisitAt: null }, now)).toBeNull();
  });
});

describe("nextVisitFields (recordVisit)", () => {
  it("starts a new visit after more than 30 minutes: the last visit becomes the previous one", () => {
    expect(nextVisitFields({ lastSeenAt: ago(2 * HOUR), previousVisitAt: ago(3 * DAY) }, now)).toEqual({
      lastSeenAt: now,
      previousVisitAt: ago(2 * HOUR),
    });
  });

  it("within the same visit, only moves the last seen date", () => {
    expect(nextVisitFields({ lastSeenAt: ago(10 * MIN), previousVisitAt: ago(3 * DAY) }, now)).toEqual({
      lastSeenAt: now,
      previousVisitAt: ago(3 * DAY),
    });
  });

  it("records the very first visit", () => {
    expect(nextVisitFields({ lastSeenAt: null, previousVisitAt: null }, now)).toEqual({ lastSeenAt: now, previousVisitAt: null });
  });
});
