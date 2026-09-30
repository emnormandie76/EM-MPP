import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { isPublicPath } from "@/lib/auth/public-paths";

// Quick redirection to /connexion without a session cookie (architecture §6.4). Not a security
// check: the cookie is not verified here. The layouts and every action check the session.
export function proxy(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname) || getSessionCookie(request)) return NextResponse.next();
  return NextResponse.redirect(new URL("/connexion", request.url));
}

export const config = {
  // Everything but the build files and the files served as they are.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt).*)"],
};
