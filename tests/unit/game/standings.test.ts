import { describe, expect, it } from "vitest";
import {
  computeStandings,
  defaultSeason,
  rankStandings,
  type SeasonSummary,
  seasonPlayers,
  type StandingsInput,
  type StandingsPlayer,
  type StandingsPrediction,
  type StandingsQuestion,
  type StandingTotals,
  withMovement,
} from "@/lib/game/standings";
import { seasonStartFromLocalDate } from "@/lib/game/time";

// Standings (architecture §5.6, v1.2): the fewest malus first. Malus are in hundredths.

const day = (n: number) => new Date(Date.UTC(2026, 10, n, 10));

function numberQuestion(id: number, resultNumber: number, resolvedAt: Date, overrides: Partial<StandingsQuestion> = {}): StandingsQuestion {
  return { id, type: "number", coefficient: 1, resultNumber, resultOptionId: null, wrongAnswerMalus: null, resolvedAt, ...overrides };
}

function choiceQuestion(
  id: number,
  resultOptionId: number,
  wrongAnswerMalus: number,
  resolvedAt: Date,
  overrides: Partial<StandingsQuestion> = {},
): StandingsQuestion {
  return { id, type: "choice", coefficient: 1, resultNumber: null, resultOptionId, wrongAnswerMalus, resolvedAt, ...overrides };
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
  return { userId, name: userId, inactive: false, malus: 0, bullseyes: 0, meanError: null, questionsPlayed: 0, ...overrides };
}

const ranks = (rows: { userId: string; rank: number }[]) => rows.map(({ userId, rank }) => [userId, rank]);
const byId = <R extends { userId: string }>(rows: R[]) => Object.fromEntries(rows.map((row) => [row.userId, row]));

