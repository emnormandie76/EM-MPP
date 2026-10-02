import { describe, expect, it } from "vitest";
import { JOKER_DIVISOR } from "@/lib/game/constants";
import { halveForJoker, scoreQuestion, type ScoringPrediction, type ScoringQuestion, toHundredths } from "@/lib/game/scoring";

// Malus (architecture §5.5, v1.2): the raw gap, without any cap; the malus are in hundredths.

function numberQuestion(resultNumber: number | null, overrides: Partial<ScoringQuestion> = {}): ScoringQuestion {
  return { type: "number", coefficient: 1, resultNumber, resultOptionId: null, wrongAnswerMalus: null, ...overrides };
}

function choiceQuestion(resultOptionId: number | null, wrongAnswerMalus: number, overrides: Partial<ScoringQuestion> = {}): ScoringQuestion {
  return { type: "choice", coefficient: 1, resultNumber: null, resultOptionId, wrongAnswerMalus, ...overrides };
}

function guess(id: string, valueNumber: number, joker = false): ScoringPrediction & { id: string } {
  return { id, valueNumber, optionId: null, joker };
}

function pick(id: string, optionId: number, joker = false): ScoringPrediction & { id: string } {
  return { id, valueNumber: null, optionId, joker };
}

/** Scores by prediction id. */
function scoresOf(question: ScoringQuestion, predictions: (ScoringPrediction & { id: string })[]) {
  return Object.fromEntries(scoreQuestion(question, predictions).scores.map((score) => [score.prediction.id, score]));
}

describe("scoreQuestion: number question (real value 1 000, coefficient 1, no joker)", () => {
  it.each([
    ["M1", 1000, 0, true],
    ["M2", 500, 500, false],
    ["M3", 1500, 500, false],
    ["M4", 1010, 10, true],
    ["M5", 989.99, 10.01, false],
    ["M6", 0, 1000, false],
    ["M7", 25000, 24000, false],
  ])("%s: %d gives a malus of %d (Dans le mille: %s)", (_, value, malus, bullseye) => {
    const {
      scores: [score],
    } = scoreQuestion(numberQuestion(1000), [guess("A", value)]);
    expect(score.baseMalus).toBe(toHundredths(malus));
    expect(score.total).toBe(toHundredths(malus));
    expect(score.bullseye).toBe(bullseye);
  });

  it("M7: no cap, whatever the size of the typing mistake", () => {
    const {
      scores: [score],
    } = scoreQuestion(numberQuestion(1000), [guess("A", 999_999_999.99)]);
    expect(score.total).toBe(99_999_899_999);
  });

  it("computes the relative error as a plain ratio", () => {
    const scores = scoresOf(numberQuestion(250), [guess("A", 240), guess("B", 252.5), guess("C", 250)]);
    expect(scores.A.relativeError).toBeCloseTo(0.04, 12);
    expect(scores.B.relativeError).toBeCloseTo(0.01, 12);
    expect(scores.C.relativeError).toBe(0);
  });
});

describe("scoreQuestion: coefficient and joker", () => {
  it("K1: real 1 000, prediction 1 501, joker: 501 ÷ 2 = 250,5", () => {
    const {
      scores: [score],
    } = scoreQuestion(numberQuestion(1000), [guess("A", 1501, true)]);
    expect(score.baseMalus).toBe(50_100);
    expect(score.total).toBe(25_050);
  });

  it("K2: real 1 000, prediction 800, coefficient 3: 600; with a joker, 300", () => {
    const scores = scoresOf(numberQuestion(1000, { coefficient: 3 }), [guess("A", 800), guess("B", 800, true)]);
    expect(scores.A.total).toBe(60_000);
    expect(scores.B.total).toBe(30_000);
  });

  it("K3: real 12,5, prediction 12,6: 0,1; with a joker, 0,05", () => {
    const scores = scoresOf(numberQuestion(12.5), [guess("A", 12.6), guess("B", 12.6, true)]);
    expect(scores.A.total).toBe(10);
    expect(scores.B.total).toBe(5);
  });

  it("K4: real 10, prediction 10,01, joker: 0,005 rounds to 0,01 (half up)", () => {
    const {
      scores: [score],
    } = scoreQuestion(numberQuestion(10), [guess("A", 10.01, true)]);
    expect(score.total).toBe(1);
  });

  it("K5: real 0: 0 is a Dans le mille with no malus; 5 gives 5, with an infinite relative error", () => {
    const scores = scoresOf(numberQuestion(0), [guess("A", 0), guess("B", 5)]);
    expect(scores.A).toMatchObject({ total: 0, bullseye: true, relativeError: 0 });
    expect(scores.B).toMatchObject({ total: 500, bullseye: false });
    expect(scores.B.relativeError).toBe(Number.POSITIVE_INFINITY);
  });

  it("divides by JOKER_DIVISOR, rounding half up in hundredths", () => {
    expect(JOKER_DIVISOR).toBe(2);
    expect([0, 1, 2, 3, 50_100].map(halveForJoker)).toEqual([0, 1, 1, 2, 25_050]);
  });
});

