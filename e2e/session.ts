import { createHash, createHmac } from "node:crypto";

// What scripts/e2e-prepare.ts, playwright.config.ts and e2e/fixtures.ts share (architecture §9.4).

/** Fixed test-only value, never used outside end-to-end tests. */
export const E2E_SECRET = "e2e-only-secret-0123456789abcdefghij";

export const FAKE_PORTAIL_PORT = 3101;
export const FAKE_PORTAIL_ORIGIN = `http://127.0.0.1:${FAKE_PORTAIL_PORT}`;

/** The session token of a seeded account, the same in the database and in the browser. */
export function sessionToken(email: string): string {
  return createHash("sha256").update(`e2e-${email}`).digest("hex");
}

/** A session cookie as Better Auth signs it: `<token>.<HMAC-SHA256 in base64>`, URL-encoded. */
export function sessionCookieValue(token: string): string {
  const signature = createHmac("sha256", E2E_SECRET).update(token).digest("base64");
  return encodeURIComponent(`${token}.${signature}`);
}
