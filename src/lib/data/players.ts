import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import type { Viewer } from "@/lib/auth/session";
import { isAvatarKey, type AvatarKey } from "@/lib/avatars";
import type { Database } from "@/lib/db/client";
import { allowedEmail, questionOption, user } from "@/lib/db/schema";
import type { Role } from "@/lib/services/result";
import { isAnonymized } from "@/lib/services/users";
import { type BadgeView, getPlayerBadges, getPlayerResults } from "./badges";
import { getAvailableSeasons, getStandings, type SeasonRef, type StandingView } from "./standings";

// Reads of the /admin/joueurs page (architecture §7.4), admin only, and the public profile of a
// player (/joueurs/[id]).

type ViewerRole = Pick<Viewer, "id" | "role">;

function assertAdmin(viewer: ViewerRole): void {
  if (viewer.role !== "admin") throw new Error("FORBIDDEN: admin reads only");
}

export type AllowedEmailRow = { email: string; hasAccount: boolean };

/** The allow list, with whether an account uses each address. */
export async function getAllowedEmails(db: Database, viewer: ViewerRole): Promise<AllowedEmailRow[]> {
  assertAdmin(viewer);
  const rows = await db
    .select({ email: allowedEmail.email, userId: user.id })
    .from(allowedEmail)
    .leftJoin(user, eq(user.email, allowedEmail.email))
    .orderBy(asc(allowedEmail.email));
  return rows.map(({ email, userId }) => ({ email, hasAccount: userId !== null }));
}

export type AccountRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  banned: boolean;
  anonymized: boolean;
  avatar: AvatarKey;
  lastSeenAt: Date | null;
  isViewer: boolean;
};

const byName = new Intl.Collator("fr", { sensitivity: "base" });

/** Every account, by name (French order); anonymized accounts last. */
export async function getAccounts(db: Database, viewer: ViewerRole): Promise<AccountRow[]> {
  assertAdmin(viewer);
  const rows = await db.select().from(user);
  return rows
    .map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role === "admin" ? ("admin" as const) : ("player" as const),
      banned: row.banned === true,
      anonymized: isAnonymized(row),
      avatar: isAvatarKey(row.avatar) ? row.avatar : ("maillot-bleu-uni" as const),
      lastSeenAt: row.lastSeenAt,
      isViewer: row.id === viewer.id,
    }))
    .sort((a, b) => Number(a.anonymized) - Number(b.anonymized) || byName.compare(a.name, b.name));
}

// ---------------------------------------------------------------------------------------------
// Public profile (§8.3 /joueurs/[id]), visible to every signed-in account: only resolved
// questions, whose predictions are public.

/** A number with its unit, or the label of an answer. */
export type AnswerView = { valueNumber: number | null; optionLabel: string | null };

export type ProfileHistoryItem = {
  questionId: number;
  title: string;
  unit: string | null;
  resolvedAt: Date;
  /** The player's answer; null without a prediction (v1.2: the malus of the absence applies). */
  answer: AnswerView | null;
  real: AnswerView;
  joker: boolean;
  /** Gap of a number prediction, in hundredths; null for a choice or an absence. */
  gap: number | null;
  /** Relative error of a number question; null for a choice or an absence (infinite if the real value is 0). */
  relativeError: number | null;
  /** Malus of the question, in hundredths. */
  malus: number;
};

export type PlayerProfile = {
  player: { id: string; name: string; avatar: AvatarKey; inactive: boolean; isViewer: boolean };
  /** Seasons of the picker: those with a published question, latest first. */
  seasons: SeasonRef[];
  /** The season shown: the one asked for, or the default one (§5.6); null before any season. */
  season: SeasonRef | null;
  /** Resolved questions of the season shown: 0 means no standings yet. */
  resolvedCount: number;
  /** The player's row in the standings of the season shown (rank, malus, Dans le mille…). */
  standing: StandingView | null;
  /** The 6 badges, every season. */
  badges: BadgeView[];
  /**
   * The resolved questions of the season shown, latest result first: the player's predictions and,
   * when they are in its standings, the questions they did not predict (v1.2).
   */
  history: ProfileHistoryItem[];
};

/**
 * Public profile of a player (§8.3): rank and malus in the season shown, mean error, Dans le mille,
 * questions played, badges and history. Null when the account does not exist.
 */
export async function getPlayerProfile(
  db: Database,
  viewer: ViewerRole,
  { userId, seasonId }: { userId: string; seasonId?: number },
  now: Date,
): Promise<PlayerProfile | null> {
  const [row] = await db
    .select({ id: user.id, name: user.name, avatar: user.avatar, banned: user.banned })
    .from(user)
    .where(eq(user.id, userId));
  if (!row) return null;

  const seasons = await getAvailableSeasons(db);
  const chosen = seasonId !== undefined && seasons.some(({ id }) => id === seasonId) ? seasonId : undefined;
  const standings = await getStandings(db, viewer, { seasonId: chosen }, now);
  const results = await getPlayerResults(db, viewer, userId);
  const inSeason = results
    .filter(({ seasonId: id }) => id === standings.season?.id)
    .sort((a, b) => b.resolvedAt.getTime() - a.resolvedAt.getTime() || b.questionId - a.questionId);

  const labels = new Map<number, string>();
  const optionIds = inSeason.flatMap(({ score, resultOptionId }) => [score?.prediction.optionId ?? null, resultOptionId]).filter((id) => id !== null);
  if (optionIds.length > 0) {
    const options = await db.select({ id: questionOption.id, label: questionOption.label }).from(questionOption).where(inArray(questionOption.id, optionIds));
    for (const { id, label } of options) labels.set(id, label);
  }
  const answerOf = (valueNumber: number | null, optionId: number | null): AnswerView => ({
    valueNumber,
    optionLabel: optionId === null ? null : (labels.get(optionId) ?? null),
  });

  return {
    player: {
      id: row.id,
      name: row.name,
      avatar: isAvatarKey(row.avatar) ? row.avatar : "maillot-bleu-uni",
      inactive: row.banned === true,
      isViewer: row.id === viewer.id,
    },
    seasons,
    season: standings.season,
    resolvedCount: standings.resolvedCount,
    standing: standings.rows.find(({ userId: id }) => id === row.id) ?? null,
    badges: await getPlayerBadges(db, viewer, row.id, results),
    history: inSeason.map(({ questionId, title, type, unit, resolvedAt, resultNumber, resultOptionId, score, malus }) => ({
      questionId,
      title,
      unit,
      resolvedAt,
      answer: score ? answerOf(score.prediction.valueNumber, score.prediction.optionId) : null,
      real: answerOf(resultNumber, resultOptionId),
      joker: score?.prediction.joker ?? false,
      gap: score && type === "number" ? score.baseMalus : null,
      relativeError: score?.relativeError ?? null,
      malus,
    })),
  };
}
