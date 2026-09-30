// Applies pending migrations (architecture §3.4): locally with `npm run db:migrate`,
// and on Vercel before `next build` (`npm run build:vercel`).
import { countAppliedMigrations, markAsProduction, openScriptDb, safeMessage } from "./lib/db";
import { loadLocalEnv } from "./lib/load-env";

async function main(): Promise<void> {
  loadLocalEnv();
  const target = await openScriptDb();
  try {
    const before = await countAppliedMigrations(target.db);
    await target.migrate();
    const after = await countAppliedMigrations(target.db);
    console.log(`Migrations : ${after - before} appliquée(s), ${after} au total. Base : ${target.location}.`);

    if (process.env.VERCEL_ENV === "production") {
      await markAsProduction(target.db);
      console.log("Base marquée comme base de production : le seed y est interdit.");
    }
  } finally {
    await target.close();
  }
}

main().catch((error: unknown) => {
  console.error(`Échec de la migration : ${safeMessage(error)}`);
  process.exit(1);
});
