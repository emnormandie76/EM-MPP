import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthHolder } from "@/lib/auth/auth";
import { COOKIE_PREFIX, PORTAIL_PROVIDER_ID } from "@/lib/auth/portail";
import { defaultAvatarFor } from "@/lib/avatars";
import { account, session, user } from "@/lib/db/schema";
import { anonymizeUser } from "@/lib/services/players";
import { authRequest, createPortailAuth, signInThroughPortail, TEST_BASE_URL, type TestAuth } from "../helpers/auth";
import { createTestDb, type TestDb } from "../helpers/db";
import { createUser } from "../helpers/factories";
import { type FakePortail, type PortailIdentity, startFakePortail } from "../helpers/fake-portail";

// Sign-in through the portal (architecture §6.2, contract portal v1), the whole flow against a fake
// provider. Each test starts from an empty database and a neutral portal.

/** The code carried by a redirection to /connexion, or null elsewhere. */
function refusal(location: string | null): string | null {
  const url = new URL(location ?? "/", TEST_BASE_URL);
  return url.pathname === "/connexion" ? url.searchParams.get("error") : null;
}

const NOW = new Date("2026-11-20T10:00:00.000Z");
const HOUR = 3_600_000;
const SCHOOL = "em-normandie.fr";

function person(overrides: Partial<PortailIdentity> = {}): PortailIdentity {
  return { sub: "sub-camille", email: `camille@${SCHOOL}`, name: "Camille Durand", role: "player", ...overrides };
}

