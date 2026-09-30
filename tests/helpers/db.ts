import type { Database } from "@/lib/db/client";
import { openPglite } from "../../scripts/lib/db";

/** In-memory PGlite with every migration applied (architecture §7.2, §9.2). */
export async function createTestDb(): Promise<{ db: Database; close: () => Promise<void> }> {
  const target = await openPglite();
  await target.migrate();
  return { db: target.db, close: target.close };
}
