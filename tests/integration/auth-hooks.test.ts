import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultAvatarFor } from "@/lib/avatars";
import type { Database } from "@/lib/db/client";
import { allowedEmail, session, user } from "@/lib/db/schema";
import { authRequest, createTestAuth, type TestAuth } from "../helpers/auth";
import { createTestDb } from "../helpers/db";
import { createUser } from "../helpers/factories";

// Sign-up hook (architecture §6.2, §9.2): allow list, ADMIN_EMAILS, unique name, default avatar.

const PASSWORD = "Test-1234!";

describe("sign-up", () => {
  let db: Database;
  let close: () => Promise<void>;
  let auth: TestAuth;

  beforeEach(async () => {
    ({ db, close } = await createTestDb());
    auth = createTestAuth(db, { ADMIN_EMAILS: "chef@example.test, Adjointe@Example.test" });
    await db.insert(allowedEmail).values([{ email: "camille@example.test" }, { email: "hugo@example.test" }]);
  });

  afterEach(async () => {
    await close();
  });

  const signUp = (email: string, name: string, password = PASSWORD) =>
    auth.api.signUpEmail({ body: { email, name, password } });

  it("refuses an address outside the allow list, without creating anything", async () => {
    await expect(signUp("inconnu@example.test", "Inconnu")).rejects.toThrow(
      "Cette adresse n'est pas sur la liste des joueurs. Contacte l'admin.",
    );
    expect(await db.select().from(user)).toEqual([]);
  });

  it("accepts a listed address whatever its case and surrounding spaces", async () => {
    const result = await signUp("  Camille@Example.TEST ", "  Camille  ");
    expect(result.user).toMatchObject({ email: "camille@example.test", name: "Camille" });

    const [row] = await db.select().from(user);
    expect(row).toMatchObject({ email: "camille@example.test", name: "Camille", role: "player", banned: false });
    expect(row.avatar).toBe(defaultAvatarFor(row.id));
  });

  it("signs the new player in", async () => {
    const result = await signUp("hugo@example.test", "Hugo");
    expect(result.token).toBeTruthy();
    expect(await db.select().from(session).where(eq(session.userId, result.user.id))).toHaveLength(1);
  });

  it("gives the admin role to an address of ADMIN_EMAILS, which needs no allow list entry", async () => {
    await signUp("chef@example.test", "Chef");
    await signUp("ADJOINTE@example.test", "Adjointe");
    const rows = await db.select({ email: user.email, role: user.role }).from(user).orderBy(user.email);
    expect(rows).toEqual([
      { email: "adjointe@example.test", role: "admin" },
      { email: "chef@example.test", role: "admin" },
    ]);
  });

  it("refuses a name already taken, whatever the case", async () => {
    await createUser(db, { name: "Sarah", email: "sarah@example.test" });
    await expect(signUp("camille@example.test", " sarah ")).rejects.toThrow("Ce nom est déjà pris.");
    expect(await db.select().from(user).where(eq(user.email, "camille@example.test"))).toEqual([]);
  });

  it("refuses a name shorter than 2 or longer than 30 characters once trimmed", async () => {
    await expect(signUp("camille@example.test", "  C  ")).rejects.toThrow("Ton nom doit faire de 2 à 30 caractères.");
    await expect(signUp("camille@example.test", "C".repeat(31))).rejects.toThrow("Ton nom doit faire de 2 à 30 caractères.");
    expect((await signUp("camille@example.test", "C".repeat(30))).user.name).toBe("C".repeat(30));
  });

  it("refuses a second account for the same address", async () => {
    await signUp("camille@example.test", "Camille");
    await expect(signUp("CAMILLE@example.test", "Camille B")).rejects.toThrow(
      "Un compte existe déjà avec cette adresse. Connecte-toi.",
    );
  });

  it("refuses an invalid address and a password shorter than 8 characters", async () => {
    await expect(signUp("pas-une-adresse", "Camille")).rejects.toThrow("Adresse email invalide.");
    await expect(signUp("camille@example.test", "Camille", "court")).rejects.toMatchObject({
      body: { code: "PASSWORD_TOO_SHORT" },
    });
  });

  it("never takes a role, a ban or an avatar from the client", async () => {
    const body = { email: "hugo@example.test", name: "Hugo", password: PASSWORD };
    await expect(auth.api.signUpEmail({ body: { ...body, role: "admin" } } as never)).rejects.toThrow("role is not allowed to be set");
    expect(await db.select().from(user)).toEqual([]);

    // A ban and an avatar sent by the client are replaced by the default values.
    await auth.api.signUpEmail({ body: { ...body, banned: true, avatar: "maillot-jaune-raye" } } as never);
    const [row] = await db.select().from(user);
    expect(row).toMatchObject({ role: "player", banned: false, avatar: defaultAvatarFor(row.id) });
  });
});

describe("attempt limits over HTTP (§6.1)", () => {
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

  it("answers 429 to the 6th sign-in attempt within a minute from the same address", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const response = await auth.handler(authRequest("/sign-in/email", { email: "x@example.test", password: "Mauvais-1234!" }));
      statuses.push(response.status);
    }
    expect(statuses.slice(0, 5).every((status) => status === 401)).toBe(true);
    expect(statuses[5]).toBe(429);

    // Another address is not blocked.
    const other = await auth.handler(authRequest("/sign-in/email", { email: "x@example.test", password: "Mauvais-1234!" }, "203.0.113.99"));
    expect(other.status).toBe(401);
  });

  it("answers the sign-up refusal with its French message and code", async () => {
    const response = await auth.handler(authRequest("/sign-up/email", { email: "inconnu@example.test", name: "Inconnu", password: PASSWORD }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "EMAIL_NOT_ALLOWED",
      message: "Cette adresse n'est pas sur la liste des joueurs. Contacte l'admin.",
    });
  });
});
