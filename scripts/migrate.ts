// Applies pending migrations (architecture §3.4): locally with `npm run db:migrate`,
// and on Vercel before `next build` (`npm run build:vercel`).
import { openScriptDb, safeMessage } from "./lib/db";
import { loadLocalEnv } from "./lib/load-env";
import { runMigrations } from "./lib/migrate";

async function main(): Promise<void> {
  loadLocalEnv();
  const target = await openScriptDb();
  try {
    const { applied, total, markedAsProduction } = await runMigrations(target, process.env);
    console.log(`Migrations : ${applied} appliquée(s), ${total} au total. Base : ${target.location}.`);
    if (markedAsProduction) console.log("Base marquée comme base de production : le seed y est interdit.");
  } finally {
    await target.close();
  }
}

main().catch((error: unknown) => {
  console.error(`Échec de la migration : ${safeMessage(error)}`);
  process.exit(1);
});
