import { describe, expect, it } from "vitest";
import {
  computeStandings,
  defaultSeason,
  rankStandings,
  type SeasonSummary,
  type StandingsInput,
  type StandingsPlayer,
  type StandingsPrediction,
  type StandingsQuestion,
  type StandingTotals,
  withMovement,
} from "@/lib/game/standings";
import { seasonStartFromLocalDate } from "@/lib/game/time";

const day = (n: number) => new Date(Date.UTC(2026, 10, n, 10));

function numberQuestion(id: number, resultNumber: number, resolvedAt: Date, overrides: Partial<StandingsQuestion> = {}): StandingsQuestion {
  return { id, type: "number", priceIsRight: false, coefficient: 1, resultNumber, resultOptionId: null, resolvedAt, ...overrides };
}

function choiceQuestion(id: number, resultOptionId: number, resolvedAt: Date, overrides: Partial<StandingsQuestion> = {}): StandingsQuestion {
  return { id, type: "choice", priceIsRight: false, coefficient: 1, resultNumber: null, resultOptionId, resolvedAt, ...overrides };
}

function guess(questionId: number, userId: string, valueNumber: number, joker = false): StandingsPrediction {
  return { questionId, userId, valueNumber, optionId: null, joker };
}

function pick(questionId: number, userId: string, optionId: number, joker = false): StandingsPrediction {
  return { questionId, userId, valueNumber: null, optionId, joker };
}

function player(id: string, name = id, banned = false): StandingsPlayer {
  return { id, name, banned };
}

function totals(userId: string, overrides: Partial<StandingTotals> = {}): StandingTotals {
  return { userId, name: userId, inactive: false, points: 0, bullseyes: 0, meanError: null, questionsPlayed: 0, ...overrides };
}

const ranks = (rows: { userId: string; rank: number }[]) => rows.map(({ userId, rank }) => [userId, rank]);

describe("rankStandings: order and ties", () => {
  it("C1: same points, more Dans le mille first", () => {
    const rows = rankStandings([totals("B", { points: 200, bullseyes: 1 }), totals("A", { points: 200, bullseyes: 2 })]);
    expect(ranks(rows)).toEqual([["A", 1], ["B", 2]]);
  });

  it("C2: same points and Dans le mille, lower mean error first", () => {
    const rows = rankStandings([
      totals("B", { points: 200, bullseyes: 1, meanError: 0.05 }),
      totals("A", { points: 200, bullseyes: 1, meanError: 0.03 }),
    ]);
    expect(ranks(rows)).toEqual([["A", 1], ["B", 2]]);
  });

  it("C3: strictly identical players share the rank, the next one is skipped", () => {
    const rows = rankStandings([
      totals("C", { points: 100 }),
      totals("A", { points: 200, bullseyes: 1, meanError: 0.03 }),
      totals("B", { points: 200, bullseyes: 1, meanError: 0.03 }),
    ]);
    expect(ranks(rows)).toEqual([["A", 1], ["B", 1], ["C", 3]]);
  });

  it("sorts by points first, whatever the tie-breakers", () => {
    const rows = rankStandings([totals("A", { points: 100, bullseyes: 5, meanError: 0 }), totals("B", { points: 101 })]);
    expect(ranks(rows)).toEqual([["B", 1], ["A", 2]]);
  });

  it("puts a missing mean error after any mean error", () => {
    const rows = rankStandings([totals("A", { points: 50 }), totals("B", { points: 50, meanError: 0.9 })]);
    expect(ranks(rows)).toEqual([["B", 1], ["A", 2]]);
  });

  it("treats mean errors equal within 1e-12 as a tie", () => {
    const rows = rankStandings([
      totals("A", { points: 50, meanError: 0.1 + 0.2 }),
      totals("B", { points: 50, meanError: 0.3 }),
    ]);
    expect(ranks(rows)).toEqual([["A", 1], ["B", 1]]);
  });

  it("orders perfect ties by name, French alphabetical order", () => {
    const rows = rankStandings([
      totals("z", { name: "Zoé" }),
      totals("e", { name: "Émilie" }),
      totals("a", { name: "adam" }),
      totals("f", { name: "Fabien" }),
    ]);
    expect(rows.map(({ name, rank }) => [name, rank])).toEqual([
      ["adam", 1],
      ["Émilie", 1],
      ["Fabien", 1],
      ["Zoé", 1],
    ]);
  });
});

