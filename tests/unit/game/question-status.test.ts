import { describe, expect, it } from "vitest";
import { questionStatus, type StatusInput } from "@/lib/game/question-status";

const opensAt = new Date("2026-10-14T07:00:00Z");
const closesAt = new Date("2026-10-21T16:00:00Z");
const ms = (date: Date, delta: number) => new Date(date.getTime() + delta);

const published: StatusInput = { status: "published", opensAt, closesAt, resolvedAt: null };

describe("questionStatus", () => {
  it("S1: published, one millisecond before opening: scheduled", () => {
    expect(questionStatus(published, ms(opensAt, -1))).toBe("scheduled");
  });

  it("S2: published, at the exact opening: open (opening included)", () => {
    expect(questionStatus(published, opensAt)).toBe("open");
  });

  it("S3: published, one millisecond before closing: open", () => {
    expect(questionStatus(published, ms(closesAt, -1))).toBe("open");
  });

  it("S4: published, at the exact closing: closed (closing excluded)", () => {
    expect(questionStatus(published, closesAt)).toBe("closed");
  });

  it("S5: published with a result: resolved", () => {
    const resolvedAt = new Date("2026-11-20T10:00:00Z");
    expect(questionStatus({ ...published, resolvedAt }, new Date("2026-12-01T00:00:00Z"))).toBe("resolved");
  });

  it("S6: cancelled with a result: cancelled", () => {
    const question = { ...published, status: "cancelled" as const, resolvedAt: new Date("2026-11-20T10:00:00Z") };
    expect(questionStatus(question, new Date("2026-12-01T00:00:00Z"))).toBe("cancelled");
  });

  it("S7: draft with past dates: draft", () => {
    expect(questionStatus({ ...published, status: "draft" }, new Date("2027-01-01T00:00:00Z"))).toBe("draft");
  });

  it("a draft without dates is a draft", () => {
    expect(questionStatus({ status: "draft", opensAt: null, closesAt: null, resolvedAt: null }, opensAt)).toBe("draft");
  });

  it("a published question missing its dates is treated as a draft (never shown to players)", () => {
    expect(questionStatus({ ...published, opensAt: null }, closesAt)).toBe("draft");
    expect(questionStatus({ ...published, closesAt: null }, closesAt)).toBe("draft");
  });
});
