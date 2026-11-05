// Better Auth routes open over HTTP (decision of 30/09/2026). Every other route answers 404, in
// particular the admin plugin routes (/admin/*) and /update-user: they would bypass the rules of
// the services (unique name, never delete an account with predictions).
// Server-side calls (auth.api.*) are not affected.

export const AUTH_BASE_PATH = "/api/auth";

/** The two routes of the sign-in flow: they need the portal's provider (§6.2). */
const PORTAIL_FLOW_PATHS: readonly string[] = ["/sign-in/social", "/callback/portail"];

/** Sign-in goes through HTTP so that the attempt limit applies (§6.1). */
export const OPEN_AUTH_PATHS: readonly string[] = [...PORTAIL_FLOW_PATHS, "/get-session"];

function authPath(pathname: string): string | null {
  return pathname.startsWith(`${AUTH_BASE_PATH}/`) ? pathname.slice(AUTH_BASE_PATH.length) : null;
}

export function isOpenAuthPath(pathname: string): boolean {
  return OPEN_AUTH_PATHS.includes(authPath(pathname) ?? "");
}

export function isPortailFlowPath(pathname: string): boolean {
  return PORTAIL_FLOW_PATHS.includes(authPath(pathname) ?? "");
}

export function isPortailCallbackPath(pathname: string): boolean {
  return authPath(pathname) === "/callback/portail";
}
