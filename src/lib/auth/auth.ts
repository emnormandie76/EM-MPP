import { betterAuth, generateId } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { AVATAR_KEYS, defaultAvatarFor } from "@/lib/avatars";
import { type Database, getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { normalizeEmail, parseAdminEmails } from "@/lib/validation/account";
import { checkSignUp } from "./sign-up";

// Better Auth configuration (architecture §6.1, §6.2). After any change that affects the tables,
// regenerate src/lib/db/schema/auth.ts (see README).

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

export function createAuth(db: Database, env: Env = process.env) {
  const adminEmails = parseAdminEmails(env.ADMIN_EMAILS);

  return betterAuth({
    appName: "Le Bon Chiffre",
    baseURL: authBaseUrl(env),
    trustedOrigins: authTrustedOrigins(env),
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
      // No cookie cache: a disabled account, a role or a name change applies at the next page,
      // not up to 5 minutes later (decision of 30/09/2026).
      cookieCache: { enabled: false },
    },
    user: {
      additionalFields: {
        // Set by the hook below (§6.2, §8.2); changed in the profile, never at sign-up. Better Auth
        // requires a default before the hook runs: this placeholder is always replaced. Being a
        // function, it adds no database default to the generated schema.
        avatar: { type: "string", required: true, input: false, defaultValue: () => AVATAR_KEYS[0] },
        lastSeenAt: { type: "date", required: false, input: false },
        previousVisitAt: { type: "date", required: false, input: false },
      },
    },
    hooks: {
      // Sign-up rules (§6.2). They read the database, so they run before the sign-up
      // transaction, with French messages the forms show as they are.
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email") return;
        const body = (ctx.body ?? {}) as Record<string, unknown>;
        const check = await checkSignUp(db, { email: body.email, name: body.name }, adminEmails);
        if (!check.ok) throw new APIError("BAD_REQUEST", { code: check.code, message: check.message });
        return { context: { body: { ...body, email: check.email, name: check.name } } };
      }),
    },
    databaseHooks: {
      user: {
        create: {
          // Every new account: normalized address, role from ADMIN_EMAILS, default avatar.
          async before(data) {
            const id = generateId();
            const email = normalizeEmail(data.email);
            return {
              data: {
                ...data,
                id,
                email,
                name: data.name.trim(),
                role: adminEmails.includes(email) ? "admin" : "player",
                avatar: defaultAvatarFor(id),
              },
            };
          },
        },
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
      // Role and ban fields, and the refusal of a disabled account at sign-in. The admin actions
      // themselves are services (src/lib/services/players.ts); their HTTP routes stay closed.
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

let instance: Auth | undefined;

/**
 * The application's instance, created on first use rather than at import: `next build` loads
 * this module, and must not open the database (PGlite in end-to-end tests).
 */
export function getAuth(): Auth {
  instance ??= createAuth(getDb());
  return instance;
}
