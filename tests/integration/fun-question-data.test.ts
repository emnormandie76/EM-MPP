import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Viewer } from "@/lib/auth/session";
import { getQuestionDetail, getQuestionsList } from "@/lib/data/questions";
import { getQuestionResults } from "@/lib/data/results";
import { getStandings } from "@/lib/data/standings";
import type { Database } from "@/lib/db/client";
import { makeClock } from "../helpers/clock";
import { createTestDb } from "../helpers/db";
import { createCategory, createPrediction, createQuestion, createUser, ensureTestSeason } from "../helpers/factories";

// Reads of a resolved fun question (v1.7, architecture §5.5, §5.6, §8.3): the malus of each place,
// the raw gap kept apart, the absent players at the last place's malus, and the standings, whose
// mean error leaves the fun question out. Vector FU1, with Sarah absent.

const clock = makeClock("2026-11-20T10:00:00Z");
const now = clock.now;

let db: Database;
let close: () => Promise<void>;
let players: Record<string, string>;
let questionId: number;
let seasonId: number;

type PlayerViewer = Pick<Viewer, "id" | "role" | "lastSeenAt" | "previousVisitAt">;
const as = (name: string): PlayerViewer => ({ id: players[name], role: "player", lastSeenAt: null, previousVisitAt: null });

beforeEach(async () => {
  ({ db, close } = await createTestDb());
  seasonId = (await ensureTestSeason(db, "2026-2027", "2026-09-28")).id;
  const categoryId = (await createCategory(db, "Vie du campus")).id;
  players = {};
  for (const name of ["Julien", "Léa", "Hugo", "Camille", "Sarah"]) players[name] = (await createUser(db, { name })).id;
  const q = await createQuestion(db, {
    categoryId,
    title: "Combien de cafés servis au distributeur du campus de Caen en novembre ?",
    unit: "cafés",
    placeMalus: 5,
    status: "published",
    opensAt: clock.at("-10d"),
    closesAt: clock.at("-3d"),
    resultNumber: 4200,
    resolvedAt: clock.at("-1d"),
  });
  questionId = q.id;
  const values: Record<string, number> = { Julien: 4000, Léa: 5000, Hugo: 900, Camille: 20000 };
  for (const [name, valueNumber] of Object.entries(values)) {
    await createPrediction(db, { questionId, userId: players[name], valueNumber, validatedAt: clock.at("-4d"), joker: name === "Hugo" });
  }
});

afterEach(async () => {
  await close();
});

describe("a resolved fun question (v1.7)", () => {
  it("is shown as a fun question, with its malus per place and the coefficient ×1", async () => {
    const detail = (await getQuestionDetail(db, as("Julien"), questionId, now))!;
    expect(detail).toMatchObject({ kind: "fun", type: "number", placeMalus: 5, coefficient: 1, status: "resolved" });
    const list = await getQuestionsList(db, as("Julien"), "resolved", now);
    expect(list.items).toMatchObject([{ id: questionId, kind: "fun", placeMalus: 5, myMalus: 0 }]);
  });

  it("gives the malus of each place, the raw gap apart, a joker halving it, and the last place's malus to Sarah", async () => {
    const detail = (await getQuestionDetail(db, as("Sarah"), questionId, now))!;
    const results = (await getQuestionResults(db, as("Sarah"), detail, now))!;
    expect(results.rows.map(({ name, score }) => [name, score?.podiumRank, score?.gap, score?.total])).toEqual([
      ["Julien", 1, 20_000, 0],
      // Hugo: third place, 10 of malus, halved by his joker; tied with Léa, by name.
      ["Hugo", 3, 330_000, 500],
      ["Léa", 2, 80_000, 500],
      ["Camille", 4, 1_580_000, 1_500],
    ]);
    expect(results.absentMalus).toBe(1_500);
    // Every account of the standings without a prediction: Sarah, and the admin who created the question.
    expect(results.absents.find(({ name }) => name === "Sarah")).toMatchObject({ isViewer: true, malus: 1_500 });
    expect(results.absents.every(({ malus }) => malus === 1_500)).toBe(true);
  });

  it("adds up in the standings, the fun question staying out of the mean error", async () => {
    const standings = await getStandings(db, as("Julien"), { seasonId }, now);
    const byName = Object.fromEntries(standings.rows.map((row) => [row.name, row]));
    expect([byName.Julien.malus, byName.Léa.malus, byName.Hugo.malus, byName.Camille.malus, byName.Sarah.malus]).toEqual([0, 500, 500, 1_500, 1_500]);
    expect(byName.Julien).toMatchObject({ rank: 1, questionsPlayed: 1, meanError: null });
  });
});
