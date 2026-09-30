// Environment check (architecture §3.1): prints variable names and statuses, never values.
import { checkEnv } from "./lib/env-rules";
import { loadLocalEnv } from "./lib/load-env";

loadLocalEnv();

const results = checkEnv(process.env);
console.log("Variables d'environnement :");
for (const { name, status, hint } of results) {
  console.log(`  ${status.padEnd(10)} ${name}${hint ? ` (${hint})` : ""}`);
}

if (results.some(({ status }) => status !== "OK")) {
  console.log("Récupère les variables avec `vercel env pull .env.local`, puis relance `npm run check:env`.");
  process.exitCode = 1;
}
