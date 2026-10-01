import { describe, expect, it } from "vitest";
import { scoreQuestion, type ScoringPrediction, type ScoringQuestion } from "@/lib/game/scoring";

function numberQuestion(resultNumber: number, overrides: Partial<ScoringQuestion> = {}): ScoringQuestion {
  return { type: "number", priceIsRight: false, coefficient: 1, resultNumber, resultOptionId: null, ...overrides };
}

function choiceQuestion(resultOptionId: number, overrides: Partial<ScoringQuestion> = {}): ScoringQuestion {
  return { type: "choice", priceIsRight: false, coefficient: 1, resultNumber: null, resultOptionId, ...overrides };
}

function guess(id: string, valueNumber: number, joker = false): ScoringPrediction & { id: string } {
  return { id, valueNumber, optionId: null, joker };
}

function pick(id: string, optionId: number, joker = false): ScoringPrediction & { id: string } {
  return { id, valueNumber: null, optionId, joker };
}

/** Scores by prediction id. */
function scoresOf(question: ScoringQuestion, predictions: (ScoringPrediction & { id: string })[]) {
  return Object.fromEntries(scoreQuestion(question, predictions).map((score) => [score.prediction.id, score]));
}

describe("scoreQuestion: scale (real value 250, coefficient 1, no joker)", () => {
  it.each([
    ["B1", 250, 100],
    ["B2", 252.5, 100],
    ["B3", 247, 80],
    ["B4", 257.5, 80],
    ["B5", 240, 65],
    ["B6", 262.5, 65],
    ["B7", 225, 45],
    ["B8", 300, 25],
    ["B9", 337.5, 10],
    ["B10", 340, 0],
  ])("%s: %d gives %d points on the scale", (_, value, points) => {
    const [score] = scoreQuestion(numberQuestion(250), [guess("A", value)]);
    expect(score.basePoints).toBe(points);
  });

  it("computes the relative error as a plain ratio", () => {
    const scores = scoresOf(numberQuestion(250), [guess("A", 240), guess("B", 252.5), guess("C", 250)]);
    expect(scores.A.relativeError).toBeCloseTo(0.04, 12);
    expect(scores.B.relativeError).toBeCloseTo(0.01, 12);
    expect(scores.C.relativeError).toBe(0);
  });

  it("marks a Dans le mille only at 100 points on the scale", () => {
    const scores = scoresOf(numberQuestion(250), [guess("A", 252.5), guess("B", 247)]);
    expect(scores.A.bullseye).toBe(true);
    expect(scores.B.bullseye).toBe(false);
  });
});

describe("scoreQuestion: podium (real value 250)", () => {
  it("P1: ties share a rank and the bonus, the next rank is skipped", () => {
    const scores = scoresOf(numberQuestion(250), [
      guess("A", 240),
      guess("B", 262),
      guess("C", 235),
      guess("D", 235),
      guess("E", 300),
    ]);
    expect([scores.A.podiumRank, scores.A.podiumBonus]).toEqual([1, 20]);
    expect([scores.B.podiumRank, scores.B.podiumBonus]).toEqual([2, 10]);
    expect([scores.C.podiumRank, scores.C.podiumBonus]).toEqual([3, 5]);
    expect([scores.D.podiumRank, scores.D.podiumBonus]).toEqual([3, 5]);
    expect([scores.E.podiumRank, scores.E.podiumBonus]).toEqual([5, 0]);
    expect(scores.A.total).toBe(65 + 20);
    expect(scores.E.total).toBe(25);
  });

  it("P2: two tied first places, then third", () => {
    const scores = scoresOf(numberQuestion(250), [guess("A", 245), guess("B", 255), guess("C", 240)]);
    expect([scores.A.podiumRank, scores.A.podiumBonus]).toEqual([1, 20]);
    expect([scores.B.podiumRank, scores.B.podiumBonus]).toEqual([1, 20]);
    expect([scores.C.podiumRank, scores.C.podiumBonus]).toEqual([3, 5]);
  });

  it("P3: a single far prediction still wins the first bonus", () => {
    const [score] = scoreQuestion(numberQuestion(250), [guess("A", 400)]);
    expect(score).toMatchObject({ basePoints: 0, podiumRank: 1, podiumBonus: 20, total: 20 });
  });
});

