import { z } from "zod";

// Account inputs shared by the sign-up hook, the services and the forms (architecture §6.2, §6.3).

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 30;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export const MESSAGES = {
  invalidEmail: "Adresse email invalide.",
  nameLength: `Ton nom doit faire de ${DISPLAY_NAME_MIN} à ${DISPLAY_NAME_MAX} caractères.`,
  nameTaken: "Ce nom est déjà pris.",
  notAllowed: "Cette adresse n'est pas sur la liste des joueurs. Contacte l'admin.",
  accountExists: "Un compte existe déjà avec cette adresse. Connecte-toi.",
  passwordLength: `Le mot de passe doit faire de ${PASSWORD_MIN} à ${PASSWORD_MAX} caractères.`,
  passwordMismatch: "Les deux mots de passe ne correspondent pas.",
} as const;

/** Addresses are compared and stored in lower case, without surrounding spaces. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

const email = z.email();

/** The normalized address, or null if it is not a valid address. */
export function parseEmail(raw: string): string | null {
  const normalized = normalizeEmail(raw);
  return email.safeParse(normalized).success ? normalized : null;
}

/** Display name: 2 to 30 characters once the surrounding spaces are removed. */
export const displayNameSchema = z
  .string(MESSAGES.nameLength)
  .trim()
  .min(DISPLAY_NAME_MIN, MESSAGES.nameLength)
  .max(DISPLAY_NAME_MAX, MESSAGES.nameLength);

export const passwordSchema = z
  .string(MESSAGES.passwordLength)
  .min(PASSWORD_MIN, MESSAGES.passwordLength)
  .max(PASSWORD_MAX, MESSAGES.passwordLength);

/** ADMIN_EMAILS: comma-separated addresses, normalized. */
export function parseAdminEmails(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map(normalizeEmail)
    .filter((item) => item !== "");
}

/** A pasted list of addresses: one per line, commas and semicolons accepted (§6.3). */
export function splitEmailList(text: string): string[] {
  return text
    .split(/[\r\n,;]+/)
    .map((item) => item.trim())
    .filter((item) => item !== "");
}
