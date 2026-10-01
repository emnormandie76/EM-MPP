import { BULLSEYE_POINTS, CHOICE_POINTS, JOKER_MULTIPLIER, PODIUM_BONUS, SCORE_TIERS } from "./constants";

// Points of each prediction on a resolved question (architecture §5.5). Computed on every read,
// never stored. Number comparisons are exact: values have at most 2 decimals, so they are
// compared in integer hundredths.

export type QuestionType = "number" | "choice";

export type ScoringQuestion = {
  type: QuestionType;
  priceIsRight: boolean;
  coefficient: number;
  resultNumber: number | null;
  resultOptionId: number | null;
};

export type ScoringPrediction = {
  valueNumber: number | null;
  optionId: number | null;
  joker: boolean;
};

export type PredictionScore<P extends ScoringPrediction = ScoringPrediction> = {
  prediction: P;
  /** Points of the scale (number) or of the right answer (choice). */
  basePoints: number;
  /** Rank among the eligible predictions of a number question, with ties (1, 1, 3); else null. */
  podiumRank: number | null;
  podiumBonus: number;
  bullseye: boolean;
  /** |prediction − real| / |real| for a number question (infinite if real = 0 ≠ prediction); else null. */
  relativeError: number | null;
  /**
   * Juste Prix: the prediction went over the real value. Its relative error is shown, but it stays out
   * of the mean error of the tie-break, like its points (decision of 01/10/2026).
   */
  wentOver: boolean;
  total: number;
};

/** Exact integer hundredths of a value that has at most 2 decimals. */
export function toHundredths(value: number): number {
  return Math.round(value * 100);
}

/** First tier satisfied, else 0. In tier t (%) if and only if distance × 100 ≤ t × |real|. */
function scalePoints(distance: number, real: number): number {
  const tier = SCORE_TIERS.find(({ maxPercent }) => distance * 100 <= maxPercent * Math.abs(real));
  return tier?.points ?? 0;
}

function podiumBonus(rank: number | null): number {
  return rank === null ? 0 : (PODIUM_BONUS[rank - 1] ?? 0);
}

function total(basePoints: number, bonus: number, coefficient: number, joker: boolean): number {
  return (basePoints + bonus) * coefficient * (joker ? JOKER_MULTIPLIER : 1);
}

export function scoreQuestion<P extends ScoringPrediction>(
  question: ScoringQuestion,
  predictions: readonly P[],
): PredictionScore<P>[] {
  return question.type === "number" ? scoreNumber(question, predictions) : scoreChoice(question, predictions);
}

function scoreChoice<P extends ScoringPrediction>(question: ScoringQuestion, predictions: readonly P[]): PredictionScore<P>[] {
  const answer = question.resultOptionId;
  if (answer === null) throw new Error("Cannot score a question with no result");
  return predictions.map((prediction) => {
    const basePoints = prediction.optionId === answer ? CHOICE_POINTS : 0;
    return {
      prediction,
      basePoints,
      podiumRank: null,
      podiumBonus: 0,
      bullseye: false,
      relativeError: null,
      wentOver: false,
      total: total(basePoints, 0, question.coefficient, prediction.joker),
    };
  });
}

type NumberEvaluation = {
  basePoints: number;
  relativeError: number | null;
  /** Distance in hundredths, when the prediction competes for the podium. */
  podiumDistance: number | null;
  wentOver: boolean;
};

function evaluateNumber(question: ScoringQuestion, real: number, value: number | null): NumberEvaluation {
  if (value === null) return { basePoints: 0, relativeError: null, podiumDistance: null, wentOver: false };
  const guess = toHundredths(value);
  const distance = Math.abs(guess - real);
  // Real value 0: the relative error does not exist; only 0 scores (100 points, from the scale).
  const relativeError = real === 0 ? (distance === 0 ? 0 : Number.POSITIVE_INFINITY) : distance / Math.abs(real);
  // Juste Prix: going over the real value scores nothing and leaves the podium.
  const over = question.priceIsRight && guess > real;
  return {
    basePoints: over ? 0 : scalePoints(distance, real),
    relativeError,
    podiumDistance: over || !Number.isFinite(relativeError) ? null : distance,
    wentOver: over,
  };
}

function scoreNumber<P extends ScoringPrediction>(question: ScoringQuestion, predictions: readonly P[]): PredictionScore<P>[] {
  if (question.resultNumber === null) throw new Error("Cannot score a question with no result");
  const real = toHundredths(question.resultNumber);
  const evaluations = predictions.map((prediction) => evaluateNumber(question, real, prediction.valueNumber));
  const distances = evaluations.flatMap(({ podiumDistance }) => (podiumDistance === null ? [] : [podiumDistance]));

  return predictions.map((prediction, index) => {
    const { basePoints, relativeError, podiumDistance, wentOver } = evaluations[index];
    const podiumRank =
      podiumDistance === null ? null : 1 + distances.filter((distance) => distance < podiumDistance).length;
    const bonus = podiumBonus(podiumRank);
    return {
      prediction,
      basePoints,
      podiumRank,
      podiumBonus: bonus,
      bullseye: basePoints === BULLSEYE_POINTS,
      relativeError,
      wentOver,
      total: total(basePoints, bonus, question.coefficient, prediction.joker),
    };
  });
}
