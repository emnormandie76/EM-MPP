import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/lib/db/client";
import { prediction, question, questionExtension, user } from "@/lib/db/schema";
import { questionStatus } from "@/lib/game/question-status";
import { localDateTimeSchema } from "@/lib/validation/question";
import { type Actor, authorize, fail, isFailure, ok, type Result } from "./result";

// Extensions of a question for an absent player (architecture §5.14, v1.2): the admin reopens a
// question, open or closed but never resolved, for one player without a prediction, until a
// personal deadline. While it runs, the question is open for that player only (§5.2), and its
// result cannot be entered (§5.11).
//
// Locks: the question (FOR UPDATE: it waits for the prediction services under way, which hold it
// FOR SHARE, and blocks resolveQuestion), then the extension row (FOR UPDATE), then the player's
// prediction (read). The order question → extension is the one of the prediction services (§5.4).

const NOT_FOUND = "Cette question n'existe pas.";

const extensionInput = z.object({
  questionId: z.coerce.number().int().positive(),
  userId: z.string().trim().min(1),
  /** The deadline, typed in Paris time (`datetime-local`). */
  closesAt: localDateTimeSchema,
});

const targetInput = extensionInput.omit({ closesAt: true });

type Locked = {
  question: Pick<typeof question.$inferSelect, "id" | "status" | "opensAt" | "closesAt" | "resolvedAt">;
  extension: typeof questionExtension.$inferSelect | undefined;
  hasPrediction: boolean;
};

/** The question (FOR UPDATE), the player's extension on it (FOR UPDATE) and whether they have a prediction. */
async function lockTarget(tx: Database, questionId: number, userId: string): Promise<Locked | null> {
  const [row] = await tx
    .select({ id: question.id, status: question.status, opensAt: question.opensAt, closesAt: question.closesAt, resolvedAt: question.resolvedAt })
    .from(question)
    .where(eq(question.id, questionId))
    .for("update");
  if (!row) return null;
  const [extension] = await tx
    .select()
    .from(questionExtension)
    .where(and(eq(questionExtension.questionId, questionId), eq(questionExtension.userId, userId)))
    .for("update");
  const [own] = await tx
    .select({ id: prediction.id })
    .from(prediction)
    .where(and(eq(prediction.questionId, questionId), eq(prediction.userId, userId)));
  return { question: row, extension, hasPrediction: own !== undefined };
}

export type ExtensionSaved = { closesAt: Date };

/**
 * Grants an extension to a player, or changes its deadline (§5.14). The question is published, not
 * cancelled, without a result, and open or closed. The player has no prediction on it, unless their
 * extension still runs (the deadline can then change); an expired extension without a prediction
 * can be granted again. The deadline is in the future and after the closing of the question. No one
 * extends a question for themselves: the other admin does it.
 */
export async function setQuestionExtension(
  db: Database,
  actor: Actor | null,
  input: unknown,
  now: Date,
): Promise<Result<ExtensionSaved>> {
  const me = authorize(actor, { admin: true });
  if (isFailure(me)) return me;
  const parsed = extensionInput.safeParse(input);
  if (!parsed.success) {
    // An empty or invalid date is a deadline that does not exist.
    const dateOnly = parsed.error.issues.every(({ path }) => path[0] === "closesAt");
    return dateOnly ? fail("INVALID_EXTENSION_DATE", undefined, { closesAt: "Date invalide." }) : fail("INVALID_INPUT");
  }
  const { questionId, userId, closesAt } = parsed.data;
  if (userId === me.id) return fail("SELF_EXTENSION");

  return db.transaction(async (tx) => {
    const locked = await lockTarget(tx, questionId, userId);
    if (!locked) return fail("NOT_FOUND", NOT_FOUND);
    const { question: row, extension, hasPrediction } = locked;
    const status = questionStatus(row, now);
    if (status !== "open" && status !== "closed") return fail("EXTENSION_NOT_ALLOWED");

    const [target] = await tx.select({ id: user.id, banned: user.banned }).from(user).where(eq(user.id, userId));
    if (!target) return fail("NOT_FOUND");
    if (target.banned) return fail("EXTENSION_NOT_ALLOWED", "Ce compte est désactivé : pas de prolongation possible.");

    // Once the extension is over, a prediction is final, and its owner may have seen the others'.
    const running = extension !== undefined && now < extension.closesAt;
    if (hasPrediction && !running) return fail("EXTENSION_HAS_PREDICTION");
    if (closesAt === null || closesAt <= now || closesAt <= row.closesAt!) {
      return fail("INVALID_EXTENSION_DATE", undefined, { closesAt: "La date limite doit être dans le futur et après la clôture de la question." });
    }

    if (extension) {
      await tx
        .update(questionExtension)
        .set({ closesAt, updatedBy: me.id, updatedAt: now })
        .where(and(eq(questionExtension.questionId, questionId), eq(questionExtension.userId, userId)));
    } else {
      await tx.insert(questionExtension).values({ questionId, userId, closesAt, grantedBy: me.id, grantedAt: now });
    }
    return ok({ closesAt });
  });
}

export type ExtensionEnded = { ended: "deleted" | "closed" };

/**
 * Cancels a running extension (§5.14). Without a prediction, the row is deleted; with one, the
 * extension ends now, and the prediction counts as validated (§5.4).
 */
export async function cancelQuestionExtension(
  db: Database,
  actor: Actor | null,
  input: unknown,
  now: Date,
): Promise<Result<ExtensionEnded>> {
  const me = authorize(actor, { admin: true });
  if (isFailure(me)) return me;
  const parsed = targetInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  const { questionId, userId } = parsed.data;
  if (userId === me.id) return fail("SELF_EXTENSION");

  return db.transaction(async (tx) => {
    const locked = await lockTarget(tx, questionId, userId);
    if (!locked) return fail("NOT_FOUND", NOT_FOUND);
    const { extension, hasPrediction } = locked;
    if (!extension || now >= extension.closesAt) return fail("NO_EXTENSION");

    const own = and(eq(questionExtension.questionId, questionId), eq(questionExtension.userId, userId));
    if (!hasPrediction) {
      await tx.delete(questionExtension).where(own);
      return ok({ ended: "deleted" as const });
    }
    await tx.update(questionExtension).set({ closesAt: now, updatedBy: me.id, updatedAt: now }).where(own);
    return ok({ ended: "closed" as const });
  });
}
