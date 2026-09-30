import { describe, expect, it } from "vitest";
import { checkEnv } from "../../scripts/lib/env-rules";

const VALID = {
  DATABASE_URL: "postgresql://user:s3cr3t-pooled@ep-test-pooler.example.test/db?sslmode=require",
  DATABASE_URL_UNPOOLED: "postgresql://user:s3cr3t-direct@ep-test.example.test/db?sslmode=require",
  BETTER_AUTH_SECRET: "0123456789abcdefghijklmnopqrstuvwxyz",
  BETTER_AUTH_URL: "http://localhost:3000",
  ADMIN_EMAILS: "admin@example.test, second.admin@example.test",
};

function statuses(env: Record<string, string | undefined>) {
  return Object.fromEntries(checkEnv(env).map(({ name, status }) => [name, status]));
}

describe("checkEnv (scripts/check-env.ts)", () => {
  it("accepts a complete environment", () => {
    expect(checkEnv(VALID).every(({ status }) => status === "OK")).toBe(true);
  });

  it("reports missing and blank variables", () => {
    const result = statuses({ ...VALID, BETTER_AUTH_URL: undefined, ADMIN_EMAILS: "  " });
    expect(result.BETTER_AUTH_URL).toBe("MANQUANTE");
    expect(result.ADMIN_EMAILS).toBe("MANQUANTE");
    expect(result.DATABASE_URL).toBe("OK");
  });

  it("reports invalid formats, with a hint", () => {
    const result = checkEnv({
      DATABASE_URL: "mysql://user:pw@host/db",
      DATABASE_URL_UNPOOLED: "not a url",
      BETTER_AUTH_SECRET: "too-short",
      BETTER_AUTH_URL: "localhost:3000",
      ADMIN_EMAILS: "admin@example.test,nope,also nope",
    });
    expect(result).toEqual([
      { name: "DATABASE_URL", status: "INVALIDE", hint: "URL PostgreSQL attendue" },
      { name: "DATABASE_URL_UNPOOLED", status: "INVALIDE", hint: "URL PostgreSQL attendue" },
      { name: "BETTER_AUTH_SECRET", status: "INVALIDE", hint: "au moins 32 caractères" },
      { name: "BETTER_AUTH_URL", status: "INVALIDE", hint: "URL http(s) attendue" },
      { name: "ADMIN_EMAILS", status: "INVALIDE", hint: "2 adresses invalides" },
    ]);
  });

  it("never returns a value", () => {
    const output = JSON.stringify([checkEnv(VALID), checkEnv({ ...VALID, BETTER_AUTH_SECRET: "short-secret" })]);
    for (const value of ["s3cr3t", "0123456789abcdef", "short-secret", "admin@example.test", "localhost"]) {
      expect(output).not.toContain(value);
    }
  });
});
