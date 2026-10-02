import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, describe, expect, it } from "vitest";
import { prediction, prize, question, season, seasonStanding } from "@/lib/db/schema";
import {
  countAppliedMigrations,
  isMarkedAsProduction,
  markAsProduction,
  MIGRATIONS_FOLDER,
  openPglite,
  type ScriptDb,
} from "../../scripts/lib/db";
import { runMigrations } from "../../scripts/lib/migrate";
import { createCategory, createPrediction, createUser } from "../helpers/factories";

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

/** A copy of the migrations folder that stops at `lastTag`: the database as it was then. */
function migrationsUpTo(lastTag: string): string {
  const journal = JSON.parse(readFileSync(join(MIGRATIONS_FOLDER, "meta", "_journal.json"), "utf8")) as {
    entries: { idx: number; tag: string }[];
  };
  const last = journal.entries.find(({ tag }) => tag === lastTag)!;
  const entries = journal.entries.filter(({ idx }) => idx <= last.idx);
  const dir = mkdtempSync(join(tmpdir(), "migrations-"));
  mkdirSync(join(dir, "meta"));
  writeFileSync(join(dir, "meta", "_journal.json"), JSON.stringify({ ...journal, entries }));
  for (const { tag } of entries) copyFileSync(join(MIGRATIONS_FOLDER, `${tag}.sql`), join(dir, `${tag}.sql`));
  return dir;
}

type OldQuestion = {
  categoryId: number;
  createdBy: string;
  seasonId: number | null;
  type?: "number" | "choice";
  priceIsRight?: boolean;
  status?: "draft" | "published";
  opensAt?: string;
  closesAt?: string;
  resultNumber?: number;
  resolvedAt?: string;
};

/**
 * A question inserted with the columns of an older schema (raw SQL: the factories write the
 * columns of the current one, which the older database does not have).
 */
async function insertOldQuestion(db: ScriptDb["db"], q: OldQuestion): Promise<number> {
  const result = (await db.execute(sql`
    insert into question (category_id, created_by, season_id, type, price_is_right, title, unit, source, status,
      opens_at, closes_at, result_number, resolved_at)
    values (${q.categoryId}, ${q.createdBy}, ${q.seasonId}, ${q.type ?? "number"}, ${q.priceIsRight ?? false},
      'Combien de participants à la JPO ?', 'participants', 'Tableau BI', ${q.status ?? "draft"},
      ${q.opensAt ?? null}, ${q.closesAt ?? null}, ${q.resultNumber ?? null}, ${q.resolvedAt ?? null})
    returning id
  `)) as unknown as { rows: { id: number }[] };
  return result.rows[0].id;
}

describe("migration 0002 (seasons created by the admin, v1.1)", () => {
  let target: ScriptDb | undefined;
  let folder: string | undefined;

  afterEach(async () => {
    await target?.close();
    target = undefined;
    if (folder) rmSync(folder, { recursive: true, force: true });
    folder = undefined;
  });

  it("keeps the seasons of step 5, their questions, predictions and prizes, and drops the end date", async () => {
    target = await openPglite();
    folder = migrationsUpTo("0001_schema");
    await migrate(target.db as unknown as PgliteDatabase<Record<string, unknown>>, { migrationsFolder: folder });
    const { db } = target;

    // Seasons as step 5 created them: 1 October to 1 October, with an end date.
    await db.execute(sql`
      insert into season (label, starts_at, ends_at, proclaimed_at) values
        ('2025-2026', '2025-09-30T22:00:00Z', '2026-09-30T22:00:00Z', '2026-09-15T10:00:00Z'),
        ('2026-2027', '2026-09-30T22:00:00Z', '2027-09-30T22:00:00Z', null)
    `);
    const [previous, current] = await db.select({ id: season.id }).from(season).orderBy(season.id);
    const player = await createUser(db);
    const categoryId = (await createCategory(db)).id;
    const createdBy = (await createUser(db, { role: "admin" })).id;
    const published = {
      id: await insertOldQuestion(db, {
        categoryId,
        createdBy,
        seasonId: current.id,
        status: "published",
        opensAt: "2026-10-14T07:00:00Z",
        closesAt: "2026-10-21T16:00:00Z",
      }),
    };
    const resolved = {
      id: await insertOldQuestion(db, {
        categoryId,
        createdBy,
        seasonId: previous.id,
        status: "published",
        opensAt: "2026-03-01T08:00:00Z",
        closesAt: "2026-03-10T16:00:00Z",
        resultNumber: 250,
        resolvedAt: "2026-06-01T08:00:00Z",
      }),
    };
    const draft = { id: await insertOldQuestion(db, { categoryId, createdBy, seasonId: null }) };
    await createPrediction(db, { questionId: published.id, userId: player.id, valueNumber: 240 });
    await db.insert(prize).values({ seasonId: current.id, rankLabel: "1er", description: "Un mug", position: 1 });

    expect(await runMigrations(target, {})).toEqual({ applied: migrationFiles.length - 2, total: migrationFiles.length, markedAsProduction: false });

    const seasons = await db.select().from(season).orderBy(season.id);
    expect(seasons.map(({ id, label, startsAt, proclaimedAt }) => ({ id, label, startsAt, proclaimedAt }))).toEqual([
      { id: previous.id, label: "2025-2026", startsAt: new Date("2025-09-30T22:00:00Z"), proclaimedAt: new Date("2026-09-15T10:00:00Z") },
      { id: current.id, label: "2026-2027", startsAt: new Date("2026-09-30T22:00:00Z"), proclaimedAt: null },
    ]);
    const questions = await db.select({ id: question.id, seasonId: question.seasonId }).from(question).orderBy(question.id);
    expect(questions).toEqual([
      { id: published.id, seasonId: current.id },
      { id: resolved.id, seasonId: previous.id },
      { id: draft.id, seasonId: null },
    ]);
    expect(await db.select({ value: prediction.valueNumber }).from(prediction)).toEqual([{ value: 240 }]);
    expect(await db.select({ seasonId: prize.seasonId }).from(prize)).toEqual([{ seasonId: current.id }]);
    const columns = (await db.execute(sql`
      select column_name from information_schema.columns where table_name = 'season' and column_name = 'ends_at'
    `)) as unknown as { rows: unknown[] };
    expect(columns.rows).toEqual([]);
  });
});

