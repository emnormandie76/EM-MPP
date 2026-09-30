import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAdminDashboard, getAdminQuestion } from "@/lib/data/admin";
import { getQuestionPredictionsForViewer } from "@/lib/data/questions";
import type { Database } from "@/lib/db/client";
import { makeClock } from "../helpers/clock";
import { createTestDb } from "../helpers/db";
import { createCategory, createPrediction, createQuestion, createUser } from "../helpers/factories";

// Visibility of the predictions in the back office (architecture §6.6, §11 É5): before the
// closing, the dashboard and the follow-up never carry a prediction value, not even the admin's.

const clock = makeClock("2026-10-05T10:00:00Z");
const now = clock.now;
/** Witness values: they must never appear before the closing. */
const WITNESS = 987654;
const WITNESS_ADMIN = 876543;

let db: Database;
let close: () => Promise<void>;

beforeEach(async () => {
  ({ db, close } = await createTestDb());
});

afterEach(async () => {
  await close();
});

async function setUp() {
  const admin = await createUser(db, { role: "admin", name: "Admin" });
  const sarah = await createUser(db, { name: "Sarah" });
  const julien = await createUser(db, { name: "Julien" });
  const ines = await createUser(db, { name: "Inès" });
  const nora = await createUser(db, { name: "Nora", banned: true });
  const categoryId = (await createCategory(db, "JPO")).id;
  const open = await createQuestion(db, {
    categoryId,
    createdBy: admin.id,
    title: "Combien de participants à la JPO ?",
    status: "published",
    opensAt: clock.at("-1d"),
    closesAt: clock.at("+2d"),
  });
  await createPrediction(db, { questionId: open.id, userId: sarah.id, valueNumber: WITNESS, joker: true });
  await createPrediction(db, { questionId: open.id, userId: julien.id, valueNumber: WITNESS + 1, validatedAt: clock.at("-2h") });
  await createPrediction(db, { questionId: open.id, userId: admin.id, valueNumber: WITNESS_ADMIN });
  await createPrediction(db, { questionId: open.id, userId: nora.id, valueNumber: WITNESS + 2, validatedAt: clock.at("-1d") });
  return { admin, sarah, julien, ines, nora, categoryId, open };
}

const adminView = (admin: { id: string }) => ({ id: admin.id, role: "admin" as const });
const playerView = (player: { id: string }) => ({ id: player.id, role: "player" as const });

function expectNoValue(data: unknown) {
  const json = JSON.stringify(data);
  for (const value of [WITNESS, WITNESS + 1, WITNESS + 2, WITNESS_ADMIN]) expect(json).not.toContain(String(value));
  expect(json).not.toMatch(/"(valueNumber|optionId|joker)"/);
}

describe("before the closing, the admin only receives states", () => {
  it("the dashboard: validated x / N and who is late, without any value", async () => {
    const { admin, open } = await setUp();
    const dashboard = await getAdminDashboard(db, adminView(admin), now);

    expectNoValue(dashboard);
    expect(dashboard.open).toHaveLength(1);
    // Active accounts: Admin, Inès, Julien, Sarah (Nora is disabled). Only Julien validated.
    expect(dashboard.open[0]).toMatchObject({ id: open.id, validated: 1, total: 4 });
    expect(dashboard.open[0].laggards.map(({ name, state }) => ({ name, state }))).toEqual([
      { name: "Admin", state: "saved" },
      { name: "Inès", state: "todo" },
      { name: "Sarah", state: "saved" },
    ]);
  });

  it("the follow-up of the question: every player's state and validation date, without any value", async () => {
    const { admin, open } = await setUp();
    const detail = await getAdminQuestion(db, adminView(admin), open.id, now);

    expectNoValue(detail);
    expect(detail?.tracking?.map(({ name, state, inactive, validatedAt, answer }) => ({ name, state, inactive, validatedAt, answer }))).toEqual([
      { name: "Admin", state: "saved", inactive: false, validatedAt: null, answer: null },
      { name: "Inès", state: "todo", inactive: false, validatedAt: null, answer: null },
      { name: "Julien", state: "validated", inactive: false, validatedAt: clock.at("-2h"), answer: null },
      { name: "Nora", state: "validated", inactive: true, validatedAt: clock.at("-1d"), answer: null },
      { name: "Sarah", state: "saved", inactive: false, validatedAt: null, answer: null },
    ]);
  });

  it("getQuestionPredictionsForViewer: states for the admin, only their own prediction for a player", async () => {
    const { admin, sarah, open } = await setUp();
    const forAdmin = await getQuestionPredictionsForViewer(db, adminView(admin), open.id, now);
    expectNoValue(forAdmin);
    expect(forAdmin).toHaveLength(4);

    const forSarah = await getQuestionPredictionsForViewer(db, playerView(sarah), open.id, now);
    expect(forSarah).toEqual([
      expect.objectContaining({ name: "Sarah", state: "saved", answer: { valueNumber: WITNESS, optionId: null, joker: true } }),
    ]);
  });
});

