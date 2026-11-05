"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth, getPortailAuth } from "@/lib/auth/auth";
import { SIGN_IN_PATH } from "@/lib/auth/portail";

/**
 * Closes the session here, then on the portal (contract §3.8): Better Auth builds the address of its
 * end_session_endpoint. Without one (portal out of reach, session already gone), back to /connexion.
 */
export async function signOutAction(): Promise<void> {
  const auth = (await getPortailAuth()) ?? getAuth();
  let portailLogout: string | undefined;
  try {
    const result = await auth.api.signOut({
      headers: await headers(),
      body: { callbackURL: SIGN_IN_PATH, disableRedirect: true },
    });
    portailLogout = result.url;
  } catch (error) {
    // Already signed out (session revoked): the cookie is cleared all the same.
    if (!isAPIError(error)) throw error;
  }
  redirect(portailLogout ?? SIGN_IN_PATH);
}
