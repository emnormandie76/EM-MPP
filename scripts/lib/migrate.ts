import { countAppliedMigrations, isMarkedAsProduction, markAsProduction, type ScriptDb } from "./db";

export type MigrationReport = { applied: number; total: number; markedAsProduction: boolean };

/**
 * Applies pending migrations (architecture §3.4). On the Vercel production environment, then marks
 * the database as the production one, which forbids seeding it for good. Anywhere else, a database
 * marked as production is refused: a wrong preview variable must not migrate it (D21).
 */
export async function runMigrations(target: ScriptDb, env: Record<string, string | undefined>): Promise<MigrationReport> {
  if (env.VERCEL_ENV !== "production" && (await isMarkedAsProduction(target.db))) {
    throw new Error("Migration refusée : cette base est celle de production, et cet environnement ne l'est pas.");
  }
  const before = await countAppliedMigrations(target.db);
  await target.migrate();
  const total = await countAppliedMigrations(target.db);
  const markedAsProduction = env.VERCEL_ENV === "production";
  if (markedAsProduction) await markAsProduction(target.db);
  return { applied: total - before, total, markedAsProduction };
}
