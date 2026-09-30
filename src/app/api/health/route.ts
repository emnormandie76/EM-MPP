import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";

// Public database check (architecture §10): answers only `{ ok: true }` or `{ ok: false }`.
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(): Promise<Response> {
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ ok: true }, { headers: NO_STORE });
  } catch (error) {
    console.error("HEALTH_DB_UNAVAILABLE", error instanceof Error ? error.name : "unknown");
    return Response.json({ ok: false }, { status: 503, headers: NO_STORE });
  }
}
