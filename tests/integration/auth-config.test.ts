import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authBaseUrl, authTrustedOrigins, createAuth } from "@/lib/auth/auth";
import { session } from "@/lib/db/schema";
import { openPglite, type ScriptDb } from "../../scripts/lib/db";
import { SEED_PASSWORD, seedDatabase } from "../../scripts/lib/seed";

// Better Auth configuration (architecture §6.1) against the generated schema and the seeded accounts.
// Sign-up and its hook arrive in step 4.

describe("createAuth", () => {
  let target: ScriptDb;
  let auth: ReturnType<typeof createAuth>;

  beforeAll(async () => {
    target = await openPglite();
    await target.migrate();
    await seedDatabase(target.db, { now: new Date("2026-11-20T10:00:00Z"), env: {} });
    auth = createAuth(target.db);
  });

  afterAll(async () => {
    await target.close();
  });

  it("signs in a seeded account, with its role and avatar", async () => {
    const result = await auth.api.signInEmail({ body: { email: "admin@example.test", password: SEED_PASSWORD } });
    expect(result.user).toMatchObject({ email: "admin@example.test", name: "Admin", role: "admin" });
    expect(result.user.avatar).toMatch(/^maillot-/);
    expect(result.token).toBeTruthy();
  });

  it("creates a session that lasts 400 days", async () => {
    const { token } = await auth.api.signInEmail({ body: { email: "joueur1@example.test", password: SEED_PASSWORD } });
    const [row] = await target.db.select().from(session).where(eq(session.token, token));
    const days = (row.expiresAt.getTime() - row.createdAt.getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(400);
  });

  it("refuses a wrong password", async () => {
    await expect(auth.api.signInEmail({ body: { email: "joueur1@example.test", password: "Mauvais-1234!" } })).rejects.toThrow();
  });

  it("refuses a disabled account, with the French message", async () => {
    await expect(auth.api.signInEmail({ body: { email: "desactive@example.test", password: SEED_PASSWORD } })).rejects.toThrow(
      "Ton compte est désactivé. Contacte l'admin.",
    );
  });
});

describe("trusted origins (§6.1)", () => {
  it("uses BETTER_AUTH_URL first, then the Vercel address, then localhost", () => {
    expect(authBaseUrl({ BETTER_AUTH_URL: "https://le-bon-chiffre.vercel.app", VERCEL_URL: "x.vercel.app" })).toBe(
      "https://le-bon-chiffre.vercel.app",
    );
    expect(authBaseUrl({ VERCEL_URL: "le-bon-chiffre-abc123.vercel.app" })).toBe("https://le-bon-chiffre-abc123.vercel.app");
    expect(authBaseUrl({})).toBe("http://localhost:3000");
  });

  it("trusts BETTER_AUTH_URL and the https deployment, branch and production addresses", () => {
    expect(
      authTrustedOrigins({
        BETTER_AUTH_URL: "http://localhost:3000",
        VERCEL_URL: "le-bon-chiffre-abc123.vercel.app",
        VERCEL_BRANCH_URL: "le-bon-chiffre-git-etape-03.vercel.app",
        VERCEL_PROJECT_PRODUCTION_URL: "le-bon-chiffre.vercel.app",
      }),
    ).toEqual([
      "http://localhost:3000",
      "https://le-bon-chiffre-abc123.vercel.app",
      "https://le-bon-chiffre-git-etape-03.vercel.app",
      "https://le-bon-chiffre.vercel.app",
    ]);
  });

  it("leaves out missing variables and duplicates", () => {
    expect(authTrustedOrigins({})).toEqual([]);
    expect(
      authTrustedOrigins({ BETTER_AUTH_URL: "https://le-bon-chiffre.vercel.app", VERCEL_PROJECT_PRODUCTION_URL: "le-bon-chiffre.vercel.app" }),
    ).toEqual(["https://le-bon-chiffre.vercel.app"]);
  });
});
