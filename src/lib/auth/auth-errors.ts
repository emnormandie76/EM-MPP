import { ERROR_MESSAGES } from "@/lib/services/result";
import { MESSAGES } from "@/lib/validation/account";
import type { SignUpErrorCode } from "./sign-up";

// French messages for the errors Better Auth returns to the sign-in and sign-up forms (§8.3).

export type AuthError = { status: number; code?: string; message?: string };
export type FormError = { field?: "email" | "name" | "password"; message: string };

export const UNEXPECTED_ERROR = "Une erreur est survenue. Réessaie.";

export function signInError(error: AuthError): FormError {
  if (error.status === 429) return { message: "Trop de tentatives. Réessaie dans une minute." };
  if (error.code === "BANNED_USER") return { message: ERROR_MESSAGES.ACCOUNT_DISABLED };
  if (error.status === 0 || error.status >= 500) return { message: UNEXPECTED_ERROR };
  return { message: "Email ou mot de passe incorrect." };
}

const SIGN_UP_FIELDS: Record<SignUpErrorCode, FormError["field"]> = {
  INVALID_EMAIL: "email",
  ACCOUNT_EXISTS: "email",
  EMAIL_NOT_ALLOWED: "email",
  INVALID_NAME: "name",
  NAME_TAKEN: "name",
};

function isSignUpErrorCode(code: string): code is SignUpErrorCode {
  return Object.hasOwn(SIGN_UP_FIELDS, code);
}

export function signUpError(error: AuthError): FormError {
  if (error.status === 429) return { message: "Trop de tentatives. Réessaie dans quelques minutes." };
  const code = error.code ?? "";
  // Our own checks (src/lib/auth/sign-up.ts) already answer in French.
  if (isSignUpErrorCode(code) && error.message) return { field: SIGN_UP_FIELDS[code], message: error.message };
  if (code === "PASSWORD_TOO_SHORT" || code === "PASSWORD_TOO_LONG") {
    return { field: "password", message: MESSAGES.passwordLength };
  }
  if (code.startsWith("USER_ALREADY_EXISTS")) return { field: "email", message: MESSAGES.accountExists };
  return { message: UNEXPECTED_ERROR };
}
