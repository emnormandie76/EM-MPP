import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/auth/[...all]/route";
import { COOKIE_PREFIX } from "@/lib/auth/portail";
import type { Database } from "@/lib/db/client";
import { session } from "@/lib/db/schema";
import { E2E_SECRET, sessionCookieValue } from "../../e2e/session";
import { createTestDb, type TestDb } from "../helpers/db";
import { createUser } from "../helpers/factories";

// The HTTP route of Better Auth (architecture §6.1, §6.2), without a working portal: this is what a
// preview without a client sees, and what the application does when the portal is out of reach.

const BASE = "http://localhost:3100";

// The route reads the singleton of src/lib/db/client.ts: it gets the migrated test database.
const shared = globalThis as typeof globalThis & { appDb?: Database };
let target: TestDb;

beforeAll(async () => {
  target = await createTestDb();
  shared.appDb = target.db;
  vi.stubEnv("BETTER_AUTH_SECRET", E2E_SECRET);
  vi.stubEnv("BETTER_AUTH_URL", BASE);
  vi.stubEnv("PORTAIL_ISSUER", "");
  vi.stubEnv("PORTAIL_CLIENT_ID", "");
  vi.stubEnv("PORTAIL_CLIENT_SECRET", "");
});

afterAll(async () => {
  vi.unstubAllEnvs();
  delete shared.appDb;
  await target.close();
});

const post = (path: string) =>
  POST(
    new Request(`${BASE}/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE },
      body: JSON.stringify({ provider: "portail", callbackURL: "/" }),
    }),
  );

describe("the route, without the portal", () => {
  it("closes what the interface does not use, the password routes first", async () => {
    for (const path of ["/sign-in/email", "/sign-up/email", "/admin/set-role", "/update-user"]) {
      expect((await post(path)).status, path).toBe(404);
    }
  });

  it("answers 503 to the start of the flow, which the sign-in page turns into a neutral message", async () => {
    const response = await post("/sign-in/social");
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "PORTAIL_UNAVAILABLE" });
  });

  it("leads the return address to /connexion with an error, never into a loop", async () => {
    const response = await GET(new Request(`${BASE}/api/auth/callback/portail?code=abc&state=def`));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(`${BASE}/connexion?error=portail_unavailable`);
  });

  it("keeps reading the sessions already open: they do not need the portal", async () => {
    const owner = await createUser(target.db);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60_000);
    await target.db.insert(session).values({ id: "s1", token: "t1", userId: owner.id, expiresAt, createdAt: now, updatedAt: now });

    const cookie = `${COOKIE_PREFIX}.session_token=${sessionCookieValue("t1")}`;
    const response = await GET(new Request(`${BASE}/api/auth/get-session`, { headers: { cookie } }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ user: { id: owner.id } });
  });

  it("answers nothing, without an error, to a visitor who has no session", async () => {
    const response = await GET(new Request(`${BASE}/api/auth/get-session`));
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });
});
