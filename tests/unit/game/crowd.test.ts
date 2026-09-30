import { describe, expect, it } from "vitest";
import { choiceDistribution, numberCrowd, relativeGap } from "@/lib/game/crowd";

const F1 = [180, 205, 220, 228, 235, 240, 262, 270, 285, 300, 310, 330];

describe("numberCrowd", () => {
  it("F1: mean 255.4 shown as 255 (all values are whole numbers), median 251", () => {
    const crowd = numberCrowd(F1);
    expect(crowd?.count).toBe(12);
    expect(crowd?.mean).toBeCloseTo(255.4167, 4);
    expect(crowd?.displayMean).toBe(255);
    expect(crowd?.median).toBe(251);
    expect(crowd?.displayMedian).toBe(251);
  });

  it("takes the middle value for an odd count, whatever the order", () => {
    expect(numberCrowd([300, 100, 200])).toMatchObject({ mean: 200, median: 200 });
  });

  it("rounds to 2 decimals when a value has decimals", () => {
    const crowd = numberCrowd([12.5, 13, 14.25]);
    expect(crowd?.mean).toBeCloseTo(13.25, 12);
    expect(crowd?.displayMean).toBe(13.25);
    expect(crowd?.median).toBe(13);
    const thirds = numberCrowd([10, 10, 10.5]);
    expect(thirds?.displayMean).toBe(10.17);
  });

  it("computes exactly, in hundredths", () => {
    expect(numberCrowd([0.1, 0.2])?.mean).toBe(0.15);
    expect(numberCrowd([0.1, 0.2])?.median).toBe(0.15);
  });

  it("handles a single value", () => {
    expect(numberCrowd([42])).toMatchObject({ count: 1, mean: 42, median: 42, displayMean: 42, displayMedian: 42 });
  });

  it("returns null without any value", () => {
    expect(numberCrowd([])).toBeNull();
  });
});

describe("relativeGap", () => {
  it("compares the crowd to the real value like a prediction", () => {
    expect(relativeGap(255.4, 250)).toBeCloseTo(0.0216, 12);
    expect(relativeGap(240, 250)).toBeCloseTo(0.04, 12);
  });

  it("is null when the real value is 0", () => {
    expect(relativeGap(3, 0)).toBeNull();
  });
});

describe("choiceDistribution", () => {
  it("F2: 5, 3 and 1 answers give 56 %, 33 % and 11 % (largest remainder, sum 100)", () => {
    const picks = [1, 1, 1, 1, 1, 2, 2, 2, 3];
    expect(choiceDistribution([1, 2, 3], picks)).toEqual([
      { optionId: 1, count: 5, percent: 56 },
      { optionId: 2, count: 3, percent: 33 },
      { optionId: 3, count: 1, percent: 11 },
    ]);
  });

  it("gives the extra points to the earliest options when remainders are equal", () => {
    expect(choiceDistribution([1, 2, 3], [3, 2, 1]).map(({ percent }) => percent)).toEqual([34, 33, 33]);
  });

  it("always sums to 100 when there are answers", () => {
    const picks = [1, 2, 2, 3, 3, 3, 4, 4, 4, 4, 5, 6, 7];
    const shares = choiceDistribution([1, 2, 3, 4, 5, 6, 7], picks);
    expect(shares.reduce((sum, { percent }) => sum + percent, 0)).toBe(100);
  });

  it("keeps options nobody chose, at 0 %", () => {
    expect(choiceDistribution([1, 2], [2, 2])).toEqual([
      { optionId: 1, count: 0, percent: 0 },
      { optionId: 2, count: 2, percent: 100 },
    ]);
  });

  it("gives 0 % everywhere without any answer, and ignores unknown options", () => {
    expect(choiceDistribution([1, 2], [9, null])).toEqual([
      { optionId: 1, count: 0, percent: 0 },
      { optionId: 2, count: 0, percent: 0 },
    ]);
  });
});
