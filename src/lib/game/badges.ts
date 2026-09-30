import type { QuestionType } from "./scoring";

// Badges (architecture §5.8), all deduced from resolved predictions and the palmarès, never stored.

export type BadgeKey = "first_bullseye" | "nostradamus" | "sharpshooter" | "joker_win" | "assiduous" | "champion";

/** The 6 badges, in display order. */
export const BADGES: readonly { key: BadgeKey; name: string }[] = [
  { key: "first_bullseye", name: "Premier « Dans le mille »" },
  { key: "nostradamus", name: "Nostradamus" },
  { key: "sharpshooter", name: "Tireur d'élite" },
  { key: "joker_win", name: "Joker gagnant" },
  { key: "assiduous", name: "Assidu" },
  { key: "champion", name: "Champion" },
];

/** Dans le mille needed in one season for Nostradamus. */
const NOSTRADAMUS_BULLSEYES = 3;
/** Podium ranks that win a bonus. */
const PODIUM_SIZE = 3;

/** One scored prediction of the player, on a resolved and not cancelled question. */
export type BadgeResult = {
  seasonId: number;
  questionType: QuestionType;
  resolvedAt: Date;
  joker: boolean;
  bullseye: boolean;
  podiumRank: number | null;
  correctChoice: boolean;
};

export type ProclaimedSeason = {
  seasonId: number;
  proclaimedAt: Date;
  /** Published questions of the season, cancelled ones excluded. */
  questionIds: readonly number[];
  /** The player's rank in the palmarès (`season_standing`), or null if absent. */
  rank: number | null;
};

export type BadgeInput = {
  results: readonly BadgeResult[];
  /** Every question the player has a prediction on. */
  predictedQuestionIds: readonly number[];
  proclaimedSeasons: readonly ProclaimedSeason[];
};

export type EarnedBadge = { key: BadgeKey; count: number; lastEarnedAt: Date | null };

function latest(dates: readonly Date[]): Date | null {
  return dates.reduce<Date | null>((max, date) => (max === null || date > max ? date : max), null);
}

function byDate(a: Date, b: Date): number {
  return a.getTime() - b.getTime();
}

/** Earning dates of a badge counted per occurrence. */
function occurrences(dates: readonly Date[]): Omit<EarnedBadge, "key"> {
  return { count: dates.length, lastEarnedAt: latest(dates) };
}

function firstBullseye(results: readonly BadgeResult[]): Omit<EarnedBadge, "key"> {
  const [first] = results.filter(({ bullseye }) => bullseye).map(({ resolvedAt }) => resolvedAt).sort(byDate);
  return first ? { count: 1, lastEarnedAt: first } : { count: 0, lastEarnedAt: null };
}

/** One per season with 3 Dans le mille, earned on the date of the third. */
function nostradamus(results: readonly BadgeResult[]): Omit<EarnedBadge, "key"> {
  const bySeason = new Map<number, Date[]>();
  for (const { seasonId, bullseye, resolvedAt } of results) {
    if (bullseye) bySeason.set(seasonId, [...(bySeason.get(seasonId) ?? []), resolvedAt]);
  }
  const earned = [...bySeason.values()]
    .filter((dates) => dates.length >= NOSTRADAMUS_BULLSEYES)
    .map((dates) => dates.sort(byDate)[NOSTRADAMUS_BULLSEYES - 1]);
  return occurrences(earned);
}

function jokerWon({ joker, questionType, podiumRank, correctChoice }: BadgeResult): boolean {
  if (!joker) return false;
  return questionType === "number" ? podiumRank !== null && podiumRank <= PODIUM_SIZE : correctChoice;
}

export function computeBadges({ results, predictedQuestionIds, proclaimedSeasons }: BadgeInput): EarnedBadge[] {
  const predicted = new Set(predictedQuestionIds);
  const assiduous = proclaimedSeasons.filter(
    ({ questionIds }) => questionIds.length > 0 && questionIds.every((id) => predicted.has(id)),
  );
  const earned: Record<BadgeKey, Omit<EarnedBadge, "key">> = {
    first_bullseye: firstBullseye(results),
    nostradamus: nostradamus(results),
    sharpshooter: occurrences(
      results.filter(({ questionType, podiumRank }) => questionType === "number" && podiumRank === 1).map(({ resolvedAt }) => resolvedAt),
    ),
    joker_win: occurrences(results.filter(jokerWon).map(({ resolvedAt }) => resolvedAt)),
    assiduous: occurrences(assiduous.map(({ proclaimedAt }) => proclaimedAt)),
    champion: occurrences(proclaimedSeasons.filter(({ rank }) => rank === 1).map(({ proclaimedAt }) => proclaimedAt)),
  };
  return BADGES.map(({ key }) => ({ key, ...earned[key] }));
}
