import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAvailableSeasons, getStandings, type StandingView } from "@/lib/data/standings";
import type { Database } from "@/lib/db/client";
import { question, user } from "@/lib/db/schema";
import { resolveQuestion } from "@/lib/services/questions";
import type { Actor } from "@/lib/services/result";
import { seedDatabase } from "../../scripts/lib/seed";
import { createTestDb } from "../helpers/db";

// Standings of the seed (architecture §5.6, §11 É7), compared with a table computed by hand below.
// v1.2 (step 8c): malus, the fewest first; a player without a prediction takes the malus of the
// worst prediction. These expectations replace those of the points scale (decision of the user,
// 02/10/2026): the rule changed, the test is not weakened.
//
// Current season 2026-2027, resolved questions:
// - JPO de septembre (number, real 250, coef 1), vector P1: Sarah 240 (4 %, malus 10), Julien 262
//   with a joker (4,8 %, 12 ÷ 2 = 6), Inès and Camille 235 (6 %, 15), Thomas 300 (20 %, 50, the
//   worst): Admin, Mehdi, Léa, Hugo and Nora take 50.
// - Candidatures BBA (number, real 1 000, coef 2), vector A1: Mehdi 900 (10 %, 100 × 2 = 200), Léa
//   1 300 with a joker (30 %, 300 × 2 ÷ 2 = 300), Sarah 1 050 (5 %, 50 × 2 = 100): the others take the
//   worst gap, 300 × 2 = 600.
// - Campus (choice, "Le Havre", coef 2, wrong answer 100, resolved last): right for Julien, Inès,
//   Thomas (joker), Hugo and Nora (0); wrong for Sarah, Camille and Admin (200); Mehdi and Léa absent (200).
// Before the campus question (the previous standings): Sarah 110, Mehdi 250, Léa 350, Julien 606,
// Inès and Camille 615 (tied at 6 %), Thomas 650 (20 %), then Admin, Hugo and Nora at 650 without error.

const MID_SEASON = new Date("2026-11-20T10:00:00Z");

let db: Database;
let close: () => Promise<void>;
let ids: Record<string, string>;

beforeEach(async () => {
  ({ db, close } = await createTestDb());
  await seedDatabase(db, { now: MID_SEASON, env: {} });
  const users = await db.select({ id: user.id, name: user.name }).from(user);
  ids = Object.fromEntries(users.map(({ id, name }) => [name, id]));
});

afterEach(async () => {
  await close();
});

/** `malus` in units: the rows carry hundredths. */
type Expected = [name: string, rank: number, malus: number, bullseyes: number, meanError: number | null, played: number, delta: number | null];

function expectRows(rows: StandingView[], expected: Expected[]) {
  expect(rows.map(({ name }) => name)).toEqual(expected.map(([name]) => name));
  rows.forEach((row, index) => {
    const [name, rank, malus, bullseyes, meanError, played, delta] = expected[index];
    expect({ name: row.name, rank: row.rank, malus: row.malus, bullseyes: row.bullseyes, played: row.questionsPlayed, delta: row.delta }).toEqual({
      name,
      rank,
      malus: malus * 100,
      bullseyes,
      played,
      delta,
    });
    if (meanError === null) expect(row.meanError, name).toBeNull();
    else expect(row.meanError, name).toBeCloseTo(meanError, 12);
  });
}