describe("migration 0003 (malus, jokers by season, extensions, v1.2)", () => {
  let target: ScriptDb | undefined;
  let folder: string | undefined;

  afterEach(async () => {
    await target?.close();
    target = undefined;
    if (folder) rmSync(folder, { recursive: true, force: true });
    folder = undefined;
  });

  it("keeps the choice questions (malus 50), turns off the Juste Prix and keeps the palmarès in points", async () => {
    target = await openPglite();
    folder = migrationsUpTo("0002_seasons_by_admin");
    await migrate(target.db as unknown as PgliteDatabase<Record<string, unknown>>, { migrationsFolder: folder });
    const { db } = target;

    await db.execute(sql`
      insert into season (label, starts_at, proclaimed_at) values
        ('2025-2026', '2025-09-30T22:00:00Z', '2026-09-15T10:00:00Z'),
        ('2026-2027', '2026-09-30T22:00:00Z', null)
    `);
    const [previous, current] = await db.select({ id: season.id }).from(season).orderBy(season.id);
    const player = await createUser(db);
    const categoryId = (await createCategory(db)).id;
    const createdBy = (await createUser(db, { role: "admin" })).id;
    const open = { categoryId, createdBy, seasonId: current.id, status: "published" as const, opensAt: "2026-10-14T07:00:00Z", closesAt: "2026-10-21T16:00:00Z" };
    const choice = await insertOldQuestion(db, { ...open, type: "choice" });
    await db.execute(sql`insert into question_option (question_id, label, position) values (${choice}, 'Oui', 1), (${choice}, 'Non', 2)`);
    const justePrix = await insertOldQuestion(db, { ...open, priceIsRight: true });
    const number = await insertOldQuestion(db, open);
    await createPrediction(db, { questionId: justePrix, userId: player.id, valueNumber: 240, joker: true });
    await db.execute(sql`
      insert into season_standing (season_id, user_id, rank, points, bullseyes, mean_error, questions_played, name_snapshot)
      values (${previous.id}, ${player.id}, 1, 185, 1, 0.02, 2, 'Sarah')
    `);

    expect(await runMigrations(target, {})).toEqual({ applied: migrationFiles.length - 3, total: migrationFiles.length, markedAsProduction: false });

    const questions = await db
      .select({ id: question.id, type: question.type, priceIsRight: question.priceIsRight, wrongAnswerMalus: question.wrongAnswerMalus })
      .from(question)
      .orderBy(question.id);
    expect(questions).toEqual([
      { id: choice, type: "choice", priceIsRight: false, wrongAnswerMalus: 50 },
      { id: justePrix, type: "number", priceIsRight: false, wrongAnswerMalus: null },
      { id: number, type: "number", priceIsRight: false, wrongAnswerMalus: null },
    ]);
    expect(await db.select({ value: prediction.valueNumber, joker: prediction.joker }).from(prediction)).toEqual([{ value: 240, joker: true }]);
    expect(await db.select({ jokersEnabled: season.jokersEnabled }).from(season)).toEqual([{ jokersEnabled: true }, { jokersEnabled: true }]);
    const [standing] = await db.select().from(seasonStanding);
    expect(standing).toMatchObject({ rank: 1, points: 185, malus: null, bullseyes: 1, meanError: 0.02, questionsPlayed: 2, nameSnapshot: "Sarah" });
  });
});