describe("after the closing, the values are revealed to everyone", () => {
  it("the follow-up shows each answer, a saved prediction counts as validated", async () => {
    const { admin, sarah, open } = await setUp();
    const afterClosing = clock.at("+2d");
    const detail = await getAdminQuestion(db, adminView(admin), open.id, afterClosing);
    expect(detail?.tracking?.find(({ name }) => name === "Sarah")).toMatchObject({
      state: "validated",
      answer: { valueNumber: WITNESS, optionId: null, joker: true },
    });
    const forSarah = await getQuestionPredictionsForViewer(db, playerView(sarah), open.id, afterClosing);
    expect(forSarah?.map(({ name }) => name)).toEqual(["Admin", "Julien", "Nora", "Sarah"]);
    const dashboard = await getAdminDashboard(db, adminView(admin), afterClosing);
    expect(dashboard.open).toEqual([]);
    expect(dashboard.toResolve.map(({ id }) => id)).toEqual([open.id]);
  });
});

describe("questions that are not open", () => {
  it("a scheduled question does not exist for a player; the admin sees no prediction", async () => {
    const { admin, sarah, categoryId } = await setUp();
    const scheduled = await createQuestion(db, { categoryId, createdBy: admin.id, status: "published", opensAt: clock.at("+1d"), closesAt: clock.at("+3d") });
    expect(await getQuestionPredictionsForViewer(db, playerView(sarah), scheduled.id, now)).toBeNull();
    expect(await getQuestionPredictionsForViewer(db, adminView(admin), scheduled.id, now)).toEqual([]);
    expect(await getQuestionPredictionsForViewer(db, adminView(admin), 999, now)).toBeNull();
    const dashboard = await getAdminDashboard(db, adminView(admin), now);
    expect(dashboard.upcoming.map(({ id }) => id)).toEqual([scheduled.id]);
  });

  it("a cancelled question: nothing for a player, states only for the admin", async () => {
    const { admin, sarah, categoryId } = await setUp();
    const cancelled = await createQuestion(db, {
      categoryId,
      createdBy: admin.id,
      status: "cancelled",
      opensAt: clock.at("-3d"),
      closesAt: clock.at("-1d"),
      cancelledAt: clock.at("-2d"),
    });
    await createPrediction(db, { questionId: cancelled.id, userId: sarah.id, valueNumber: WITNESS, joker: true });
    expect(await getQuestionPredictionsForViewer(db, playerView(sarah), cancelled.id, now)).toEqual([]);
    const forAdmin = await getQuestionPredictionsForViewer(db, adminView(admin), cancelled.id, now);
    expectNoValue(forAdmin);
    expect(forAdmin).toEqual([expect.objectContaining({ name: "Sarah", answer: null })]);
  });

  it("a draft has no follow-up", async () => {
    const { admin, categoryId } = await setUp();
    const draft = await createQuestion(db, { categoryId, createdBy: admin.id });
    expect((await getAdminQuestion(db, adminView(admin), draft.id, now))?.tracking).toBeNull();
  });
});

it("the back-office reads are refused to a player", async () => {
  const { sarah, open } = await setUp();
  await expect(getAdminDashboard(db, playerView(sarah), now)).rejects.toThrow("FORBIDDEN");
  await expect(getAdminQuestion(db, playerView(sarah), open.id, now)).rejects.toThrow("FORBIDDEN");
});
