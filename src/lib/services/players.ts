import { and, count, eq, isNull, like, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { PORTAIL_PROVIDER_ID } from "@/lib/auth/portail";
import { defaultAvatarFor } from "@/lib/avatars";
import type { Database } from "@/lib/db/client";
import { account, allowedEmail, chatMessage, seasonStanding, session, user } from "@/lib/db/schema";
import { type Actor, authorize, type Failure, fail, isFailure, ok, type Result } from "./result";
import { anonymizedEmail, isAnonymized, isDisplayNameTaken } from "./users";

// The one action left on the accounts (architecture §6.3): the accesses and the roles are managed on
// the portal. This service writes what Better Auth's admin API would write (ban fields, sessions),
// with our rules on top (decision of 30/09/2026).

type UserRow = typeof user.$inferSelect;

const targetInput = z.object({ userId: z.string().min(1) });

/** Checks the admin actor and loads the target account, which must not be anonymized. */
async function adminAndTarget(
  db: Database,
  actor: Actor | null,
  input: unknown,
): Promise<{ me: Actor; target: UserRow } | Failure> {
  const me = authorize(actor, { admin: true });
  if (isFailure(me)) return me;
  const parsed = targetInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  const [target] = await db.select().from(user).where(eq(user.id, parsed.data.userId));
  if (!target) return fail("NOT_FOUND");
  if (isAnonymized(target)) return fail("ANONYMIZED");
  return { me, target };
}

/** Admins who can still sign in, the target left aside. */
async function otherActiveAdmins(db: Database, targetId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(user)
    .where(and(eq(user.role, "admin"), sql`${user.banned} is not true`, ne(user.id, targetId)));
  return row.n;
}

/** "Ancien joueur n", with the first n not taken yet. */
async function nextAnonymousName(db: Database): Promise<string> {
  const [row] = await db
    .select({ n: count() })
    .from(user)
    .where(like(user.email, anonymizedEmail("%")));
  let n = row.n + 1;
  while (await isDisplayNameTaken(db, `Ancien joueur ${n}`)) n += 1;
  return `Ancien joueur ${n}`;
}

/**
 * Right to erasure (§6.3): the account keeps its predictions, so that the others' standings stay
 * right, but loses its name, address and avatar, its link to the portal, and is disabled. Its name
 * also leaves the palmarès, and its chat messages are erased (v1.2).
 */
export async function anonymizeUser(
  db: Database,
  actor: Actor | null,
  input: unknown,
  now: Date,
): Promise<Result<{ name: string }>> {
  return db.transaction(async (tx) => {
    const loaded = await adminAndTarget(tx, actor, input);
    if (isFailure(loaded)) return loaded;
    const { me, target } = loaded;
    if (target.id === me.id) return fail("SELF_TARGET", "Tu ne peux pas anonymiser ton propre compte.");
    if (target.role === "admin" && (await otherActiveAdmins(tx, target.id)) === 0) return fail("LAST_ADMIN");

    const name = await nextAnonymousName(tx);
    await tx
      .update(user)
      .set({
        name,
        email: anonymizedEmail(target.id),
        image: null,
        avatar: defaultAvatarFor(target.id),
        role: "player",
        banned: true,
        banReason: "Compte anonymisé",
        banExpires: null,
        lastSeenAt: null,
        previousVisitAt: null,
        updatedAt: now,
      })
      .where(eq(user.id, target.id));
    await tx.delete(session).where(eq(session.userId, target.id));
    // Whoever comes back gets a new account, never this one (D4). The access is withdrawn on the portal.
    await tx.delete(account).where(and(eq(account.userId, target.id), eq(account.providerId, PORTAIL_PROVIDER_ID)));
    // The table stays until step B4: this address must not leave in the export of the accounts (B2).
    await tx.delete(allowedEmail).where(eq(allowedEmail.email, target.email));
    // The palmarès keeps ranks and malus, but not the name (decision of 30/09/2026).
    await tx.update(seasonStanding).set({ nameSnapshot: name }).where(eq(seasonStanding.userId, target.id));
    // The chat messages are erased, as by a deletion (v1.2, §5.15).
    await tx
      .update(chatMessage)
      .set({ body: null, deletedAt: now, deletedBy: me.id })
      .where(and(eq(chatMessage.userId, target.id), isNull(chatMessage.deletedAt)));
    return ok({ name });
  });
}
