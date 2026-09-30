// Development data (architecture §9.6): `npm run db:seed` ERASES the database of .env.local and
// fills it. Refused on production. Asks to type "oui", unless `npm run db:seed -- --yes`.
import { createInterface } from "node:readline/promises";
import { openScriptDb, safeMessage } from "./lib/db";
import { loadLocalEnv } from "./lib/load-env";
import { seedDatabase, seedRefusal } from "./lib/seed";

async function confirmed(): Promise<boolean> {
  if (process.argv.includes("--yes")) return true;
  if (!process.stdin.isTTY) {
    console.log("Terminal non interactif : relance avec `npm run db:seed -- --yes`.");
    return false;
  }
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await readline.question("Tape oui pour continuer : ")).trim().toLowerCase() === "oui";
  } finally {
    readline.close();
  }
}

async function main(): Promise<void> {
  loadLocalEnv();
  const target = await openScriptDb();
  try {
    const refusal = await seedRefusal(target.db, process.env);
    if (refusal) {
      console.error(`Seed refusé : ${refusal}`);
      process.exitCode = 1;
      return;
    }
    console.log(`Base visée : ${target.location}.`);
    console.log("Le seed EFFACE toutes les données (application et comptes), puis remplit la base de développement.");
    if (!(await confirmed())) {
      console.log("Seed annulé : la base n'a pas été modifiée.");
      process.exitCode = 1;
      return;
    }
    const summary = await seedDatabase(target.db, { now: new Date(), env: process.env });
    console.log(
      `Seed terminé : ${summary.users} comptes, ${summary.questions} questions, ${summary.predictions} pronos, ` +
        `saisons ${summary.seasons.older} (prête à proclamer), ${summary.seasons.previous} (proclamée) et ${summary.seasons.current}.`,
    );
  } finally {
    await target.close();
  }
}

main().catch((error: unknown) => {
  console.error(`Échec du seed : ${safeMessage(error)}`);
  process.exit(1);
});