describe("getStandings on the seed (§5.6)", () => {
  it("equals the standings computed by hand: malus, ranks, Dans le mille, mean error, arrows", async () => {
    const standings = await getStandings(db, { id: ids.Sarah, role: "player" }, {}, MID_SEASON);
    expect(standings.season?.label).toBe("2026-2027");
    expect(standings.resolvedCount).toBe(3);
    expectRows(standings.rows, [
      ["Sarah", 1, 10 + 100 + 200, 0, (0.04 + 0.05) / 2, 3, 0],
      ["Mehdi", 2, 50 + 200 + 200, 0, 0.1, 1, 0],
      ["Léa", 3, 50 + 300 + 200, 0, 0.3, 1, 0],
      ["Julien", 4, 6 + 600 + 0, 0, 0.048, 2, 0],
      ["Inès", 5, 15 + 600 + 0, 0, 0.06, 2, 0],
      ["Thomas", 6, 50 + 600 + 0, 0, 0.2, 2, +1],
      // Perfect tie: same rank, shown in French alphabetical order. Before the latest result, they were
      // tied at rank 8 with Admin.
      ["Hugo", 7, 50 + 600 + 0, 0, null, 1, +1],
      ["Nora", 7, 50 + 600 + 0, 0, null, 1, +1],
      ["Camille", 9, 15 + 600 + 200, 0, 0.06, 2, -4],
      ["Admin", 10, 50 + 600 + 200, 0, null, 1, -2],
    ]);
    expect(standings.rows.filter(({ isViewer }) => isViewer).map(({ name }) => name)).toEqual(["Sarah"]);
  });

  it("marks a disabled account that has predictions as inactive, and leaves out one that has none", async () => {
    const { rows } = await getStandings(db, { id: ids.Sarah, role: "player" }, {}, MID_SEASON);
    expect(rows.filter(({ inactive }) => inactive).map(({ name }) => name)).toEqual(["Nora"]);

    // The previous season: Nora made no prediction in it.
    const [previous] = (await getAvailableSeasons(db)).filter(({ label }) => label === "2025-2026");
    const before = await getStandings(db, { id: ids.Sarah, role: "player" }, { seasonId: previous.id }, MID_SEASON);
    expect(before.rows.map(({ name }) => name)).not.toContain("Nora");
    expect(before.rows).toHaveLength(9);
  });

  it("lists an account created after the end of a season in the current one only, with the malus of its absences", async () => {
    const [newcomer] = await db
      .insert(user)
      .values({ id: "nouvelle", name: "Zoé", email: "zoe@example.test", avatar: "maillot-vert-uni", createdAt: new Date("2026-11-02T09:00:00Z") })
      .returning();
    const seasons = await getAvailableSeasons(db);
    const previous = seasons.find(({ label }) => label === "2025-2026")!;
    const viewer = { id: ids.Sarah, role: "player" as const };

    const current = await getStandings(db, viewer, {}, MID_SEASON);
    // Absent everywhere, even on the questions resolved before she arrived (v1.2, C8): 50 + 600 + 200,
    // no error, like Admin: tied at rank 10.
    expect(current.rows.find(({ userId }) => userId === newcomer.id)).toMatchObject({ malus: 85_000, rank: 10, questionsPlayed: 0 });
    const before = await getStandings(db, viewer, { seasonId: previous.id }, MID_SEASON);
    expect(before.rows.map(({ userId }) => userId)).not.toContain(newcomer.id);
    expect(before.rows).toHaveLength(9);
  });

  it("moves the arrows after the latest result", async () => {
    const admin: Actor = { id: ids.Admin, role: "admin", banned: false };
    const [studyrama] = await db.select().from(question).where(eq(question.title, "Combien de visiteurs sur le stand du salon Studyrama ?"));
    const later = new Date(MID_SEASON.getTime() + 3_600_000);
    expect(await resolveQuestion(db, admin, { questionId: studyrama.id, rawValue: "250" }, later)).toMatchObject({ ok: true });

    // Real 250: Inès 250 (Dans le mille, 0), Mehdi 240 (10), Hugo 262 (12), Julien 220 (30), Camille 205
    // (45), Thomas 300 (50), Sarah 180 (70, the worst): Admin, Léa and Nora take 70.
    const { rows, resolvedCount } = await getStandings(db, { id: ids.Sarah, role: "player" }, {}, later);
    expect(resolvedCount).toBe(4);
    expectRows(rows, [
      ["Sarah", 1, 310 + 70, 0, (0.04 + 0.05 + 0.28) / 3, 4, 0],
      ["Mehdi", 2, 450 + 10, 0, (0.1 + 0.04) / 2, 2, 0],
      ["Inès", 3, 615 + 0, 1, (0.06 + 0) / 2, 3, +2],
      ["Léa", 4, 550 + 70, 0, 0.3, 1, -1],
      ["Julien", 5, 606 + 30, 0, (0.048 + 0.12) / 2, 3, -1],
      ["Hugo", 6, 650 + 12, 0, 0.048, 2, +1],
      ["Thomas", 7, 650 + 50, 0, (0.2 + 0.2) / 2, 3, -1],
      ["Nora", 8, 650 + 70, 0, null, 1, -1],
      ["Camille", 9, 815 + 45, 0, (0.06 + 0.18) / 2, 3, 0],
      ["Admin", 10, 850 + 70, 0, null, 1, 0],
    ]);
  });
});

describe("getAvailableSeasons (§5.6)", () => {
  it("lists the seasons with a published question, latest first", async () => {
    const seasons = await getAvailableSeasons(db);
    expect(seasons.map(({ label, proclaimed }) => [label, proclaimed])).toEqual([
      ["2026-2027", false],
      ["2025-2026", true],
      ["2024-2025", false],
    ]);
  });
});
