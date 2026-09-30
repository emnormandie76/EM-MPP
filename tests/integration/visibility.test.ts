import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getQuestionHistory } from "@/lib/data/admin";
import { getHomeData } from "@/lib/data/home";
import { getOpenQuestionsForViewer, getQuestionDetail, getQuestionPredictionsForViewer, getQuestionsList } from "@/lib/data/questions";
import { getStandings } from "@/lib/data/standings";
import type { Database } from "@/lib/db/client";
import { predictionEvent } from "@/lib/db/schema";
import { makeClock } from "../helpers/clock";
import { createTestDb } from "../helpers/db";
import { createCategory, createPrediction, createQuestion, createUser, ensureTestSeason } from "../helpers/factories";

// Visibility of the predictions on the player pages (architecture §6.6, §11 É6): before the
// closing, a player only receives their own prediction and the admin only states; after it,
// everyone receives the values. Now is 5 October 2026, in the season 2026-2027 (from 28 September).

const clock = makeClock("2026-10-05T10:00:00Z");
const now = clock.now;
/** Witness values of the other players: they must never appear before the closing. */
const WITNESS = 987654;
const WITNESS_ADMIN = 876543;

let db: Database;
let close: () => Promise<void>;

beforeEach(async () => {
  ({ db, close } = await createTestDb());
  await ensureTestSeason(db, "2026-2027", "2026-09-28");
});

afterEach(async () => {
  await close();
});

async function setUp() {
  const admin = await createUser(db, { role: "admin", name: "Admin" });
  const sarah = await createUser(db, { name: "Sarah" });
  const julien = await createUser(db, { name: "Julien" });
  const categoryId = (await createCategory(db, "JPO")).id;
  const published = { categoryId, createdBy: admin.id, status: "published" as const };
  const open = await createQuestion(db, { ...published, title: "Combien de participants à la JPO ?", opensAt: clock.at("-1d"), closesAt: clock.at("+2d") });
  const julienPrediction = await createPrediction(db, { questionId: open.id, userId: julien.id, valueNumber: WITNESS, joker: true, validatedAt: clock.at("-2h") });
  await createPrediction(db, { questionId: open.id, userId: admin.id, valueNumber: WITNESS_ADMIN });
  await createPrediction(db, { questionId: open.id, userId: sarah.id, valueNumber: 240 });
  return { admin, sarah, julien, categoryId, published, open, julienPrediction };
}

const view = (account: { id: string; role: string | null; lastSeenAt?: Date | null; previousVisitAt?: Date | null }) => ({
  id: account.id,
  role: account.role === "admin" ? ("admin" as const) : ("player" as const),
  lastSeenAt: account.lastSeenAt ?? null,
  previousVisitAt: account.previousVisitAt ?? null,
});

function expectNoWitness(data: unknown, witnesses = [WITNESS, WITNESS_ADMIN]) {
  const json = JSON.stringify(data);
  for (const value of witnesses) expect(json).not.toContain(String(value));
}

describe("before the closing", () => {
  it("a player only receives their own prediction, on every player read", async () => {
    const { sarah, open } = await setUp();
    const viewer = view(sarah);

    const openQuestions = await getOpenQuestionsForViewer(db, viewer, now);
    expectNoWitness(openQuestions);
    expect(openQuestions).toEqual([expect.objectContaining({ id: open.id, state: "saved", mine: expect.objectContaining({ valueNumber: 240, joker: false }) })]);

    const detail = await getQuestionDetail(db, viewer, open.id, now);
    expectNoWitness(detail);
    expect(detail).toMatchObject({ status: "open", result: null, mine: { valueNumber: 240 } });

    const list = await getQuestionsList(db, viewer, "open", now);
    expectNoWitness(list);
    const home = await getHomeData(db, viewer, now);
    expectNoWitness(home);
    const standings = await getStandings(db, viewer, {}, now);
    expectNoWitness(standings);

    expect(await getQuestionPredictionsForViewer(db, viewer, open.id, now)).toEqual([
      expect.objectContaining({ name: "Sarah", answer: { valueNumber: 240, optionId: null, joker: false } }),
    ]);
  });

  it("the admin, who plays too, only receives their own prediction on the player pages, and states in the back office", async () => {
    const { admin, open } = await setUp();
    const viewer = view(admin);
    const detail = await getQuestionDetail(db, viewer, open.id, now);
    expectNoWitness(detail, [WITNESS]);
    expect(detail?.mine?.valueNumber).toBe(WITNESS_ADMIN);
    expectNoWitness(await getOpenQuestionsForViewer(db, viewer, now), [WITNESS]);
    expectNoWitness(await getHomeData(db, viewer, now), [WITNESS]);

    const states = await getQuestionPredictionsForViewer(db, viewer, open.id, now);
    expectNoWitness(states);
    expect(states?.map(({ name, state, answer }) => ({ name, state, answer }))).toEqual([
      { name: "Admin", state: "saved", answer: null },
      { name: "Julien", state: "validated", answer: null },
      { name: "Sarah", state: "saved", answer: null },
    ]);
  });

  it("the history of the back office gives types and times, without values", async () => {
    const { admin, julien, open, julienPrediction } = await setUp();
    const event = { predictionId: julienPrediction.id, questionId: open.id, ownerId: julien.id, actorId: julien.id, valueNumber: WITNESS };
    await db.insert(predictionEvent).values([
      { ...event, type: "saved", joker: false, createdAt: clock.at("-3h") },
      { ...event, type: "joker_on", joker: true, createdAt: clock.at("-150min") },
      { ...event, actorId: admin.id, type: "unlocked", joker: true, createdAt: clock.at("-1h") },
    ]);

    const before = await getQuestionHistory(db, view(admin), open.id, now);
    expectNoWitness(before);
    expect(JSON.stringify(before)).not.toMatch(/"(valueNumber|optionId|joker)"/);
    expect(before.map(({ type, ownerName, actorName, answer }) => ({ type, ownerName, actorName, answer }))).toEqual([
      { type: "unlocked", ownerName: "Julien", actorName: "Admin", answer: null },
      { type: "joker_on", ownerName: "Julien", actorName: null, answer: null },
      { type: "saved", ownerName: "Julien", actorName: null, answer: null },
    ]);

    const after = await getQuestionHistory(db, view(admin), open.id, clock.at("+3d"));
    expect(after.at(-1)).toMatchObject({ type: "saved", answer: { valueNumber: WITNESS, optionId: null, joker: false } });
    await expect(getQuestionHistory(db, view(julien), open.id, now)).rejects.toThrow("FORBIDDEN");
  });
});

