import { verifyPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultAvatarFor } from "@/lib/avatars";
import type { Database } from "@/lib/db/client";
import { account, allowedEmail, prediction, session, user } from "@/lib/db/schema";
import {
  addAllowedEmails,
  anonymizeUser,
  disableUser,
  enableUser,
  generateTemporaryPassword,
  removeAllowedEmail,
  setRole,
  setTemporaryPassword,
  TEMPORARY_PASSWORD_ALPHABET,
} from "@/lib/services/players";
import type { Actor } from "@/lib/services/result";
import { createTestAuth, type TestAuth } from "../helpers/auth";
import { makeClock } from "../helpers/clock";
import { createTestDb } from "../helpers/db";
import { createPrediction, createQuestion, createUser } from "../helpers/factories";

// Players and allow list services (architecture §6.3, §11 É4).

const clock = makeClock("2026-10-20T10:00:00Z");
const now = clock.now;
const PASSWORD = "Test-1234!";

let db: Database;
let close: () => Promise<void>;
let auth: TestAuth;

beforeEach(async () => {
  ({ db, close } = await createTestDb());
  auth = createTestAuth(db);
});

afterEach(async () => {
  await close();
});

const actorOf = (row: { id: string; role: string | null; banned: boolean | null }): Actor => ({
  id: row.id,
  role: row.role === "admin" ? "admin" : "player",
  banned: row.banned === true,
});

/** A real account (password PASSWORD), signed up through Better Auth, with an open session. */
async function signedUpUser(email: string, name: string, role: "player" | "admin" = "player") {
  await db.insert(allowedEmail).values({ email });
  const { user: created } = await auth.api.signUpEmail({ body: { email, name, password: PASSWORD } });
  if (role === "admin") await db.update(user).set({ role: "admin" }).where(eq(user.id, created.id));
  const [row] = await db.select().from(user).where(eq(user.id, created.id));
  return row;
}

async function sessionsOf(userId: string) {
  return db.select().from(session).where(eq(session.userId, userId));
}

describe("authorization (§6.5): admin only", () => {
  const services = {
    addAllowedEmails: (actor: Actor | null) => addAllowedEmails(db, actor, { emails: "a@example.test" }, now),
    removeAllowedEmail: (actor: Actor | null) => removeAllowedEmail(db, actor, { email: "a@example.test" }),
    setRole: (actor: Actor | null, userId: string) => setRole(db, actor, { userId, role: "admin" }, now),
    disableUser: (actor: Actor | null, userId: string) => disableUser(db, actor, { userId }, now),
    enableUser: (actor: Actor | null, userId: string) => enableUser(db, actor, { userId }, now),
    setTemporaryPassword: (actor: Actor | null, userId: string) => setTemporaryPassword(db, actor, { userId }, now),
    anonymizeUser: (actor: Actor | null, userId: string) => anonymizeUser(db, actor, { userId }, now),
  };

  it.each(Object.keys(services))("%s: anonymous, player and disabled admin refused; admin accepted", async (name) => {
    const service = services[name as keyof typeof services];
    const target = await createUser(db);
    const player = await createUser(db);
    const disabledAdmin = await createUser(db, { role: "admin", banned: true });
    const admin = await createUser(db, { role: "admin" });

    expect(await service(null, target.id)).toMatchObject({ ok: false, code: "NOT_AUTHENTICATED" });
    expect(await service(actorOf(player), target.id)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await service(actorOf(disabledAdmin), target.id)).toMatchObject({ ok: false, code: "ACCOUNT_DISABLED" });
    const result = await service(actorOf(admin), target.id);
    // Removing an address that is not listed is refused for another reason.
    expect(result.ok || (!result.ok && result.code === "EMAIL_NOT_LISTED")).toBe(true);
  });
});

describe("allow list", () => {
  it("adds a pasted list and reports added, already present and invalid addresses", async () => {
    const admin = await createUser(db, { role: "admin" });
    await db.insert(allowedEmail).values({ email: "deja@example.test" });

    const result = await addAllowedEmails(
      db,
      actorOf(admin),
      { emails: "Un@Example.test\n  deux@example.test ; trois@example.test,\r\ndeja@example.test\npas-une-adresse\nun@example.test\n\n" },
      now,
    );

    expect(result).toEqual({
      ok: true,
      data: {
        added: ["un@example.test", "deux@example.test", "trois@example.test"],
        alreadyPresent: ["un@example.test", "deja@example.test"],
        invalid: ["pas-une-adresse"],
      },
    });
    const rows = await db.select().from(allowedEmail).orderBy(allowedEmail.email);
    expect(rows.map(({ email }) => email)).toEqual(["deja@example.test", "deux@example.test", "trois@example.test", "un@example.test"]);
    expect(rows.find(({ email }) => email === "un@example.test")).toMatchObject({ createdBy: admin.id, createdAt: now });
  });

  it("refuses an empty list", async () => {
    const admin = await createUser(db, { role: "admin" });
    expect(await addAllowedEmails(db, actorOf(admin), { emails: " \n ; , " }, now)).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: { emails: "Colle au moins une adresse." },
    });
  });

  it("removes an address without an account, and refuses when an account uses it", async () => {
    const admin = await createUser(db, { role: "admin" });
    await db.insert(allowedEmail).values([{ email: "libre@example.test" }, { email: "pris@example.test" }]);
    await createUser(db, { email: "pris@example.test" });

    expect(await removeAllowedEmail(db, actorOf(admin), { email: " Libre@example.test " })).toEqual({ ok: true, data: undefined });
    expect(await removeAllowedEmail(db, actorOf(admin), { email: "pris@example.test" })).toMatchObject({
      ok: false,
      code: "EMAIL_HAS_ACCOUNT",
    });
    expect((await db.select().from(allowedEmail)).map(({ email }) => email)).toEqual(["pris@example.test"]);
  });
});

