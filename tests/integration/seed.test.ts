import { verifyPassword } from "better-auth/crypto";
import { and, eq, isNotNull, ne } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import {
  account,
  allowedEmail,
  announcement,
  category,
  prediction,
  predictionEvent,
  prize,
  question,
  season,
  seasonStanding,
  user,
} from "@/lib/db/schema";
import { JOKERS_PER_SEASON } from "@/lib/game/constants";
import { questionStatus } from "@/lib/game/question-status";
import { seasonAt, seasonStartFromLocalDate } from "@/lib/game/time";
import { isNew, newReference } from "@/lib/game/visits";
import { markAsProduction, openPglite, type ScriptDb } from "../../scripts/lib/db";
import { SEED_PASSWORD, SeedRefusedError, seedDatabase, WITNESS_VALUE } from "../../scripts/lib/seed";

const MID_SEASON = new Date("2026-11-20T10:00:00Z");

async function migratedDb(): Promise<ScriptDb> {
  const target = await openPglite();
  await target.migrate();
  return target;
}

async function statusCounts(target: ScriptDb, now: Date): Promise<Record<string, number>> {
  const rows = await target.db.select().from(question);
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const status = questionStatus(row, now);
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}

describe("seed (scripts/seed.ts)", () => {
  let target: ScriptDb | undefined;

  afterEach(async () => {
    await target?.close();
    target = undefined;
  });

  it("creates the expected accounts, allow list, categories, seasons and content", async () => {
    target = await migratedDb();
    const { db } = target;
    const summary = await seedDatabase(db, { now: MID_SEASON, env: {} });

    expect(summary).toMatchObject({
      users: 10,
      allowedEmails: 10,
      categories: 4,
      seasons: { older: "2024-2025", previous: "2025-2026", current: "2026-2027" },
      questions: 15,
      predictions: 58,
      announcements: 2,
      prizes: 3,
      standings: 9,
    });

    const users = await db.select().from(user);
    expect(users.map(({ email }) => email).sort()).toEqual([
      "admin@example.test",
      "desactive@example.test",
      ...Array.from({ length: 8 }, (_, i) => `joueur${i + 1}@example.test`),
    ]);
    expect(users.filter(({ role }) => role === "admin").map(({ name }) => name)).toEqual(["Admin"]);
    expect(users.filter(({ banned }) => banned).map(({ email }) => email)).toEqual(["desactive@example.test"]);
    expect(users.map(({ name }) => name)).toEqual(expect.arrayContaining(["Sarah", "Julien", "Inès", "Camille", "Thomas", "Mehdi", "Léa", "Hugo"]));

    const allowed = (await db.select().from(allowedEmail)).map(({ email }) => email);
    expect(allowed).toHaveLength(10);
    expect(allowed).toEqual(expect.arrayContaining(["nouveau1@example.test", "desactive@example.test"]));
    // Added by the admin in e2e/auth.spec.ts.
    expect(allowed).not.toContain("nouveau2@example.test");
    expect(allowed).not.toContain("admin@example.test");

    const categories = await db.select().from(category);
    expect(categories.map(({ name }) => name).sort()).toEqual(["Archivée", "Candidatures", "Intégration", "JPO"]);
    expect(categories.filter(({ archivedAt }) => archivedAt).map(({ name }) => name)).toEqual(["Archivée"]);

    expect(await db.select().from(announcement)).toHaveLength(2);
    expect(await db.select().from(prize)).toHaveLength(3);
    expect(await db.select().from(prediction)).toHaveLength(58);
    expect((await db.select().from(predictionEvent)).length).toBe(summary.events);
  });

  it("has questions in every state (§9.6)", async () => {
    target = await migratedDb();
    await seedDatabase(target.db, { now: MID_SEASON, env: {} });
    expect(await statusCounts(target, MID_SEASON)).toEqual({
      draft: 1,
      scheduled: 1,
      open: 4,
      closed: 2,
      resolved: 6,
      cancelled: 1,
    });
  });

  it("proclaims the previous season with its palmarès, and leaves the current one open", async () => {
    target = await migratedDb();
    const { db } = target;
    await seedDatabase(db, { now: MID_SEASON, env: {} });

    const seasons = await db.select().from(season).orderBy(season.startsAt);
    expect(seasons.map(({ label, startsAt, proclaimedAt }) => [label, startsAt, proclaimedAt !== null])).toEqual([
      ["2024-2025", seasonStartFromLocalDate("2024-10-01"), false],
      ["2025-2026", seasonStartFromLocalDate("2025-10-01"), true],
      ["2026-2027", seasonStartFromLocalDate("2026-10-01"), false],
    ]);
    const previousQuestions = await db.select().from(question).where(eq(question.seasonId, seasons[1].id));
    expect(previousQuestions).toHaveLength(2);
    expect(previousQuestions.every(({ resolvedAt }) => resolvedAt !== null)).toBe(true);

    const palmares = await db
      .select({ name: seasonStanding.nameSnapshot, rank: seasonStanding.rank, points: seasonStanding.points })
      .from(seasonStanding)
      .orderBy(seasonStanding.rank, seasonStanding.nameSnapshot);
    // 1 200 candidatures: Sarah 1 210 (Dans le mille, +20), Inès 1 180 (+10), Julien 1 100 (+5)…
    expect(palmares.slice(0, 3)).toEqual([
      { name: "Inès", rank: 1, points: 90 + 50 },
      { name: "Sarah", rank: 2, points: 120 },
      { name: "Julien", rank: 3, points: 50 + 50 },
    ]);
    expect(palmares.map(({ name }) => name)).not.toContain("Nora");
  });

  it("leaves the older season resolved but not proclaimed, ready for the proclamation (§5.12)", async () => {
    target = await migratedDb();
    const { db } = target;
    await seedDatabase(db, { now: MID_SEASON, env: {} });

    const [older] = await db.select().from(season).where(eq(season.label, "2024-2025"));
    expect(older.proclaimedAt).toBeNull();
    const questions = await db.select().from(question).where(eq(question.seasonId, older.id));
    expect(questions.map(({ status, resolvedAt }) => [status, resolvedAt !== null])).toEqual([["published", true]]);
    expect(await db.select().from(prediction).where(eq(prediction.questionId, questions[0].id))).toHaveLength(4);
    expect(await db.select().from(seasonStanding).where(eq(seasonStanding.seasonId, older.id))).toHaveLength(0);
  });

  it("keeps a second closed question without result, with predictions (§9.6)", async () => {
    target = await migratedDb();
    const { db } = target;
    await seedDatabase(db, { now: MID_SEASON, env: {} });

    const closed = (await db.select().from(question)).filter((row) => questionStatus(row, MID_SEASON) === "closed");
    expect(closed.map(({ title }) => title).sort()).toEqual([
      "Combien d'inscrits au webinaire Grande École de septembre ?",
      "Combien de visiteurs sur le stand du salon Studyrama ?",
    ]);
    for (const row of closed) {
      expect((await db.select().from(prediction).where(eq(prediction.questionId, row.id))).length).toBeGreaterThan(0);
    }
  });

  it("puts the witness value on the open question closing first, from another player than the admin", async () => {
    target = await migratedDb();
    const { db } = target;
    await seedDatabase(db, { now: MID_SEASON, env: {} });

    const [witness] = await db
      .select({ questionId: prediction.questionId, userId: prediction.userId })
      .from(prediction)
      .where(eq(prediction.valueNumber, WITNESS_VALUE));
    const open = (await db.select().from(question))
      .filter((row) => questionStatus(row, MID_SEASON) === "open")
      .sort((a, b) => a.closesAt!.getTime() - b.closesAt!.getTime());
    expect(witness.questionId).toBe(open[0].id);
    const [owner] = await db.select().from(user).where(eq(user.id, witness.userId));
    expect(owner.name).toBe("Hugo");
    expect(open[0].closesAt!.getTime() - MID_SEASON.getTime()).toBe(24 * 3_600_000);
  });

  it("never uses more than 2 jokers per player and season, cancelled questions aside", async () => {
    target = await migratedDb();
    const { db } = target;
    await seedDatabase(db, { now: MID_SEASON, env: {} });

    const jokers = await db
      .select({ userId: prediction.userId, seasonId: question.seasonId })
      .from(prediction)
      .innerJoin(question, eq(prediction.questionId, question.id))
      .where(and(eq(prediction.joker, true), ne(question.status, "cancelled")));
    const perPlayerSeason = new Map<string, number>();
    for (const { userId, seasonId } of jokers) {
      const key = `${userId}/${seasonId}`;
      perPlayerSeason.set(key, (perPlayerSeason.get(key) ?? 0) + 1);
    }
    expect(Math.max(...perPlayerSeason.values())).toBe(JOKERS_PER_SEASON);

    const onCancelled = await db
      .select()
      .from(prediction)
      .innerJoin(question, eq(prediction.questionId, question.id))
      .where(and(eq(prediction.joker, true), eq(question.status, "cancelled")));
    expect(onCancelled).toHaveLength(1);
  });

  it("shows the Nouveau badge to Camille (joueur4) on the question opened an hour ago", async () => {
    target = await migratedDb();
    const { db } = target;
    await seedDatabase(db, { now: MID_SEASON, env: {} });

    const [camille] = await db.select().from(user).where(eq(user.email, "joueur4@example.test"));
    const reference = newReference(camille, MID_SEASON);
    const open = (await db.select().from(question)).filter((row) => questionStatus(row, MID_SEASON) === "open");
    expect(open.filter(({ opensAt }) => isNew(opensAt!, reference)).map(({ title }) => title)).toEqual([
      "Le taux d'intégration du Bachelor dépassera-t-il 60 % ?",
    ]);
  });

  it("gives every account the password Test-1234!, hashed the Better Auth way", async () => {
    target = await migratedDb();
    const { db } = target;
    await seedDatabase(db, { now: MID_SEASON, env: {} });

    const accounts = await db.select().from(account).where(isNotNull(account.password));
    expect(accounts).toHaveLength(10);
    expect(accounts.every(({ providerId, accountId, userId }) => providerId === "credential" && accountId === userId)).toBe(true);
    expect(await verifyPassword({ hash: accounts[0].password!, password: SEED_PASSWORD })).toBe(true);
    expect(await verifyPassword({ hash: accounts[0].password!, password: "wrong-password" })).toBe(false);
  });

  it("erases everything and starts again: same content, identifiers from 1", async () => {
    target = await migratedDb();
    const { db } = target;
    await seedDatabase(db, { now: MID_SEASON, env: {} });
    const again = await seedDatabase(db, { now: MID_SEASON, env: {} });

    expect(again.users).toBe(10);
    expect(await db.select().from(user)).toHaveLength(10);
    expect((await db.select({ id: question.id }).from(question)).map(({ id }) => id).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 15 }, (_, i) => i + 1),
    );
  });

  it.each([
    ["30 seconds after the start of a season", "2026-09-30T22:00:30Z", "2026-2027"],
    ["on 1 October at noon", "2026-10-01T10:00:00Z", "2026-2027"],
    ["30 minutes before 1 October", "2026-09-30T21:30:00Z", "2025-2026"],
    ["on 30 September 2026, in the morning", "2026-09-30T08:00:00Z", "2025-2026"],
    ["in winter", "2027-01-15T12:00:00Z", "2026-2027"],
  ])("stays consistent %s: every question of the current season closes inside it", async (_, iso, currentLabel) => {
    const now = new Date(iso);
    target = await migratedDb();
    const { db } = target;
    const summary = await seedDatabase(db, { now, env: {} });

    expect(summary.seasons.current).toBe(currentLabel);
    expect(await statusCounts(target, now)).toEqual({ draft: 1, scheduled: 1, open: 4, closed: 2, resolved: 6, cancelled: 1 });

    // Three seasons, the current one containing now and without a next one.
    const seasons = await db.select().from(season);
    expect(seasons).toHaveLength(3);
    const current = seasonAt(seasons, now)!;
    expect(current.label).toBe(currentLabel);
    expect(seasons.every(({ startsAt }) => startsAt <= current.startsAt)).toBe(true);

    const questions = await db.select().from(question).where(isNotNull(question.closesAt));
    const currentQuestions = questions.filter(({ seasonId }) => seasonId === current.id);
    expect(currentQuestions).toHaveLength(11);
    for (const row of questions) {
      expect(row.seasonId).toBe(seasonAt(seasons, row.closesAt!)?.id);
      if (row.resolvedAt) expect(row.resolvedAt.getTime()).toBeLessThanOrEqual(now.getTime());
    }
    const predictions = await db.select().from(prediction).innerJoin(question, eq(prediction.questionId, question.id));
    for (const { prediction: made, question: q } of predictions) {
      expect(made.createdAt.getTime()).toBeGreaterThanOrEqual(q.opensAt!.getTime());
      expect((made.validatedAt ?? made.createdAt).getTime()).toBeLessThan(Math.min(q.closesAt!.getTime(), now.getTime()));
    }
  });

  it("refuses to run when VERCEL_ENV=production, without touching the database", async () => {
    target = await migratedDb();
    await expect(seedDatabase(target.db, { now: MID_SEASON, env: { VERCEL_ENV: "production" } })).rejects.toThrow(SeedRefusedError);
    expect(await target.db.select().from(user)).toEqual([]);
  });

  it("refuses to run on a database marked as production, without touching it", async () => {
    target = await migratedDb();
    await seedDatabase(target.db, { now: MID_SEASON, env: {} });
    await markAsProduction(target.db);
    await expect(seedDatabase(target.db, { now: MID_SEASON, env: {} })).rejects.toThrow("marquée comme base de production");
    expect(await target.db.select().from(user)).toHaveLength(10);
  });
});