describe("sign-in through the portal", () => {
  let portail: FakePortail;
  let testDb: TestDb;
  let db: TestDb["db"];
  let auth: TestAuth;

  const signIn = (identity: PortailIdentity = person()) => {
    portail.state.identity = identity;
    return signInThroughPortail(auth);
  };

  const userByEmail = async (email: string) => (await db.select().from(user).where(eq(user.email, email)))[0];
  const links = (userId: string) =>
    db.select().from(account).where(and(eq(account.userId, userId), eq(account.providerId, PORTAIL_PROVIDER_ID)));

  beforeAll(async () => {
    portail = await startFakePortail();
  });

  afterAll(async () => {
    await portail.close();
  });

  beforeEach(async () => {
    testDb = await createTestDb();
    db = testDb.db;
    auth = createPortailAuth(db, portail);
    Object.assign(portail.state, { identity: null, authorizeError: null, tweaks: {} });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    await testDb.close();
  });

  describe("the flow of the contract (§3.3)", () => {
    it("sends a code request with PKCE S256, state, nonce and exactly the three scopes", async () => {
      await signIn();
      const request = portail.authorizeRequests.at(-1)!;
      expect(request.response_type).toBe("code");
      expect(request.code_challenge_method).toBe("S256");
      expect(request.code_challenge).toBeTruthy();
      expect(request.state).toBeTruthy();
      expect(request.nonce).toBeTruthy();
      expect(request.scope.split(" ").sort()).toEqual(["email", "openid", "profile"]);
      expect(request.redirect_uri).toBe(`${TEST_BASE_URL}/api/auth/callback/portail`);
    });

    it("authenticates to the token endpoint with client_secret_basic, the secret staying out of the body", async () => {
      await signIn();
      const request = portail.tokenRequests.at(-1)!;
      expect(request.authorization).toMatch(/^Basic /);
      expect(request.body.client_secret).toBeUndefined();
      expect(request.body.grant_type).toBe("authorization_code");
    });

    it("opens a session and goes to the home page", async () => {
      const result = await signIn();
      expect(result.location).toBe("/");
      expect(result.sessionCookie).toBeTruthy();
    });

    it("names its cookies with its own prefix (D6)", async () => {
      const result = await signIn();
      expect(result.sessionCookie).toMatch(new RegExp(`^${COOKIE_PREFIX}\\.session_token=`));
    });
  });

  describe("finding the account (contract §3.2)", () => {
    it("keeps sub in the account table, under the provider portail", async () => {
      await signIn();
      const created = await userByEmail(`camille@${SCHOOL}`);
      expect(await links(created.id)).toMatchObject([{ accountId: "sub-camille", providerId: "portail" }]);
    });

    it("finds the account by sub, even when the address changed, and copies the new address", async () => {
      await signIn();
      const { id } = await userByEmail(`camille@${SCHOOL}`);

      await signIn(person({ email: `camille.durand@${SCHOOL}` }));

      expect(await db.select().from(user)).toHaveLength(1);
      expect((await db.select().from(user).where(eq(user.id, id)))[0].email).toBe(`camille.durand@${SCHOOL}`);
    });

    it("the first time, finds an existing account by its address, though email_verified is false", async () => {
      const local = await createUser(db, { email: `camille@${SCHOOL}`, name: "Cam", role: "admin" });
      expect((await userByEmail(`camille@${SCHOOL}`)).emailVerified).toBe(false);

      const result = await signIn();

      expect(result.sessionCookie).toBeTruthy();
      expect(await db.select().from(user)).toHaveLength(1);
      expect(await links(local.id)).toMatchObject([{ accountId: "sub-camille" }]);
    });

    it("creates the account when neither sub nor the address is known", async () => {
      await signIn();
      const created = await userByEmail(`camille@${SCHOOL}`);
      expect(created).toMatchObject({ name: "Camille Durand", role: "player", banned: false });
      expect(created.avatar).toMatch(/^maillot-/);
    });

    it("refuses an address already linked to another sub, says so in the log, and links nothing", async () => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      await signIn();
      const { id } = await userByEmail(`camille@${SCHOOL}`);

      const result = await signIn(person({ sub: "sub-quelqu-un-d-autre" }));

      expect(refusal(result.location)).toBe("address_reassigned");
      expect(result.sessionCookie).toBeNull();
      expect(await links(id)).toHaveLength(1);
      expect(log).toHaveBeenCalledWith("[portail] address_reassigned", expect.objectContaining({ userId: id }));
      expect(JSON.stringify(log.mock.calls)).not.toContain(SCHOOL);
    });

    it("takes neither a ban nor an avatar from the token", async () => {
      await signIn({ ...person(), banned: true, avatar: "maillot-jaune-raye", banReason: "Non" } as PortailIdentity);
      const created = await userByEmail(`camille@${SCHOOL}`);
      expect(created).toMatchObject({ banned: false, banReason: null, avatar: defaultAvatarFor(created.id) });
    });

    it("refuses a new address that already belongs to another account, and changes nothing", async () => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      await createUser(db, { email: `sarah@${SCHOOL}`, name: "Sarah" });
      await signIn();

      const result = await signIn(person({ email: `sarah@${SCHOOL}` }));

      expect(refusal(result.location)).toBe("address_taken");
      expect(result.sessionCookie).toBeNull();
      expect(await userByEmail(`camille@${SCHOOL}`)).toBeTruthy();
      expect(log).toHaveBeenCalledWith("[portail] address_taken", expect.anything());
    });
  });

  describe("the role (D3)", () => {
    it("copies the role at each sign-in, in both directions", async () => {
      await signIn(person({ role: "admin" }));
      expect((await userByEmail(`camille@${SCHOOL}`)).role).toBe("admin");

      await signIn(person({ role: "player" }));
      expect((await userByEmail(`camille@${SCHOOL}`)).role).toBe("player");
    });

    it("overwrites the role of an account found by its address", async () => {
      await createUser(db, { email: `camille@${SCHOOL}`, role: "admin" });
      await signIn(person({ role: "player" }));
      expect((await userByEmail(`camille@${SCHOOL}`)).role).toBe("player");
    });

    it("refuses an unknown role before creating anything", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const result = await signIn(person({ role: "superviseur" }));

      expect(refusal(result.location)).toBe("role_not_allowed");
      expect(result.sessionCookie).toBeNull();
      expect(await db.select().from(user)).toHaveLength(0);
    });

    it("refuses an unknown role on a known account, and keeps its role", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      await signIn(person({ role: "admin" }));

      const result = await signIn(person({ role: "ADMIN" }));

      expect(refusal(result.location)).toBe("role_not_allowed");
      expect((await userByEmail(`camille@${SCHOOL}`)).role).toBe("admin");
    });
  });

  describe("the display name (D3)", () => {
    it("starts from the portal's name, cut to 30 characters", async () => {
      await signIn(person({ name: "Marie-Charlotte de la Tour du Pin-Chambly" }));
      const { name } = await userByEmail(`camille@${SCHOOL}`);
      expect(name).toBe("Marie-Charlotte de la Tour du");
      expect(name.length).toBeLessThanOrEqual(30);
    });

    it("makes it unique whatever the case", async () => {
      await createUser(db, { email: `autre@${SCHOOL}`, name: "CAMILLE DURAND" });
      await signIn();
      expect((await userByEmail(`camille@${SCHOOL}`)).name).toBe("Camille Durand 2");
    });

    it("keeps a long name unique within 30 characters", async () => {
      const long = "Marie-Charlotte de la Tour du Pin";
      await createUser(db, { email: `autre@${SCHOOL}`, name: "Marie-Charlotte de la Tour du" });
      await signIn(person({ name: long }));
      const { name } = await userByEmail(`camille@${SCHOOL}`);
      expect(name).toBe("Marie-Charlotte de la Tour d 2");
      expect(name.length).toBeLessThanOrEqual(30);
    });

    it("falls back on the address when the portal's name is too short", async () => {
      await signIn(person({ name: " " }));
      expect((await userByEmail(`camille@${SCHOOL}`)).name).toBe("camille");
    });

    it("never rewrites it afterwards", async () => {
      await signIn();
      await db.update(user).set({ name: "Cam la Reine" }).where(eq(user.email, `camille@${SCHOOL}`));

      await signIn(person({ name: "Camille Martin" }));

      expect((await userByEmail(`camille@${SCHOOL}`)).name).toBe("Cam la Reine");
    });

    it("does not rewrite the display name of an account linked by its address", async () => {
      await createUser(db, { email: `camille@${SCHOOL}`, name: "Cam" });
      await signIn();
      expect((await userByEmail(`camille@${SCHOOL}`)).name).toBe("Cam");
    });
  });

  describe("disabled and anonymized accounts (D4)", () => {
    it("lifts a disabling from before the portal, which has judged the access", async () => {
      await createUser(db, { email: `camille@${SCHOOL}`, banned: true, banReason: "Désactivé par un admin" });

      const result = await signIn();

      expect(result.sessionCookie).toBeTruthy();
      expect(await userByEmail(`camille@${SCHOOL}`)).toMatchObject({ banned: false, banReason: null });
    });

    it("gives a new account, never the old one, to someone who comes back after being anonymized", async () => {
      const admin = await createUser(db, { role: "admin" });
      await signIn();
      const old = await userByEmail(`camille@${SCHOOL}`);
      await anonymizeUser(db, { id: admin.id, role: "admin", banned: false }, { userId: old.id }, NOW);
      expect(await links(old.id)).toHaveLength(0);

      const result = await signIn();

      const fresh = await userByEmail(`camille@${SCHOOL}`);
      expect(result.sessionCookie).toBeTruthy();
      expect(fresh.id).not.toBe(old.id);
      expect((await db.select().from(user).where(eq(user.id, old.id)))[0]).toMatchObject({ banned: true });
    });

    it("refuses an anonymized account that a leftover link would reach, without opening it", async () => {
      const admin = await createUser(db, { role: "admin" });
      await signIn();
      const old = await userByEmail(`camille@${SCHOOL}`);
      const [link] = await links(old.id);
      await anonymizeUser(db, { id: admin.id, role: "admin", banned: false }, { userId: old.id }, NOW);
      await db.insert(account).values(link);

      const result = await signIn();

      expect(result.sessionCookie).toBeNull();
      expect((await db.select().from(user).where(eq(user.id, old.id)))[0].banned).toBe(true);
    });
  });

  describe("the id token is verified (contract §3.3)", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it.each([
      ["a wrong signature", { badSignature: true }],
      ["another audience", { audience: "un-autre-client" }],
      ["another nonce", { nonce: "un-autre-nonce" }],
      ["an expired token", { expiresIn: -60 }],
      ["another issuer", { issuer: "https://portail-pirate.example.test/api/auth" }],
      ["no id token at all", { omitIdToken: true }],
    ])("refuses %s, and opens no session", async (_, tweaks) => {
      portail.state.tweaks = tweaks;
      const result = await signIn();

      expect(refusal(result.location)).toBeTruthy();
      expect(result.sessionCookie).toBeNull();
      expect(await db.select().from(user)).toHaveLength(0);
      expect(await db.select().from(session)).toHaveLength(0);
    });

    it("compares the issuer with PORTAIL_ISSUER, not with what the discovery says", async () => {
      auth = createPortailAuth(db, portail, { PORTAIL_ISSUER: `${portail.issuer}/` });
      // The trailing slash of the variable is dropped, as the contract says: still the same issuer.
      expect((await signIn()).sessionCookie).toBeTruthy();
    });
  });

  describe("sessions of 8 hours (G6)", () => {
    const readSession = (cookie: string) => auth.api.getSession({ headers: new Headers({ cookie }) });

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"], now: NOW });
    });

    it("lasts exactly 8 hours from the sign-in", async () => {
      await signIn();
      const [row] = await db.select().from(session);
      expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBe(8 * HOUR);
    });

    it("still ends at 8 hours when read after 7 hours", async () => {
      const { sessionCookie } = await signIn();
      const [before] = await db.select().from(session);

      vi.setSystemTime(NOW.getTime() + 7 * HOUR);
      expect(await readSession(sessionCookie!)).not.toBeNull();

      const [after] = await db.select().from(session);
      expect(after.expiresAt.getTime()).toBe(before.expiresAt.getTime());
    });

    it("is refused after 8 hours, even if read in between", async () => {
      const { sessionCookie } = await signIn();
      vi.setSystemTime(NOW.getTime() + 7 * HOUR);
      await readSession(sessionCookie!);

      vi.setSystemTime(NOW.getTime() + 8 * HOUR + 1000);

      expect(await readSession(sessionCookie!)).toBeNull();
    });
  });

  describe("signing out through the portal (contract §3.8)", () => {
    it("gives the end-session address, with id_token_hint, client_id and the exact return address", async () => {
      const { sessionCookie } = await signIn();
      const { idToken } = (await db.select().from(account))[0];

      const result = await auth.api.signOut({
        headers: new Headers({ cookie: sessionCookie! }),
        body: { callbackURL: "/connexion", disableRedirect: true },
      });

      const url = new URL(result.url!);
      expect(url.origin + url.pathname).toBe(`${portail.issuer}/oauth2/end-session`);
      expect(url.searchParams.get("id_token_hint")).toBe(idToken);
      expect(url.searchParams.get("client_id")).toBeTruthy();
      expect(url.searchParams.get("post_logout_redirect_uri")).toBe(`${TEST_BASE_URL}/connexion`);
      expect(await db.select().from(session)).toHaveLength(0);
    });
  });

  describe("errors at the return address (contract §3.6)", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("goes back to /connexion with the code the portal sent", async () => {
      portail.state.authorizeError = "access_denied";
      const result = await signIn();
      expect(refusal(result.location)).toBe("access_denied");
      expect(result.sessionCookie).toBeNull();
    });

    it("goes to /connexion, not to a Better Auth page, when the state is missing", async () => {
      const response = await auth.handler(new Request(`${TEST_BASE_URL}/api/auth/callback/portail?code=abc`));
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(`${TEST_BASE_URL}/connexion?error=state_not_found`);
    });

    it("goes to /connexion when the state is unknown", async () => {
      const response = await auth.handler(new Request(`${TEST_BASE_URL}/api/auth/callback/portail?code=abc&state=inconnu`));
      expect(response.headers.get("location")).toMatch(new RegExp(`^${TEST_BASE_URL}/connexion\\?error=`));
    });
  });

  describe("attempt limit (§6.1)", () => {
    const start = (ip: string) =>
      auth.handler(authRequest("/sign-in/social", { provider: "portail", callbackURL: "/" }, ip));

    it("does not block a shared address: the whole team signs in from one IP", async () => {
      const statuses = [];
      for (let attempt = 0; attempt < 25; attempt += 1) statuses.push((await start("203.0.113.20")).status);
      expect(new Set(statuses)).toEqual(new Set([200]));
    });

    it("still limits a sustained flood", async () => {
      const statuses = [];
      for (let attempt = 0; attempt < 61; attempt += 1) statuses.push((await start("203.0.113.21")).status);
      expect(statuses.at(-2)).toBe(200);
      expect(statuses.at(-1)).toBe(429);
    });
  });
});

