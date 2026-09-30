import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { AVATAR_KEYS, type AvatarKey } from "@/lib/avatars";
import type { Database } from "@/lib/db/client";
import { user } from "@/lib/db/schema";
import { nextVisitFields } from "@/lib/game/visits";
import { displayNameSchema } from "@/lib/validation/account";
import { type Actor, authorize, fail, fieldErrorsOf, isFailure, ok, type Result } from "./result";
import { isDisplayNameTaken } from "./users";

// Profile of the signed-in account (architecture §7.3, §8.3 /profil). The password change goes
// through Better Auth.

const displayNameInput = z.object({ name: displayNameSchema });

/** New display name: 2 to 30 characters once trimmed, unique whatever the case (§6.2). */
export async function updateDisplayName(
  db: Database,
  actor: Actor | null,
  input: unknown,
  now: Date,
): Promise<Result<{ name: string }>> {
  const me = authorize(actor);
  if (isFailure(me)) return me;
  const parsed = displayNameInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT", undefined, fieldErrorsOf(parsed.error.issues));

  const { name } = parsed.data;
  if (await isDisplayNameTaken(db, name, me.id)) return fail("NAME_TAKEN", undefined, { name: "Ce nom est déjà pris." });
  await db.update(user).set({ name, updatedAt: now }).where(eq(user.id, me.id));
  return ok({ name });
}

const avatarInput = z.object({
  avatar: z.enum(AVATAR_KEYS as [AvatarKey, ...AvatarKey[]], "Choisis un des 16 maillots."),
});

/** New avatar: one of the 16 jerseys (§8.2). */
export async function updateAvatar(
  db: Database,
  actor: Actor | null,
  input: unknown,
  now: Date,
): Promise<Result<{ avatar: AvatarKey }>> {
  const me = authorize(actor);
  if (isFailure(me)) return me;
  const parsed = avatarInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT", undefined, fieldErrorsOf(parsed.error.issues));

  await db.update(user).set({ avatar: parsed.data.avatar, updatedAt: now }).where(eq(user.id, me.id));
  return ok({ avatar: parsed.data.avatar });
}

/**
 * Records a page seen by the signed-in account (§5.9), called once the page is displayed so that
 * the "Nouveau" badges are seen before they go: after more than 30 minutes, a new visit starts and
 * the previous one is kept in `previous_visit_at`. No input: the account is the actor.
 */
export async function recordVisit(
  db: Database,
  actor: Actor | null,
  now: Date,
): Promise<Result<{ lastSeenAt: Date; previousVisitAt: Date | null }>> {
  const me = authorize(actor);
  if (isFailure(me)) return me;

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ lastSeenAt: user.lastSeenAt, previousVisitAt: user.previousVisitAt })
      .from(user)
      .where(eq(user.id, me.id))
      .for("no key update");
    if (!row) return fail("NOT_AUTHENTICATED");
    const fields = nextVisitFields(row, now);
    // A visit is not a change of the account: `updated_at` keeps its value.
    await tx
      .update(user)
      .set({ ...fields, updatedAt: sql`${user.updatedAt}` })
      .where(eq(user.id, me.id));
    return ok(fields);
  });
}
