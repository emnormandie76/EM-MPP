// Strip chart of the predictions of a number question (architecture §5.7): axis, ticks and
// placement of the dots. Positions are percentages of the width, rows are indexes from 0 to 3.

export const CHART_ROWS = 4;
export const MIN_POINT_GAP_PX = 14;
export const DEFAULT_CHART_WIDTH = 440;

/** Margin added on each side of the values, as a share of their range. */
const DOMAIN_MARGIN = 0.08;
/** Margin around a single value (as a share of it), or ±1 around 0. */
const SINGLE_VALUE_MARGIN = 0.1;
const TARGET_INTERVALS = 4;
/** Absorbs floating point noise when rounding the bounds to the step. */
const EPSILON = 1e-9;

export type ChartTicks = { min: number; max: number; step: number; ticks: number[] };

export type ChartPoint = {
  /** Index of the value in the list given to `buildStripChart`. */
  index: number;
  value: number;
  /** Position in percent of the width. */
  x: number;
  row: number;
};

export type StripChart = ChartTicks & {
  points: ChartPoint[];
  realX: number | null;
  meanX: number;
};

function decimalsOf(step: number): number {
  return Math.max(0, -Math.floor(Math.log10(step)));
}

/** "Round" ticks: a step of 1, 2 or 5 × 10ⁿ for about 4 intervals, bounds rounded out to the step. */
export function niceTicks(min: number, max: number): ChartTicks {
  const rough = (max - min) / TARGET_INTERVALS;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const error = rough / magnitude;
  const factor = error >= Math.sqrt(50) ? 10 : error >= Math.sqrt(10) ? 5 : error >= Math.sqrt(2) ? 2 : 1;
  const decimals = decimalsOf(factor * magnitude);
  const round = (value: number) => Number(value.toFixed(decimals)) + 0; // + 0 turns -0 into 0
  const step = round(factor * magnitude);

  const first = Math.floor(min / step + EPSILON);
  const last = Math.ceil(max / step - EPSILON);
  const ticks = Array.from({ length: last - first + 1 }, (_, k) => round((first + k) * step));
  return { min: ticks[0], max: ticks[ticks.length - 1], step, ticks };
}

function domainOf(values: readonly number[]): { low: number; high: number } {
  const low = Math.min(...values);
  const high = Math.max(...values);
  if (low === high) {
    const margin = low === 0 ? 1 : Math.abs(low) * SINGLE_VALUE_MARGIN;
    return { low: low - margin, high: high + margin };
  }
  const margin = (high - low) * DOMAIN_MARGIN;
  return { low: low - margin, high: high + margin };
}

/**
 * Sorted by value, each dot goes on the first row where it is at least 14 px from the previous
 * dot of that row; if none fits, on the row with the widest gap.
 */
function placeDots(sorted: { index: number; value: number; x: number }[], width: number): ChartPoint[] {
  const lastPx: (number | null)[] = Array.from({ length: CHART_ROWS }, () => null);
  return sorted.map((point) => {
    const px = (point.x / 100) * width;
    const gaps = lastPx.map((last) => (last === null ? Number.POSITIVE_INFINITY : px - last));
    const free = gaps.findIndex((gap) => gap >= MIN_POINT_GAP_PX);
    const row = free >= 0 ? free : gaps.indexOf(Math.max(...gaps));
    lastPx[row] = px;
    return { ...point, row };
  });
}

export function buildStripChart(
  values: readonly number[],
  real: number | null | undefined,
  mean: number,
  width = DEFAULT_CHART_WIDTH,
): StripChart {
  if (values.length === 0) throw new RangeError("A strip chart needs at least one value");
  const hasReal = real !== null && real !== undefined;
  const { low, high } = domainOf([...values, mean, ...(hasReal ? [real] : [])]);
  const axis = niceTicks(low, high);
  const toX = (value: number) => ((value - axis.min) / (axis.max - axis.min)) * 100;

  const sorted = values
    .map((value, index) => ({ index, value, x: toX(value) }))
    .sort((a, b) => a.value - b.value || a.index - b.index);
  return {
    ...axis,
    points: placeDots(sorted, width),
    realX: hasReal ? toX(real) : null,
    meanX: toX(mean),
  };
}
