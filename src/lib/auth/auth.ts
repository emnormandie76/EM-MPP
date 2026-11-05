import { betterAuth, generateId } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { genericOAuth } from "better-auth/plugins/generic-oauth";
import { APP_NAME } from "@/lib/app";
import { AVATAR_KEYS, defaultAvatarFor } from "@/lib/avatars";
import { type Database, getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { normalizeEmail } from "@/lib/validation/account";
import { COOKIE_PREFIX, PORTAIL_PROVIDER_ID, PORTAIL_SCOPES, portailClient, SIGN_IN_PATH } from "./portail";
import { portailIdentity, portailUserValidator, startingDisplayName } from "./portail-identity";

// Better Auth configuration (architecture §6.1, §6.2). After any change that affects the tables,
// regenerate src/lib/db/schema/auth.ts (see README).

/** 8 hours from the sign-in, never extended: a withdrawn access applies at the next sign-in (G6). */
export const SESSION_EXPIRES_IN_S = 8 * 60 * 60;

/** How often a new instance may try the portal's discovery again after a failure (§6.2). */
export const DISCOVERY_RETRY_MS = 30_000;

type Env = Record<string, string | undefined>;

const https = (host: string | undefined) => (host ? `https://${host}` : undefined);

export function authBaseUrl(env: Env = process.env): string {
  return env.BETTER_AUTH_URL || https(env.VERCEL_URL) || "http://localhost:3003";
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
  const baseURL = authBaseUrl(env);
  const portail = portailClient(env);

  return betterAuth({
    appName: APP_NAME,
    baseURL,
    trustedOrigins: authTrustedOrigins(env),
    database: drizzleAdapter(db, { provider: "pg", schema, transaction: true }),
    // Without this, an error before the state is read would end on /api/auth/error, a 404 here.
    onAPIError: { errorURL: `${baseURL}${SIGN_IN_PATH}` },
    account: {
      accountLinking: {
        trustedProviders: [PORTAIL_PROVIDER_ID],
        // Existing accounts are all at email_verified = false, and the contract does not rely on it.
        requireLocalEmailVerified: false,
      },
    },
    session: {
      expiresIn: SESSION_EXPIRES_IN_S,
      disableSessionRefresh: true,
      // No cookie cache: a role or a name change applies at the next page, not up to 5 minutes
      // later (decision of 30/09/2026).
      cookieCache: { enabled: false },
    },
    user: {
      additionalFields: {
        // Set by the hook below (§6.2, §8.2); changed in the profile, never at sign-in. Better Auth
        // requires a default before the hook runs: this placeholder is always replaced. Being a
        // function, it adds no database default to the generated schema.
        avatar: { type: "string", required: true, input: false, defaultValue: () => AVATAR_KEYS[0] },
        lastSeenAt: { type: "date", required: false, input: false },
        previousVisitAt: { type: "date", required: false, input: false },
      },
      ...(portail ? { validateUserInfo: portailUserValidator(portail.issuer) } : {}),
    },
    databaseHooks: {
      user: {
        create: {
          // Every new account: normalized address, trimmed name, default avatar.
          async before(data) {
            const id = generateId();
            return {
              data: { ...data, id, email: normalizeEmail(data.email), name: data.name.trim(), avatar: defaultAvatarFor(id) },
            };
          },
        },
      },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      // The default rule of /sign-in* is 3 requests per 10 seconds and per address: the whole school
      // goes out through one address, and a few players signing in together would block each other.
      customRules: { "/sign-in/social": { window: 60, max: 60 } },
    },
    advanced: {
      cookiePrefix: COOKIE_PREFIX,
      // Set by Vercel to the client address.
      ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
    },
    telemetry: { enabled: false },
    plugins: [
      // Before `admin`: see portailIdentity.
      portailIdentity(),
      // Role and ban fields, and the refusal of a banned account at sign-in. Their HTTP routes stay
      // closed: the only admin action left is a service (src/lib/services/players.ts).
      admin({
        defaultRole: "player",
        adminRoles: ["admin"],
        bannedUserMessage: "Ton compte est désactivé. Contacte l'admin.",
      }),
      ...(portail
        ? [
            genericOAuth({
              config: [
                {
                  providerId: PORTAIL_PROVIDER_ID,
                  discoveryUrl: `${portail.issuer}/.well-known/openid-configuration`,
                  clientId: portail.clientId,
                  clientSecret: portail.clientSecret,
                  scopes: PORTAIL_SCOPES,
                  pkce: true,
                  authentication: "basic" as const,
                  // Without verifiable keys, the provider is left out rather than trusted.
                  requireIdTokenVerification: true,
                  mapProfileToUser: async (profile) => ({
                    name: await startingDisplayName(db, profile.name, profile.email),
                  }),
                },
              ],
            }),
          ]
        : []),
      // Lets Server Actions set cookies. Must stay the last plugin.
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

async function hasPortail(auth: Auth): Promise<boolean> {
  const { socialProviders } = await auth.$context;
  return socialProviders.some(({ id }) => id === PORTAIL_PROVIDER_ID);
}

/**
 * The instance of a process, created on first use. A failed discovery leaves the provider out for
 * the whole life of an instance: `getWithPortail` builds a new one, at most every 30 seconds. The
 * pages do not go through it: the sessions already open keep working (contract §3.1).
 */
export function createAuthHolder(build: () => Auth) {
  let instance: Auth | undefined;
  let lastRetry = Number.NEGATIVE_INFINITY;

  function get(): Auth {
    instance ??= build();
    return instance;
  }

  /** The instance with a working provider, or null: portal out of reach, or none in this environment. */
  async function getWithPortail(now: number = Date.now()): Promise<Auth | null> {
    if (await hasPortail(get())) return get();
    if (now - lastRetry < DISCOVERY_RETRY_MS) return null;
    lastRetry = now;
    const fresh = build();
    if (!(await hasPortail(fresh))) return null;
    instance = fresh;
    return fresh;
  }

  return { get, getWithPortail };
}

const holder = createAuthHolder(() => createAuth(getDb()));

/**
 * The application's instance, created on first use rather than at import: `next build` loads
 * this module, and must not open the database (PGlite in end-to-end tests).
 */
export const getAuth = holder.get;

/** For the sign-in flow and the sign-out, which need the portal; see {@link createAuthHolder}. */
export const getPortailAuth = holder.getWithPortail;
