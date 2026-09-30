import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { type Database, getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

// Better Auth configuration (architecture §6.1). The sign-up hook (allow list, admin role,
// default avatar, unique name: §6.2) arrives with the pages in step 4. After any change that
// affects the tables, regenerate src/lib/db/schema/auth.ts (see README).

const DAY_S = 24 * 60 * 60;

/** 400 days: the longest cookie lifetime browsers accept (§14). */
export const SESSION_EXPIRES_IN_S = 400 * DAY_S;

export const ROLES = ["player", "admin"] as const;
export type Role = (typeof ROLES)[number];

type Env = Record<string, string | undefined>;

const https = (host: string | undefined) => (host ? `https://${host}` : undefined);

export function authBaseUrl(env: Env = process.env): string {
  return env.BETTER_AUTH_URL || https(env.VERCEL_URL) || "http://localhost:3000";
}

/** BETTER_AUTH_URL, plus the deployment, branch and production addresses on Vercel. */
export function authTrustedOrigins(env: Env = process.env): string[] {
  const origins = [
    env.BETTER_AUTH_URL,
    https(env.VERCEL_URL),
    https(env.VERCEL_BRANCH_URL),
    https(env.VERCEL_PROJECT_PRODUCTION_URL),
  ];
  return [...new Set(origins.filter((origin): origin is string => Boolean(origin)))];
}

export function createAuth(db: Database) {
  return betterAuth({
    appName: "Le Bon Chiffre",
    baseURL: authBaseUrl(),
    trustedOrigins: authTrustedOrigins(),
    database: drizzleAdapter(db, { provider: "pg", schema, transaction: true }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    session: {
      expiresIn: SESSION_EXPIRES_IN_S,
      // Renewed on each visit, at most once a day.
      updateAge: DAY_S,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    user: {
      additionalFields: {
        // Default computed by the sign-up hook (§6.2, §8.2); changed in the profile, never at sign-up.
        avatar: { type: "string", required: true, input: false },
        lastSeenAt: { type: "date", required: false, input: false },
        previousVisitAt: { type: "date", required: false, input: false },
      },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 10 * 60, max: 5 },
      },
    },
    advanced: {
      // Set by Vercel to the client address.
      ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
    },
    telemetry: { enabled: false },
    plugins: [
      admin({
        defaultRole: "player",
        adminRoles: ["admin"],
        bannedUserMessage: "Ton compte est désactivé. Contacte l'admin.",
      }),
      // Lets Server Actions set cookies. Must stay the last plugin.
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

export const auth = createAuth(getDb());
