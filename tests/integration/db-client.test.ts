import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/db/client";
import { appMeta } from "@/lib/db/schema";
import { createTestDb } from "../helpers/db";

async function selectOne(db: Database): Promise<unknown> {
  const result = (await db.execute(sql`select 1 as one`)) as unknown as { rows: unknown[] };
  return result.rows;
}

describe("createTestDb", () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>;

  beforeAll(async () => {
    testDb = await createTestDb();
  });

  afterAll(async () => {
    await testDb.close();
  });

  it("answers select 1", async () => {
    expect(await selectOne(testDb.db)).toEqual([{ one: 1 }]);
  });

  it("applies the migrations", async () => {
    await testDb.db.insert(appMeta).values({ key: "test", value: "ok" });
    expect(await testDb.db.select().from(appMeta)).toEqual([{ key: "test", value: "ok" }]);
  });
});

describe("getDb", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    // The singleton lives on globalThis (see client.ts): each test starts without it.
    delete (globalThis as { appDb?: unknown }).appDb;
  });

  it("uses an in-memory PGlite when DB_DRIVER=pglite, always the same instance", async () => {
    vi.stubEnv("DB_DRIVER", "pglite");
    vi.stubEnv("PGLITE_DIR", "");
    const { getDb } = await import("@/lib/db/client");

    const db = getDb();
    expect(getDb()).toBe(db);
    expect(await selectOne(db)).toEqual([{ one: 1 }]);
    await (db as unknown as { $client: { close(): Promise<void> } }).$client.close();
  });

  it("shares one instance between two copies of the module, as Next.js bundles routes and pages apart", async () => {
    vi.stubEnv("DB_DRIVER", "pglite");
    vi.stubEnv("PGLITE_DIR", "");
    const first = (await import("@/lib/db/client")).getDb();
    vi.resetModules();
    const second = (await import("@/lib/db/client")).getDb();

    expect(second).toBe(first);
    await (first as unknown as { $client: { close(): Promise<void> } }).$client.close();
  });

  it.each(["", "neon-ws"])("refuses to start without DATABASE_URL (DB_DRIVER=%j)", async (driver) => {
    vi.stubEnv("DB_DRIVER", driver);
    vi.stubEnv("DATABASE_URL", "");
    const { getDb } = await import("@/lib/db/client");

    expect(() => getDb()).toThrow("DATABASE_URL is not set");
  });

  it("creates the local WebSocket database without connecting yet", async () => {
    vi.stubEnv("DB_DRIVER", "neon-ws");
    vi.stubEnv("DATABASE_URL", "postgresql://user:password@ep-test.example.test/db?sslmode=require");
    const { getDb } = await import("@/lib/db/client");

    expect(getDb()).toBe(getDb());
  });

  it("rejects an unknown DB_DRIVER", async () => {
    vi.stubEnv("DB_DRIVER", "sqlite");
    const { getDb } = await import("@/lib/db/client");

    expect(() => getDb()).toThrow("Unknown DB_DRIVER: sqlite");
  });
});
