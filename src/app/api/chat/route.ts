import type { NextRequest } from "next/server";
import { getViewer } from "@/lib/auth/session";
import { getChatUpdates } from "@/lib/data/chat";
import { getDb } from "@/lib/db/client";

// New chat messages and deletions since the previous poll of the chat page (architecture §5.15):
// `GET /api/chat?after=<id>&since=<ISO date>`. Read only: marking as read is a Server Action. The
// proxy lets it through without a session cookie, so that it answers 401 in JSON instead of
// redirecting a `fetch` call.
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function error(code: "NOT_AUTHENTICATED" | "INVALID_INPUT", status: number): Response {
  return Response.json({ error: code }, { status, headers: NO_STORE });
}

export async function GET(request: NextRequest): Promise<Response> {
  // getViewer reads the request headers first (§6.4).
  const viewer = await getViewer();
  if (!viewer || viewer.banned) return error("NOT_AUTHENTICATED", 401);

  const params = request.nextUrl.searchParams;
  const after = params.get("after") ?? "";
  const since = new Date(params.get("since") ?? "");
  if (!/^\d{1,10}$/.test(after) || Number.isNaN(since.getTime())) return error("INVALID_INPUT", 400);

  const updates = await getChatUpdates(getDb(), viewer, { afterId: Number(after), since }, new Date());
  return Response.json(updates, { headers: NO_STORE });
}