describe("scoreQuestion: choice question (wrong answer: 200)", () => {
  it("Q1: right answer with a joker: 0", () => {
    const {
      scores: [score],
    } = scoreQuestion(choiceQuestion(7, 200), [pick("A", 7, true)]);
    expect(score).toMatchObject({ baseMalus: 0, total: 0, bullseye: false, relativeError: null, podiumRank: null });
  });

  it("Q2: wrong answer: 200", () => {
    const {
      scores: [score],
    } = scoreQuestion(choiceQuestion(7, 200), [pick("A", 8)]);
    expect(score).toMatchObject({ baseMalus: 20_000, total: 20_000 });
  });

  it("Q3: wrong answer, coefficient 2, joker: 200 × 2 ÷ 2 = 200", () => {
    const {
      scores: [score],
    } = scoreQuestion(choiceQuestion(7, 200, { coefficient: 2 }), [pick("A", 8, true)]);
    expect(score.total).toBe(20_000);
  });

  it("keeps the decimals of the malus of a wrong answer", () => {
    const {
      scores: [score],
    } = scoreQuestion(choiceQuestion(7, 12.5, { coefficient: 3 }), [pick("A", 8, true)]);
    expect(score.total).toBe(1_875);
  });
});

describe("scoreQuestion: proximity rank (real value 250; no bonus)", () => {
  it("P1: ties share a rank, the next rank is skipped", () => {
    const scores = scoresOf(numberQuestion(250), [guess("A", 240), guess("B", 262), guess("C", 235), guess("D", 235), guess("E", 300)]);
    expect([scores.A, scores.B, scores.C, scores.D, scores.E].map(({ podiumRank }) => podiumRank)).toEqual([1, 2, 3, 3, 5]);
    expect([scores.A, scores.B, scores.C, scores.D, scores.E].map(({ total }) => total)).toEqual([1_000, 1_200, 1_500, 1_500, 5_000]);
  });

  it("P2: two tied first places, then third", () => {
    const scores = scoresOf(numberQuestion(250), [guess("A", 245), guess("B", 255), guess("C", 240)]);
    expect([scores.A.podiumRank, scores.B.podiumRank, scores.C.podiumRank]).toEqual([1, 1, 3]);
  });

  it("ranks every prediction, a real value of 0 included", () => {
    const scores = scoresOf(numberQuestion(0), [guess("A", 5), guess("B", 2)]);
    expect([scores.A.podiumRank, scores.B.podiumRank]).toEqual([2, 1]);
  });
});

describe("scoreQuestion: malus of an absence", () => {
  it("A1: real 1 000, coefficient 2: A 900, B 1 300 with a joker, C without prediction", () => {
    const { scores, absentMalus } = scoreQuestion(numberQuestion(1000, { coefficient: 2 }), [guess("A", 900), guess("B", 1300, true)]);
    expect(scores.map(({ total }) => total)).toEqual([20_000, 30_000]);
    // The worst gap, 300, × 2: B's joker changes nothing.
    expect(absentMalus).toBe(60_000);
  });

  it("A2: choice, malus 200, coefficient 1: everyone is right, C without prediction gets 200", () => {
    const { absentMalus } = scoreQuestion(choiceQuestion(7, 200), [pick("A", 7), pick("B", 7)]);
    expect(absentMalus).toBe(20_000);
  });

  it("A2: the coefficient applies to the malus of an absence on a choice question", () => {
    expect(scoreQuestion(choiceQuestion(7, 200, { coefficient: 3 }), [pick("A", 7)]).absentMalus).toBe(60_000);
  });

  it("A3: a question without any prediction gives 0 to everyone", () => {
    expect(scoreQuestion(numberQuestion(1000), []).absentMalus).toBe(0);
    expect(scoreQuestion(choiceQuestion(7, 200), []).absentMalus).toBe(0);
  });

  it("A4: a single prediction, exact: the worst gap is 0", () => {
    expect(scoreQuestion(numberQuestion(1000), [guess("A", 1000)]).absentMalus).toBe(0);
  });

  it("X6: an empty list of predictions raises no error", () => {
    expect(scoreQuestion(numberQuestion(250), [])).toEqual({ scores: [], absentMalus: 0 });
    expect(scoreQuestion(choiceQuestion(1, 50), [])).toEqual({ scores: [], absentMalus: 0 });
  });
});

describe("scoreQuestion: exact computation", () => {
  it("compares in hundredths, so the 1 % limit is exact whatever the decimals", () => {
    // In floating point, (11.11 - 11) / 11 = 0.010000000000000009 > 1 %. It is exactly 1 %.
    const scores = scoresOf(numberQuestion(11), [guess("A", 11.11), guess("B", 10.89), guess("C", 11.12)]);
    expect([scores.A.bullseye, scores.B.bullseye, scores.C.bullseye]).toEqual([true, true, false]);
    expect([scores.A.total, scores.B.total, scores.C.total]).toEqual([11, 11, 12]);
  });

  it("returns the scores in the order of the predictions, with each prediction attached", () => {
    const predictions = [guess("B", 300), guess("A", 250)];
    expect(scoreQuestion(numberQuestion(250), predictions).scores.map((score) => score.prediction)).toEqual(predictions);
  });

  it("gives the malus of an absence to a prediction that has no value of the question's type", () => {
    const scores = scoresOf(numberQuestion(250), [pick("A", 3), guess("B", 260)]);
    expect(scores.A).toMatchObject({ total: 1_000, podiumRank: null, relativeError: null, bullseye: false });
    expect(scores.B.podiumRank).toBe(1);
    const choice = scoreQuestion(choiceQuestion(3, 40), [guess("C", 3)]);
    expect(choice.scores[0].total).toBe(4_000);
  });

  it("refuses a question without a result, or a choice question without the malus of a wrong answer", () => {
    expect(() => scoreQuestion(numberQuestion(null), [])).toThrow("no result");
    expect(() => scoreQuestion(choiceQuestion(null, 50), [])).toThrow("no result");
    expect(() => scoreQuestion(choiceQuestion(1, 50, { wrongAnswerMalus: null }), [])).toThrow("wrong answer");
  });
});
