import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getPlayerBadges } from "@/lib/data/badges";
import { getPalmares } from "@/lib/data/content";
import type { Database } from "@/lib/db/client";
import { question, season, seasonStanding, user } from "@/lib/db/schema";
import { parisLocalToUtc } from "@/lib/game/time";
import { anonymizeUser } from "@/lib/services/players";
import { publishQuestions, resolveQuestion, setQuestionDates, updateQuestion } from "@/lib/services/questions";
import type { Actor } from "@/lib/services/result";
import { createSeason, proclaimSeason, proclamationBlocker } from "@/lib/services/seasons";
import { seedDatabase } from "../../scripts/lib/seed";
import { makeClock } from "../helpers/clock";
import { createTestDb } from "../helpers/db";
import { createCategory, createQuestion, createUser, ensureTestSeason } from "../helpers/factories";

// Proclamation of the final standings (architecture §5.12, §11 É7), on the seed: the older season
// 2024-2025 is resolved but not proclaimed. Its only question (real 180), in malus (v1.2): Camille
// 185 (2,8 %, 5), Sarah 170 (5,6 %, 10), Julien 200 (11,1 %, 20), Thomas 150 (16,7 %, 30, the worst:
// 30 for each absent player). Since v1.2, the palmarès stores the malus, and `points` stays null;
// these expectations replace those of the points scale (decision of the user, 02/10/2026).

const clock = makeClock("2026-11-20T10:00:00Z");
const now = clock.now;

let db: Database;
let close: () => Promise<void>;
let ids: Record<string, string>;
let admin: Actor;

async function seasonId(label: string): Promise<number> {
  const [row] = await db.select({ id: season.id }).from(season).where(eq(season.label, label));
  return row.id;
}

beforeEach(async () => {
  ({ db, close } = await createTestDb());
  await seedDatabase(db, { now, env: {} });
  const users = await db.select({ id: user.id, name: user.name }).from(user);
  ids = Object.fromEntries(users.map(({ id, name }) => [name, id]));
  admin = { id: ids.Admin, role: "admin", banned: false };
});

afterEach(async () => {
  await close();
});

describe("authorization (§6.5)", () => {
  it("lets only an active admin proclaim a season", async () => {
    const older = await seasonId("2024-2025");
    const profiles: [Actor | null, string][] = [
      [null, "NOT_AUTHENTICATED"],
      [{ id: ids.Sarah, role: "player", banned: false }, "FORBIDDEN"],
      [{ id: ids.Admin, role: "admin", banned: true }, "ACCOUNT_DISABLED"],
    ];
    for (const [actor, code] of profiles) {
      expect(await proclaimSeason(db, actor, { seasonId: older }, now)).toMatchObject({ ok: false, code });
    }
    expect(await db.select().from(seasonStanding).where(eq(seasonStanding.seasonId, older))).toHaveLength(0);
    expect(await proclaimSeason(db, admin, { seasonId: older }, now)).toEqual({ ok: true, data: { seasonId: older, standings: 9 } });
  });
});

