import { describe, expect, it } from "vitest";
import { CHAT_IDLE_MS, CHAT_POLL_MS } from "@/lib/chat/constants";
import { shouldPoll } from "@/lib/chat/polling";

// Polling of the chat page (architecture §5.15, vector CH11): only while the tab is visible and the
// person acted in the last 5 minutes, to spare the free quotas of Vercel and Neon.

const now = 1_790_000_000_000;
const MIN = 60_000;

describe("shouldPoll", () => {
  it("polls every 10 seconds and pauses after 5 minutes without any action", () => {
    expect(CHAT_POLL_MS).toBe(10_000);
    expect(CHAT_IDLE_MS).toBe(5 * MIN);
  });

  it("CH11: hidden tab: no", () => {
    expect(shouldPoll({ visible: false, lastActivityAt: now, now })).toBe(false);
    expect(shouldPoll({ visible: false, lastActivityAt: now - MIN, now })).toBe(false);
  });

  it("CH11: visible, idle for 6 minutes: no", () => {
    expect(shouldPoll({ visible: true, lastActivityAt: now - 6 * MIN, now })).toBe(false);
  });

  it("CH11: visible, active 1 minute ago: yes", () => {
    expect(shouldPoll({ visible: true, lastActivityAt: now - MIN, now })).toBe(true);
  });

  it("pauses once the 5 minutes are over, not before", () => {
    expect(shouldPoll({ visible: true, lastActivityAt: now - 5 * MIN + 1, now })).toBe(true);
    expect(shouldPoll({ visible: true, lastActivityAt: now - 5 * MIN, now })).toBe(false);
  });

  it("polls when the last action is in the future (clock adjusted meanwhile)", () => {
    expect(shouldPoll({ visible: true, lastActivityAt: now + MIN, now })).toBe(true);
  });
});
