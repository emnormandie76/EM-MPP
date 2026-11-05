import { z } from "zod";

// Account inputs shared by the sign-in hooks, the services and the forms (architecture §6.2).

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 30;

export const MESSAGES = {
  nameLength: `Ton nom doit faire de ${DISPLAY_NAME_MIN} à ${DISPLAY_NAME_MAX} caractères.`,
  nameTaken: "Ce nom est déjà pris.",
} as const;

/** Addresses are compared and stored in lower case, without surrounding spaces. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Display name: 2 to 30 characters once the surrounding spaces are removed. */
export const displayNameSchema = z
  .string(MESSAGES.nameLength)
  .trim()
  .min(DISPLAY_NAME_MIN, MESSAGES.nameLength)
  .max(DISPLAY_NAME_MAX, MESSAGES.nameLength);
