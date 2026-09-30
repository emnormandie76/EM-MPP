import { describe, expect, it } from "vitest";
import { BADGES, type BadgeInput, type BadgeKey, type BadgeResult, computeBadges } from "@/lib/game/badges";

const at = (day: number) => new Date(Date.UTC(2026, 10, day, 10));

function result(overrides: Partial<BadgeResult> = {}): BadgeResult {
  return {
    seasonId: 1,
    questionType: "number",
    resolvedAt: at(1),
    joker: false,
    bullseye: false,
    podiumRank: null,
    correctChoice: false,
    ...overrides,
  };
}

function badges(input: Partial<BadgeInput>) {
  const list = computeBadges({ results: [], predictedQuestionIds: [], proclaimedSeasons: [], ...input });
  return Object.fromEntries(list.map((badge) => [badge.key, badge])) as Record<BadgeKey, (typeof list)[number]>;
}

describe("computeBadges", () => {
  it("lists the 6 badges, in the display order, even when none is earned", () => {
    const list = computeBadges({ results: [], predictedQuestionIds: [], proclaimedSeasons: [] });
    expect(list.map(({ key }) => key)).toEqual(BADGES.map(({ key }) => key));
    expect(list.map(({ key }) => key)).toEqual(["first_bullseye", "nostradamus", "sharpshooter", "joker_win", "assiduous", "champion"]);
    expect(list.every(({ count, lastEarnedAt }) => count === 0 && lastEarnedAt === null)).toBe(true);
  });

  it("gives every badge a French name", () => {
    expect(BADGES.map(({ name }) => name)).toEqual([
      "Premier « Dans le mille »",
      "Nostradamus",
      "Tireur d'élite",
      "Joker gagnant",
      "Assidu",
      "Champion",
    ]);
  });
});

describe("first_bullseye", () => {
  it("is earned once, on the date of the first Dans le mille", () => {
    const { first_bullseye } = badges({
      results: [result({ bullseye: true, resolvedAt: at(9) }), result({ bullseye: true, resolvedAt: at(3), seasonId: 2 })],
    });
    expect(first_bullseye).toEqual({ key: "first_bullseye", count: 1, lastEarnedAt: at(3) });
  });

  it("is not earned without a Dans le mille", () => {
    expect(badges({ results: [result({ podiumRank: 1 })] }).first_bullseye.count).toBe(0);
  });
});

describe("nostradamus", () => {
  it("is earned per season with 3 Dans le mille, on the date of the third", () => {
    const { nostradamus } = badges({
      results: [
        result({ seasonId: 1, bullseye: true, resolvedAt: at(5) }),
        result({ seasonId: 1, bullseye: true, resolvedAt: at(1) }),
        result({ seasonId: 1, bullseye: true, resolvedAt: at(3) }),
        result({ seasonId: 2, bullseye: true, resolvedAt: at(20) }),
        result({ seasonId: 2, bullseye: true, resolvedAt: at(21) }),
        result({ seasonId: 2, bullseye: true, resolvedAt: at(22) }),
        result({ seasonId: 2, bullseye: true, resolvedAt: at(23) }),
      ],
    });
    expect(nostradamus).toEqual({ key: "nostradamus", count: 2, lastEarnedAt: at(22) });
  });

  it("is not earned with 3 Dans le mille spread over two seasons", () => {
    const { nostradamus } = badges({
      results: [
        result({ seasonId: 1, bullseye: true }),
        result({ seasonId: 1, bullseye: true }),
        result({ seasonId: 2, bullseye: true }),
      ],
    });
    expect(nostradamus.count).toBe(0);
  });
});

describe("sharpshooter", () => {
  it("counts the number questions where the prediction is first on the podium (ties included)", () => {
    const { sharpshooter } = badges({
      results: [result({ podiumRank: 1, resolvedAt: at(2) }), result({ podiumRank: 1, resolvedAt: at(7) }), result({ podiumRank: 2 })],
    });
    expect(sharpshooter).toEqual({ key: "sharpshooter", count: 2, lastEarnedAt: at(7) });
  });

  it("is not earned from the second place", () => {
    expect(badges({ results: [result({ podiumRank: 2 }), result({ podiumRank: null })] }).sharpshooter.count).toBe(0);
  });
});

describe("joker_win", () => {
  it("counts jokers on a podium (number) or on the right answer (choice)", () => {
    const { joker_win } = badges({
      results: [
        result({ joker: true, podiumRank: 3, resolvedAt: at(4) }),
        result({ joker: true, questionType: "choice", correctChoice: true, resolvedAt: at(8) }),
      ],
    });
    expect(joker_win).toEqual({ key: "joker_win", count: 2, lastEarnedAt: at(8) });
  });

  it("is not earned off the podium, on a wrong answer, or without a joker", () => {
    const { joker_win } = badges({
      results: [
        result({ joker: true, podiumRank: 4 }),
        result({ joker: true, podiumRank: null }),
        result({ joker: true, questionType: "choice", correctChoice: false }),
        result({ joker: false, podiumRank: 1 }),
        result({ joker: false, questionType: "choice", correctChoice: true }),
      ],
    });
    expect(joker_win.count).toBe(0);
  });
});

describe("assiduous", () => {
  const season = { seasonId: 1, proclaimedAt: at(30), questionIds: [1, 2, 3], rank: 4 };

  it("is earned for a proclaimed season with a prediction on every question", () => {
    const { assiduous } = badges({ predictedQuestionIds: [1, 2, 3, 9], proclaimedSeasons: [season] });
    expect(assiduous).toEqual({ key: "assiduous", count: 1, lastEarnedAt: at(30) });
  });

  it("is not earned when one question has no prediction, or for a season without questions", () => {
    const empty = { ...season, seasonId: 2, questionIds: [] };
    expect(badges({ predictedQuestionIds: [1, 3], proclaimedSeasons: [season, empty] }).assiduous.count).toBe(0);
  });
});

describe("champion", () => {
  it("is earned for each proclaimed season finished first, ties included", () => {
    const { champion } = badges({
      proclaimedSeasons: [
        { seasonId: 1, proclaimedAt: at(10), questionIds: [1], rank: 1 },
        { seasonId: 2, proclaimedAt: at(20), questionIds: [2], rank: 1 },
      ],
    });
    expect(champion).toEqual({ key: "champion", count: 2, lastEarnedAt: at(20) });
  });

  it("is not earned from the second place, or without a final rank", () => {
    const { champion } = badges({
      proclaimedSeasons: [
        { seasonId: 1, proclaimedAt: at(10), questionIds: [1], rank: 2 },
        { seasonId: 2, proclaimedAt: at(20), questionIds: [2], rank: null },
      ],
    });
    expect(champion.count).toBe(0);
  });
});
