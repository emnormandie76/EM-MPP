import { readdirSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
  countAppliedMigrations,
  isMarkedAsProduction,
  markAsProduction,
  MIGRATIONS_FOLDER,
  openPglite,
  type ScriptDb,
} from "../../scripts/lib/db";

const migrationFiles = readdirSync(MIGRATIONS_FOLDER).filter((file) => file.endsWith(".sql"));

describe("migrations (scripts/migrate.ts)", () => {
  let target: ScriptDb | undefined;

  afterEach(async () => {
    await target?.close();
    target = undefined;
  });

  it("apply every migration file, and running them again changes nothing", async () => {
    target = await openPglite();
    expect(migrationFiles.length).toBeGreaterThan(0);
    expect(await countAppliedMigrations(target.db)).toBe(0);

    await target.migrate();
    expect(await countAppliedMigrations(target.db)).toBe(migrationFiles.length);

    await target.migrate();
    expect(await countAppliedMigrations(target.db)).toBe(migrationFiles.length);
  });

  it("mark the production database, idempotently", async () => {
    target = await openPglite();
    expect(await isMarkedAsProduction(target.db)).toBe(false);

    await target.migrate();
    expect(await isMarkedAsProduction(target.db)).toBe(false);

    await markAsProduction(target.db);
    await markAsProduction(target.db);
    expect(await isMarkedAsProduction(target.db)).toBe(true);
  });
});
