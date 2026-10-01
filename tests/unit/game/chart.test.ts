import { describe, expect, it } from "vitest";
import {
  buildStripChart,
  CHART_ROWS,
  DEFAULT_CHART_WIDTH,
  MIN_POINT_GAP_PX,
  niceTicks,
  VIEWER_LABEL_PX,
  viewerLabelSide,
} from "@/lib/game/chart";

const F1 = [180, 205, 220, 228, 235, 240, 262, 270, 285, 300, 310, 330];
const F1_MEAN = 3065 / 12;

describe("niceTicks", () => {
  it("F4: a domain from 150 to 350 gives 150, 200, 250, 300, 350", () => {
    expect(niceTicks(150, 350)).toEqual({ min: 150, max: 350, step: 50, ticks: [150, 200, 250, 300, 350] });
  });

  it("rounds the bounds out to multiples of the step", () => {
    expect(niceTicks(168, 342)).toMatchObject({ min: 150, max: 350, step: 50 });
  });

  it("uses steps of 1, 2 or 5 times a power of ten", () => {
    expect(niceTicks(0, 10).step).toBe(2);
    expect(niceTicks(0, 4).step).toBe(1);
    expect(niceTicks(0, 1000).step).toBe(200);
    expect(niceTicks(2000, 3000).step).toBe(200);
    expect(niceTicks(0, 35).step).toBe(10);
  });

  it("works with decimals, without floating point noise", () => {
    const { ticks, step } = niceTicks(11.5, 13.5);
    expect(step).toBe(0.5);
    expect(ticks).toEqual([11.5, 12, 12.5, 13, 13.5]);
    expect(niceTicks(0.1, 0.5).ticks).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
  });

  it("gives about 4 intervals", () => {
    for (const [min, max] of [[150, 350], [0, 1000], [90, 110], [3, 97], [12.3, 18.9]]) {
      const { ticks } = niceTicks(min, max);
      expect(ticks.length - 1).toBeGreaterThanOrEqual(2);
      expect(ticks.length - 1).toBeLessThanOrEqual(7);
    }
  });
});

describe("buildStripChart: domain", () => {
  it("F1 and F4: predictions from 180 to 330 give an axis from 150 to 350", () => {
    const chart = buildStripChart(F1, null, F1_MEAN);
    expect(chart.ticks).toEqual([150, 200, 250, 300, 350]);
    expect([chart.min, chart.max]).toEqual([150, 350]);
  });

  it("F3: all values equal to 100 give a domain from 90 to 110", () => {
    const chart = buildStripChart([100, 100, 100], null, 100);
    expect([chart.min, chart.max]).toEqual([90, 110]);
  });

  it("widens a single value 0 by ±1", () => {
    const chart = buildStripChart([0], null, 0);
    expect(chart.min).toBeLessThanOrEqual(-1);
    expect(chart.max).toBeGreaterThanOrEqual(1);
  });

  it("includes the real value in the domain", () => {
    const chart = buildStripChart([100, 110], 200, 105);
    expect([chart.min, chart.max]).toEqual([80, 220]);
    expect(chart.realX).toBeCloseTo(((200 - 80) / 140) * 100, 12);
  });

  it("places the real value and the mean in percent of the width", () => {
    const chart = buildStripChart(F1, 250, F1_MEAN);
    expect(chart.realX).toBe(50);
    expect(chart.meanX).toBeCloseTo(((F1_MEAN - 150) / 200) * 100, 12);
  });

  it("has no real value before the result", () => {
    expect(buildStripChart(F1, null, F1_MEAN).realX).toBeNull();
    expect(buildStripChart(F1, undefined, F1_MEAN).realX).toBeNull();
  });

  it("refuses an empty list", () => {
    expect(() => buildStripChart([], null, 0)).toThrow(RangeError);
  });
});

