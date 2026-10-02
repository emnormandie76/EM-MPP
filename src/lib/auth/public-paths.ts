// Addresses reachable without a session cookie (architecture §6.4). Static files are left out by
// the matcher of src/proxy.ts. /api/chat checks the session itself and answers 401 in JSON: a
// redirection makes no sense for the `fetch` of the chat page (step 8d).

const PUBLIC_PREFIXES = ["/connexion", "/inscription", "/api/auth", "/api/health", "/api/chat"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
