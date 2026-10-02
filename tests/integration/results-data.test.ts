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
import { CLOSED_WITNESS_VALUE, seedDatabase, WITNESS_VALUE } from "../../scripts/lib/seed";
import { createTestDb } from "../helpers/db";

// Reads of the results (architecture §5.7, §6.6, §8.3 /questions/[id], accueil, /joueurs/[id]),
// on the seed, read-only. v1.2 (step 8c): malus in hundredths, absent players with the malus of the
// worst prediction; these expectations replace those of the points scale (decision of the user,
// 02/10/2026).

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

  it("v1.2: a player without a prediction on a closed question sees nothing before the result, but the running extension", async () => {
    const q = await detail("Combien d'inscrits au webinaire Grande École de septembre ?", as("Hugo"));
    expect(q.status).toBe("closed");
    const results = (await getQuestionResults(db, as("Hugo"), q, NOW))!;
    expect(results).toMatchObject({ rows: [], mine: null, crowd: null, absents: [], absentMalus: null });
    expect(JSON.stringify([q, results])).not.toContain(String(CLOSED_WITNESS_VALUE));
    // Mehdi's extension, without his name.
    expect(q.othersExtended).toEqual({ count: 1, until: new Date(NOW.getTime() + 2 * 86_400_000) });
  });

  it("v1.2: for the player whose extension runs, the question is open: no results, his own deadline", async () => {
    const q = await detail("Combien d'inscrits au webinaire Grande École de septembre ?", as("Mehdi"));
    expect(q).toMatchObject({ status: "open", extendedUntil: new Date(NOW.getTime() + 2 * 86_400_000), othersExtended: null, mine: null, state: "todo" });
    expect(q.deadline).toEqual(q.extendedUntil);
    expect(await getQuestionResults(db, as("Mehdi"), q, NOW)).toBeNull();
    expect(JSON.stringify(q)).not.toContain(String(CLOSED_WITNESS_VALUE));
  });
});

describe("getQuestionResults: closed question (§5.7, §8.3)", () => {
  it("gives everyone's predictions, jokers and names, the mean and the median, without real value nor malus", async () => {
    const viewer = as("Sarah");
    const q = await detail("Combien d'inscrits au webinaire Grande École de septembre ?", viewer);
    expect(q.status).toBe("closed");
    const results = (await getQuestionResults(db, viewer, q, NOW))!;

    // By name while there is no result. Mehdi has an extension but no prediction: nothing to hide.
    expect(results.rows.map(({ name, answer }) => [name, answer.valueNumber, answer.joker])).toEqual([
      ["Admin", 110, false],
      ["Camille", CLOSED_WITNESS_VALUE, false],
      ["Inès", 150, true],
      ["Julien", 120, false],
      ["Léa", 130, false],
      ["Sarah", 140, false],
      ["Thomas", 95, false],
    ]);
    expect(results.rows.every(({ score }) => score === null)).toBe(true);
    expect(results).toMatchObject({ absents: [], absentMalus: null });
    expect(results.mine).toMatchObject({ name: "Sarah", isViewer: true });
    // 95, 110, 120, 130, 140, 150, 876 543: median 130, mean 125 326,86 shown as 125 327 (whole predictions).
    expect(results.crowd).toMatchObject({ kind: "number", count: 7, median: 130, displayMedian: 130, displayMean: 125_327, meanGap: null, medianGap: null });
    expect(results.badges).toEqual([]);
    expect(q.result).toBeNull();
    expect(q.othersExtended).toMatchObject({ count: 1 });
  });
});

