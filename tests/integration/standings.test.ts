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
//
// Current season 2026-2027, resolved questions:
// - JPO de septembre (number, real 250, coef 1), vector P1: Sarah 240 (4 %, 65 + 20 = 85), Julien 262
//   with a joker (4,8 %, (65 + 10) × 2 = 150), Inès and Camille 235 (6 %, 45 + 5 = 50), Thomas 300
//   (20 %, 25).
// - Candidatures BBA (Juste Prix, real 250, coef 1), vector J3: Mehdi 251 (over: 0, error 0,4 %),
//   Sarah 245 (2 %, 80 + 20 = 100), Léa 230 (8 %, 45 + 10 = 55).
// - Campus (choice, "Le Havre", coef 2, resolved last): right for Julien, Inès, Hugo, Nora (100),
//   Thomas with a joker (200); wrong for Sarah, Camille, Admin (0).
// Before the campus question (the previous standings): Sarah 185, Julien 150, Léa 55, Inès and
// Camille 50 (tied at 6 %), Thomas 25, Mehdi 0 (0,4 %), then Hugo, Admin and Nora at 0 without error.

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

type Expected = [name: string, rank: number, points: number, bullseyes: number, meanError: number | null, played: number, delta: number | null];

function expectRows(rows: StandingView[], expected: Expected[]) {
  expect(rows.map(({ name }) => name)).toEqual(expected.map(([name]) => name));
  rows.forEach((row, index) => {
    const [name, rank, points, bullseyes, meanError, played, delta] = expected[index];
    expect({ name: row.name, rank: row.rank, points: row.points, bullseyes: row.bullseyes, played: row.questionsPlayed, delta: row.delta }).toEqual({
      name,
      rank,
      points,
      bullseyes,
      played,
      delta,
    });
    if (meanError === null) expect(row.meanError, name).toBeNull();
    else expect(row.meanError, name).toBeCloseTo(meanError, 12);
  });
}

describe("getStandings on the seed (§5.6)", () => {
  it("equals the standings computed by hand: points, ranks, Dans le mille, mean error, arrows", async () => {
    const standings = await getStandings(db, { id: ids.Sarah, role: "player" }, {}, MID_SEASON);
    expect(standings.season?.label).toBe("2026-2027");
    expect(standings.resolvedCount).toBe(3);
    expectRows(standings.rows, [
      ["Julien", 1, 250, 0, 0.048, 2, +1],
      ["Thomas", 2, 225, 0, 0.2, 2, +4],
      ["Sarah", 3, 185, 0, 0.03, 3, -2],
      ["Inès", 4, 150, 0, 0.06, 2, 0],
      // Perfect tie: same rank, shown in French alphabetical order.
      ["Hugo", 5, 100, 0, null, 1, +3],
      ["Nora", 5, 100, 0, null, 1, +3],
      ["Léa", 7, 55, 0, 0.08, 1, -4],
      ["Camille", 8, 50, 0, 0.06, 2, -4],
      // Same points: the lowest mean error first, a player without error last.
      ["Mehdi", 9, 0, 0, 0.004, 1, -2],
      ["Admin", 10, 0, 0, null, 1, -2],
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

  it("lists an account created after the end of a season in the current one only (decision of 30/09/2026)", async () => {
    const [newcomer] = await db
      .insert(user)
      .values({ id: "nouvelle", name: "Zoé", email: "zoe@example.test", avatar: "maillot-vert-uni", createdAt: new Date("2026-11-02T09:00:00Z") })
      .returning();
    const seasons = await getAvailableSeasons(db);
    const previous = seasons.find(({ label }) => label === "2025-2026")!;
    const viewer = { id: ids.Sarah, role: "player" as const };

    const current = await getStandings(db, viewer, {}, MID_SEASON);
    // 0 point and no error, like Admin: tied at rank 10.
    expect(current.rows.find(({ userId }) => userId === newcomer.id)).toMatchObject({ points: 0, rank: 10, questionsPlayed: 0 });
    const before = await getStandings(db, viewer, { seasonId: previous.id }, MID_SEASON);
    expect(before.rows.map(({ userId }) => userId)).not.toContain(newcomer.id);
    expect(before.rows).toHaveLength(9);
  });

  it("moves the arrows after the latest result", async () => {
    const admin: Actor = { id: ids.Admin, role: "admin", banned: false };
    const [studyrama] = await db.select().from(question).where(eq(question.title, "Combien de visiteurs sur le stand du salon Studyrama ?"));
    const later = new Date(MID_SEASON.getTime() + 3_600_000);
    expect(await resolveQuestion(db, admin, { questionId: studyrama.id, rawValue: "250" }, later)).toMatchObject({ ok: true });

    // Real 250: Inès 250 (Dans le mille, 100 + 20), Mehdi 240 (65 + 10), Hugo 262 (65 + 5), Julien 220,
    // Camille 205 and Thomas 300 (25), Sarah 180 (10).
    const { rows, resolvedCount } = await getStandings(db, { id: ids.Sarah, role: "player" }, {}, later);
    expect(resolvedCount).toBe(4);
    expectRows(rows, [
      ["Julien", 1, 275, 0, (0.048 + 0.12) / 2, 3, 0],
      ["Inès", 2, 270, 1, (0.06 + 0) / 2, 3, +2],
      ["Thomas", 3, 250, 0, (0.2 + 0.2) / 2, 3, -1],
      ["Sarah", 4, 195, 0, (0.04 + 0.02 + 0.28) / 3, 4, -1],
      ["Hugo", 5, 170, 0, 0.048, 2, 0],
      ["Nora", 6, 100, 0, null, 1, -1],
      ["Mehdi", 7, 75, 0, (0.004 + 0.04) / 2, 2, +2],
      ["Camille", 8, 75, 0, (0.06 + 0.18) / 2, 3, 0],
      ["Léa", 9, 55, 0, 0.08, 1, -2],
      ["Admin", 10, 0, 0, null, 1, 0],
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
