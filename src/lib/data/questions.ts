import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import type { Viewer } from "@/lib/auth/session";
import { type AvatarKey, isAvatarKey } from "@/lib/avatars";
import type { Database } from "@/lib/db/client";
import { prediction, question, user } from "@/lib/db/schema";
import { type PredictionState, predictionState } from "@/lib/game/prediction-state";
import { type QuestionStatus, questionStatus } from "@/lib/game/question-status";

// The only reads of the predictions of a question (architecture §6.6). Before the closing, the
// others' values never leave the server, not even for the admin, who plays too: the admin only
// receives states (to do, saved, validated), read by queries that do not select any value.

type ViewerRole = Pick<Viewer, "id" | "role">;

export type PredictionAnswer = { valueNumber: number | null; optionId: number | null; joker: boolean };

export type PredictionView = {
  userId: string;
  name: string;
  avatar: AvatarKey;
  /** Disabled account: shown with "(inactif)". */
  inactive: boolean;
  state: PredictionState;
  validatedAt: Date | null;
  /** The answer, only when the viewer may see it (§6.6); otherwise null. */
  answer: PredictionAnswer | null;
};

const byName = new Intl.Collator("fr", { sensitivity: "base" });

function avatarOf(value: string | null): AvatarKey {
  return value && isAvatarKey(value) ? value : "maillot-bleu-uni";
}

const PLAYER_COLUMNS = { userId: prediction.userId, name: user.name, avatar: user.avatar, banned: user.banned };

/** State of each prediction of these questions, without any value or joker (admin follow-up). */
export async function getPredictionStates(
  db: Database,
  questionIds: number[],
): Promise<{ questionId: number; userId: string; validatedAt: Date | null }[]> {
  if (questionIds.length === 0) return [];
  return db
    .select({ questionId: prediction.questionId, userId: prediction.userId, validatedAt: prediction.validatedAt })
    .from(prediction)
    .where(inArray(prediction.questionId, questionIds));
}

/**
 * Predictions of a question as `viewer` may see them at `now` (§6.6):
 * - draft or scheduled: null for a player (the question does not exist for them), none for the admin;
 * - open: a player only gets their own prediction; the admin gets every state, without values;
 * - closed or resolved: everyone gets every answer, with jokers and names;
 * - cancelled: nothing for a player; states only for the admin.
 * Null as well when the question does not exist.
 */
export async function getQuestionPredictionsForViewer(
  db: Database,
  viewer: ViewerRole,
  questionId: number,
  now: Date,
): Promise<PredictionView[] | null> {
  const [row] = await db
    .select({ status: question.status, opensAt: question.opensAt, closesAt: question.closesAt, resolvedAt: question.resolvedAt })
    .from(question)
    .where(eq(question.id, questionId));
  if (!row) return null;
  const status: QuestionStatus = questionStatus(row, now);
  const isAdmin = viewer.role === "admin";
  if (status === "draft" || status === "scheduled") return isAdmin ? [] : null;

  const revealed = status === "closed" || status === "resolved";
  let views: PredictionView[];
  if (revealed || (status === "open" && !isAdmin)) {
    const rows = await db
      .select({
        ...PLAYER_COLUMNS,
        validatedAt: prediction.validatedAt,
        valueNumber: prediction.valueNumber,
        optionId: prediction.optionId,
        joker: prediction.joker,
      })
      .from(prediction)
      .innerJoin(user, eq(user.id, prediction.userId))
      // Open question: a player only reads their own row.
      .where(and(eq(prediction.questionId, questionId), revealed ? undefined : eq(prediction.userId, viewer.id)));
    views = rows.map((r) => ({
      userId: r.userId,
      name: r.name,
      avatar: avatarOf(r.avatar),
      inactive: r.banned === true,
      state: predictionState(r, status),
      validatedAt: r.validatedAt,
      answer: { valueNumber: r.valueNumber, optionId: r.optionId, joker: r.joker },
    }));
  } else if (isAdmin) {
    // Open or cancelled, admin: states only. No value column is selected.
    const rows = await db
      .select({ ...PLAYER_COLUMNS, validatedAt: prediction.validatedAt })
      .from(prediction)
      .innerJoin(user, eq(user.id, prediction.userId))
      .where(eq(prediction.questionId, questionId));
    views = rows.map((r) => ({
      userId: r.userId,
      name: r.name,
      avatar: avatarOf(r.avatar),
      inactive: r.banned === true,
      state: predictionState(r, status),
      validatedAt: r.validatedAt,
      answer: null,
    }));
  } else {
    // Cancelled, player: the predictions are not shown (§8.3).
    views = [];
  }
  return views.sort((a, b) => byName.compare(a.name, b.name));
}
