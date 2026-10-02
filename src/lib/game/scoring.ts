import { BULLSEYE_PERCENT, JOKER_DIVISOR } from "./constants";

// Malus of each prediction on a resolved question (architecture §5.5, v1.2): the raw gap to the real
// value, without any cap; the fewest malus wins. Computed on every read, never stored. Predictions,
// real values and malus of a wrong answer have at most 2 decimals: everything is computed in exact
// integer hundredths, and the malus stay in hundredths until they are displayed.

export type QuestionType = "number" | "choice";

export type ScoringQuestion = {
  type: QuestionType;
  coefficient: number;
  resultNumber: number | null;
  resultOptionId: number | null;
  /** Malus of a wrong answer, for a choice question. */
  wrongAnswerMalus: number | null;
};

export type ScoringPrediction = {
  valueNumber: number | null;
  optionId: number | null;
  joker: boolean;
};

export type PredictionScore<P extends ScoringPrediction = ScoringPrediction> = {
  prediction: P;
  /** Gap (number) or malus of a wrong answer (choice), in hundredths, before coefficient and joker. */
  baseMalus: number;
  /** Malus of the question, in hundredths: base × coefficient, halved with a joker. */
  total: number;
  /** Relative error of 1 % or less (number question). It does not change the malus. */
  bullseye: boolean;
  /** |prediction − real| / |real| for a number question (infinite if real = 0 ≠ prediction); else null. */
  relativeError: number | null;
  /** 1 + the number of predictions strictly closer, with ties (1, 1, 3), on a number question; else null. */
  podiumRank: number | null;
};

export type QuestionScores<P extends ScoringPrediction = ScoringPrediction> = {
  scores: PredictionScore<P>[];
  /**
   * Malus of a player of the standings without a prediction (decision of 02/10/2026): the worst
   * prediction's, in hundredths. Largest gap × coefficient (number), malus of a wrong answer ×
   * coefficient (choice), 0 when nobody predicted.
   */
  absentMalus: number;
};

/** Exact integer hundredths of a value that has at most 2 decimals. */
export function toHundredths(value: number): number {
  return Math.round(value * 100);
}

/** A malus in hundredths divided by JOKER_DIVISOR (2), rounded to the hundredth, half up. */
export function halveForJoker(hundredths: number): number {
  return Math.floor((hundredths + 1) / JOKER_DIVISOR);
}

function total(baseMalus: number, coefficient: number, joker: boolean): number {
  const malus = baseMalus * coefficient;
  return joker ? halveForJoker(malus) : malus;
}

export function scoreQuestion<P extends ScoringPrediction>(question: ScoringQuestion, predictions: readonly P[]): QuestionScores<P> {
  return question.type === "number" ? scoreNumber(question, predictions) : scoreChoice(question, predictions);
}

function scoreChoice<P extends ScoringPrediction>(question: ScoringQuestion, predictions: readonly P[]): QuestionScores<P> {
  const answer = question.resultOptionId;
  if (answer === null) throw new Error("Cannot score a question with no result");
  if (question.wrongAnswerMalus === null) throw new Error("Cannot score a choice question without the malus of a wrong answer");
  const wrong = toHundredths(question.wrongAnswerMalus);
  const scores = predictions.map((prediction) => {
    // No answer counts as a wrong answer, like an absence.
    const baseMalus = prediction.optionId === answer ? 0 : wrong;
    return {
      prediction,
      baseMalus,
      total: total(baseMalus, question.coefficient, prediction.joker),
      bullseye: false,
      relativeError: null,
      podiumRank: null,
    };
  });
  return { scores, absentMalus: predictions.length === 0 ? 0 : wrong * question.coefficient };
}

function scoreNumber<P extends ScoringPrediction>(question: ScoringQuestion, predictions: readonly P[]): QuestionScores<P> {
  if (question.resultNumber === null) throw new Error("Cannot score a question with no result");
  const real = toHundredths(question.resultNumber);
  const gaps = predictions.map(({ valueNumber }) => (valueNumber === null ? null : Math.abs(toHundredths(valueNumber) - real)));
  const known = gaps.filter((gap) => gap !== null);
  const absentMalus = known.length === 0 ? 0 : Math.max(...known) * question.coefficient;

  const scores = predictions.map((prediction, index) => {
    const gap = gaps[index];
    // A prediction without a value (impossible through the services) is treated as an absence.
    if (gap === null) {
      return { prediction, baseMalus: absentMalus, total: absentMalus, bullseye: false, relativeError: null, podiumRank: null };
    }
    return {
      prediction,
      baseMalus: gap,
      total: total(gap, question.coefficient, prediction.joker),
      // Real value 0: only 0 is a Dans le mille.
      bullseye: gap * 100 <= BULLSEYE_PERCENT * Math.abs(real),
      relativeError: real === 0 ? (gap === 0 ? 0 : Number.POSITIVE_INFINITY) : gap / Math.abs(real),
      podiumRank: 1 + known.filter((other) => other < gap).length,
    };
  });
  return { scores, absentMalus };
}