describe("scoreQuestion: Juste Prix (real value 250)", () => {
  it("J1: above the real value gives 0, no podium, no Dans le mille", () => {
    const [score] = scoreQuestion(numberQuestion(250, { priceIsRight: true }), [guess("A", 251)]);
    expect(score).toMatchObject({ basePoints: 0, podiumRank: null, podiumBonus: 0, bullseye: false, total: 0 });
  });

  it("J2: below the real value is scored normally", () => {
    const [score] = scoreQuestion(numberQuestion(250, { priceIsRight: true }), [guess("A", 245)]);
    expect(score.basePoints).toBe(80);
  });

  it("J3: the podium is played among the predictions that do not go over", () => {
    const scores = scoresOf(numberQuestion(250, { priceIsRight: true }), [
      guess("A", 251),
      guess("B", 245),
      guess("C", 230),
    ]);
    expect(scores.A.total).toBe(0);
    expect(scores.B).toMatchObject({ basePoints: 80, podiumRank: 1, podiumBonus: 20, total: 100 });
    expect(scores.C).toMatchObject({ basePoints: 45, podiumRank: 2, podiumBonus: 10, total: 55 });
  });

  it("keeps the relative error of a prediction that goes over, for the display, and marks it", () => {
    const [score] = scoreQuestion(numberQuestion(250, { priceIsRight: true }), [guess("A", 275)]);
    expect(score.relativeError).toBeCloseTo(0.1, 12);
    expect(score.wentOver).toBe(true);
  });

  it("marks only the predictions above the real value of a Juste Prix question", () => {
    const juste = scoresOf(numberQuestion(250, { priceIsRight: true }), [guess("A", 251), guess("B", 250), guess("C", 230)]);
    expect([juste.A.wentOver, juste.B.wentOver, juste.C.wentOver]).toEqual([true, false, false]);
    // Above the real value of an ordinary number question: scored normally, not marked.
    const [ordinary] = scoreQuestion(numberQuestion(250), [guess("A", 251)]);
    expect(ordinary).toMatchObject({ basePoints: 100, wentOver: false });
  });

  it("the exact value does not go over", () => {
    const [score] = scoreQuestion(numberQuestion(250, { priceIsRight: true }), [guess("A", 250)]);
    expect(score).toMatchObject({ basePoints: 100, bullseye: true, podiumRank: 1, total: 120 });
  });
});

describe("scoreQuestion: other vectors", () => {
  it("X1: closest number prediction, coefficient 2, joker: (65 + 20) × 2 × 2 = 340", () => {
    const scores = scoresOf(numberQuestion(250, { coefficient: 2 }), [guess("A", 240, true), guess("B", 300)]);
    expect(scores.A.total).toBe(340);
  });

  it("X2: right choice, coefficient 3, joker: 50 × 3 × 2 = 300", () => {
    const [score] = scoreQuestion(choiceQuestion(7, { coefficient: 3 }), [pick("A", 7, true)]);
    expect(score).toMatchObject({ basePoints: 50, podiumRank: null, podiumBonus: 0, bullseye: false, relativeError: null, total: 300 });
  });

  it("X3: wrong choice with a joker gives 0", () => {
    const [score] = scoreQuestion(choiceQuestion(7), [pick("A", 8, true)]);
    expect(score.total).toBe(0);
  });

  it("X4: real value 0: 0 gives 100 + 20, anything else 0 without podium", () => {
    const scores = scoresOf(numberQuestion(0), [guess("A", 0), guess("B", 5)]);
    expect(scores.A).toMatchObject({ basePoints: 100, bullseye: true, podiumRank: 1, podiumBonus: 20, total: 120 });
    expect(scores.A.relativeError).toBe(0);
    expect(scores.B).toMatchObject({ basePoints: 0, podiumRank: null, podiumBonus: 0, total: 0 });
    expect(scores.B.relativeError).toBe(Number.POSITIVE_INFINITY);
  });

  it("X5: real value 12.5, prediction 12.6: 0.8 % gives 100", () => {
    const [score] = scoreQuestion(numberQuestion(12.5), [guess("A", 12.6)]);
    expect(score.basePoints).toBe(100);
  });

  it("X6: no prediction gives an empty list", () => {
    expect(scoreQuestion(numberQuestion(250), [])).toEqual([]);
    expect(scoreQuestion(choiceQuestion(1), [])).toEqual([]);
  });
});

describe("scoreQuestion: exact computation", () => {
  it("compares in hundredths, so tier limits are exact whatever the decimals", () => {
    // In floating point, (11.33 - 11) / 11 = 0.030000000000000006 > 3 %. It is exactly 3 %.
    const scores = scoresOf(numberQuestion(11), [guess("A", 11.33), guess("B", 10.67), guess("C", 11.34)]);
    expect(scores.A.basePoints).toBe(80);
    expect(scores.B.basePoints).toBe(80);
    expect(scores.C.basePoints).toBe(65);
  });

  it("applies the coefficient and the joker to the bonus as well", () => {
    const [score] = scoreQuestion(numberQuestion(250, { coefficient: 3 }), [guess("A", 400, true)]);
    expect(score.total).toBe(20 * 3 * 2);
  });

  it("returns the scores in the order of the predictions, with each prediction attached", () => {
    const predictions = [guess("B", 300), guess("A", 250)];
    expect(scoreQuestion(numberQuestion(250), predictions).map((score) => score.prediction)).toEqual(predictions);
  });

  it("gives 0 to a prediction that has no value of the question's type", () => {
    const scores = scoresOf(numberQuestion(250), [pick("A", 3), guess("B", 250)]);
    expect(scores.A).toMatchObject({ basePoints: 0, podiumRank: null, relativeError: null, total: 0 });
    expect(scores.B.podiumRank).toBe(1);
    const [choice] = scoreQuestion(choiceQuestion(3), [guess("C", 3)]);
    expect(choice.total).toBe(0);
  });

  it("refuses a question without a result", () => {
    expect(() => scoreQuestion(numberQuestion(250, { resultNumber: null }), [])).toThrow("no result");
    expect(() => scoreQuestion(choiceQuestion(1, { resultOptionId: null }), [])).toThrow("no result");
  });
});
