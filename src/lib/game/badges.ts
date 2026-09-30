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

export function badgeName(key: BadgeKey): string {
  return BADGES.find((badge) => badge.key === key)!.name;
}

/** Dans le mille needed in one season for Nostradamus. */
const NOSTRADAMUS_BULLSEYES = 3;
/** Podium ranks that win a bonus. */
const PODIUM_SIZE = 3;

/** One scored prediction of the player, on a resolved and not cancelled question. */
export type BadgeResult = {
  questionId: number;
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

/** Chronological order of the results: resolution date, then question, for equal dates. */
function chronological(a: BadgeResult, b: BadgeResult): number {
  return a.resolvedAt.getTime() - b.resolvedAt.getTime() || a.questionId - b.questionId;
}

/** Earning dates of a badge counted per occurrence. */
function occurrences(dates: readonly Date[]): Omit<EarnedBadge, "key"> {
  return { count: dates.length, lastEarnedAt: latest(dates) };
}

/** The first Dans le mille of all seasons. */
function firstBullseyeResult(results: readonly BadgeResult[]): BadgeResult | null {
  return results.filter(({ bullseye }) => bullseye).sort(chronological)[0] ?? null;
}

/** For each season with 3 Dans le mille, the third one. */
function nostradamusResults(results: readonly BadgeResult[]): BadgeResult[] {
  const bySeason = new Map<number, BadgeResult[]>();
  for (const result of results) {
    if (result.bullseye) bySeason.set(result.seasonId, [...(bySeason.get(result.seasonId) ?? []), result]);
  }
  return [...bySeason.values()]
    .filter((bullseyes) => bullseyes.length >= NOSTRADAMUS_BULLSEYES)
    .map((bullseyes) => bullseyes.sort(chronological)[NOSTRADAMUS_BULLSEYES - 1]);
}

function sharpshot({ questionType, podiumRank }: BadgeResult): boolean {
  return questionType === "number" && podiumRank === 1;
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
  const first = firstBullseyeResult(results);
  const earned: Record<BadgeKey, Omit<EarnedBadge, "key">> = {
    first_bullseye: first ? { count: 1, lastEarnedAt: first.resolvedAt } : { count: 0, lastEarnedAt: null },
    nostradamus: occurrences(nostradamusResults(results).map(({ resolvedAt }) => resolvedAt)),
    sharpshooter: occurrences(results.filter(sharpshot).map(({ resolvedAt }) => resolvedAt)),
    joker_win: occurrences(results.filter(jokerWon).map(({ resolvedAt }) => resolvedAt)),
    assiduous: occurrences(assiduous.map(({ proclaimedAt }) => proclaimedAt)),
    champion: occurrences(proclaimedSeasons.filter(({ rank }) => rank === 1).map(({ proclaimedAt }) => proclaimedAt)),
  };
  return BADGES.map(({ key }) => ({ key, ...earned[key] }));
}

/**
 * Badges earned on one question (§8.2 ResultPanel), in display order: the first Dans le mille, the
 * third of a season (Nostradamus), Tireur d'élite and Joker gagnant. `results` are all the player's
 * results, so that "first" and "third" are known.
 */
export function badgesOnQuestion(results: readonly BadgeResult[], questionId: number): BadgeKey[] {
  const own = results.find((result) => result.questionId === questionId);
  if (!own) return [];
  const earned: Partial<Record<BadgeKey, boolean>> = {
    first_bullseye: firstBullseyeResult(results) === own,
    nostradamus: nostradamusResults(results).includes(own),
    sharpshooter: sharpshot(own),
    joker_win: jokerWon(own),
  };
  return BADGES.map(({ key }) => key).filter((key) => earned[key]);
}
