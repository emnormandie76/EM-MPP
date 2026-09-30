// Prepares the end-to-end database (architecture §9.4): deletes PGLITE_DIR, then migrates.
// The seed arrives with step 3. PGlite is closed before the server starts (one connection at a time).
import { rmSync } from "node:fs";
import path from "node:path";
import { openPglite, safeMessage } from "./lib/db";

async function main(): Promise<void> {
  const dir = process.env.PGLITE_DIR;
  // Guard: this script deletes a folder, so only ever a `.pglite-*` one, and only for PGlite.
  if (process.env.DB_DRIVER !== "pglite" || !dir || !path.basename(dir).startsWith(".pglite-")) {
    throw new Error("e2e-prepare exige DB_DRIVER=pglite et PGLITE_DIR=.pglite-…");
  }

  rmSync(dir, { recursive: true, force: true });
  const target = await openPglite(dir);
  try {
    await target.migrate();
    console.log(`Base de bout en bout prête : ${target.location}.`);
  } finally {
    await target.close();
  }
}

main().catch((error: unknown) => {
  console.error(`Échec de la préparation : ${safeMessage(error)}`);
  process.exit(1);
});
