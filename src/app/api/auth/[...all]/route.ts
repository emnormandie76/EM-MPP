import { authBaseUrl, getAuth, getPortailAuth } from "@/lib/auth/auth";
import { isOpenAuthPath, isPortailCallbackPath, isPortailFlowPath } from "@/lib/auth/http-paths";
import { SIGN_IN_PATH } from "@/lib/auth/portail";

// Better Auth over HTTP (architecture §6.1), limited to the routes the interface uses.
export const dynamic = "force-dynamic";

/** The portal is out of reach: the flow stops here, and the sessions already open keep working. */
function portailUnavailable(pathname: string): Response {
  if (isPortailCallbackPath(pathname)) {
    return Response.redirect(`${authBaseUrl()}${SIGN_IN_PATH}?error=portail_unavailable`, 302);
  }
  return Response.json({ code: "PORTAIL_UNAVAILABLE" }, { status: 503 });
}

async function handle(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (!isOpenAuthPath(pathname)) return new Response("Not Found", { status: 404 });
  if (!isPortailFlowPath(pathname)) return getAuth().handler(request);
  const auth = await getPortailAuth();
  return auth ? auth.handler(request) : portailUnavailable(pathname);
}

export const GET = handle;
export const POST = handle;
