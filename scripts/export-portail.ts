// Writes export-portail-mpplike.json for the portal (B2): read-only on the production database,
// whose connection string arrives on the standard input, so that it is neither displayed, nor
// kept in a file, nor in the shell's history:
//   neon connection-string main --project-id <projet> | npm run export:portail
import { openPostgres, safeMessage } from "./lib/db";
import { loadLocalEnv } from "./lib/load-env";
import { connectionStringFrom, EXPORT_FILE, exportAccounts, exportReport } from "./lib/portail-export";

async function standardInput(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  // Only for DB_DRIVER: the database of .env.local is never the one read here.
  loadLocalEnv();
  const target = await openPostgres(connectionStringFrom(await standardInput()));
  try {
    const counts = await exportAccounts(target.db, EXPORT_FILE);
    console.log(`Export écrit dans ${EXPORT_FILE}, hors de Git. Base : ${target.location}.`);
    for (const line of exportReport(counts)) console.log(`  ${line}`);
  } finally {
    await target.close();
  }
}

main().catch((error: unknown) => {
  console.error(`Échec de l'export : ${safeMessage(error)}`);
  process.exit(1);
});
