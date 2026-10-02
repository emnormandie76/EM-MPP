import { generateId } from "better-auth";
import { hashPassword } from "better-auth/crypto";
import { and, count, eq, isNull, like, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { defaultAvatarFor } from "@/lib/avatars";
import type { Database } from "@/lib/db/client";
import { account, allowedEmail, chatMessage, seasonStanding, session, user } from "@/lib/db/schema";
import { normalizeEmail, parseEmail, splitEmailList } from "@/lib/validation/account";
import { type Actor, authorize, type Failure, fail, fieldErrorsOf, isFailure, ok, type Result, type Role } from "./result";
import { anonymizedEmail, hasAccount, isAnonymized, isDisplayNameTaken } from "./users";

// Players and allow list, managed by an admin (architecture §6.3, §7.3). These services write
// what Better Auth's admin API would write (ban fields, sessions, hashed password), with our
// rules on top (decision of 30/09/2026).

// ---------------------------------------------------------------------------------------------
// Allow list

export type AllowListReport = { added: string[]; alreadyPresent: string[]; invalid: string[] };

const allowListInput = z.object({ emails: z.string("Colle au moins une adresse.").max(50_000, "Liste trop longue.") });

/** Adds a pasted list of addresses: one per line, commas and semicolons accepted. */
export async function addAllowedEmails(
  db: Database,
  actor: Actor | null,
  input: unknown,
  now: Date,
): Promise<Result<AllowListReport>> {
  const me = authorize(actor, { admin: true });
  if (isFailure(me)) return me;
  const parsed = allowListInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT", undefined, fieldErrorsOf(parsed.error.issues));
  const entries = splitEmailList(parsed.data.emails);
  if (entries.length === 0) return fail("INVALID_INPUT", undefined, { emails: "Colle au moins une adresse." });

  const report: AllowListReport = { added: [], alreadyPresent: [], invalid: [] };
  const candidates: string[] = [];
  for (const entry of entries) {
    const email = parseEmail(entry);
    if (!email) report.invalid.push(entry);
    else if (candidates.includes(email)) report.alreadyPresent.push(email);
    else candidates.push(email);
  }
  if (candidates.length > 0) {
    const inserted = await db
      .insert(allowedEmail)
      .values(candidates.map((email) => ({ email, createdBy: me.id, createdAt: now })))
      .onConflictDoNothing()
      .returning({ email: allowedEmail.email });
    const added = new Set(inserted.map(({ email }) => email));
    for (const email of candidates) (added.has(email) ? report.added : report.alreadyPresent).push(email);
  }
  return ok(report);
}

const emailInput = z.object({ email: z.string().min(1) });

/** Removes an address, only when no account uses it (otherwise, disable the account). */
export async function removeAllowedEmail(db: Database, actor: Actor | null, input: unknown): Promise<Result> {
  const me = authorize(actor, { admin: true });
  if (isFailure(me)) return me;
  const parsed = emailInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  const email = normalizeEmail(parsed.data.email);

  if (await hasAccount(db, email)) return fail("EMAIL_HAS_ACCOUNT");
  const deleted = await db.delete(allowedEmail).where(eq(allowedEmail.email, email)).returning({ email: allowedEmail.email });
  return deleted.length > 0 ? ok() : fail("EMAIL_NOT_LISTED");
}

// ---------------------------------------------------------------------------------------------
// Accounts

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

const roleInput = targetInput.extend({ role: z.enum(["player", "admin"]) });

/** Makes an account admin or player. Never removes the last admin, nor one's own admin role. */
export async function setRole(db: Database, actor: Actor | null, input: unknown, now: Date): Promise<Result<{ role: Role }>> {
  return db.transaction(async (tx) => {
    const loaded = await adminAndTarget(tx, actor, input);
    if (isFailure(loaded)) return loaded;
    const parsed = roleInput.safeParse(input);
    if (!parsed.success) return fail("INVALID_INPUT");
    const { role } = parsed.data;
    const { me, target } = loaded;
    if (target.role === role) return ok({ role });
    if (role === "player") {
      if ((await otherActiveAdmins(tx, target.id)) === 0) return fail("LAST_ADMIN");
      if (target.id === me.id) return fail("SELF_TARGET", "Tu ne peux pas te retirer toi-même le rôle admin.");
    }
    await tx.update(user).set({ role, updatedAt: now }).where(eq(user.id, target.id));
    return ok({ role });
  });
}

/** Disables an account (Better Auth ban, without end date) and revokes its sessions. */
export async function disableUser(db: Database, actor: Actor | null, input: unknown, now: Date): Promise<Result> {
  return db.transaction(async (tx) => {
    const loaded = await adminAndTarget(tx, actor, input);
    if (isFailure(loaded)) return loaded;
    const { me, target } = loaded;
    if (target.id === me.id) return fail("SELF_TARGET", "Tu ne peux pas désactiver ton propre compte.");
    if (target.role === "admin" && (await otherActiveAdmins(tx, target.id)) === 0) return fail("LAST_ADMIN");
    await tx
      .update(user)
      .set({ banned: true, banReason: "Désactivé par un admin", banExpires: null, updatedAt: now })
      .where(eq(user.id, target.id));
    await tx.delete(session).where(eq(session.userId, target.id));
    return ok();
  });
}

/** Enables a disabled account again. */
export async function enableUser(db: Database, actor: Actor | null, input: unknown, now: Date): Promise<Result> {
  const loaded = await adminAndTarget(db, actor, input);
  if (isFailure(loaded)) return loaded;
  await db
    .update(user)
    .set({ banned: false, banReason: null, banExpires: null, updatedAt: now })
    .where(eq(user.id, loaded.target.id));
  return ok();
}

/** Alphabet of temporary passwords: no 0, O, o, 1, l or I, which are easy to mix up (§6.3). */
export const TEMPORARY_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
export const TEMPORARY_PASSWORD_LENGTH = 12;

/** 12 random characters from the alphabet, without modulo bias. */
export function generateTemporaryPassword(): string {
  const size = TEMPORARY_PASSWORD_ALPHABET.length;
  // Bytes at or above `limit` would favour the first characters: they are drawn again.
  const limit = 256 - (256 % size);
  let password = "";
  while (password.length < TEMPORARY_PASSWORD_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(TEMPORARY_PASSWORD_LENGTH * 2))) {
      if (byte < limit && password.length < TEMPORARY_PASSWORD_LENGTH) password += TEMPORARY_PASSWORD_ALPHABET[byte % size];
    }
  }
  return password;
}

/**
 * Gives an account a temporary password, shown once to the admin, and revokes its sessions. The
 * player changes it afterwards in /profil.
 */
export async function setTemporaryPassword(
  db: Database,
  actor: Actor | null,
  input: unknown,
  now: Date,
): Promise<Result<{ password: string; name: string }>> {
  const loaded = await adminAndTarget(db, actor, input);
  if (isFailure(loaded)) return loaded;
  const { me, target } = loaded;
  if (target.id === me.id) return fail("SELF_TARGET", "Change ton propre mot de passe dans ton profil.");

  const password = generateTemporaryPassword();
  const hash = await hashPassword(password);
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(account)
      .set({ password: hash, updatedAt: now })
      .where(and(eq(account.userId, target.id), eq(account.providerId, "credential")))
      .returning({ id: account.id });
    if (updated.length === 0) {
      await tx.insert(account).values({
        id: generateId(),
        accountId: target.id,
        providerId: "credential",
        userId: target.id,
        password: hash,
        createdAt: now,
        updatedAt: now,
      });
    }
    await tx.delete(session).where(eq(session.userId, target.id));
  });
  return ok({ password, name: target.name });
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
 * right, but loses its name, address and avatar, is disabled and leaves the allow list. Its name
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
