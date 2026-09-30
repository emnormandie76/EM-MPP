import { getAuth } from "@/lib/auth/auth";
import { isOpenAuthPath } from "@/lib/auth/http-paths";

// Better Auth over HTTP (architecture §6.1), limited to the routes the interface uses.
export const dynamic = "force-dynamic";

async function handle(request: Request): Promise<Response> {
  if (!isOpenAuthPath(new URL(request.url).pathname)) return new Response("Not Found", { status: 404 });
  return getAuth().handler(request);
}

export const GET = handle;
export const POST = handle;
