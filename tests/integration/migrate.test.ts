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
import { runMigrations } from "../../scripts/lib/migrate";

const migrationFiles = readdirSync(MIGRATIONS_FOLDER).filter((file) => file.endsWith(".sql"));

describe("migrations (scripts/migrate.ts)", () => {
  let target: ScriptDb | undefined;

  afterEach(async () => {
    await target?.close();
    target = undefined;
  });

  it("apply every migration file, and running them again changes nothing", async () => {
    target = await openPglite();
    expect(migrationFiles.length).toBeGreaterThan(1);
    expect(await countAppliedMigrations(target.db)).toBe(0);

    expect(await runMigrations(target, {})).toEqual({ applied: migrationFiles.length, total: migrationFiles.length, markedAsProduction: false });
    expect(await runMigrations(target, {})).toEqual({ applied: 0, total: migrationFiles.length, markedAsProduction: false });
  });

  it("mark the database as production when VERCEL_ENV=production", async () => {
    target = await openPglite();
    const report = await runMigrations(target, { VERCEL_ENV: "production" });
    expect(report.markedAsProduction).toBe(true);
    expect(await isMarkedAsProduction(target.db)).toBe(true);
  });

  it.each([{}, { VERCEL_ENV: "preview" }, { VERCEL_ENV: "development" }])("do not mark the database with %j", async (env) => {
    target = await openPglite();
    expect((await runMigrations(target, env)).markedAsProduction).toBe(false);
    expect(await isMarkedAsProduction(target.db)).toBe(false);
  });

  it("mark the production database idempotently", async () => {
    target = await openPglite();
    expect(await isMarkedAsProduction(target.db)).toBe(false);

    await target.migrate();
    await markAsProduction(target.db);
    await markAsProduction(target.db);
    expect(await isMarkedAsProduction(target.db)).toBe(true);
  });
});
