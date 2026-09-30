// Shared types of the write services (architecture §7.1). Services never throw for an expected
// refusal: they return a Result whose message is shown as is in the interface.

export type Role = "player" | "admin";

/** Who performs the action, read from the session by the Server Action. */
export type Actor = { id: string; role: Role; banned: boolean };

export const ERROR_MESSAGES = {
  NOT_AUTHENTICATED: "Ta session a expiré, reconnecte-toi.",
  FORBIDDEN: "Tu n'as pas accès à cette action.",
  ACCOUNT_DISABLED: "Ton compte est désactivé. Contacte l'admin.",
  INVALID_INPUT: "Vérifie les informations saisies.",
  NOT_FOUND: "Ce compte n'existe pas.",
  NAME_TAKEN: "Ce nom est déjà pris.",
  SELF_TARGET: "Tu ne peux pas faire cette action sur ton propre compte.",
  LAST_ADMIN: "Il doit toujours rester au moins un admin.",
  EMAIL_HAS_ACCOUNT: "Un compte existe avec cette adresse : désactive le compte plutôt que de retirer l'adresse.",
  EMAIL_NOT_LISTED: "Cette adresse n'est pas sur la liste.",
  ANONYMIZED: "Ce compte est anonymisé : il ne peut plus être modifié.",
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export type Result<T = void> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; message: string; fieldErrors?: Record<string, string> };

export function ok(): Result<void>;
export function ok<T>(data: T): Result<T>;
export function ok<T>(data?: T): Result<T | undefined> {
  return { ok: true, data };
}

export function fail(code: ErrorCode, message: string = ERROR_MESSAGES[code], fieldErrors?: Record<string, string>) {
  return { ok: false as const, code, message, ...(fieldErrors ? { fieldErrors } : {}) };
}

export type Failure = ReturnType<typeof fail>;

export function isFailure(value: unknown): value is Failure {
  return typeof value === "object" && value !== null && (value as { ok?: unknown }).ok === false;
}

/**
 * Checks the actor (§6.4, §6.5): signed in, not disabled and, when `admin` is set, admin.
 * Returns the actor, or the refusal.
 */
export function authorize(actor: Actor | null, { admin = false }: { admin?: boolean } = {}): Actor | Failure {
  if (!actor) return fail("NOT_AUTHENTICATED");
  if (actor.banned) return fail("ACCOUNT_DISABLED");
  if (admin && actor.role !== "admin") return fail("FORBIDDEN");
  return actor;
}

/** The first message of each invalid field, keyed by field name. */
export function fieldErrorsOf(issues: readonly { path: readonly PropertyKey[]; message: string }[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? "form");
    errors[field] ??= issue.message;
  }
  return errors;
}
