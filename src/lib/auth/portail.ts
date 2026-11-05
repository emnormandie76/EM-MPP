// What the proxy, the pages and Better Auth share about the portal (architecture §6.2, contract
// portal v1). No dependency here: src/proxy.ts imports this module, and does not load Better Auth.
// The portal's address is never written in the code: it comes from PORTAIL_ISSUER.

export const PORTAIL_PROVIDER_ID = "portail";

/** The scopes of the contract: `offline_access` is refused by the portal. */
export const PORTAIL_SCOPES = ["openid", "profile", "email"];

/** Keeps the cookies apart from any other Better Auth application of the workstation (D6). */
export const COOKIE_PREFIX = "mpplike";

/** Where a sign-out and an error lead: the flow never starts by itself there (D20). */
export const SIGN_IN_PATH = "/connexion";

/** Where a visitor without a session is sent: the page starts the flow by itself (D20). */
export const SIGN_IN_AUTO_PATH = "/connexion?auto=1";

/** The roles declared to the portal, written exactly as it sends them. */
export const ROLES = ["player", "admin"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return ROLES.includes(value as Role);
}

type Env = Record<string, string | undefined>;

/** PORTAIL_ISSUER without spaces or a trailing slash, as the contract writes it; null if absent. */
export function portailIssuer(env: Env = process.env): string | null {
  return env.PORTAIL_ISSUER?.trim().replace(/\/+$/, "") || null;
}

export type PortailClient = { issuer: string; clientId: string; clientSecret: string };

/**
 * The client of this environment, or null: only the production, the recette branch and the
 * workstation have one. Any other preview has no sign-in (G12).
 */
export function portailClient(env: Env = process.env): PortailClient | null {
  const issuer = portailIssuer(env);
  const clientId = env.PORTAIL_CLIENT_ID?.trim();
  const clientSecret = env.PORTAIL_CLIENT_SECRET?.trim();
  return issuer && clientId && clientSecret ? { issuer, clientId, clientSecret } : null;
}

/** The home page of the portal: the origin of its issuer, or null. */
export function portailHomeUrl(env: Env = process.env): string | null {
  const issuer = portailIssuer(env);
  if (!issuer) return null;
  try {
    return new URL(issuer).origin;
  } catch {
    return null;
  }
}
