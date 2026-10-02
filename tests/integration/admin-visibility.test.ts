import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAdminDashboard, getAdminQuestion } from "@/lib/data/admin";
import { getQuestionPredictionsForViewer } from "@/lib/data/questions";
import type { Database } from "@/lib/db/client";
import { questionExtension } from "@/lib/db/schema";
import { validatePrediction } from "@/lib/services/predictions";
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

describe("after the closing, the values are revealed to whoever predicted the question", () => {
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

describe("v1.2: extensions in the back office (§5.14, §8.3)", () => {
  /** Closed yesterday: Sarah predicted; Julien, absent, has an extension until in 2 days; Inès and the admin have no prediction. */
  async function extendedSetUp() {
    const { admin, sarah, julien, ines, categoryId } = await setUp();
    const closed = await createQuestion(db, {
      categoryId,
      createdBy: admin.id,
      title: "Combien d'inscrits au webinaire ?",
      status: "published",
      opensAt: clock.at("-5d"),
      closesAt: clock.at("-1d"),
    });
    await createPrediction(db, { questionId: closed.id, userId: sarah.id, valueNumber: WITNESS, validatedAt: clock.at("-2d") });
    const deadline = clock.at("+2d");
    await db.insert(questionExtension).values({ questionId: closed.id, userId: julien.id, closesAt: deadline, grantedBy: admin.id, grantedAt: clock.at("-1h") });
    return { admin, sarah, julien, ines, closed, deadline };
  }

  it("the dashboard: the result is blocked with the reason, and the running extensions are listed", async () => {
    const { admin, closed, deadline } = await extendedSetUp();
    const dashboard = await getAdminDashboard(db, adminView(admin), now);
    expect(dashboard.toResolve).toEqual([expect.objectContaining({ id: closed.id, blocker: "Prolongation de Julien jusqu'au mer. 7 oct. à 12 h." })]);
    expect(dashboard.extensions).toEqual([
      { questionId: closed.id, questionTitle: "Combien d'inscrits au webinaire ?", player: expect.objectContaining({ name: "Julien" }), closesAt: deadline, state: "todo" },
    ]);
    expectNoValue(dashboard);

    const after = await getAdminDashboard(db, adminView(admin), deadline);
    // At the deadline, the open question of setUp closes too: both are waiting for their result.
    expect(after.toResolve.find(({ id }) => id === closed.id)).toMatchObject({ blocker: null });
    expect(after.extensions).toEqual([]);
  });

  it("the follow-up: the extension of each player, and what the admin can do on each row", async () => {
    const { admin, closed, deadline } = await extendedSetUp();
    const detail = await getAdminQuestion(db, adminView(admin), closed.id, now);
    expect(detail?.extensionBlocker).toBe("Prolongation de Julien jusqu'au mer. 7 oct. à 12 h.");
    expect(
      detail?.tracking?.map(({ name, state, extension, canExtend, canChangeExtension, canUnlock }) => ({ name, state, extension, canExtend, canChangeExtension, canUnlock })),
    ).toEqual([
      // The admin does not extend a question for themselves.
      { name: "Admin", state: "todo", extension: null, canExtend: false, canChangeExtension: false, canUnlock: false },
      { name: "Inès", state: "todo", extension: null, canExtend: true, canChangeExtension: false, canUnlock: false },
      { name: "Julien", state: "todo", extension: { closesAt: deadline, running: true }, canExtend: false, canChangeExtension: true, canUnlock: false },
      { name: "Sarah", state: "validated", extension: null, canExtend: false, canChangeExtension: false, canUnlock: false },
    ]);
    // The admin did not predict the question: states only (v1.2).
    expectNoValue(detail);
  });

  it("a prediction validated during the extension can be unlocked; after the deadline, nothing is possible any more", async () => {
    const { admin, julien, closed, deadline } = await extendedSetUp();
    await validatePrediction(db, { id: julien.id, role: "player", banned: false }, { questionId: closed.id, rawValue: "120" }, now);
    const during = await getAdminQuestion(db, adminView(admin), closed.id, now);
    expect(during?.tracking?.find(({ name }) => name === "Julien")).toMatchObject({ state: "validated", canUnlock: true, canChangeExtension: true, answer: null });

    const after = await getAdminQuestion(db, adminView(admin), closed.id, deadline);
    expect(after?.extensionBlocker).toBeNull();
    expect(after?.tracking?.find(({ name }) => name === "Julien")).toMatchObject({
      extension: { closesAt: deadline, running: false },
      canUnlock: false,
      canExtend: false,
      canChangeExtension: false,
    });
    // Inès can still get one: the question has no result yet.
    expect(after?.tracking?.find(({ name }) => name === "Inès")).toMatchObject({ canExtend: true });
  });
});
