import { createAuth } from "@/lib/auth/auth";
import type { Database } from "@/lib/db/client";

export const TEST_BASE_URL = "http://localhost:3100";

/**
 * Better Auth plugged into a test database (architecture §9.2), with its own environment:
 * ADMIN_EMAILS and the base URL never come from the machine.
 */
export function createTestAuth(db: Database, env: { ADMIN_EMAILS?: string } = {}) {
  return createAuth(db, { BETTER_AUTH_URL: TEST_BASE_URL, ...env });
}

export type TestAuth = ReturnType<typeof createTestAuth>;

/** A POST to a Better Auth route over HTTP, as the browser sends it. */
export function authRequest(path: string, body: unknown, ip = "203.0.113.10"): Request {
  return new Request(`${TEST_BASE_URL}/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: TEST_BASE_URL, "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}