describe("after the closing", () => {
  it("everyone receives every value, with the jokers and the names", async () => {
    const { admin, sarah, open } = await setUp();
    const afterClosing = clock.at("+3d");
    for (const viewer of [view(sarah), view(admin)]) {
      const predictions = await getQuestionPredictionsForViewer(db, viewer, open.id, afterClosing);
      expect(predictions?.map(({ name, state, answer }) => ({ name, state, answer }))).toEqual([
        { name: "Admin", state: "validated", answer: { valueNumber: WITNESS_ADMIN, optionId: null, joker: false } },
        { name: "Julien", state: "validated", answer: { valueNumber: WITNESS, optionId: null, joker: true } },
        { name: "Sarah", state: "validated", answer: { valueNumber: 240, optionId: null, joker: false } },
      ]);
    }
    // The saved prediction counts as validated at the closing, without any write.
    expect(await getQuestionDetail(db, view(sarah), open.id, afterClosing)).toMatchObject({ status: "closed", state: "validated", mine: { validatedAt: null } });
  });
});

describe("questions that do not exist for a player", () => {
  it("a scheduled question and a draft are unknown to a player, and to the admin on the player pages", async () => {
    const { admin, sarah, categoryId, published } = await setUp();
    const scheduled = await createQuestion(db, { ...published, opensAt: clock.at("+1d"), closesAt: clock.at("+3d") });
    const draft = await createQuestion(db, { categoryId, createdBy: admin.id });
    for (const viewer of [view(sarah), view(admin)]) {
      expect(await getQuestionDetail(db, viewer, scheduled.id, now)).toBeNull();
      expect(await getQuestionDetail(db, viewer, draft.id, now)).toBeNull();
      expect(await getQuestionDetail(db, viewer, 999_999, now)).toBeNull();
      expect((await getOpenQuestionsForViewer(db, viewer, now)).map(({ id }) => id)).not.toContain(scheduled.id);
    }
    const list = await getQuestionsList(db, view(sarah), "open", now);
    expect(list.items.map(({ id }) => id)).not.toContain(scheduled.id);
  });

  it("a question cancelled before it opened stays hidden; one cancelled once open shows as cancelled, without predictions", async () => {
    const { sarah, published } = await setUp();
    const neverOpened = await createQuestion(db, { ...published, status: "cancelled", opensAt: clock.at("+1d"), closesAt: clock.at("+3d"), cancelledAt: clock.at("-1h") });
    const cancelled = await createQuestion(db, { ...published, status: "cancelled", opensAt: clock.at("-3d"), closesAt: clock.at("+3d"), cancelledAt: clock.at("-1d") });
    const other = await createUser(db);
    await createPrediction(db, { questionId: cancelled.id, userId: other.id, valueNumber: WITNESS, joker: true });

    const viewer = view(sarah);
    expect(await getQuestionDetail(db, viewer, neverOpened.id, now)).toBeNull();
    expect(await getQuestionDetail(db, viewer, cancelled.id, now)).toMatchObject({ status: "cancelled", mine: null });
    const list = await getQuestionsList(db, viewer, "cancelled", now);
    expect(list.items.map(({ id }) => id)).toEqual([cancelled.id]);
    expect(list.counts).toEqual({ open: 1, closed: 0, resolved: 0, cancelled: 1 });
    expect(await getQuestionPredictionsForViewer(db, viewer, cancelled.id, now)).toEqual([]);
  });
});

