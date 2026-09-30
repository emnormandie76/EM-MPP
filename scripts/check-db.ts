// Connection check (architecture §3.2): each database URL of .env.local, without printing it.
import { sql } from "drizzle-orm";
import {
  countAppliedMigrations,
  isMarkedAsProduction,
  openPglite,
  openPostgres,
  type ScriptDb,
  safeMessage,
} from "./lib/db";
import { loadLocalEnv } from "./lib/load-env";

const URL_NAMES = ["DATABASE_URL", "DATABASE_URL_UNPOOLED"] as const;

async function probe(label: string, open: () => Promise<ScriptDb>): Promise<boolean> {
  const started = performance.now();
  let target: ScriptDb | undefined;
  try {
    target = await open();
    await target.db.execute(sql`select 1`);
    const ms = Math.round(performance.now() - started);
    const migrations = await countAppliedMigrations(target.db);
    const production = await isMarkedAsProduction(target.db);
    console.log(`  ${label.padEnd(22)} OK (${target.location}, ${ms} ms)`);
    console.log(`  ${"".padEnd(22)} migrations appliquées : ${migrations} ; base de production : ${production ? "oui" : "non"}`);
    return true;
  } catch (error) {
    console.log(`  ${label.padEnd(22)} ÉCHEC : ${safeMessage(error)}`);
    return false;
  } finally {
    await target?.close();
  }
}

async function main(): Promise<void> {
  loadLocalEnv();
  console.log("Connexion à la base :");

  if (process.env.DB_DRIVER === "pglite") {
    if (!(await probe("PGlite", () => openPglite(process.env.PGLITE_DIR || undefined)))) process.exitCode = 1;
    return;
  }

  for (const name of URL_NAMES) {
    const url = process.env[name];
    if (!url) {
      console.log(`  ${name.padEnd(22)} MANQUANTE`);
      process.exitCode = 1;
    } else if (!(await probe(name, () => openPostgres(url)))) {
      process.exitCode = 1;
    }
  }
}

main().catch((error: unknown) => {
  console.error(`Échec du contrôle : ${safeMessage(error)}`);
  process.exit(1);
});
