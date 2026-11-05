import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { COOKIE_PREFIX, SIGN_IN_AUTO_PATH } from "@/lib/auth/portail";
import { isPublicPath } from "@/lib/auth/public-paths";

// Quick redirection to the sign-in without a session cookie (architecture §6.4). Not a security
// check: the cookie is not verified here. The layouts and every action check the session.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname) || getSessionCookie(request, { cookiePrefix: COOKIE_PREFIX })) return NextResponse.next();
  return NextResponse.redirect(new URL(SIGN_IN_AUTO_PATH, request.url));
}

export const config = {
  // Everything but the build files and the files served as they are.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt).*)"],
};