describe("the player's reads", () => {
  it("the open questions, closing soonest first, with the Nouveau badge since the last visit (§5.9)", async () => {
    const { sarah, published, open } = await setUp();
    const later = await createQuestion(db, { ...published, opensAt: clock.at("-1h"), closesAt: clock.at("+6d") });
    const sooner = await createQuestion(db, { ...published, opensAt: clock.at("-3d"), closesAt: clock.at("+1d") });

    // Last page seen 2 hours ago: a new visit, whose reference is that last page.
    const visitor = view({ ...sarah, lastSeenAt: clock.at("-2h"), previousVisitAt: clock.at("-3d") });
    const questions = await getOpenQuestionsForViewer(db, visitor, now);
    expect(questions.map(({ id, isNew }) => ({ id, isNew }))).toEqual([
      { id: sooner.id, isNew: false },
      { id: open.id, isNew: false },
      { id: later.id, isNew: true },
    ]);
    // Never came: no badge at all.
    expect((await getOpenQuestionsForViewer(db, view(sarah), now)).some(({ isNew }) => isNew)).toBe(false);
  });

  it("the jokers left in the season of each question, and the date of the latest save", async () => {
    const { sarah, published } = await setUp();
    const withJoker = await createQuestion(db, { ...published, opensAt: clock.at("-1d"), closesAt: clock.at("+4d") });
    await createPrediction(db, { questionId: withJoker.id, userId: sarah.id, valueNumber: 12, joker: true, updatedAt: clock.at("-1h") });
    const questions = await getOpenQuestionsForViewer(db, view(sarah), now);
    expect(questions.map(({ jokersLeft }) => jokersLeft)).toEqual([1, 1]);
    expect(questions[1].mine?.savedAt).toEqual(clock.at("-1h"));
  });

  it("the resolved tab gives the viewer's points, computed with everyone's predictions", async () => {
    const { sarah, julien, published } = await setUp();
    const resolved = await createQuestion(db, {
      ...published,
      opensAt: clock.at("-6d"),
      closesAt: clock.at("-4d"),
      resultNumber: 250,
      resolvedAt: clock.at("-1d"),
    });
    await createPrediction(db, { questionId: resolved.id, userId: sarah.id, valueNumber: 240 });
    await createPrediction(db, { questionId: resolved.id, userId: julien.id, valueNumber: 300 });
    const list = await getQuestionsList(db, view(sarah), "resolved", now);
    // 240 for 250: 4 %, 65 points, the closest (+20).
    expect(list.items).toEqual([expect.objectContaining({ id: resolved.id, status: "resolved", state: "validated", myPoints: 85 })]);
    expect((await getQuestionDetail(db, view(sarah), resolved.id, now))?.result).toEqual({ valueNumber: 250, optionId: null });
  });

  it("the home page: progress, the next closings, the standings and the jokers of the current season", async () => {
    const { sarah, julien, published, open } = await setUp();
    const resolved = await createQuestion(db, { ...published, opensAt: clock.at("-6d"), closesAt: clock.at("-4d"), resultNumber: 250, resolvedAt: clock.at("-1d") });
    await createPrediction(db, { questionId: resolved.id, userId: julien.id, valueNumber: 250, joker: true });
    for (let i = 0; i < 5; i += 1) await createQuestion(db, { ...published, opensAt: clock.at("-1d"), closesAt: clock.at(`+${3 + i}d`) });

    const home = await getHomeData(db, view(sarah), now);
    expect(home.progress).toEqual({ open: 6, validated: 0 });
    expect(home.closingSoon).toHaveLength(5);
    expect(home.closingSoon[0].id).toBe(open.id);
    expect(home.standings).toMatchObject({ season: { label: "2026-2027" }, resolvedCount: 1, mine: null });
    // Julien: 100 + 20, with a joker.
    expect(home.standings.top.map(({ name, points, rank }) => ({ name, points, rank }))).toEqual([
      { name: "Julien", points: 240, rank: 1 },
      { name: "Admin", points: 0, rank: 2 },
      { name: "Sarah", points: 0, rank: 2 },
    ]);
    expect(home.standings.me).toMatchObject({ name: "Sarah", isViewer: true });
    expect(home.jokersLeft).toBe(2);
    // Julien has posed his 2 jokers of the season: on the open question and on the resolved one.
    expect((await getHomeData(db, view(julien), now)).jokersLeft).toBe(0);
  });
});