describe("computeStandings: totals per player", () => {
  // Number question from vector P1 (real 250) and Juste Prix from vector J3 (real 250).
  const q1 = numberQuestion(1, 250, day(1));
  const q2 = numberQuestion(2, 250, day(2), { priceIsRight: true });
  const q3 = choiceQuestion(3, 30, day(3), { coefficient: 2 });
  const input: StandingsInput = {
    questions: [q1, q2, q3],
    predictions: [
      guess(1, "A", 240), // 65 + 20
      guess(1, "B", 262, true), // (65 + 10) × 2
      guess(1, "C", 235), // 45 + 5
      guess(1, "D", 235), // 45 + 5
      guess(1, "E", 300), // 25
      guess(2, "A", 251), // over: 0
      guess(2, "B", 245), // 80 + 20
      guess(2, "C", 230), // 45 + 10
      pick(3, "A", 30), // 50 × 2
      pick(3, "E", 31), // 0
    ],
    players: ["A", "B", "C", "D", "E"].map((id) => player(id)),
  };

  it("adds the totals of every resolved question", () => {
    const byId = Object.fromEntries(computeStandings(input).map((row) => [row.userId, row]));
    expect(byId.A.points).toBe(85 + 0 + 100);
    expect(byId.B.points).toBe(150 + 100);
    expect(byId.C.points).toBe(50 + 55);
    expect(byId.D.points).toBe(50);
    expect(byId.E.points).toBe(25);
  });

  it("counts the questions played, including a wrong answer or a prediction that goes over", () => {
    const byId = Object.fromEntries(computeStandings(input).map((row) => [row.userId, row]));
    expect([byId.A.questionsPlayed, byId.B.questionsPlayed, byId.D.questionsPlayed, byId.E.questionsPlayed]).toEqual([3, 2, 1, 2]);
  });

  it("averages the relative errors of number questions, Juste Prix included", () => {
    const byId = Object.fromEntries(computeStandings(input).map((row) => [row.userId, row]));
    expect(byId.A.meanError).toBeCloseTo((10 / 250 + 1 / 250) / 2, 12);
    expect(byId.D.meanError).toBeCloseTo(15 / 250, 12);
  });

  it("ranks the players", () => {
    expect(ranks(computeStandings(input))).toEqual([["B", 1], ["A", 2], ["C", 3], ["D", 4], ["E", 5]]);
  });

  it("counts the Dans le mille", () => {
    const rows = computeStandings({
      questions: [numberQuestion(1, 100, day(1)), numberQuestion(2, 1000, day(2))],
      predictions: [guess(1, "A", 100), guess(2, "A", 1005), guess(1, "B", 99), guess(2, "B", 1100)],
      players: [player("A"), player("B")],
    });
    expect(rows.map(({ userId, bullseyes }) => [userId, bullseyes])).toEqual([["A", 2], ["B", 1]]);
  });

  it("leaves out infinite errors (real value 0) from the mean error", () => {
    const rows = computeStandings({
      questions: [numberQuestion(1, 0, day(1)), numberQuestion(2, 100, day(2))],
      predictions: [guess(1, "A", 5), guess(2, "A", 90), guess(1, "B", 3)],
      players: [player("A"), player("B")],
    });
    const byId = Object.fromEntries(rows.map((row) => [row.userId, row]));
    expect(byId.A.meanError).toBeCloseTo(0.1, 12);
    expect(byId.B.meanError).toBeNull();
    expect(byId.B.questionsPlayed).toBe(1);
  });

  it("C6: an active player without any prediction is listed with 0 point", () => {
    const rows = computeStandings({ ...input, players: [...input.players, player("F", "Fanny")] });
    expect(rows.at(-1)).toMatchObject({ userId: "F", name: "Fanny", points: 0, bullseyes: 0, meanError: null, questionsPlayed: 0, inactive: false });
  });

  it("lists a disabled player only if they have a prediction in the season, marked inactive", () => {
    const rows = computeStandings({
      questions: [q1],
      predictions: [guess(1, "A", 240), guess(1, "X", 250), guess(99, "Y", 12)],
      players: [player("A"), player("X", "Xavier", true), player("Y", "Yann", true), player("Z", "Zoé", true)],
    });
    expect(rows.map(({ userId, inactive, points }) => [userId, inactive, points])).toEqual([
      ["X", true, 120],
      ["A", false, 75],
      ["Y", true, 0],
    ]);
  });

  it("ignores predictions on questions that are not in the list (unresolved)", () => {
    const rows = computeStandings({ questions: [q1], predictions: [guess(1, "A", 240), guess(7, "A", 1)], players: [player("A")] });
    expect(rows[0]).toMatchObject({ points: 85, questionsPlayed: 1 });
  });

  it("returns an empty list without players", () => {
    expect(computeStandings({ questions: [], predictions: [], players: [] })).toEqual([]);
  });
});

