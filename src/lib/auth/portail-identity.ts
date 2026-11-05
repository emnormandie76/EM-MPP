import type { BetterAuthOptions, BetterAuthPlugin, GenericEndpointContext, User } from "better-auth";
import type { Database } from "@/lib/db/client";
import { isAnonymized, isDisplayNameTaken } from "@/lib/services/users";
import { DISPLAY_NAME_MAX, DISPLAY_NAME_MIN } from "@/lib/validation/account";
import { isRole, PORTAIL_PROVIDER_ID } from "./portail";

// What the code of MPPlike adds to Better Auth at each sign-in (architecture §6.2, contract §3.2).

type ValidateUserInfo = NonNullable<NonNullable<BetterAuthOptions["user"]>["validateUserInfo"]>;

/** Logged without any address (§10), and sent back as `?error=<code>` to /connexion. */
function refuse(code: string, details: Record<string, unknown>) {
  console.error(`[portail] ${code}`, details);
  return { error: code };
}

/**
 * Refusals, before anything is written. Better Auth calls this when it is about to create an
 * account, to link one, or to sign one in again, with the claims of the verified id token.
 */
export function portailUserValidator(issuer: string): ValidateUserInfo {
  return async ({ user, source }, ctx) => {
    if (source.oauth?.providerId !== PORTAIL_PROVIDER_ID) return;
    const profile = source.oauth.profile ?? {};
    const userId = user.id;

    // The plugin compares `iss` with the discovery; the contract compares it with PORTAIL_ISSUER.
    // A token answer without an id token reaches this check too, unverified: it has no `iss`.
    if (profile.iss !== issuer) return refuse("issuer_mismatch", { userId });
    if (!isRole(profile.role)) return refuse("role_not_allowed", { userId });
    if (source.action === "create-user" || !userId) return;

    const { internalAdapter } = ctx.context;
    if (source.action === "link-account") {
      // Found by its address, but already linked to someone else: a reassigned address. Left
      // alone, Better Auth would link a second portail account.
      const accounts = await internalAdapter.findAccounts(userId);
      if (accounts.some(({ providerId }) => providerId === PORTAIL_PROVIDER_ID)) {
        return refuse("address_reassigned", { userId, sub: profile.sub });
      }
      return;
    }

    const local = await internalAdapter.findUserById(userId);
    if (local && isAnonymized(local)) return refuse("account_anonymized", { userId });
    const owner = user.email ? await internalAdapter.findUserByEmail(user.email.toLowerCase()) : null;
    if (owner && owner.user.id !== userId) return refuse("address_taken", { userId });
  };
}

function idTokenClaims(idToken: string): Record<string, unknown> | null {
  try {
    return JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Copies the role and the address at each sign-in, and lifts a disabling from before the portal,
 * which has judged the access (D3, D4). Better Auth ignores `role`, and its `overrideUserInfo` would
 * rewrite the display name too. No hook receives both the token and a new account's id: the claims
 * come from `account.id_token`, written in this same request and already verified.
 */
async function copyPortailIdentity(userId: string, ctx: GenericEndpointContext | null): Promise<void> {
  if (!ctx) return;
  const { internalAdapter } = ctx.context;
  const accounts = await internalAdapter.findAccounts(userId);
  const idToken = accounts.find(({ providerId }) => providerId === PORTAIL_PROVIDER_ID)?.idToken;
  const claims = idToken ? idTokenClaims(idToken) : null;
  if (!claims || !isRole(claims.role) || typeof claims.email !== "string") return;

  const local = (await internalAdapter.findUserById(userId)) as (User & { banned?: boolean | null }) | null;
  if (!local) return;
  const lift = local.banned === true && !isAnonymized(local);
  await internalAdapter.updateUser(userId, {
    role: claims.role,
    email: claims.email,
    ...(lift ? { banned: false, banReason: null, banExpires: null } : {}),
  });
}

/**
 * Carries the hook above. Better Auth runs the hooks of the plugins first, in their order, and those
 * of its options last: as a plugin placed before `admin`, this one lifts a disabling before the admin
 * plugin refuses an account that is still banned.
 */
export function portailIdentity(): BetterAuthPlugin {
  return {
    id: "portail-identity",
    init: () => ({
      options: {
        databaseHooks: {
          session: {
            create: {
              async before(session, ctx) {
                await copyPortailIdentity(session.userId, ctx);
              },
            },
          },
        },
      },
    }),
  };
}

function truncate(value: string, max: number): string {
  let text = "";
  for (const character of value) {
    if (text.length + character.length > max) break;
    text += character;
  }
  return text.trimEnd();
}

/**
 * The display name of a new account (D3): the portal's name, cut to 30 characters and made unique
 * whatever the case (« Prénom 2 »). It is computed before the transaction that creates the account:
 * a query outside that transaction would block PGlite, which has a single connection.
 */
export async function startingDisplayName(db: Database, name: unknown, email: unknown): Promise<string> {
  const fromName = typeof name === "string" ? name.trim() : "";
  const fromEmail = typeof email === "string" ? email.split("@")[0].trim() : "";
  const base = [fromName, fromEmail].find((value) => value.length >= DISPLAY_NAME_MIN) ?? "Joueur";

  for (let n = 1; ; n += 1) {
    const suffix = n === 1 ? "" : ` ${n}`;
    const candidate = `${truncate(base, DISPLAY_NAME_MAX - suffix.length)}${suffix}`;
    if (!(await isDisplayNameTaken(db, candidate))) return candidate;
  }
}
