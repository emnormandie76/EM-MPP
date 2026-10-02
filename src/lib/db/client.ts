import { createRequire } from "node:module";
import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import * as schema from "./schema";

/** Common base of the node-postgres (Neon), Neon WebSocket (local) and PGlite (tests) databases (§7.2). */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

// One instance per process, kept on globalThis: Next.js bundles the route handlers and the pages
// separately, each with its own copy of this module. Two PGlite instances on the same folder
// would not see each other's writes (a session created by /api/auth, unknown to the pages).
const shared = globalThis as typeof globalThis & { appDb?: Database };

/**
 * Singleton database, chosen by `DB_DRIVER`:
 * - unset: Neon through node-postgres (Vercel, production);
 * - `neon-ws`: Neon over WebSocket on port 443, locally only, on networks that block port 5432;
 * - `pglite`: PGlite (tests).
 */
export function getDb(): Database {
  shared.appDb ??= createDb(process.env.DB_DRIVER);
  return shared.appDb;
}

function createDb(driver: string | undefined): Database {
  if (!driver) return createNeonDb();
  if (driver === "neon-ws") return createNeonWebSocketDb();
  if (driver === "pglite") return createPgliteDb();
  throw new Error(`Unknown DB_DRIVER: ${driver}`);
}

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return url;
}

function createNeonDb(): Database {
  const pool = new Pool({ connectionString: databaseUrl() });
  // On Vercel, keeps the function alive until idle connections are closed (§14).
  attachDatabasePool(pool);
  return drizzle({ client: pool, schema });
}

// The two drivers below are required lazily: they are dev dependencies, never loaded in production.

function createNeonWebSocketDb(): Database {
  const require = createRequire(import.meta.url);
  const { Pool: NeonPool } = require("@neondatabase/serverless") as typeof import("@neondatabase/serverless");
  const neon = require("drizzle-orm/neon-serverless") as typeof import("drizzle-orm/neon-serverless");
  return neon.drizzle({ client: new NeonPool({ connectionString: databaseUrl() }), schema });
}

function createPgliteDb(): Database {
  const require = createRequire(import.meta.url);
  const { PGlite } = require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
  const pglite = require("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");
  return pglite.drizzle({ client: new PGlite(process.env.PGLITE_DIR || undefined), schema });
}
