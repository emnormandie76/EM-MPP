import { createAuth } from "@/lib/auth/auth";
import type { Database } from "@/lib/db/client";
import { FAKE_CLIENT_ID, FAKE_CLIENT_SECRET, type FakePortail } from "./fake-portail";

export const TEST_BASE_URL = "http://localhost:3100";

type Env = Record<string, string | undefined>;

/**
 * Better Auth plugged into a test database (architecture §9.2), with its own environment: the base
 * URL and the portal's variables never come from the machine.
 */
export function createTestAuth(db: Database, env: Env = {}) {
  return createAuth(db, { BETTER_AUTH_URL: TEST_BASE_URL, ...env });
}

export type TestAuth = ReturnType<typeof createTestAuth>;

/** The same, connected to a fake portal. */
export function createPortailAuth(db: Database, portail: FakePortail, env: Env = {}) {
  return createTestAuth(db, {
    PORTAIL_ISSUER: portail.issuer,
    PORTAIL_CLIENT_ID: FAKE_CLIENT_ID,
    PORTAIL_CLIENT_SECRET: FAKE_CLIENT_SECRET,
    ...env,
  });
}

/** A POST to a Better Auth route over HTTP, as the browser sends it. */
export function authRequest(path: string, body: unknown, ip = "203.0.113.10"): Request {
  return new Request(`${TEST_BASE_URL}/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: TEST_BASE_URL, "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

/** `name=value` pairs of the Set-Cookie headers, ready for a Cookie header. */
function cookiesOf(response: Response): string[] {
  return response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]);
}

export type SignInResult = {
  /** Where the return address sends the browser, or null when the portal keeps it. */
  location: string | null;
  /** The session cookie, ready for a Cookie header, or null without a session. */
  sessionCookie: string | null;
};

/** The whole flow as a browser plays it: start, portal, return address. */
export async function signInThroughPortail(auth: TestAuth): Promise<SignInResult> {
  const start = await auth.handler(
    authRequest("/sign-in/social", { provider: "portail", callbackURL: "/", errorCallbackURL: "/connexion" }),
  );
  if (!start.ok) throw new Error(`/sign-in/social: ${start.status} ${await start.text()}`);
  const { url } = (await start.json()) as { url: string };

  const authorize = await fetch(url, { redirect: "manual" });
  const callback = authorize.headers.get("location");
  if (!callback) return { location: null, sessionCookie: null };

  const response = await auth.handler(new Request(callback, { headers: { cookie: cookiesOf(start).join("; ") } }));
  const session = cookiesOf(response).find((cookie) => /\.session_token=./.test(cookie));
  return { location: response.headers.get("location"), sessionCookie: session ?? null };
}
