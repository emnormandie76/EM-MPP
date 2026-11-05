import { type APIRequestContext, expect, type Page, test as base } from "@playwright/test";
import { COOKIE_PREFIX } from "../src/lib/auth/portail";
import type { FakePortailState } from "../tests/helpers/fake-portail";
import { FAKE_PORTAIL_ORIGIN, sessionCookieValue, sessionToken } from "./session";

// Shared end-to-end helpers (architecture §9.4).

export { FAKE_PORTAIL_ORIGIN };

export const ACCOUNTS = {
  admin: "admin@example.test",
  sarah: "joueur1@example.test",
  julien: "joueur2@example.test",
  camille: "joueur4@example.test",
  thomas: "joueur5@example.test",
  mehdi: "joueur6@example.test",
  lea: "joueur7@example.test",
  hugo: "joueur8@example.test",
  disabled: "desactive@example.test",
} as const;

/** A distinct client address per test, from the testId: the attempt limits count per address (§6.1). */
function clientAddress(testId: string): string {
  let hash = 0;
  for (const char of testId) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return `10.${(hash >>> 16) & 255}.${(hash >>> 8) & 255}.${hash & 255}`;
}

export const test = base.extend({
  // Next.js keeps the incoming x-forwarded-for; on Vercel, the platform sets it.
  // (The second parameter is Playwright's `use`, renamed: the React hooks lint rule would flag it.)
  extraHTTPHeaders: async ({ extraHTTPHeaders }, provide, testInfo) => {
    await provide({ ...extraHTTPHeaders, "x-forwarded-for": clientAddress(`${testInfo.testId}-${testInfo.retry}`) });
  },
});

export { expect };

const SESSION_COOKIE = `${COOKIE_PREFIX}.session_token`;

/**
 * Gives the browser the session of a seeded account, opened by scripts/e2e-prepare.ts, and waits for
 * the home page. No sign-in path exists for the tests in the application (D8): the flow itself is
 * proved in e2e/auth.spec.ts, against the fake portal.
 */
export async function signIn(page: Page, email: string): Promise<void> {
  const url = test.info().project.use.baseURL!;
  await page.context().addCookies([{ name: SESSION_COOKIE, value: sessionCookieValue(sessionToken(email)), url }]);
  await page.goto("/");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Salut");
}

/**
 * Forgets the session in this browser only, to go on with another account: the session stays open,
 * for the next test of this account. The real sign-out is proved in e2e/auth.spec.ts.
 */
export async function signOut(page: Page): Promise<void> {
  await page.context().clearCookies({ name: SESSION_COOKIE });
  await page.goto("/connexion");
}

/** Sets the fake portal: who is signed in there, and how it answers. Anything left out is reset. */
export async function setPortail(request: APIRequestContext, state: Partial<FakePortailState>): Promise<void> {
  const response = await request.post(`${FAKE_PORTAIL_ORIGIN}/__test/state`, { data: state });
  expect(response.ok()).toBe(true);
}

export type PortailReport = {
  authorizeCount: number;
  logoutRequests: Record<string, string>[];
  state: FakePortailState;
};

export async function readPortail(request: APIRequestContext): Promise<PortailReport> {
  return (await request.get(`${FAKE_PORTAIL_ORIGIN}/__test/state`)).json() as Promise<PortailReport>;
}
