import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getActiveCategories, getAdminQuestion, getAdminQuestionsList, getCategoriesAdmin, getSeasonsAdmin } from "@/lib/data/admin";
import type { Database } from "@/lib/db/client";
import { category, prize, season } from "@/lib/db/schema";
import { makeClock } from "../helpers/clock";
import { createTestDb } from "../helpers/db";
import { createCategory, createPrediction, createQuestion, createUser, ensureTestSeason } from "../helpers/factories";

// Back-office reads: questions list and filters, one question, categories, seasons (§7.4, §8.3).

const clock = makeClock("2026-10-05T10:00:00Z");
const now = clock.now;

let db: Database;
let close: () => Promise<void>;
let viewer: { id: string; role: "admin" };

beforeEach(async () => {
  ({ db, close } = await createTestDb());
  viewer = { id: (await createUser(db, { role: "admin" })).id, role: "admin" };
});

afterEach(async () => {
  await close();
});

describe("getAdminQuestionsList", () => {
  it("lists every question, newest first, with its computed status, and filters them", async () => {
    const jpo = await createCategory(db, "JPO");
    const candidatures = await createCategory(db, "Candidatures");
    const draft = await createQuestion(db, { categoryId: jpo.id, title: "Brouillon sans dates" });
    const open = await createQuestion(db, {
      categoryId: jpo.id,
      type: "choice",
      unit: null,
      options: ["Oui", "Non"],
      status: "published",
      opensAt: clock.at("-1d"),
      closesAt: clock.at("+1d"),
    });
    const previous = await createQuestion(db, {
      categoryId: candidatures.id,
      priceIsRight: true,
      status: "published",
      opensAt: new Date("2026-09-01T08:00:00Z"),
      closesAt: new Date("2026-09-10T16:00:00Z"),
      resultNumber: 250,
      resolvedAt: new Date("2026-09-20T08:00:00Z"),
    });
    await createPrediction(db, { questionId: open.id, userId: viewer.id, optionId: open.options[0].id });

    const list = await getAdminQuestionsList(db, viewer, {}, now);
    expect(list.rows.map(({ id, kind, status, seasonLabel, predictionCount }) => ({ id, kind, status, seasonLabel, predictionCount }))).toEqual([
      { id: previous.id, kind: "priceIsRight", status: "resolved", seasonLabel: "2025-2026", predictionCount: 0 },
      { id: open.id, kind: "yesNo", status: "open", seasonLabel: "2026-2027", predictionCount: 1 },
      { id: draft.id, kind: "number", status: "draft", seasonLabel: null, predictionCount: 0 },
    ]);
    expect(list.seasons).toEqual(["2026-2027", "2025-2026"]);
    expect(list.categories.map(({ name }) => name)).toEqual(["Candidatures", "JPO"]);

    const ids = async (filters: Parameters<typeof getAdminQuestionsList>[2]) =>
      (await getAdminQuestionsList(db, viewer, filters, now)).rows.map(({ id }) => id);
    expect(await ids({ status: "open" })).toEqual([open.id]);
    expect(await ids({ status: "scheduled" })).toEqual([]);
    expect(await ids({ season: "2025-2026" })).toEqual([previous.id]);
    expect(await ids({ season: "none" })).toEqual([draft.id]);
    expect(await ids({ categoryId: jpo.id })).toEqual([open.id, draft.id]);
    expect(await ids({ categoryId: jpo.id, status: "draft" })).toEqual([draft.id]);
  });
});

describe("getAdminQuestion", () => {
  it("gives the question, its answers, its locks and the categories to choose from", async () => {
    const active = await createCategory(db, "JPO");
    const [archived] = await db.insert(category).values({ name: "Archivée", archivedAt: clock.at("-1d") }).returning();
    await createCategory(db, "Autre archivée").then((row) =>
      db.update(category).set({ archivedAt: now }).where(eq(category.id, row.id)),
    );
    const original = await createQuestion(db, { categoryId: active.id, title: "Question d'origine" });
    const q = await createQuestion(db, {
      categoryId: archived.id,
      type: "choice",
      unit: null,
      options: ["BBA", "MSc"],
      status: "published",
      opensAt: clock.at("-1d"),
      closesAt: clock.at("+1d"),
      duplicatedFromId: original.id,
    });
    await createPrediction(db, { questionId: q.id, userId: viewer.id, optionId: q.options[1].id });

    const detail = await getAdminQuestion(db, viewer, q.id, now);
    expect(detail).toMatchObject({
      question: {
        id: q.id,
        kind: "choice",
        computedStatus: "open",
        categoryName: "Archivée",
        seasonLabel: "2026-2027",
        duplicatedFrom: { id: original.id, title: "Question d'origine" },
      },
      options: [{ label: "BBA" }, { label: "MSc" }],
      predictionCount: 1,
      rules: { content: "QUESTION_LOCKED", other: null, opensAt: "QUESTION_LOCKED", closesAt: null, closesLaterOnly: true },
    });
    expect(detail?.categories.map(({ name }) => name)).toEqual(["JPO", "Archivée"]);
    expect(await getAdminQuestion(db, viewer, 999, now)).toBeNull();
    expect((await getActiveCategories(db, viewer)).map(({ name }) => name)).toEqual(["JPO"]);
  });
});

