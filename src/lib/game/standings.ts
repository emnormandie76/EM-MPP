import { scoreQuestion, type ScoringPrediction, type ScoringQuestion } from "./scoring";
import { previousSeason, seasonAt } from "./time";

// Season standings (architecture §5.6), recomputed on every read from predictions and results.

/** A published, resolved and not cancelled question of the season. */
export type StandingsQuestion = ScoringQuestion & { id: number; resolvedAt: Date };
export type StandingsPrediction = ScoringPrediction & { questionId: number; userId: string };
export type StandingsPlayer = { id: string; name: string; banned: boolean };

export type StandingsInput = {
  questions: readonly StandingsQuestion[];
  /**
   * Predictions of the season. Only those on `questions` are scored; the others only tell
   * whether a disabled player took part in the season.
   */
  predictions: readonly StandingsPrediction[];
  players: readonly StandingsPlayer[];
};

export type StandingTotals = {
  userId: string;
  name: string;
  /** Disabled account, listed because it has predictions in the season. */
  inactive: boolean;
  points: number;
  bullseyes: number;
  /** Mean of the finite relative errors on number questions (Juste Prix included), or null. */
  meanError: number | null;
  questionsPlayed: number;
};

export type StandingRow = StandingTotals & { rank: number };

/** `delta` = previous rank − current rank (positive = up); null when there is nothing to compare. */
export type StandingRowWithMovement = StandingRow & { delta: number | null };

export type SeasonSummary = {
  /** 00:00 on its start day, Paris time (§5.1). */
  startsAt: Date;
  /** Published questions, cancelled ones excluded. */
  publishedCount: number;
  resolvedCount: number;
  proclaimed: boolean;
};

/** Mean errors closer than this are equal: a perfect tie. */
const MEAN_ERROR_TOLERANCE = 1e-12;

const frenchOrder = new Intl.Collator("fr", { sensitivity: "base" });

function compareMeanErrors(a: number | null, b: number | null): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  return Math.abs(a - b) <= MEAN_ERROR_TOLERANCE ? 0 : a - b;
}

/** Negative when `a` ranks before `b`: points, then Dans le mille, then lowest mean error. */
function compareTotals(a: StandingTotals, b: StandingTotals): number {
  if (a.points !== b.points) return b.points - a.points;
  if (a.bullseyes !== b.bullseyes) return b.bullseyes - a.bullseyes;
  return compareMeanErrors(a.meanError, b.meanError);
}

/** Sorts and ranks with ties (1, 1, 3). Perfect ties are displayed in French alphabetical order. */
export function rankStandings(totals: readonly StandingTotals[]): StandingRow[] {
  const sorted = [...totals].sort(
    (a, b) => compareTotals(a, b) || frenchOrder.compare(a.name, b.name) || a.userId.localeCompare(b.userId),
  );
  const rows: StandingRow[] = [];
  sorted.forEach((row, index) => {
    const tiedWithPrevious = index > 0 && compareTotals(sorted[index - 1], row) === 0;
    rows.push({ ...row, rank: tiedWithPrevious ? rows[index - 1].rank : index + 1 });
  });
  return rows;
}

export function computeStandings({ questions, predictions, players }: StandingsInput): StandingRow[] {
  const tookPart = new Set(predictions.map(({ userId }) => userId));
  const totals = new Map<string, StandingTotals & { errors: number[] }>();
  for (const { id, name, banned } of players) {
    if (banned && !tookPart.has(id)) continue;
    totals.set(id, { userId: id, name, inactive: banned, points: 0, bullseyes: 0, meanError: null, questionsPlayed: 0, errors: [] });
  }

  for (const question of questions) {
    const scores = scoreQuestion(
      question,
      predictions.filter(({ questionId }) => questionId === question.id),
    );
    for (const score of scores) {
      const row = totals.get(score.prediction.userId);
      if (!row) continue;
      row.points += score.total;
      row.questionsPlayed += 1;
      if (score.bullseye) row.bullseyes += 1;
      // A Juste Prix prediction that went over scores nothing, and does not help the tie-break either.
      if (!score.wentOver && score.relativeError !== null && Number.isFinite(score.relativeError)) row.errors.push(score.relativeError);
    }
  }

  return rankStandings(
    [...totals.values()].map(({ errors, ...row }) => ({
      ...row,
      meanError: errors.length > 0 ? errors.reduce((sum, error) => sum + error, 0) / errors.length : null,
    })),
  );
}

/**
 * Accounts that belong to the standings of a season (decision of 30/09/2026): those created before
 * its end, and those with a prediction in it. A colleague who arrives after a season does not show
 * in it, nor in its palmarès; one who arrives during it does, even at 0. The last season, which has
 * no end (§5.1), keeps every account. `computeStandings` then leaves out the disabled accounts
 * without predictions.
 */
export function seasonPlayers<P extends { id: string; createdAt: Date }>(
  players: readonly P[],
  end: Date | null,
  participants: ReadonlySet<string>,
): P[] {
  return players.filter(({ id, createdAt }) => end === null || createdAt < end || participants.has(id));
}

/** The latest result: highest `resolvedAt`, then highest id. */
function latestResolved(questions: readonly StandingsQuestion[]): StandingsQuestion {
  return questions.reduce((latest, question) => {
    const diff = question.resolvedAt.getTime() - latest.resolvedAt.getTime();
    return diff > 0 || (diff === 0 && question.id > latest.id) ? question : latest;
  });
}

/** Standings with the movement since the previous result (standings without the latest one). */
export function withMovement(input: StandingsInput): StandingRowWithMovement[] {
  const current = computeStandings(input);
  if (input.questions.length < 2) return current.map((row) => ({ ...row, delta: null }));

  const latest = latestResolved(input.questions);
  const previous = computeStandings({ ...input, questions: input.questions.filter((question) => question !== latest) });
  const previousRanks = new Map(previous.map(({ userId, rank }) => [userId, rank]));
  return current.map((row) => {
    const before = previousRanks.get(row.userId);
    return { ...row, delta: before === undefined ? null : before - row.rank };
  });
}

/**
 * Season shown by default on the home page and the standings (§5.6): the one containing `now`,
 * unless it has no result yet while the previous one, with published questions, is not proclaimed.
 * Null while no season contains `now` (none created yet, or before the first one): empty state.
 */
export function defaultSeason<S extends SeasonSummary>(now: Date, seasons: readonly S[]): S | null {
  const current = seasonAt(seasons, now);
  if (!current || current.resolvedCount > 0) return current;
  const previous = previousSeason(seasons, current);
  return previous && previous.publishedCount > 0 && !previous.proclaimed ? previous : current;
}