describe("when the portal is out of reach (contract §3.1)", () => {
  let testDb: TestDb;
  let portail: FakePortail;

  beforeEach(async () => {
    testDb = await createTestDb();
    portail = await startFakePortail();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await portail.close().catch(() => {});
    await testDb.close();
  });

  it("keeps the sessions already open, though the discovery fails", async () => {
    const auth = createPortailAuth(testDb.db, portail);
    portail.state.identity = person();
    const { sessionCookie } = await signInThroughPortail(auth);
    const { issuer } = portail;
    await portail.close();

    const restarted = createPortailAuth(testDb.db, portail, { PORTAIL_ISSUER: issuer });
    const read = await restarted.api.getSession({ headers: new Headers({ cookie: sessionCookie! }) });

    expect(read?.user.email).toBe(`camille@${SCHOOL}`);
  });

  it("rebuilds the instance after a failed discovery, at most every 30 seconds", async () => {
    const down = "http://localhost:1/api/auth";
    let issuer = down;
    let built = 0;
    const holder = createAuthHolder(() => {
      built += 1;
      return createPortailAuth(testDb.db, portail, { PORTAIL_ISSUER: issuer });
    });
    const start = 1_000_000;

    expect(await holder.getWithPortail(start)).toBeNull();
    expect(built).toBe(2);

    issuer = portail.issuer;
    expect(await holder.getWithPortail(start + 1000)).toBeNull();
    expect(built).toBe(2);

    const auth = await holder.getWithPortail(start + 31_000);
    expect(auth).not.toBeNull();
    expect(built).toBe(3);
    expect(holder.get()).toBe(auth);

    expect(await holder.getWithPortail(start + 32_000)).toBe(auth);
    expect(built).toBe(3);
  });
});
