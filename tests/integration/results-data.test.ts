import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Viewer } from "@/lib/auth/session";
import { getHomeData } from "@/lib/data/home";
import { getPlayerProfile } from "@/lib/data/players";
import { getQuestionDetail, type QuestionDetail } from "@/lib/data/questions";
import { getLatestResult, getQuestionResults } from "@/lib/data/results";
import { getAvailableSeasons } from "@/lib/data/standings";
import type { Database } from "@/lib/db/client";
import { question, user } from "@/lib/db/schema";
import { seedDatabase, WITNESS_VALUE } from "../../scripts/lib/seed";
import { createTestDb } from "../helpers/db";

// Reads of the results (architecture §5.7, §6.6, §8.3 /questions/[id], accueil, /joueurs/[id]),
// on the seed, read-only.

const NOW = new Date("2026-11-20T10:00:00Z");

let db: Database;
let close: () => Promise<void>;
let ids: Record<string, string>;

type PlayerViewer = Pick<Viewer, "id" | "role" | "lastSeenAt" | "previousVisitAt">;
const as = (name: string, role: "player" | "admin" = "player"): PlayerViewer => ({ id: ids[name], role, lastSeenAt: null, previousVisitAt: null });

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await seedDatabase(db, { now: NOW, env: {} });
  const users = await db.select({ id: user.id, name: user.name }).from(user);
  ids = Object.fromEntries(users.map(({ id, name }) => [name, id]));
});

afterAll(async () => {
  await close();
});

async function detail(title: string, viewer: PlayerViewer): Promise<QuestionDetail> {
  const [row] = await db.select({ id: question.id }).from(question).where(eq(question.title, title));
  const found = await getQuestionDetail(db, viewer, row.id, NOW);
  if (!found) throw new Error(`Question not visible: ${title}`);
  return found;
}

describe("getQuestionResults: visibility (§6.6)", () => {
  it("returns nothing before the closing, for a player and for the admin", async () => {
    for (const viewer of [as("Sarah"), as("Admin", "admin")]) {
      const open = await detail("Combien de participants à la JPO du 15 novembre ?", viewer);
      expect(open.status).toBe("open");
      expect(await getQuestionResults(db, viewer, open, NOW)).toBeNull();
      expect(JSON.stringify(open)).not.toContain(String(WITNESS_VALUE));
    }
  });

  it("returns nothing on a cancelled question", async () => {
    const cancelled = await detail("Combien de dossiers complets au 15 octobre ?", as("Hugo"));
    expect(await getQuestionResults(db, as("Hugo"), cancelled, NOW)).toBeNull();
  });
});

describe("getQuestionResults: closed question (§5.7, §8.3)", () => {
  it("gives everyone's predictions, jokers and names, the mean and the median, without real value nor points", async () => {
    const viewer = as("Sarah");
    const q = await detail("Combien d'inscrits au webinaire Grande École de septembre ?", viewer);
    expect(q.status).toBe("closed");
    const results = (await getQuestionResults(db, viewer, q, NOW))!;

    // By name while there is no result.
    expect(results.rows.map(({ name, answer }) => [name, answer.valueNumber, answer.joker])).toEqual([
      ["Admin", 110, false],
      ["Inès", 150, true],
      ["Julien", 120, false],
      ["Léa", 130, false],
      ["Sarah", 140, false],
      ["Thomas", 95, false],
    ]);
    expect(results.rows.every(({ score }) => score === null)).toBe(true);
    expect(results.mine).toMatchObject({ name: "Sarah", isViewer: true });
    // 95, 110, 120, 130, 140, 150: median 125, mean 124,17 shown as 124 (whole predictions).
    expect(results.crowd).toMatchObject({ kind: "number", count: 6, median: 125, displayMedian: 125, displayMean: 124, meanGap: null, medianGap: null });
    expect(results.badges).toEqual([]);
    expect(q.result).toBeNull();
  });
});

