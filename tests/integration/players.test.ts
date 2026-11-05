import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultAvatarFor } from "@/lib/avatars";
import type { Database } from "@/lib/db/client";
import { account, allowedEmail, prediction, session, user } from "@/lib/db/schema";
import { anonymizeUser } from "@/lib/services/players";
import type { Actor } from "@/lib/services/result";
import { makeClock } from "../helpers/clock";
import { createTestDb } from "../helpers/db";
import { createPrediction, createQuestion, createUser } from "../helpers/factories";

// The one service left on the accounts (architecture §6.3): the accesses and the roles are managed on
// the portal, and the whole sign-in is proved in portail-sign-in.test.ts.

const clock = makeClock("2026-10-20T10:00:00Z");
const now = clock.now;

let db: Database;
let close: () => Promise<void>;

beforeEach(async () => {
  ({ db, close } = await createTestDb());
});

afterEach(async () => {
  await close();
});

const actorOf = (row: { id: string; role: string | null; banned: boolean | null }): Actor => ({
  id: row.id,
  role: row.role === "admin" ? "admin" : "player",
  banned: row.banned === true,
});

async function sessionsOf(userId: string) {
  return db.select().from(session).where(eq(session.userId, userId));
}

describe("authorization (§6.5): admin only", () => {
  const service = (actor: Actor | null, userId: string) => anonymizeUser(db, actor, { userId }, now);

  it("anonymizeUser: anonymous, player and disabled admin refused; admin accepted", async () => {
    const target = await createUser(db);
    const player = await createUser(db);
    const disabledAdmin = await createUser(db, { role: "admin", banned: true });
    const admin = await createUser(db, { role: "admin" });

    expect(await service(null, target.id)).toMatchObject({ ok: false, code: "NOT_AUTHENTICATED" });
    expect(await service(actorOf(player), target.id)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await service(actorOf(disabledAdmin), target.id)).toMatchObject({ ok: false, code: "ACCOUNT_DISABLED" });
    expect(await service(actorOf(admin), target.id)).toMatchObject({ ok: true });
  });
});

describe("anonymization (§6.3)", () => {
  it("erases name, address and avatar, disables the account, keeps the predictions", async () => {
    const admin = await createUser(db, { role: "admin" });
    const player = await createUser(db, { email: "sarah@example.test", name: "Sarah" });
    await db.insert(allowedEmail).values({ email: "sarah@example.test" });
    await db.insert(session).values({ id: "s1", token: "t1", userId: player.id, expiresAt: clock.at("+1h"), updatedAt: now });
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
  });

  it("cuts the link to the portal, so that whoever comes back gets a new account (D4)", async () => {
    const admin = await createUser(db, { role: "admin" });
    const player = await createUser(db);
    await db.insert(account).values([
      { id: "a1", accountId: "sub-sarah", providerId: "portail", userId: player.id, updatedAt: now },
      { id: "a2", accountId: player.id, providerId: "credential", userId: player.id, password: "hachage", updatedAt: now },
    ]);

    await anonymizeUser(db, actorOf(admin), { userId: player.id }, now);

    expect(await db.select().from(account).where(and(eq(account.userId, player.id), eq(account.providerId, "portail")))).toEqual([]);
    // The old passwords stay until step B4 (D9).
    expect(await db.select().from(account).where(eq(account.userId, player.id))).toHaveLength(1);
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
    expect(await anonymizeUser(db, actorOf(admin), { userId: player.id }, now)).toMatchObject({ ok: false, code: "ANONYMIZED" });
  });
});
