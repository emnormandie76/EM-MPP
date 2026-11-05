// Prepares the end-to-end database (architecture §9.4): deletes PGLITE_DIR, migrates, seeds, and
// opens a session per account for e2e/fixtures.ts (D8). PGlite is closed before the server starts
// (one connection at a time): the tests cannot write there afterwards.
import { rmSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { SESSION_EXPIRES_IN_S } from "../src/lib/auth/auth";
import { session, user } from "../src/lib/db/schema";
import { sessionToken } from "../e2e/session";
import { openPglite, safeMessage } from "./lib/db";
import { seedDatabase } from "./lib/seed";

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
    const now = new Date();
    const summary = await seedDatabase(target.db, { now, env: process.env });
    const accounts = await target.db.select().from(user).where(eq(user.banned, false));
    await target.db.insert(session).values(
      accounts.map(({ id, email }) => ({
        id: `e2e-${id}`,
        token: sessionToken(email),
        userId: id,
        expiresAt: new Date(now.getTime() + SESSION_EXPIRES_IN_S * 1000),
        createdAt: now,
        updatedAt: now,
      })),
    );
    console.log(`Base de bout en bout prête : ${target.location}, ${summary.questions} questions, ${summary.predictions} pronos.`);
  } finally {
    await target.close();
  }
}

main().catch((error: unknown) => {
  console.error(`Échec de la préparation : ${safeMessage(error)}`);
  process.exit(1);
});