describe("getQuestionResults: resolved question (§5.5, §5.7)", () => {
  it("gives the malus with the proximity ranks (P1), the smallest first, then the absent players, with the gaps of the crowd", async () => {
    const viewer = as("Sarah");
    const q = await detail("Combien de participants à la JPO de septembre ?", viewer);
    const results = (await getQuestionResults(db, viewer, q, NOW))!;
    expect(results.rows.map(({ name, answer, score }) => [name, answer.valueNumber, score!.baseMalus, score!.podiumRank, score!.total])).toEqual([
      ["Julien", 262, 1_200, 2, 600],
      ["Sarah", 240, 1_000, 1, 1_000],
      ["Camille", 235, 1_500, 3, 1_500],
      ["Inès", 235, 1_500, 3, 1_500],
      ["Thomas", 300, 5_000, 5, 5_000],
    ]);
    // The players of the standings without a prediction take the worst gap, 50.
    expect(results.absentMalus).toBe(5_000);
    expect(results.absents.map(({ name, malus, inactive }) => [name, malus, inactive])).toEqual([
      ["Admin", 5_000, false],
      ["Hugo", 5_000, false],
      ["Léa", 5_000, false],
      ["Mehdi", 5_000, false],
      ["Nora", 5_000, true],
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
    expect(results.mine?.score).toMatchObject({ baseMalus: 0, total: 0 });
    // Right answers first (0), by name, then the wrong ones (100 × 2).
    expect(results.rows.map(({ name, score }) => [name, score!.total])).toEqual([
      ["Hugo", 0],
      ["Inès", 0],
      ["Julien", 0],
      ["Nora", 0],
      ["Thomas", 0],
      ["Admin", 20_000],
      ["Camille", 20_000],
      ["Sarah", 20_000],
    ]);
    expect(results.rows.find(({ name }) => name === "Nora")).toMatchObject({ inactive: true });
    // No answer counts as a wrong answer: 100 × 2.
    expect(results.absents.map(({ name, malus }) => [name, malus])).toEqual([
      ["Léa", 20_000],
      ["Mehdi", 20_000],
    ]);
    expect(results.badges).toEqual(["joker_win"]);
  });
});

describe("getLatestResult and the home page (§8.3, block 4)", () => {
  it("is the latest resolved question, with the viewer's malus", async () => {
    const latest = await getLatestResult(db, as("Julien"), NOW);
    expect(latest?.question.title).toBe("Quel campus comptera le plus d'intégrés en Bachelor ?");
    expect(latest?.results.mine?.score?.total).toBe(0);
    // Léa did not answer: she sees the malus of her absence.
    const absent = await getLatestResult(db, as("Léa"), NOW);
    expect(absent?.results.mine).toBeNull();
    expect(absent?.results.absents.find(({ isViewer }) => isViewer)).toMatchObject({ name: "Léa", malus: 20_000 });
    const home = await getHomeData(db, as("Julien"), NOW);
    expect(home.latestResult?.question.id).toBe(latest?.question.id);
  });
});

describe("getPlayerProfile (§8.3 /joueurs/[id])", () => {
  it("gives the rank, malus, tiles, badges and history of the default season", async () => {
    const profile = (await getPlayerProfile(db, as("Hugo"), { userId: ids.Sarah }, NOW))!;
    expect(profile.player).toMatchObject({ name: "Sarah", inactive: false, isViewer: false });
    expect(profile.season?.label).toBe("2026-2027");
    expect(profile.seasons.map(({ label }) => label)).toEqual(["2026-2027", "2025-2026", "2024-2025"]);
    expect(profile.standing).toMatchObject({ rank: 1, malus: 31_000, bullseyes: 0, questionsPlayed: 3 });
    expect(profile.standing?.meanError).toBeCloseTo((0.04 + 0.05) / 2, 12);
    expect(profile.badges.filter(({ count }) => count > 0).map(({ key }) => key)).toEqual(["first_bullseye", "sharpshooter", "assiduous"]);
    // Latest result first.
    expect(profile.history.map(({ title, answer, real, gap, malus, joker }) => [title, answer, real, gap, malus, joker])).toEqual([
      ["Quel campus comptera le plus d'intégrés en Bachelor ?", { valueNumber: null, optionLabel: "Caen" }, { valueNumber: null, optionLabel: "Le Havre" }, null, 20_000, false],
      ["Combien de candidatures BBA pendant la semaine de rentrée ?", { valueNumber: 1050, optionLabel: null }, { valueNumber: 1000, optionLabel: null }, 5_000, 10_000, false],
      ["Combien de participants à la JPO de septembre ?", { valueNumber: 240, optionLabel: null }, { valueNumber: 250, optionLabel: null }, 1_000, 1_000, false],
    ]);
    expect(profile.history[0].relativeError).toBeNull();
    expect(profile.history[1].relativeError).toBeCloseTo(0.05, 12);
  });

  it("v1.2: lists the questions a player did not predict, with the malus of the absence, so that the total adds up", async () => {
    const profile = (await getPlayerProfile(db, as("Sarah"), { userId: ids.Mehdi }, NOW))!;
    expect(profile.history.map(({ title, answer, gap, malus }) => [title, answer, gap, malus])).toEqual([
      ["Quel campus comptera le plus d'intégrés en Bachelor ?", null, null, 20_000],
      ["Combien de candidatures BBA pendant la semaine de rentrée ?", { valueNumber: 900, optionLabel: null }, 10_000, 20_000],
      ["Combien de participants à la JPO de septembre ?", null, null, 5_000],
    ]);
    expect(profile.history.reduce((sum, { malus }) => sum + malus, 0)).toBe(profile.standing?.malus);
  });

  it("follows the season asked for, and falls back to the default one for an unknown season", async () => {
    const previous = (await getAvailableSeasons(db)).find(({ label }) => label === "2025-2026")!;
    const profile = (await getPlayerProfile(db, as("Sarah"), { userId: ids.Sarah, seasonId: previous.id }, NOW))!;
    expect(profile.player.isViewer).toBe(true);
    expect(profile.season?.label).toBe("2025-2026");
    expect(profile.standing).toMatchObject({ rank: 2, malus: 6_000, bullseyes: 1 });
    // The Oui/Non question (wrong: 50), then the candidatures (1 210 for 1 200: 10).
    expect(profile.history.map(({ malus }) => malus)).toEqual([5_000, 1_000]);

    const fallback = (await getPlayerProfile(db, as("Sarah"), { userId: ids.Sarah, seasonId: 9999 }, NOW))!;
    expect(fallback.season?.label).toBe("2026-2027");
  });

  it("shows a disabled player as inactive, and nothing for an unknown account", async () => {
    const nora = (await getPlayerProfile(db, as("Sarah"), { userId: ids.Nora }, NOW))!;
    expect(nora.player.inactive).toBe(true);
    expect(nora.standing).toMatchObject({ rank: 7, malus: 65_000, inactive: true });
    // Only resolved questions: Nora's other predictions are not listed; she is in the standings of
    // the season, so the questions she missed are listed with the malus of her absence (v1.2).
    expect(nora.history.map(({ answer, malus }) => [answer === null, malus])).toEqual([
      [false, 0],
      [true, 60_000],
      [true, 5_000],
    ]);
    expect(await getPlayerProfile(db, as("Sarah"), { userId: "inconnu" }, NOW)).toBeNull();
  });
});
