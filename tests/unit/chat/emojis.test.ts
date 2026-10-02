import { describe, expect, it } from "vitest";
import { CHAT_EMOJIS } from "@/lib/chat/emojis";
import { findForbiddenWords } from "../../helpers/vocabulary";

// The emoji grid of the chat (architecture §5.15): 48 chosen emojis, each with its French name,
// which is the accessible name of its button.

describe("CHAT_EMOJIS", () => {
  it("has 48 distinct emojis, a grid of 8 columns by 6 rows", () => {
    expect(CHAT_EMOJIS).toHaveLength(48);
    expect(new Set(CHAT_EMOJIS.map(({ emoji }) => emoji)).size).toBe(48);
  });

  it("gives each emoji a distinct French name", () => {
    for (const { emoji, name } of CHAT_EMOJIS) {
      expect(name.trim(), emoji).not.toBe("");
      expect(name, emoji).toBe(name.trim());
    }
    expect(new Set(CHAT_EMOJIS.map(({ name }) => name)).size).toBe(48);
  });

  it("starts and ends as in the architecture", () => {
    expect(CHAT_EMOJIS[0]).toEqual({ emoji: "😀", name: "visage souriant" });
    expect(CHAT_EMOJIS[38]).toEqual({ emoji: "🃏", name: "joker" });
    expect(CHAT_EMOJIS[47]).toEqual({ emoji: "🚀", name: "fusée" });
  });

  it("uses no betting word in the names (§9.3)", () => {
    expect(findForbiddenWords(CHAT_EMOJIS.map(({ name }) => name).join(" "))).toEqual([]);
  });
});
