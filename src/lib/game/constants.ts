// Scoring constants (architecture §5.5). The rules page is generated from these same values,
// so the published rules and the computation cannot diverge.

/** Scale for number questions: first tier whose relative error is within `maxPercent`; beyond, 0. */
export const SCORE_TIERS = [
  { maxPercent: 1, points: 100 }, // "Dans le mille"
  { maxPercent: 3, points: 80 },
  { maxPercent: 5, points: 65 },
  { maxPercent: 10, points: 45 },
  { maxPercent: 20, points: 25 },
  { maxPercent: 35, points: 10 },
] as const;

/** Bonus for podium ranks 1, 2 and 3 on number questions. */
export const PODIUM_BONUS = [20, 10, 5] as const;

/** Points for the right answer to a choice question. */
export const CHOICE_POINTS = 50;

export const JOKER_MULTIPLIER = 2;
export const JOKERS_PER_SEASON = 2;
export const COEFFICIENTS = [1, 2, 3] as const;

export type Coefficient = (typeof COEFFICIENTS)[number];

/** Base points of a "Dans le mille". */
export const BULLSEYE_POINTS = SCORE_TIERS[0].points;
