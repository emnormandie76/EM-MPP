import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authBaseUrl, authTrustedOrigins, createAuth, SESSION_EXPIRES_IN_S } from "@/lib/auth/auth";
import { session, user } from "@/lib/db/schema";
import { openPglite, type ScriptDb } from "../../scripts/lib/db";
import { authRequest, TEST_BASE_URL } from "../helpers/auth";

// Better Auth configuration (architecture §6.1). The sign-in itself is in portail-sign-in.test.ts.

describe("createAuth", () => {
  let target: ScriptDb;
  let auth: ReturnType<typeof createAuth>;

  beforeAll(async () => {
    target = await openPglite();
    await target.migrate();
    auth = createAuth(target.db, { BETTER_AUTH_URL: TEST_BASE_URL });
  });

  afterAll(async () => {
    await target.close();
  });

  it("keeps a session 8 hours, without renewing it or caching it in the cookie", () => {
    expect(SESSION_EXPIRES_IN_S).toBe(8 * 60 * 60);
    expect(auth.options.session).toMatchObject({
      expiresIn: SESSION_EXPIRES_IN_S,
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
    });
  });

  it("has no local sign-in at all, even behind the HTTP filter (G9)", async () => {
    expect(auth.options).not.toHaveProperty("emailAndPassword");
    for (const path of ["/sign-in/email", "/sign-up/email"]) {
      const body = { email: "x@example.test", password: "Mauvais-1234!", name: "Quelqu'un" };
      const response = await auth.handler(authRequest(path, body));
      expect(response.status, path).toBe(400);
      expect(response.headers.getSetCookie(), path).toEqual([]);
    }
    expect(await target.db.select().from(user)).toEqual([]);
    expect(await target.db.select().from(session)).toEqual([]);
  });

  it("starts without the portal's variables, with no provider: a preview has no sign-in (G12)", async () => {
    const { socialProviders } = await auth.$context;
    expect(socialProviders).toEqual([]);
  });

  it("sends an error before the state is read to /connexion, not to a Better Auth page", () => {
    expect(auth.options.onAPIError?.errorURL).toBe(`${TEST_BASE_URL}/connexion`);
  });
});

describe("trusted origins (§6.1)", () => {
  it("uses BETTER_AUTH_URL first, then the Vercel address, then localhost", () => {
    expect(authBaseUrl({ BETTER_AUTH_URL: "https://les-petits-pronos-de-la-promo.vercel.app", VERCEL_URL: "x.vercel.app" })).toBe(
      "https://les-petits-pronos-de-la-promo.vercel.app",
    );
    expect(authBaseUrl({ VERCEL_URL: "les-petits-pronos-de-la-promo-abc123.vercel.app" })).toBe("https://les-petits-pronos-de-la-promo-abc123.vercel.app");
    expect(authBaseUrl({})).toBe("http://localhost:3003");
  });

  it("trusts BETTER_AUTH_URL and the https deployment, branch and production addresses", () => {
    expect(
      authTrustedOrigins({
        BETTER_AUTH_URL: "http://localhost:3000",
        VERCEL_URL: "les-petits-pronos-de-la-promo-abc123.vercel.app",
        VERCEL_BRANCH_URL: "les-petits-pronos-de-la-promo-git-etape-03.vercel.app",
        VERCEL_PROJECT_PRODUCTION_URL: "les-petits-pronos-de-la-promo.vercel.app",
      }),
    ).toEqual([
      "http://localhost:3000",
      "https://les-petits-pronos-de-la-promo-abc123.vercel.app",
      "https://les-petits-pronos-de-la-promo-git-etape-03.vercel.app",
      "https://les-petits-pronos-de-la-promo.vercel.app",
    ]);
  });

  it("leaves out missing variables and duplicates", () => {
    expect(authTrustedOrigins({})).toEqual([]);
    expect(
      authTrustedOrigins({ BETTER_AUTH_URL: "https://les-petits-pronos-de-la-promo.vercel.app", VERCEL_PROJECT_PRODUCTION_URL: "les-petits-pronos-de-la-promo.vercel.app" }),
    ).toEqual(["https://les-petits-pronos-de-la-promo.vercel.app"]);
  });
});
