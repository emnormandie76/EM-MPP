import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import type { Database } from "../../src/lib/db/client";
import * as schema from "../../src/lib/db/schema";

/** Database opened by a script (migrate, check-db, e2e-prepare) or by a test. */
export type ScriptDb = {
  db: Database;
  /** Where the database lives, without credentials: host name or PGlite folder. */
  location: string;
  migrate(): Promise<void>;
  close(): Promise<void>;
};

export const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../drizzle", import.meta.url));

/** PGlite in `dir`, or in memory when `dir` is undefined. */
export async function openPglite(dir?: string): Promise<ScriptDb> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(dir);
  const db = drizzle({ client, schema });
  return {
    db,
    location: dir ? `PGlite (${dir})` : "PGlite (en mémoire)",
    migrate: () => migrate(db, { migrationsFolder: MIGRATIONS_FOLDER }),
    close: () => client.close(),
  };
}

/**
 * A single connection to `connectionString`: TCP through node-postgres, or WebSocket on port 443
 * when `DB_DRIVER=neon-ws` (local networks that block port 5432).
 */
export async function openPostgres(connectionString: string): Promise<ScriptDb> {
  if (process.env.DB_DRIVER === "neon-ws") return openNeonWebSocket(connectionString);
  const { Client } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const client = new Client({ connectionString });
  await client.connect();
  const db = drizzle({ client, schema });
  return {
    db,
    location: hostOf(connectionString),
    migrate: () => migrate(db, { migrationsFolder: MIGRATIONS_FOLDER }),
    close: () => client.end(),
  };
}

async function openNeonWebSocket(connectionString: string): Promise<ScriptDb> {
  const { Client } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-serverless");
  const { migrate } = await import("drizzle-orm/neon-serverless/migrator");
  const client = new Client({ connectionString });
  await client.connect();
  const db = drizzle({ client, schema });
  return {
    db,
    location: `${hostOf(connectionString)}, WebSocket`,
    migrate: () => migrate(db, { migrationsFolder: MIGRATIONS_FOLDER }),
    close: () => client.end(),
  };
}

/** The database targeted by the environment: PGlite for tests, else the direct Neon connection (§3.4). */
export async function openScriptDb(): Promise<ScriptDb> {
  if (process.env.DB_DRIVER === "pglite") return openPglite(process.env.PGLITE_DIR || undefined);
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL_UNPOOLED et DATABASE_URL sont absentes. Lance `vercel env pull .env.local`.");
  }
  return openPostgres(url);
}

export function hostOf(connectionString: string): string {
  try {
    return new URL(connectionString).hostname || "hôte inconnu";
  } catch {
    return "hôte inconnu";
  }
}

/** Error message with any connection string masked, safe for logs. */
export function safeMessage(error: unknown): string {
  return describe(error).replace(/postgres(ql)?:\/\/\S+/gi, "<URL masquée>");
}

function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const code = (error as { code?: unknown }).code;
  const text = [typeof code === "string" ? code : undefined, error.message].filter(Boolean).join(" ") || error.name;
  // Network failures (one attempt per address) arrive as an AggregateError with an empty message.
  const causes = error instanceof AggregateError ? error.errors : error.cause ? [error.cause] : [];
  return causes.length > 0 ? `${text} (${causes.map(describe).join(" ; ")})` : text;
}

async function rows<T>(db: Database, query: ReturnType<typeof sql>): Promise<T[]> {
  // Both drivers return an object with `rows`.
  const result = (await db.execute(query)) as unknown as { rows: T[] };
  return result.rows;
}

async function tableExists(db: Database, qualifiedName: string): Promise<boolean> {
  const [row] = await rows<{ exists: boolean }>(db, sql`select to_regclass(${qualifiedName}) is not null as exists`);
  return row.exists;
}

export async function countAppliedMigrations(db: Database): Promise<number> {
  if (!(await tableExists(db, "drizzle.__drizzle_migrations"))) return 0;
  const [row] = await rows<{ count: number }>(db, sql`select count(*)::int as count from drizzle.__drizzle_migrations`);
  return row.count;
}

/** Marks the production database: seeding it is then refused for good (§3.4, §9.6). */
export async function markAsProduction(db: Database): Promise<void> {
  await db
    .insert(schema.appMeta)
    .values({ key: "environment", value: "production" })
    .onConflictDoUpdate({ target: schema.appMeta.key, set: { value: "production" } });
}

export async function isMarkedAsProduction(db: Database): Promise<boolean> {
  if (!(await tableExists(db, "public.app_meta"))) return false;
  const [row] = await rows<{ value: string | null }>(db, sql`select value from app_meta where key = 'environment'`);
  return row?.value === "production";
}