describe("proclaimSeason (§5.12)", () => {
  it("is refused while a published question of the season is not resolved, and writes nothing", async () => {
    const current = await seasonId("2026-2027");
    const result = await proclaimSeason(db, admin, { seasonId: current }, now);
    expect(result).toMatchObject({ ok: false, code: "NOT_PROCLAIMABLE" });
    // 4 open, 1 scheduled and 2 closed questions are waiting (the cancelled one does not count).
    expect(result.ok ? null : result.message).toBe(
      "7 questions publiées n'ont pas encore de résultat : la proclamation se fait une fois toutes les questions résolues.",
    );
    const [row] = await db.select().from(season).where(eq(season.id, current));
    expect(row.proclaimedAt).toBeNull();
    expect(await db.select().from(seasonStanding).where(eq(seasonStanding.seasonId, current))).toHaveLength(0);
  });

  it("is refused for a season without any published question, or unknown", async () => {
    const empty = (await createSeason(db, admin, { label: "2027-2028", startsOn: "2027-10-01" }, now)) as { ok: true; data: { id: number } };
    expect(await proclaimSeason(db, admin, { seasonId: empty.data.id }, now)).toMatchObject({
      ok: false,
      code: "NOT_PROCLAIMABLE",
      message: "Aucune question n'a été publiée dans cette saison.",
    });
    expect(await proclaimSeason(db, admin, { seasonId: 9999 }, now)).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("freezes the standings in season_standing, with the names of the day, and dates the proclamation", async () => {
    const older = await seasonId("2024-2025");
    expect(await proclaimSeason(db, admin, { seasonId: older }, now)).toMatchObject({ ok: true });

    const [row] = await db.select().from(season).where(eq(season.id, older));
    expect(row.proclaimedAt).toEqual(now);
    const rows = await db.select().from(seasonStanding).where(eq(seasonStanding.seasonId, older));
    const byName = Object.fromEntries(rows.map((r) => [r.nameSnapshot, r]));
    expect(Object.keys(byName).sort()).toEqual(["Admin", "Camille", "Hugo", "Inès", "Julien", "Léa", "Mehdi", "Sarah", "Thomas"]);
    expect(byName.Camille).toMatchObject({ userId: ids.Camille, rank: 1, malus: 5, points: null, bullseyes: 0, questionsPlayed: 1 });
    expect(byName.Camille.meanError).toBeCloseTo(5 / 180, 6);
    expect(byName.Sarah).toMatchObject({ rank: 2, malus: 10, questionsPlayed: 1 });
    expect(byName.Sarah.meanError).toBeCloseTo(10 / 180, 6);
    expect(byName.Julien).toMatchObject({ rank: 3, malus: 20 });
    expect(byName.Thomas).toMatchObject({ rank: 4, malus: 30 });
    // Active accounts without a prediction: the malus of the worst prediction (30), tied behind Thomas,
    // who has a mean error; Nora (disabled, no prediction) is left out.
    for (const name of ["Admin", "Hugo", "Inès", "Léa", "Mehdi"]) {
      expect(byName[name]).toMatchObject({ rank: 5, malus: 30, points: null, bullseyes: 0, meanError: null, questionsPlayed: 0 });
    }

    // The palmarès reads this table: the older season comes after the previous one.
    const palmares = await getPalmares(db, { id: ids.Sarah, role: "player" });
    expect(palmares.map(({ label }) => label)).toEqual(["2025-2026", "2024-2025"]);
    // In hundredths, like every malus until it is displayed.
    expect(palmares[1].rows.slice(0, 4).map(({ name, rank, malus }) => [name, rank, malus])).toEqual([
      ["Camille", 1, 500],
      ["Sarah", 2, 1_000],
      ["Julien", 3, 2_000],
      ["Thomas", 4, 3_000],
    ]);
    expect(palmares[1].rows.find(({ isViewer }) => isViewer)?.name).toBe("Sarah");
  });

  it("leaves out of the palmarès the accounts created after the end of the season (decision of 30/09/2026)", async () => {
    // 2024-2025 ends when 2025-2026 starts, on 1 October 2025.
    await createUser(db, { name: "Arrivée en 2026", createdAt: new Date("2026-01-05T09:00:00Z") });
    await createUser(db, { name: "Arrivée en 2025", createdAt: new Date("2025-03-05T09:00:00Z") });
    const older = await seasonId("2024-2025");
    expect(await proclaimSeason(db, admin, { seasonId: older }, now)).toMatchObject({ ok: true, data: { standings: 10 } });
    const names = (await db.select().from(seasonStanding).where(eq(seasonStanding.seasonId, older))).map(({ nameSnapshot }) => nameSnapshot);
    expect(names).toContain("Arrivée en 2025");
    expect(names).not.toContain("Arrivée en 2026");
  });

  it("refuses a second proclamation", async () => {
    const older = await seasonId("2024-2025");
    await proclaimSeason(db, admin, { seasonId: older }, now);
    expect(await proclaimSeason(db, admin, { seasonId: older }, clock.at("+1d"))).toMatchObject({
      ok: false,
      code: "ALREADY_PROCLAIMED",
      message: "Le classement final de cette saison est déjà proclamé.",
    });
    const [row] = await db.select().from(season).where(eq(season.id, older));
    expect(row.proclaimedAt).toEqual(now);
    expect(await db.select().from(seasonStanding).where(eq(seasonStanding.seasonId, older))).toHaveLength(9);
  });

  it("keeps the palmarès when a result is corrected afterwards", async () => {
    const older = await seasonId("2024-2025");
    await proclaimSeason(db, admin, { seasonId: older }, now);
    const before = await db.select().from(seasonStanding).where(eq(seasonStanding.seasonId, older));

    const [q] = await db.select().from(question).where(eq(question.seasonId, older));
    // 150: Thomas would now be the closest.
    expect(await resolveQuestion(db, admin, { questionId: q.id, rawValue: "150" }, clock.at("+1h"))).toMatchObject({
      ok: true,
      data: { corrected: true },
    });
    expect(await db.select().from(seasonStanding).where(eq(seasonStanding.seasonId, older))).toEqual(before);
    const palmares = await getPalmares(db, { id: ids.Sarah, role: "player" });
    expect(palmares.find(({ label }) => label === "2024-2025")?.rows[0]).toMatchObject({ name: "Camille", malus: 500 });
  });

  it("gives the Champion and Assidu badges of the season", async () => {
    const viewer = { id: ids.Sarah, role: "player" as const };
    const badge = async (name: string, key: string) =>
      (await getPlayerBadges(db, viewer, ids[name])).find((earned) => earned.key === key)!.count;
    // Before: Camille played every question of the previous season (Assidu), and was never first.
    expect(await badge("Camille", "champion")).toBe(0);
    expect(await badge("Camille", "assiduous")).toBe(1);
    expect(await badge("Mehdi", "assiduous")).toBe(0);

    await proclaimSeason(db, admin, { seasonId: await seasonId("2024-2025") }, now);
    expect(await badge("Camille", "champion")).toBe(1);
    expect(await badge("Camille", "assiduous")).toBe(2);
    expect(await badge("Thomas", "assiduous")).toBe(2);
    // Inès made no prediction in 2024-2025: still her first Assidu, of 2025-2026 only.
    expect(await badge("Inès", "assiduous")).toBe(1);
    expect(await badge("Mehdi", "assiduous")).toBe(0);
  });
});

describe("proclamationBlocker (§5.12)", () => {
  it("says why a season cannot be proclaimed yet", () => {
    expect(proclamationBlocker({ proclaimed: false, publishedCount: 3, resolvedCount: 3 })).toBeNull();
    expect(proclamationBlocker({ proclaimed: true, publishedCount: 3, resolvedCount: 3 })).toBe(
      "Le classement final de cette saison est déjà proclamé.",
    );
    expect(proclamationBlocker({ proclaimed: false, publishedCount: 0, resolvedCount: 0 })).toBe(
      "Aucune question n'a été publiée dans cette saison.",
    );
    expect(proclamationBlocker({ proclaimed: false, publishedCount: 3, resolvedCount: 2 })).toBe(
      "1 question publiée n'a pas encore de résultat : la proclamation se fait une fois toutes les questions résolues.",
    );
  });
});

describe("anonymization after a proclamation (decision of 30/09/2026)", () => {
  it("replaces the name in the palmarès, and keeps ranks and malus", async () => {
    const result = await anonymizeUser(db, admin, { userId: ids.Inès }, now);
    expect(result).toMatchObject({ ok: true });
    const anonymous = result.ok ? result.data.name : "";
    expect(anonymous).toMatch(/^Ancien joueur \d+$/);

    const [row] = await db
      .select()
      .from(seasonStanding)
      .where(and(eq(seasonStanding.userId, ids.Inès), eq(seasonStanding.seasonId, await seasonId("2025-2026"))));
    expect(row).toMatchObject({ nameSnapshot: anonymous, rank: 1, malus: 20 });
    const [palmares] = await getPalmares(db, { id: ids.Sarah, role: "player" });
    expect(palmares.rows[0]).toMatchObject({ name: anonymous, rank: 1 });
    expect(palmares.rows.map(({ name }) => name)).not.toContain("Inès");
  });
});

// A proclaimed season receives no new question (decision of 30/09/2026): season S (1 October 2026)
// is proclaimed while it is the last one; T (1 October 2027) is created afterwards.
describe("questions in a proclaimed season", () => {
  let fresh: Database;
  let closeFresh: () => Promise<void>;
  let me: Actor;
  let categoryId: number;
  let S: number;

  beforeEach(async () => {
    ({ db: fresh, close: closeFresh } = await createTestDb());
    me = { id: (await createUser(fresh, { role: "admin" })).id, role: "admin", banned: false };
    categoryId = (await createCategory(fresh, "JPO")).id;
    S = (await ensureTestSeason(fresh, "2026-2027", "2026-10-01")).id;
    await createQuestion(fresh, {
      categoryId,
      status: "published",
      opensAt: parisLocalToUtc("2026-10-05T09:00"),
      closesAt: parisLocalToUtc("2026-10-12T18:00"),
      resultNumber: 250,
      resolvedAt: parisLocalToUtc("2026-10-20T09:00"),
    });
    expect(await proclaimSeason(fresh, me, { seasonId: S }, now)).toMatchObject({ ok: true });
  });

  afterEach(async () => {
    await closeFresh();
  });

  const MESSAGE = "Cette date de clôture tombe dans une saison déjà proclamée : crée d'abord la saison suivante dans Saisons et lots.";

  it("refuses to publish a draft that closes in it, until the next season exists", async () => {
    const draft = await createQuestion(fresh, {
      categoryId,
      opensAt: parisLocalToUtc("2026-12-01T09:00"),
      closesAt: parisLocalToUtc("2026-12-15T18:00"),
    });
    expect(draft.seasonId).toBe(S);
    const refused = await publishQuestions(fresh, me, { questionIds: [draft.id] }, now);
    expect(refused).toMatchObject({ ok: true, data: { succeeded: [], failed: [{ id: draft.id, reasons: [MESSAGE] }] } });

    // The next season starts before its closing: the draft follows its date, then can be published.
    expect(await createSeason(fresh, me, { label: "Hiver", startsOn: "2026-12-01" }, now)).toMatchObject({ ok: true, data: { moved: 1 } });
    const published = await publishQuestions(fresh, me, { questionIds: [draft.id] }, now);
    expect(published).toMatchObject({ ok: true, data: { succeeded: [{ id: draft.id }], failed: [] } });
  });

  it("refuses to move the closing of a published question into it, alone or in series", async () => {
    await ensureTestSeason(fresh, "2027-2028", "2027-10-01");
    const scheduled = await createQuestion(fresh, {
      categoryId,
      status: "published",
      opensAt: parisLocalToUtc("2027-10-20T09:00"),
      closesAt: parisLocalToUtc("2027-11-01T18:00"),
    });

    const update = await updateQuestion(
      fresh,
      me,
      { questionId: scheduled.id, opensAt: "2026-12-01T09:00", closesAt: "2026-12-15T18:00" },
      now,
    );
    expect(update).toMatchObject({ ok: false, code: "INVALID_INPUT", fieldErrors: { closesAt: MESSAGE } });

    const series = await setQuestionDates(
      fresh,
      me,
      { questionIds: [scheduled.id], opensAt: "2026-12-01T09:00", closesAt: "2026-12-15T18:00" },
      now,
    );
    expect(series).toMatchObject({ ok: true, data: { succeeded: [], failed: [{ id: scheduled.id, reasons: [MESSAGE] }] } });
    const [row] = await fresh.select().from(question).where(eq(question.id, scheduled.id));
    expect(row.closesAt).toEqual(parisLocalToUtc("2027-11-01T18:00"));
  });

  it("lets a draft close in it: drafts follow their date", async () => {
    const draft = await createQuestion(fresh, { categoryId });
    expect(await updateQuestion(fresh, me, { questionId: draft.id, closesAt: "2026-12-15T18:00" }, now)).toMatchObject({ ok: true });
    const series = await setQuestionDates(fresh, me, { questionIds: [draft.id], opensAt: "2026-12-01T09:00", closesAt: "2026-12-16T18:00" }, now);
    expect(series).toMatchObject({ ok: true, data: { succeeded: [{ id: draft.id }] } });
  });
});
