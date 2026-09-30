"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/auth";
import { getActor } from "@/lib/auth/session";
import { authorize, fail, isFailure, ok, type Result } from "@/lib/services/result";
import { MESSAGES, passwordSchema } from "@/lib/validation/account";

// Sign-out and password change go through Better Auth, called on the server (§6.1).

export async function signOutAction(): Promise<void> {
  try {
    await getAuth().api.signOut({ headers: await headers() });
  } catch (error) {
    // Already signed out (session revoked): the cookie is cleared all the same.
    if (!isAPIError(error)) throw error;
  }
  redirect("/connexion");
}

/** Changes the password of the signed-in account and revokes its other sessions. */
export async function changePasswordAction(_: unknown, formData: FormData): Promise<Result> {
  const me = authorize(await getActor());
  if (isFailure(me)) return me;

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = passwordSchema.safeParse(String(formData.get("newPassword") ?? ""));
  if (!currentPassword) return fail("INVALID_INPUT", undefined, { currentPassword: "Saisis ton mot de passe actuel." });
  if (!newPassword.success) return fail("INVALID_INPUT", undefined, { newPassword: MESSAGES.passwordLength });
  if (formData.get("confirmPassword") !== newPassword.data) {
    return fail("INVALID_INPUT", undefined, { confirmPassword: MESSAGES.passwordMismatch });
  }

  const requestHeaders = await headers();
  try {
    await getAuth().api.changePassword({
      body: { currentPassword, newPassword: newPassword.data, revokeOtherSessions: false },
      headers: requestHeaders,
    });
  } catch (error) {
    if (isAPIError(error) && error.body?.code === "INVALID_PASSWORD") {
      return fail("INVALID_INPUT", undefined, { currentPassword: "Mot de passe actuel incorrect." });
    }
    throw error;
  }
  // The other sessions are closed, the current one is kept: with `revokeOtherSessions: true`,
  // Better Auth would replace it, and the page, rendered again with the old cookie, would find
  // no session.
  await getAuth().api.revokeOtherSessions({ headers: requestHeaders });
  return ok();
}
