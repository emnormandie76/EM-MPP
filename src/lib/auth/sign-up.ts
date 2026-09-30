import type { Database } from "@/lib/db/client";
import { hasAccount, isAllowedEmail, isDisplayNameTaken } from "@/lib/services/users";
import { displayNameSchema, MESSAGES, parseEmail } from "@/lib/validation/account";

// Sign-up rules (architecture §6.2), checked before Better Auth creates the account.

export type SignUpErrorCode = "INVALID_EMAIL" | "ACCOUNT_EXISTS" | "EMAIL_NOT_ALLOWED" | "INVALID_NAME" | "NAME_TAKEN";

export type SignUpCheck =
  | { ok: true; email: string; name: string }
  | { ok: false; code: SignUpErrorCode; message: string };

/**
 * Normalizes the address (lower case, no surrounding spaces) and the name (trimmed), then checks
 * that the address is on the allow list or in ADMIN_EMAILS, has no account yet, and that the
 * name is valid and free.
 */
export async function checkSignUp(
  db: Database,
  input: { email: unknown; name: unknown },
  adminEmails: readonly string[],
): Promise<SignUpCheck> {
  const email = typeof input.email === "string" ? parseEmail(input.email) : null;
  if (!email) return { ok: false, code: "INVALID_EMAIL", message: MESSAGES.invalidEmail };
  if (await hasAccount(db, email)) return { ok: false, code: "ACCOUNT_EXISTS", message: MESSAGES.accountExists };
  if (!adminEmails.includes(email) && !(await isAllowedEmail(db, email))) {
    return { ok: false, code: "EMAIL_NOT_ALLOWED", message: MESSAGES.notAllowed };
  }

  const name = displayNameSchema.safeParse(input.name);
  if (!name.success) return { ok: false, code: "INVALID_NAME", message: MESSAGES.nameLength };
  if (await isDisplayNameTaken(db, name.data)) return { ok: false, code: "NAME_TAKEN", message: MESSAGES.nameTaken };

  return { ok: true, email, name: name.data };
}
