import { JOKERS_PER_SEASON } from "@/lib/game/constants";

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
  // Back office (§5.11, step 5).
  CATEGORY_NAME_TAKEN: "Cette catégorie existe déjà.",
  CATEGORY_ARCHIVED: "Cette catégorie est archivée : choisis-en une autre.",
  QUESTION_LOCKED: "Des pronos existent : ce champ ne peut plus changer. Pour le modifier, annule la question et crée une nouvelle question.",
  QUESTION_CLOSED: "La question est clôturée : seuls la catégorie, l'aide et la date de résultat prévue peuvent encore changer.",
  QUESTION_CANCELLED: "Cette question est annulée : elle ne peut plus être modifiée.",
  NOT_DELETABLE: "Seul un brouillon sans prono peut être supprimé. Annule plutôt la question.",
  NOT_CANCELLABLE: "Un brouillon ne s'annule pas : supprime-le.",
  ALREADY_CANCELLED: "Cette question est déjà annulée.",
  NOT_PUBLISHABLE: "La question ne peut pas être publiée.",
  RESULT_TOO_EARLY: "Le résultat se saisit une fois la question clôturée.",
  INVALID_VALUE: "Saisis un nombre.",
  INVALID_OPTION: "Réponse inconnue.",
  SEASON_PROCLAIMED: "Cette saison est proclamée : ses lots ne peuvent plus changer.",
  // Seasons created by the admin (§5.13, step 5b).
  NO_SEASON: "Aucune saison ne couvre cette date de clôture : crée d'abord la saison dans Saisons et lots.",
  SEASON_NAME_TAKEN: "Cette saison existe déjà.",
  SEASON_START_TAKEN: "Une saison commence déjà ce jour-là.",
  SEASON_ORDER: "La date de début doit rester entre celle de la saison précédente et celle de la suivante.",
  SEASON_CHANGE_REFUSED: "Des questions changeraient de saison alors qu'elles ne le peuvent plus.",
  SEASON_HAS_QUESTIONS: "Des questions sont rattachées à cette saison : elle ne peut pas être supprimée.",
  // Proclamation (§5.12, step 7).
  ALREADY_PROCLAIMED: "Le classement final de cette saison est déjà proclamé.",
  NOT_PROCLAIMABLE: "Toutes les questions publiées de la saison doivent être résolues avant la proclamation.",
  CLOSING_IN_PROCLAIMED_SEASON:
    "Cette date de clôture tombe dans une saison déjà proclamée : crée d'abord la saison suivante dans Saisons et lots.",
  // Predictions (§5.4, step 6).
  QUESTION_NOT_OPEN: "Cette question n'est pas ouverte aux pronos.",
  ALREADY_VALIDATED: "Ton prono est validé : il ne peut plus être modifié.",
  NO_PREDICTION: "Enregistre d'abord ton prono.",
  NO_JOKER_LEFT: `Tu as déjà utilisé tes ${JOKERS_PER_SEASON} jokers cette saison.`,
  NOT_VALIDATED: "Ce prono n'est pas validé.",
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
