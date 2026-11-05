import type { Database } from "@/lib/db/client";
import { openPglite } from "../../scripts/lib/db";

export type TestDb = { db: Database; close: () => Promise<void> };

/** In-memory PGlite with every migration applied (architecture §7.2, §9.2). */
export async function createTestDb(): Promise<TestDb> {
  const target = await openPglite();
  await target.migrate();
  return { db: target.db, close: target.close };
}
