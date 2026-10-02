// Scoring constants (architecture §5.5, v1.2). The rules page is generated from these same values,
// so the published rules and the computation cannot diverge.

/** A joker divides the malus of its question by 2. */
export const JOKER_DIVISOR = 2;
/** Jokers per player and per season, when the season allows them (§5.13). */
export const JOKERS_PER_SEASON = 2;
export const COEFFICIENTS = [1, 2, 3] as const;

export type Coefficient = (typeof COEFFICIENTS)[number];

/** "Dans le mille": a relative error of 1 % or less. It does not change the malus. */
export const BULLSEYE_PERCENT = 1;
/** The 3 closest predictions (badges), without any bonus. */
export const PODIUM_SIZE = 3;