describe("roles", () => {
  it("makes a player admin, then player again", async () => {
    const admin = await createUser(db, { role: "admin" });
    const player = await createUser(db);

    expect(await setRole(db, actorOf(admin), { userId: player.id, role: "admin" }, now)).toEqual({ ok: true, data: { role: "admin" } });
    expect(await setRole(db, actorOf(admin), { userId: player.id, role: "player" }, now)).toEqual({ ok: true, data: { role: "player" } });
    const [row] = await db.select().from(user).where(eq(user.id, player.id));
    expect(row.role).toBe("player");
  });

  it("never removes the last admin", async () => {
    const admin = await createUser(db, { role: "admin" });
    // A disabled admin cannot sign in: it does not count.
    await createUser(db, { role: "admin", banned: true });

    expect(await setRole(db, actorOf(admin), { userId: admin.id, role: "player" }, now)).toMatchObject({
      ok: false,
      code: "LAST_ADMIN",
      message: "Il doit toujours rester au moins un admin.",
    });
    const [row] = await db.select().from(user).where(eq(user.id, admin.id));
    expect(row.role).toBe("admin");
  });

  it("never removes one's own admin role, even with another admin", async () => {
    const admin = await createUser(db, { role: "admin" });
    await createUser(db, { role: "admin" });
    expect(await setRole(db, actorOf(admin), { userId: admin.id, role: "player" }, now)).toMatchObject({
      ok: false,
      code: "SELF_TARGET",
      message: "Tu ne peux pas te retirer toi-même le rôle admin.",
    });
  });

  it("refuses an unknown role or account", async () => {
    const admin = await createUser(db, { role: "admin" });
    const player = await createUser(db);
    expect(await setRole(db, actorOf(admin), { userId: player.id, role: "root" }, now)).toMatchObject({ code: "INVALID_INPUT" });
    expect(await setRole(db, actorOf(admin), { userId: "inconnu", role: "admin" }, now)).toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("disable and enable", () => {
  it("refuses to disable one's own account", async () => {
    const admin = await createUser(db, { role: "admin" });
    await createUser(db, { role: "admin" });
    expect(await disableUser(db, actorOf(admin), { userId: admin.id }, now)).toMatchObject({
      ok: false,
      code: "SELF_TARGET",
      message: "Tu ne peux pas désactiver ton propre compte.",
    });
  });

  it("revokes the sessions, then refuses the sign-in with the French message", async () => {
    const admin = await createUser(db, { role: "admin" });
    const player = await signedUpUser("sarah@example.test", "Sarah");
    await auth.api.signInEmail({ body: { email: "sarah@example.test", password: PASSWORD } });
    expect((await sessionsOf(player.id)).length).toBe(2);

    expect(await disableUser(db, actorOf(admin), { userId: player.id }, now)).toEqual({ ok: true, data: undefined });

    expect(await sessionsOf(player.id)).toEqual([]);
    const [row] = await db.select().from(user).where(eq(user.id, player.id));
    expect(row).toMatchObject({ banned: true, banExpires: null, updatedAt: now });
    await expect(auth.api.signInEmail({ body: { email: "sarah@example.test", password: PASSWORD } })).rejects.toThrow(
      "Ton compte est désactivé. Contacte l'admin.",
    );
  });

  it("enables the account again", async () => {
    const admin = await createUser(db, { role: "admin" });
    const player = await signedUpUser("sarah@example.test", "Sarah");
    await disableUser(db, actorOf(admin), { userId: player.id }, now);

    expect(await enableUser(db, actorOf(admin), { userId: player.id }, now)).toEqual({ ok: true, data: undefined });
    const [row] = await db.select().from(user).where(eq(user.id, player.id));
    expect(row).toMatchObject({ banned: false, banReason: null });
    expect((await auth.api.signInEmail({ body: { email: "sarah@example.test", password: PASSWORD } })).token).toBeTruthy();
  });
});

describe("temporary password", () => {
  it("has 12 characters, none of 0 O o 1 l I", () => {
    expect(TEMPORARY_PASSWORD_ALPHABET).not.toMatch(/[0Oo1lI]/);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const password = generateTemporaryPassword();
      expect(password).toMatch(/^[A-HJ-NP-Za-km-np-z2-9]{12}$/);
      for (const char of password) seen.add(char);
    }
    // 2 400 draws over 56 characters: every character comes out.
    expect(seen.size).toBe(TEMPORARY_PASSWORD_ALPHABET.length);
  });

  it("replaces the password, revokes the sessions, and lets the player sign in with it", async () => {
    const admin = await createUser(db, { role: "admin" });
    const player = await signedUpUser("sarah@example.test", "Sarah");

    const result = await setTemporaryPassword(db, actorOf(admin), { userId: player.id }, now);
    if (!result.ok) throw new Error(result.message);
    expect(result.data.name).toBe("Sarah");
    expect(result.data.password).toHaveLength(12);

    expect(await sessionsOf(player.id)).toEqual([]);
    const [credential] = await db
      .select()
      .from(account)
      .where(and(eq(account.userId, player.id), eq(account.providerId, "credential")));
    expect(await verifyPassword({ hash: credential.password!, password: result.data.password })).toBe(true);
    await expect(auth.api.signInEmail({ body: { email: "sarah@example.test", password: PASSWORD } })).rejects.toThrow();
    expect((await auth.api.signInEmail({ body: { email: "sarah@example.test", password: result.data.password } })).token).toBeTruthy();
  });

  it("creates the password when the account has none", async () => {
    const admin = await createUser(db, { role: "admin" });
    const player = await createUser(db, { email: "sans-mot-de-passe@example.test" });
    const result = await setTemporaryPassword(db, actorOf(admin), { userId: player.id }, now);
    if (!result.ok) throw new Error(result.message);
    expect(
      (await auth.api.signInEmail({ body: { email: "sans-mot-de-passe@example.test", password: result.data.password } })).token,
    ).toBeTruthy();
  });

  it("refuses one's own account: the password is changed in the profile", async () => {
    const admin = await createUser(db, { role: "admin" });
    expect(await setTemporaryPassword(db, actorOf(admin), { userId: admin.id }, now)).toMatchObject({ code: "SELF_TARGET" });
  });
});

describe("anonymization (§6.3)", () => {
  it("erases name, address and avatar, disables the account, keeps the predictions", async () => {
    const admin = await createUser(db, { role: "admin" });
    const player = await signedUpUser("sarah@example.test", "Sarah");
    await db.update(user).set({ avatar: "maillot-jaune-raye", lastSeenAt: clock.at("-1d") }).where(eq(user.id, player.id));
    const question = await createQuestion(db, { createdBy: admin.id });
    await createPrediction(db, { questionId: question.id, userId: player.id, valueNumber: 250 });

    expect(await anonymizeUser(db, actorOf(admin), { userId: player.id }, now)).toEqual({ ok: true, data: { name: "Ancien joueur 1" } });

    const [row] = await db.select().from(user).where(eq(user.id, player.id));
    expect(row).toMatchObject({
      name: "Ancien joueur 1",
      email: `anonyme-${player.id}@invalid.local`,
      avatar: defaultAvatarFor(player.id),
      role: "player",
      banned: true,
      lastSeenAt: null,
      previousVisitAt: null,
    });
    expect(await sessionsOf(player.id)).toEqual([]);
    expect(await db.select().from(allowedEmail).where(eq(allowedEmail.email, "sarah@example.test"))).toEqual([]);
    expect(await db.select().from(prediction).where(eq(prediction.userId, player.id))).toHaveLength(1);
    await expect(auth.api.signInEmail({ body: { email: "sarah@example.test", password: PASSWORD } })).rejects.toThrow();
  });

  it("numbers the anonymized accounts and skips a name already taken", async () => {
    const admin = await createUser(db, { role: "admin" });
    const first = await createUser(db);
    const second = await createUser(db);
    await createUser(db, { name: "ancien joueur 2" });

    expect(await anonymizeUser(db, actorOf(admin), { userId: first.id }, now)).toMatchObject({ data: { name: "Ancien joueur 1" } });
    expect(await anonymizeUser(db, actorOf(admin), { userId: second.id }, now)).toMatchObject({ data: { name: "Ancien joueur 3" } });
  });

  it("refuses one's own account, and an account already anonymized", async () => {
    const admin = await createUser(db, { role: "admin" });
    const player = await createUser(db);
    expect(await anonymizeUser(db, actorOf(admin), { userId: admin.id }, now)).toMatchObject({ code: "SELF_TARGET" });
    await anonymizeUser(db, actorOf(admin), { userId: player.id }, now);
    for (const result of [
      await anonymizeUser(db, actorOf(admin), { userId: player.id }, now),
      await enableUser(db, actorOf(admin), { userId: player.id }, now),
      await setRole(db, actorOf(admin), { userId: player.id, role: "admin" }, now),
    ]) {
      expect(result).toMatchObject({ ok: false, code: "ANONYMIZED" });
    }
  });
});
