import { toHundredths } from "./scoring";

// Wisdom of the crowd (architecture §5.7): shown once a question is closed.

export type NumberCrowd = {
  count: number;
  mean: number;
  median: number;
  /** Rounded to a whole number when every prediction is whole, else to 2 decimals. */
  displayMean: number;
  displayMedian: number;
};

export type ChoiceShare = { optionId: number; count: number; percent: number };

function roundTo(value: number, decimals: 0 | 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Mean and median of the predictions of a number question, computed in exact hundredths. */
export function numberCrowd(values: readonly number[]): NumberCrowd | null {
  if (values.length === 0) return null;
  const hundredths = values.map(toHundredths).sort((a, b) => a - b);
  const count = hundredths.length;
  const mean = hundredths.reduce((sum, value) => sum + value, 0) / count / 100;
  const middle = Math.floor(count / 2);
  const median = (count % 2 === 1 ? hundredths[middle] : (hundredths[middle - 1] + hundredths[middle]) / 2) / 100;
  const decimals = hundredths.every((value) => value % 100 === 0) ? 0 : 2;
  return { count, mean, median, displayMean: roundTo(mean, decimals), displayMedian: roundTo(median, decimals) };
}

/** Gap between a crowd figure and the real value, as a relative error; null if the real value is 0. */
export function relativeGap(value: number, real: number): number | null {
  return real === 0 ? null : Math.abs(value - real) / Math.abs(real);
}

/**
 * Answers per option, in the order of `optionIds`, with whole percentages rounded by the largest
 * remainder method so that they add up to 100. Ties go to the earliest options.
 */
export function choiceDistribution(optionIds: readonly number[], picks: readonly (number | null)[]): ChoiceShare[] {
  const counts = optionIds.map((optionId) => picks.filter((pick) => pick === optionId).length);
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total === 0) return optionIds.map((optionId) => ({ optionId, count: 0, percent: 0 }));

  // Integer arithmetic: floor and remainder of count × 100 / total.
  const percents = counts.map((count) => Math.floor((count * 100) / total));
  const missing = 100 - percents.reduce((sum, percent) => sum + percent, 0);
  const byRemainder = counts
    .map((count, index) => ({ index, remainder: (count * 100) % total }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of byRemainder.slice(0, missing)) percents[index] += 1;

  return optionIds.map((optionId, index) => ({ optionId, count: counts[index], percent: percents[index] }));
}
