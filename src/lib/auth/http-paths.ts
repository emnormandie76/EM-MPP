// Better Auth routes open over HTTP (decision of 30/09/2026). Every other route answers 404, in
// particular the admin plugin routes (/admin/*) and /update-user: they would bypass the rules of
// the services (last admin, unique name, never delete an account with predictions).
// Server-side calls (auth.api.*) are not affected.

export const AUTH_BASE_PATH = "/api/auth";

/** Sign-in and sign-up go through HTTP so that the attempt limits apply (§6.1). */
export const OPEN_AUTH_PATHS: readonly string[] = ["/sign-in/email", "/sign-up/email", "/get-session"];

export function isOpenAuthPath(pathname: string): boolean {
  if (!pathname.startsWith(`${AUTH_BASE_PATH}/`)) return false;
  return OPEN_AUTH_PATHS.includes(pathname.slice(AUTH_BASE_PATH.length));
}
