// Addresses reachable without a session (architecture §6.4). Static files are left out by the
// matcher of src/proxy.ts.

const PUBLIC_PREFIXES = ["/connexion", "/inscription", "/api/auth", "/api/health"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