describe("withMovement: arrows since the previous result", () => {
  // Question 1: B 120, C 55, A 30. Question 2 (choice, coefficient 3): only A is right, 150.
  const q1 = numberQuestion(1, 100, day(1));
  const q2 = choiceQuestion(2, 5, day(2), { coefficient: 3 });
  const predictions = [guess(1, "B", 100), guess(1, "C", 90), guess(1, "A", 80), pick(2, "A", 5), pick(2, "B", 6)];
  const players = [player("A"), player("B"), player("C")];

  it("C4: after the second result, A goes from 3rd to 1st: delta +2", () => {
    const rows = withMovement({ questions: [q1, q2], predictions, players });
    expect(rows.map(({ userId, rank, delta }) => [userId, rank, delta])).toEqual([
      ["A", 1, 2],
      ["B", 2, -1],
      ["C", 3, -1],
    ]);
  });

  it("C5: with a single resolved question, every delta is null", () => {
    const rows = withMovement({ questions: [q1], predictions, players });
    expect(rows.map(({ delta }) => delta)).toEqual([null, null, null]);
  });

  it("gives 0 to a player whose rank did not change", () => {
    const rows = withMovement({ questions: [q1, numberQuestion(3, 100, day(3))], predictions, players });
    expect(rows.map(({ userId, delta }) => [userId, delta])).toEqual([["B", 0], ["C", 0], ["A", 0]]);
  });

  it("removes the latest result by resolution date, whatever the order of the list", () => {
    const rows = withMovement({ questions: [q2, q1], predictions, players });
    expect(rows.find(({ userId }) => userId === "A")?.delta).toBe(2);
  });

  it("on the same resolution date, removes the question with the highest id", () => {
    const sameDay = choiceQuestion(2, 5, day(1), { coefficient: 3 });
    const rows = withMovement({ questions: [sameDay, q1], predictions, players });
    expect(rows.find(({ userId }) => userId === "A")?.delta).toBe(2);

    // The other way round: question 1 has the highest id and is removed, so A was 1st already.
    const rowsSwapped = withMovement({
      questions: [numberQuestion(9, 100, day(1)), { ...sameDay, id: 2 }],
      predictions: predictions.map((prediction) => (prediction.questionId === 1 ? { ...prediction, questionId: 9 } : prediction)),
      players,
    });
    expect(rowsSwapped.find(({ userId }) => userId === "A")?.delta).toBe(0);
  });

  it("keeps in the previous standings, at 0 point, a disabled player whose only prediction is on the latest question", () => {
    const rows = withMovement({
      questions: [q1, q2],
      predictions: [...predictions, pick(2, "X", 5)],
      players: [...players, player("X", "Xavier", true)],
    });
    expect(rows.find(({ userId }) => userId === "X")).toMatchObject({ rank: 2, delta: 2, inactive: true });
  });
});

describe("defaultSeason", () => {
  // Seasons named after their start day, Paris time: "2026-10-01" starts on 1 October 2026 at 00:00.
  const season = (start: string, overrides: Partial<SeasonSummary> = {}) => ({
    name: start,
    startsAt: seasonStartFromLocalDate(start),
    publishedCount: 0,
    resolvedCount: 0,
    proclaimed: false,
    ...overrides,
  });
  const shown = (now: string, seasons: ReturnType<typeof season>[]) => defaultSeason(new Date(now), seasons)?.name ?? null;

  it("at launch, shows the current season even with no result yet (there is no previous one)", () => {
    expect(shown("2026-10-14T07:00:00Z", [season("2026-10-01", { publishedCount: 20 })])).toBe("2026-10-01");
  });

  it("shows nothing while no season exists, or before the first one", () => {
    expect(shown("2026-10-14T07:00:00Z", [])).toBeNull();
    expect(shown("2026-09-30T21:59:59Z", [season("2026-10-01", { publishedCount: 20 })])).toBeNull();
  });

  it("switches to the new season at 00:00 on its start day, Paris time", () => {
    const seasons = [
      season("2025-09-29", { publishedCount: 3, resolvedCount: 3, proclaimed: true }),
      season("2026-10-01"),
    ];
    expect(shown("2026-09-30T21:59:59Z", seasons)).toBe("2025-09-29");
    expect(shown("2026-09-30T22:00:00Z", seasons)).toBe("2026-10-01");
  });

  it("stays on the last season while the next one is not created", () => {
    expect(shown("2027-11-05T10:00:00Z", [season("2026-10-01", { publishedCount: 20, resolvedCount: 20, proclaimed: true })])).toBe(
      "2026-10-01",
    );
  });

  it("keeps the previous season while the new one has no result and the previous one is not proclaimed", () => {
    const seasons = [season("2026-10-01", { publishedCount: 20, resolvedCount: 18 }), season("2027-09-06", { publishedCount: 2 })];
    expect(shown("2027-10-05T10:00:00Z", seasons)).toBe("2026-10-01");
  });

  it("shows the current season once the previous one is proclaimed", () => {
    const seasons = [season("2026-10-01", { publishedCount: 20, resolvedCount: 20, proclaimed: true }), season("2027-09-06")];
    expect(shown("2027-10-05T10:00:00Z", seasons)).toBe("2027-09-06");
  });

  it("shows the current season as soon as it has a result", () => {
    const seasons = [
      season("2026-10-01", { publishedCount: 20, resolvedCount: 18 }),
      season("2027-09-06", { publishedCount: 5, resolvedCount: 1 }),
    ];
    expect(shown("2027-11-05T10:00:00Z", seasons)).toBe("2027-09-06");
  });

  it("ignores a previous season without any published question", () => {
    expect(shown("2027-10-05T10:00:00Z", [season("2026-10-01"), season("2027-09-06")])).toBe("2027-09-06");
  });

  it("only looks at the season just before the current one", () => {
    const seasons = [season("2025-09-29", { publishedCount: 4 }), season("2026-10-01"), season("2027-09-06")];
    expect(shown("2027-10-05T10:00:00Z", seasons)).toBe("2027-09-06");
  });
});