describe("getQuestionResults: resolved question (§5.5, §5.7)", () => {
  it("scores the podium with ties (P1) and sorts by total, with the gaps of the crowd", async () => {
    const viewer = as("Sarah");
    const q = await detail("Combien de participants à la JPO de septembre ?", viewer);
    const results = (await getQuestionResults(db, viewer, q, NOW))!;
    expect(
      results.rows.map(({ name, answer, score }) => [name, answer.valueNumber, score!.basePoints, score!.podiumRank, score!.podiumBonus, score!.total]),
    ).toEqual([
      ["Julien", 262, 65, 2, 10, 150],
      ["Sarah", 240, 65, 1, 20, 85],
      ["Camille", 235, 45, 3, 5, 50],
      ["Inès", 235, 45, 3, 5, 50],
      ["Thomas", 300, 25, 5, 0, 25],
    ]);
    expect(results.mine?.score?.relativeError).toBeCloseTo(0.04, 12);
    // 235, 235, 240, 262, 300: median 240, mean 254,4 shown as 254; gaps to 250.
    expect(results.crowd).toMatchObject({ kind: "number", median: 240, displayMean: 254 });
    if (results.crowd?.kind !== "number") throw new Error("number crowd expected");
    expect(results.crowd.meanGap).toBeCloseTo(4.4 / 250, 12);
    expect(results.crowd.medianGap).toBeCloseTo(0.04, 12);
    expect(results.badges).toEqual(["sharpshooter"]);
  });

  it("gives the share of each answer of a choice question, the right one and the viewer's", async () => {
    const viewer = as("Thomas");
    const q = await detail("Quel campus comptera le plus d'intégrés en Bachelor ?", viewer);
    const results = (await getQuestionResults(db, viewer, q, NOW))!;
    if (results.crowd?.kind !== "choice") throw new Error("choice crowd expected");
    // 8 predictions: Caen 2, Le Havre 5, Paris 1; largest remainder: 25, 63, 12.
    expect(results.crowd.shares.map(({ label, count, percent, isAnswer, isMine }) => [label, count, percent, isAnswer, isMine])).toEqual([
      ["Caen", 2, 25, false, false],
      ["Le Havre", 5, 63, true, true],
      ["Paris", 1, 12, false, false],
    ]);
    expect(results.mine?.score).toMatchObject({ basePoints: 50, total: 200 });
    expect(results.rows[0]).toMatchObject({ name: "Thomas", score: { total: 200 } });
    expect(results.rows.find(({ name }) => name === "Nora")).toMatchObject({ inactive: true, score: { total: 100 } });
    expect(results.badges).toEqual(["joker_win"]);
  });
});

describe("getLatestResult and the home page (§8.3, block 4)", () => {
  it("is the latest resolved question, with the viewer's points", async () => {
    const latest = await getLatestResult(db, as("Julien"), NOW);
    expect(latest?.question.title).toBe("Quel campus comptera le plus d'intégrés en Bachelor ?");
    expect(latest?.results.mine?.score?.total).toBe(100);
    const home = await getHomeData(db, as("Julien"), NOW);
    expect(home.latestResult?.question.id).toBe(latest?.question.id);
  });
});

describe("getPlayerProfile (§8.3 /joueurs/[id])", () => {
  it("gives the rank, points, tiles, badges and history of the default season", async () => {
    const profile = (await getPlayerProfile(db, as("Hugo"), { userId: ids.Sarah }, NOW))!;
    expect(profile.player).toMatchObject({ name: "Sarah", inactive: false, isViewer: false });
    expect(profile.season?.label).toBe("2026-2027");
    expect(profile.seasons.map(({ label }) => label)).toEqual(["2026-2027", "2025-2026", "2024-2025"]);
    expect(profile.standing).toMatchObject({ rank: 3, points: 185, bullseyes: 0, questionsPlayed: 3 });
    expect(profile.standing?.meanError).toBeCloseTo(0.03, 12);
    expect(profile.badges.filter(({ count }) => count > 0).map(({ key }) => key)).toEqual(["first_bullseye", "sharpshooter", "assiduous"]);
    // Latest result first.
    expect(profile.history.map(({ title, answer, real, total, joker }) => [title, answer, real, total, joker])).toEqual([
      ["Quel campus comptera le plus d'intégrés en Bachelor ?", { valueNumber: null, optionLabel: "Caen" }, { valueNumber: null, optionLabel: "Le Havre" }, 0, false],
      ["Combien de candidatures BBA pendant la semaine de rentrée ?", { valueNumber: 245, optionLabel: null }, { valueNumber: 250, optionLabel: null }, 100, false],
      ["Combien de participants à la JPO de septembre ?", { valueNumber: 240, optionLabel: null }, { valueNumber: 250, optionLabel: null }, 85, false],
    ]);
    expect(profile.history[0].relativeError).toBeNull();
    expect(profile.history[1].relativeError).toBeCloseTo(0.02, 12);
  });

  it("follows the season asked for, and falls back to the default one for an unknown season", async () => {
    const previous = (await getAvailableSeasons(db)).find(({ label }) => label === "2025-2026")!;
    const profile = (await getPlayerProfile(db, as("Sarah"), { userId: ids.Sarah, seasonId: previous.id }, NOW))!;
    expect(profile.player.isViewer).toBe(true);
    expect(profile.season?.label).toBe("2025-2026");
    expect(profile.standing).toMatchObject({ rank: 2, points: 120, bullseyes: 1 });
    expect(profile.history.map(({ total }) => total)).toEqual([0, 120]);

    const fallback = (await getPlayerProfile(db, as("Sarah"), { userId: ids.Sarah, seasonId: 9999 }, NOW))!;
    expect(fallback.season?.label).toBe("2026-2027");
  });

  it("shows a disabled player as inactive, and nothing for an unknown account", async () => {
    const nora = (await getPlayerProfile(db, as("Sarah"), { userId: ids.Nora }, NOW))!;
    expect(nora.player.inactive).toBe(true);
    expect(nora.standing).toMatchObject({ rank: 5, points: 100, inactive: true });
    // Only resolved questions: Nora's other predictions are not listed.
    expect(nora.history).toHaveLength(1);
    expect(await getPlayerProfile(db, as("Sarah"), { userId: "inconnu" }, NOW)).toBeNull();
  });
});
