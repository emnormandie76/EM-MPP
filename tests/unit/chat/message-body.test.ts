import { describe, expect, it } from "vitest";
import { messageLength, normalizeMessageBody } from "@/lib/chat/message-body";

// Text of a chat message (architecture §5.15): line ends normalized, spaces trimmed at both ends,
// inner line breaks kept; the length is counted in Unicode code points, like PostgreSQL.

describe("normalizeMessageBody", () => {
  it("normalizes the line ends to \\n and keeps the inner line breaks", () => {
    expect(normalizeMessageBody("Salut\r\nça va ?\rOui\n\nEt toi")).toBe("Salut\nça va ?\nOui\n\nEt toi");
  });

  it("trims the spaces and line breaks at both ends", () => {
    expect(normalizeMessageBody("  \n Bravo Léa !  \n\n")).toBe("Bravo Léa !");
    expect(normalizeMessageBody("   \n\t ")).toBe("");
  });
});

describe("messageLength", () => {
  it("counts a simple emoji as one character, like char_length", () => {
    expect(messageLength("Bravo 🎉")).toBe(7);
    expect(messageLength("🎯🏆🔥")).toBe(3);
  });

  it("counts the code points of a composed emoji", () => {
    // ❤️ is the heart followed by the emoji variation selector.
    expect(messageLength("❤️")).toBe(2);
  });

  it("counts accented letters and line breaks as one each", () => {
    expect(messageLength("Léa\nHugo")).toBe(8);
  });
});