describe("buildStripChart: points", () => {
  it("places the points in percent of the width, sorted by value, keeping their index", () => {
    const chart = buildStripChart([300, 150, 250], null, 233);
    expect(chart.points.map(({ index, value }) => [index, value])).toEqual([[1, 150], [2, 250], [0, 300]]);
    expect(chart.points[0].x).toBe(((150 - chart.min) / (chart.max - chart.min)) * 100);
  });

  it("keeps well separated points on the first row", () => {
    const chart = buildStripChart([100, 200, 300, 400], null, 250);
    expect(chart.points.map(({ row }) => row)).toEqual([0, 0, 0, 0]);
  });

  it("F1: 240 is 11 px from 235 on the axis from 150 to 350, so it goes to the second row", () => {
    const chart = buildStripChart(F1, 250, F1_MEAN);
    expect(chart.points.map(({ value, row }) => [value, row]).filter(([, row]) => row > 0)).toEqual([[240, 1]]);
  });

  it("moves a point closer than 14 px to the next free row", () => {
    const chart = buildStripChart([0, 3, 6, 100], null, 50);
    expect([chart.min, chart.max]).toEqual([-20, 120]);
    // Domain -20..120: 1 unit = 440 / 140 ≈ 3.14 px; 3 units ≈ 9.4 px, 6 units ≈ 18.9 px.
    expect(chart.points.map(({ value, row }) => [value, row])).toEqual([
      [0, 0],
      [3, 1],
      [6, 0],
      [100, 0],
    ]);
  });

  it("uses at most 4 rows, then the row with the widest gap", () => {
    const chart = buildStripChart([50, 50, 50, 50, 50, 50], null, 50);
    expect(chart.points.map(({ row }) => row)).toEqual([0, 1, 2, 3, 0, 0]);
    expect(CHART_ROWS).toBe(4);
    expect(MIN_POINT_GAP_PX).toBe(14);
  });

  it("depends on the width", () => {
    const narrow = buildStripChart([0, 10, 100], null, 50, 100);
    const wide = buildStripChart([0, 10, 100], null, 50, 1000);
    expect(narrow.points[1].row).toBe(1);
    expect(wide.points[1].row).toBe(0);
  });
});

// Test report of 01/10/2026, R-03: the « TOI » label, drawn above the viewer's dot, hid the dot of
// the next row. It now sits beside the dot, and takes room on the viewer's row.
describe("buildStripChart: the viewer's label", () => {
  it("is on the right of the dot, or on its left from 85 % of the width", () => {
    expect(viewerLabelSide(0)).toBe("right");
    expect(viewerLabelSide(85)).toBe("right");
    expect(viewerLabelSide(85.1)).toBe("left");
  });

  it("on the right, keeps the next dots of the viewer's row 28 px further", () => {
    // Domain -20..120: 1 unit ≈ 3.14 px. 6 is 18.9 px after 0: on the viewer's row, it would sit on the label.
    const chart = buildStripChart([0, 3, 6, 100], null, 50, DEFAULT_CHART_WIDTH, 0);
    expect(chart.points.map(({ value, row }) => [value, row])).toEqual([
      [0, 0],
      [3, 1],
      [6, 2],
      [100, 0],
    ]);
  });

  it("on the left, needs 28 px more after the previous dot of the row", () => {
    // 100 is at 85.7 % of the axis -20..120, and 95 is 15.7 px before it.
    expect(buildStripChart([0, 95, 100], null, 50).points.map(({ row }) => row)).toEqual([0, 0, 0]);
    const chart = buildStripChart([0, 95, 100], null, 50, DEFAULT_CHART_WIDTH, 2);
    expect(chart.points.map(({ row }) => row)).toEqual([0, 0, 1]);
  });

  it("A7 of the report (P1 vector, two predictions of 235): no dot under the label, whoever the viewer is", () => {
    const values = [240, 262, 235, 235, 300];
    const px = (x: number) => (x / 100) * DEFAULT_CHART_WIDTH;
    for (let viewer = 0; viewer < values.length; viewer += 1) {
      const chart = buildStripChart(values, 250, 254.4, DEFAULT_CHART_WIDTH, viewer);
      const me = chart.points.find(({ index }) => index === viewer)!;
      const side = viewerLabelSide(me.x);
      for (const other of chart.points.filter(({ index, row }) => index !== viewer && row === me.row)) {
        const ahead = (px(other.x) - px(me.x)) * (side === "right" ? 1 : -1);
        expect(ahead, `viewer ${viewer}, dot ${other.index}`).not.toBe(0);
        if (ahead > 0) expect(ahead).toBeGreaterThanOrEqual(VIEWER_LABEL_PX + MIN_POINT_GAP_PX);
      }
    }
  });

  it("changes nothing without a viewer", () => {
    expect(buildStripChart([0, 3, 6, 100], null, 50, DEFAULT_CHART_WIDTH, null)).toEqual(buildStripChart([0, 3, 6, 100], null, 50));
  });
});