describe("rankStandings: order and ties", () => {
  it("C1: same malus, more Dans le mille first", () => {
    const rows = rankStandings([totals("B", { malus: 30_000, bullseyes: 1 }), totals("A", { malus: 30_000, bullseyes: 2 })]);
    expect(ranks(rows)).toEqual([["A", 1], ["B", 2]]);
  });

  it("C2: same malus and Dans le mille, lower mean error first", () => {
    const rows = rankStandings([
      totals("B", { malus: 30_000, bullseyes: 1, meanError: 0.05 }),
      totals("A", { malus: 30_000, bullseyes: 1, meanError: 0.03 }),
    ]);
    expect(ranks(rows)).toEqual([["A", 1], ["B", 2]]);
  });

  it("C3: strictly identical players share the rank, the next one is skipped", () => {
    const rows = rankStandings([
      totals("C", { malus: 50_000 }),
      totals("A", { malus: 30_000, bullseyes: 1, meanError: 0.03 }),
      totals("B", { malus: 30_000, bullseyes: 1, meanError: 0.03 }),
    ]);
    expect(ranks(rows)).toEqual([["A", 1], ["B", 1], ["C", 3]]);
  });

  it("C7: the fewest malus first, whatever the tie-breakers", () => {
    const rows = rankStandings([totals("B", { malus: 15_000, bullseyes: 2, meanError: 0 }), totals("A", { malus: 10_000 })]);
    expect(ranks(rows)).toEqual([["A", 1], ["B", 2]]);
  });

  it("compares the malus to the hundredth", () => {
    const rows = rankStandings([totals("A", { malus: 25_051 }), totals("B", { malus: 25_050 })]);
    expect(ranks(rows)).toEqual([["B", 1], ["A", 2]]);
  });

  it("puts a missing mean error after any mean error", () => {
    const rows = rankStandings([totals("A", { malus: 5_000 }), totals("B", { malus: 5_000, meanError: 0.9 })]);
    expect(ranks(rows)).toEqual([["B", 1], ["A", 2]]);
  });

  it("treats mean errors equal within 1e-12 as a tie", () => {
    const rows = rankStandings([
      totals("A", { malus: 5_000, meanError: 0.1 + 0.2 }),
      totals("B", { malus: 5_000, meanError: 0.3 }),
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
  // Vector P1 (real 250), vector A1 (real 1 000, coefficient 2) and a choice question (coefficient 2,
  // wrong answer: 100). The players without a prediction take the malus of the worst prediction.
  const q1 = numberQuestion(1, 250, day(1));
  const q2 = numberQuestion(2, 1000, day(2), { coefficient: 2 });
  const q3 = choiceQuestion(3, 30, 100, day(3), { coefficient: 2 });
  const input: StandingsInput = {
    questions: [q1, q2, q3],
    predictions: [
      guess(1, "A", 240), // 10
      guess(1, "B", 262, true), // 12 ÷ 2 = 6
      guess(1, "C", 235), // 15
      guess(1, "D", 235), // 15
      guess(1, "E", 300), // 50, the worst: 50 for an absence
      guess(2, "A", 900), // 100 × 2 = 200
      guess(2, "B", 1300, true), // 300 × 2 ÷ 2 = 300; worst gap 300 × 2 = 600 for an absence
      pick(3, "A", 30), // 0
      pick(3, "E", 31), // 100 × 2 = 200, as an absence
    ],
    players: ["A", "B", "C", "D", "E"].map((id) => player(id)),
  };

  it("adds the malus of every resolved question, absences included", () => {
    const rows = byId(computeStandings(input));
    expect(rows.A.malus).toBe(1_000 + 20_000 + 0);
    expect(rows.B.malus).toBe(600 + 30_000 + 20_000);
    expect(rows.C.malus).toBe(1_500 + 60_000 + 20_000);
    expect(rows.D.malus).toBe(1_500 + 60_000 + 20_000);
    expect(rows.E.malus).toBe(5_000 + 60_000 + 20_000);
  });

  it("ranks the players, the fewest malus first", () => {
    expect(ranks(computeStandings(input))).toEqual([["A", 1], ["B", 2], ["C", 3], ["D", 3], ["E", 5]]);
  });

  it("counts the questions played, a wrong answer included, absences excluded", () => {
    const rows = byId(computeStandings(input));
    expect([rows.A, rows.B, rows.C, rows.D, rows.E].map(({ questionsPlayed }) => questionsPlayed)).toEqual([3, 2, 1, 1, 2]);
  });

  it("averages the relative errors of the number questions played; absences do not count", () => {
    const rows = byId(computeStandings(input));
    expect(rows.A.meanError).toBeCloseTo((10 / 250 + 100 / 1000) / 2, 12);
    expect(rows.B.meanError).toBeCloseTo((12 / 250 + 300 / 1000) / 2, 12);
    expect(rows.C.meanError).toBeCloseTo(15 / 250, 12);
    expect(rows.E.meanError).toBeCloseTo(50 / 250, 12);
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
    const rows = byId(
      computeStandings({
        questions: [numberQuestion(1, 0, day(1)), numberQuestion(2, 100, day(2))],
        predictions: [guess(1, "A", 5), guess(2, "A", 90), guess(1, "B", 3)],
        players: [player("A"), player("B")],
      }),
    );
    expect(rows.A.meanError).toBeCloseTo(0.1, 12);
    expect(rows.B.meanError).toBeNull();
    expect(rows.B.questionsPlayed).toBe(1);
  });

  it("C6: an active player without any prediction takes the malus of the worst predictions", () => {
    const rows = computeStandings({
      questions: [numberQuestion(1, 1000, day(1)), numberQuestion(2, 200, day(2))],
      predictions: [guess(1, "A", 1120), guess(1, "B", 1010), guess(2, "A", 240), guess(2, "B", 200)],
      players: [player("A"), player("B"), player("F", "Fanny")],
    });
    expect(rows.find(({ userId }) => userId === "F")).toMatchObject({
      name: "Fanny",
      malus: 12_000 + 4_000,
      bullseyes: 0,
      meanError: null,
      questionsPlayed: 0,
      inactive: false,
    });
  });

  it("C8: an account created after a result of the season takes the malus of its absence", () => {
    const end = new Date(Date.UTC(2027, 8, 30));
    const accounts = [
      { id: "A", name: "A", banned: false, createdAt: day(0) },
      { id: "N", name: "Newcomer", banned: false, createdAt: day(10) },
    ];
    const rows = byId(
      computeStandings({
        questions: [numberQuestion(1, 250, day(1))],
        predictions: [guess(1, "A", 240)],
        players: seasonPlayers(accounts, end, new Set(["A"])),
      }),
    );
    expect(rows.N).toMatchObject({ malus: 1_000, questionsPlayed: 0 });
  });

  it("C9: a disabled account is listed only with a prediction in the season, inactive, with its absences", () => {
    const rows = computeStandings({
      questions: [q1],
      predictions: [guess(1, "A", 240), guess(1, "X", 250), guess(99, "Y", 12)],
      players: [player("A"), player("X", "Xavier", true), player("Y", "Yann", true), player("Z", "Zoé", true)],
    });
    expect(rows.map(({ userId, inactive, malus }) => [userId, inactive, malus])).toEqual([
      ["X", true, 0],
      ["A", false, 1_000],
      // Yann played another question of the season: listed, with the malus of his absence here.
      ["Y", true, 1_000],
    ]);
  });

  it("ignores predictions on questions that are not in the list (unresolved)", () => {
    const rows = computeStandings({ questions: [q1], predictions: [guess(1, "A", 240), guess(7, "A", 1)], players: [player("A")] });
    expect(rows[0]).toMatchObject({ malus: 1_000, questionsPlayed: 1 });
  });

  it("a question without any prediction gives no malus to anyone (A3)", () => {
    const rows = computeStandings({ questions: [q1], predictions: [], players: [player("A"), player("B")] });
    expect(rows.map(({ malus, rank }) => [malus, rank])).toEqual([
      [0, 1],
      [0, 1],
    ]);
  });

  it("returns an empty list without players", () => {
    expect(computeStandings({ questions: [], predictions: [], players: [] })).toEqual([]);
  });
});

describe("withMovement: arrows since the previous result", () => {
  // Question 1 (real 100): B 0, C 10, A 20. Question 2 (choice, coefficient 3, wrong answer: 10):
  // only A is right; B 30, C absent 30. Totals: A 20, B 30, C 40.
  const q1 = numberQuestion(1, 100, day(1));
  const q2 = choiceQuestion(2, 5, 10, day(2), { coefficient: 3 });
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
    const sameDay = choiceQuestion(2, 5, 10, day(1), { coefficient: 3 });
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

  it("keeps in the previous standings a disabled player whose only prediction is on the latest question", () => {
    const rows = withMovement({
      questions: [q1, q2],
      predictions: [...predictions, pick(2, "X", 5)],
      players: [...players, player("X", "Xavier", true)],
    });
    // Before question 2, X was listed with the malus of an absence (20), behind A on the mean error.
    expect(rows.find(({ userId }) => userId === "X")).toMatchObject({ rank: 2, delta: 2, inactive: true, malus: 2_000 });
  });
});

describe("seasonPlayers: accounts of a season (decision of 30/09/2026)", () => {
  const end = seasonStartFromLocalDate("2027-10-01");
  const account = (id: string, createdAt: string) => ({ id, createdAt: new Date(createdAt) });
  const accounts = [
    account("before", "2026-09-01T10:00:00Z"),
    account("during", "2027-03-01T10:00:00Z"),
    account("at-the-end", end.toISOString()),
    account("after", "2027-11-01T10:00:00Z"),
    account("after-but-played", "2027-11-01T10:00:00Z"),
  ];

  it("keeps the accounts created before the end of the season, and those with a prediction in it", () => {
    expect(seasonPlayers(accounts, end, new Set(["after-but-played"])).map(({ id }) => id)).toEqual([
      "before",
      "during",
      "after-but-played",
    ]);
  });

  it("keeps every account for the last season, which has no end", () => {
    expect(seasonPlayers(accounts, null, new Set())).toEqual(accounts);
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