describe("getCategoriesAdmin", () => {
  it("lists active categories then archived ones, with their number of questions", async () => {
    const jpo = await createCategory(db, "JPO");
    const [archived] = await db.insert(category).values({ name: "Ancienne", archivedAt: now }).returning();
    await createCategory(db, "Candidatures");
    await createQuestion(db, { categoryId: jpo.id });
    await createQuestion(db, { categoryId: jpo.id });
    await createQuestion(db, { categoryId: archived.id });

    expect((await getCategoriesAdmin(db, viewer)).map(({ name, questionCount, archivedAt }) => ({ name, questionCount, archivedAt }))).toEqual([
      { name: "Candidatures", questionCount: 0, archivedAt: null },
      { name: "JPO", questionCount: 2, archivedAt: null },
      { name: "Ancienne", questionCount: 1, archivedAt: now },
    ]);
  });
});

describe("getSeasonsAdmin", () => {
  it("without any season: nothing current, the form offers today", async () => {
    expect(await getSeasonsAdmin(db, viewer, now)).toEqual({
      seasons: [],
      current: null,
      remindNext: false,
      suggestedStart: "2026-10-05",
      suggestedLabel: "2026-2027",
    });
  });

  it("lists the seasons latest start first, with their end, questions and prizes; reminds to create the next one", async () => {
    const previous = await ensureTestSeason(db, "2025-2026", "2025-09-29");
    await db.update(season).set({ proclaimedAt: clock.at("-10d") }).where(eq(season.id, previous.id));
    await db.insert(prize).values({ seasonId: previous.id, rankLabel: "1er", description: "Un mug", position: 1 });
    const current = await ensureTestSeason(db, "Saison 2026", "2026-09-28");
    const categoryId = (await createCategory(db, "JPO")).id;
    const closed = { status: "published" as const, opensAt: new Date("2026-09-01T08:00:00Z"), closesAt: new Date("2026-09-10T16:00:00Z") };
    await createQuestion(db, { categoryId, ...closed, resultNumber: 250, resolvedAt: new Date("2026-09-20T08:00:00Z") });
    await createQuestion(db, { categoryId, ...closed });
    await createQuestion(db, { categoryId, ...closed, status: "cancelled" });
    await createQuestion(db, { categoryId, closesAt: new Date("2026-11-10T16:00:00Z") });

    const view = await getSeasonsAdmin(db, viewer, now);
    expect(view.seasons).toEqual([
      {
        id: current.id,
        label: "Saison 2026",
        startsAt: new Date("2026-09-27T22:00:00Z"),
        endsAt: null,
        proclaimedAt: null,
        isCurrent: true,
        questionsTotal: 0,
        questionsResolved: 0,
        questionsAttached: 1,
        prizes: [],
        proclamationBlocker: "Aucune question n'a été publiée dans cette saison.",
      },
      {
        id: previous.id,
        label: "2025-2026",
        startsAt: new Date("2025-09-28T22:00:00Z"),
        endsAt: new Date("2026-09-27T22:00:00Z"),
        proclaimedAt: clock.at("-10d"),
        isCurrent: false,
        questionsTotal: 2,
        questionsResolved: 1,
        questionsAttached: 3,
        prizes: [expect.objectContaining({ rankLabel: "1er", description: "Un mug" })],
        proclamationBlocker: "Le classement final de cette saison est déjà proclamé.",
      },
    ]);
    expect(view.current?.id).toBe(current.id);
    expect(view.remindNext).toBe(true);
    // A year after the latest start.
    expect([view.suggestedStart, view.suggestedLabel]).toEqual(["2027-09-28", "2027-2028"]);
  });

  it("no longer reminds once the next season exists, and knows when no season has started yet", async () => {
    const current = await ensureTestSeason(db, "2026-2027", "2026-09-28");
    const next = await ensureTestSeason(db, "2027-2028", "2027-09-06");
    let view = await getSeasonsAdmin(db, viewer, now);
    expect(view.seasons.map(({ id, isCurrent, endsAt }) => [id, isCurrent, endsAt])).toEqual([
      [next.id, false, null],
      [current.id, true, next.startsAt],
    ]);
    expect(view.remindNext).toBe(false);
    expect(view.suggestedStart).toBe("2028-09-06");

    view = await getSeasonsAdmin(db, viewer, new Date("2026-09-01T10:00:00Z"));
    expect(view.current).toBeNull();
    expect(view.remindNext).toBe(false);
  });
});
