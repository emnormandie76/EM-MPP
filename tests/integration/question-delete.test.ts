import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAdminQuestion, getAdminQuestionsList } from "@/lib/data/admin";
import { getUnreadChatCount } from "@/lib/data/chat";
import { getJokersLeft } from "@/lib/data/questions";
import { getStandings } from "@/lib/data/standings";
import type { Database } from "@/lib/db/client";
import { chatMessage, chatRead, prediction, predictionEvent, question, questionExtension, questionOption, season } from "@/lib/db/schema";
import { savePrediction, setJoker } from "@/lib/services/predictions";
import { deleteQuestion, duplicateQuestion, resolveQuestion } from "@/lib/services/questions";
import type { Actor } from "@/lib/services/result";
import { deleteSeason } from "@/lib/services/seasons";
import { isDeletionConfirmed } from "@/lib/validation/question";
import { makeClock } from "../helpers/clock";
import { createTestDb } from "../helpers/db";
import { createCategory, createPrediction, createQuestion as insertQuestion, createUser, ensureTestSeason } from "../helpers/factories";

// Deletion of a question for good (v1.4, architecture §5.11, vectors QD1 to QD11, step 8e). It
// replaces the deletion of a draft without prediction (`deleteDraftQuestion`), whose expectations
// QD1 keeps. The admin has created two seasons: 2025-2026 from 29 September 2025 (proclaimed in
// QD6) and 2026-2027 from 28 September 2026, which allows jokers.

const clock = makeClock("2026-10-15T10:00:00Z");
const now = clock.now;

const PROCLAIMED = "Cette question appartient à une saison proclamée : son palmarès est figé, elle ne peut plus être supprimée.";
const CONFIRM = "Cette question a des pronos : tape SUPPRIMER pour confirmer.";

let db: Database;
let close: () => Promise<void>;
let admin: Actor;
let categoryId: number;
let previous: typeof season.$inferSelect;
let current: typeof season.$inferSelect;

beforeEach(async () => {
  ({ db, close } = await createTestDb());
  admin = actorOf(await createUser(db, { role: "admin", name: "Admin" }));
  categoryId = (await createCategory(db, "JPO")).id;
  previous = await ensureTestSeason(db, "2025-2026", "2025-09-29");
  current = await ensureTestSeason(db, "2026-2027", "2026-09-28");
});

afterEach(async () => {
  await close();
});

function actorOf(row: { id: string; role: string | null; banned: boolean | null }): Actor {
  return { id: row.id, role: row.role === "admin" ? "admin" : "player", banned: row.banned === true };
}

async function player(name: string): Promise<Actor> {
  return actorOf(await createUser(db, { name }));
}

function createQuestion(overrides: Parameters<typeof insertQuestion>[1] = {}) {
  return insertQuestion(db, { categoryId, createdBy: admin.id, ...overrides });
}

const OPEN = { status: "published", opensAt: clock.at("-1d"), closesAt: clock.at("+5d") } as const;
const CLOSED = { status: "published", opensAt: clock.at("-5d"), closesAt: clock.at("-1d") } as const;

/** Every row of the tables a deletion touches, to check that a refusal changes nothing. */
async function snapshot(): Promise<string> {
  const tables = [season, question, questionOption, prediction, predictionEvent, questionExtension, chatMessage, chatRead];
  const dumps = await Promise.all(tables.map(async (table) => (await db.select().from(table)).map((row) => JSON.stringify(row)).sort()));
  return JSON.stringify(dumps);
}

/** What is left of a question, table by table. */
async function leftOf(questionId: number) {
  return {
    question: (await db.select().from(question).where(eq(question.id, questionId))).length,
    options: (await db.select().from(questionOption).where(eq(questionOption.questionId, questionId))).length,
    predictions: (await db.select().from(prediction).where(eq(prediction.questionId, questionId))).length,
    events: (await db.select().from(predictionEvent).where(eq(predictionEvent.questionId, questionId))).length,
    extensions: (await db.select().from(questionExtension).where(eq(questionExtension.questionId, questionId))).length,
    chat: (await db.select().from(chatMessage).where(eq(chatMessage.questionId, questionId))).length,
  };
}

const NOTHING_LEFT = { question: 0, options: 0, predictions: 0, events: 0, extensions: 0, chat: 0 };

describe("isDeletionConfirmed", () => {
  it("reads SUPPRIMER, spaces around and case aside", () => {
    for (const typed of ["SUPPRIMER", "supprimer", "  Supprimer  "]) expect(isDeletionConfirmed(typed), typed).toBe(true);
    for (const typed of ["SUPPRIME", "SUP PRIMER", "SUPPRIMER !", "", undefined, null]) expect(isDeletionConfirmed(typed), String(typed)).toBe(false);
  });
});

describe("deleteQuestion (§5.11)", () => {
  it("QD1: a draft without prediction is deleted, its answers included", async () => {
    const draft = await createQuestion({ type: "choice", unit: null, options: ["BBA", "MSc", "Grande École"] });

    expect(await deleteQuestion(db, admin, { questionId: draft.id }, now)).toEqual({
      ok: true,
      data: { title: draft.title, predictions: 0, extensions: 0, resultMessage: false },
    });
    expect(await leftOf(draft.id)).toEqual(NOTHING_LEFT);
  });

  it("QD2: an open question with predictions needs SUPPRIMER; once deleted, its jokers are given back", async () => {
    const sarah = await player("Sarah");
    const julien = await player("Julien");
    const deleted = await createQuestion({ ...OPEN, type: "choice", unit: null, options: ["BBA", "MSc", "Grande École"] });
    const others = [await createQuestion({ ...OPEN, closesAt: clock.at("+3d") }), await createQuestion({ ...OPEN, closesAt: clock.at("+4d") })];
    // Through the services, so that each prediction has its events: saved, then joker_on for Sarah.
    expect(await savePrediction(db, sarah, { questionId: deleted.id, optionId: deleted.options[0].id }, now)).toMatchObject({ ok: true });
    expect(await setJoker(db, sarah, { questionId: deleted.id, enabled: true }, now)).toMatchObject({ ok: true });
    expect(await savePrediction(db, julien, { questionId: deleted.id, optionId: deleted.options[1].id }, now)).toMatchObject({ ok: true });
    for (const other of others) expect(await savePrediction(db, sarah, { questionId: other.id, rawValue: "120" }, now)).toMatchObject({ ok: true });
    expect(await getJokersLeft(db, sarah, current)).toBe(1);

    const before = await snapshot();
    expect(await deleteQuestion(db, admin, { questionId: deleted.id }, now)).toEqual({ ok: false, code: "CONFIRMATION_REQUIRED", message: CONFIRM });
    expect(await snapshot(), "without confirmation").toBe(before);
    expect(await deleteQuestion(db, admin, { questionId: deleted.id, confirmation: "SUPPRIME" }, now)).toEqual({
      ok: false,
      code: "CONFIRMATION_REQUIRED",
      message: CONFIRM,
    });
    expect(await snapshot(), "with « SUPPRIME »").toBe(before);

    expect(await deleteQuestion(db, admin, { questionId: deleted.id, confirmation: "  supprimer  " }, now)).toEqual({
      ok: true,
      data: { title: deleted.title, predictions: 2, extensions: 0, resultMessage: false },
    });
    expect(await leftOf(deleted.id)).toEqual(NOTHING_LEFT);
    // The other questions keep their predictions and events.
    for (const other of others) expect(await leftOf(other.id)).toMatchObject({ question: 1, predictions: 1, events: 1 });
    // Sarah's joker is given back: she may pose 2 again in the season.
    expect(await getJokersLeft(db, sarah, current)).toBe(2);
    for (const other of others) expect(await setJoker(db, sarah, { questionId: other.id, enabled: true }, now)).toMatchObject({ ok: true });
    expect(await getJokersLeft(db, sarah, current)).toBe(0);
  });

  it("QD3: a closed question with a running extension is deleted, the extension included", async () => {
    const sarah = await player("Sarah");
    const mehdi = await player("Mehdi");
    const closed = await createQuestion(CLOSED);
    await createPrediction(db, { questionId: closed.id, userId: sarah.id, valueNumber: 240, validatedAt: clock.at("-2d") });
    await db.insert(questionExtension).values({ questionId: closed.id, userId: mehdi.id, closesAt: clock.at("+2d"), grantedBy: admin.id, grantedAt: clock.at("-1h") });

    expect(await deleteQuestion(db, admin, { questionId: closed.id, confirmation: "SUPPRIMER" }, now)).toEqual({
      ok: true,
      data: { title: closed.title, predictions: 1, extensions: 1, resultMessage: false },
    });
    expect(await leftOf(closed.id)).toEqual(NOTHING_LEFT);
  });

  it("QD4: a resolved question goes with its result message; the standings and the unread count are computed without it", async () => {
    const sarah = await player("Sarah");
    const julien = await player("Julien");
    const ines = await player("Inès");
    // Kept, real value 100: Sarah 110 (malus 10), Julien 130 (30), Inès 100 (0); Admin absent (30, the worst).
    const kept = await createQuestion({ ...CLOSED, closesAt: clock.at("-15d"), opensAt: clock.at("-20d"), resultNumber: 100, resolvedAt: clock.at("-10d") });
    for (const [who, value] of [[sarah, 110], [julien, 130], [ines, 100]] as const) {
      await createPrediction(db, { questionId: kept.id, userId: who.id, valueNumber: value });
    }
    // Deleted, real value 200: Sarah 200 (0), Julien 150 (50); Inès and Admin absent (50).
    const deleted = await createQuestion(CLOSED);
    await createPrediction(db, { questionId: deleted.id, userId: sarah.id, valueNumber: 200 });
    await createPrediction(db, { questionId: deleted.id, userId: julien.id, valueNumber: 150 });
    expect(await resolveQuestion(db, admin, { questionId: deleted.id, rawValue: "200" }, now)).toMatchObject({ ok: true });
    const [result] = await db.select().from(chatMessage).where(eq(chatMessage.questionId, deleted.id));
    // Julien has read the chat up to the result message; the read mark has no foreign key.
    await db.insert(chatRead).values({ userId: julien.id, lastReadId: result.id, updatedAt: now });

    const malusByName = async () => {
      const standings = await getStandings(db, sarah, { seasonId: current.id }, now);
      return { resolved: standings.resolvedCount, malus: Object.fromEntries(standings.rows.map(({ name, malus }) => [name, malus / 100])) };
    };
    expect(await malusByName()).toEqual({ resolved: 2, malus: { Sarah: 10, Julien: 80, Inès: 50, Admin: 80 } });
    expect(await getUnreadChatCount(db, sarah)).toBe(1);

    expect(await deleteQuestion(db, admin, { questionId: deleted.id, confirmation: "SUPPRIMER" }, now)).toEqual({
      ok: true,
      data: { title: deleted.title, predictions: 2, extensions: 0, resultMessage: true },
    });
    expect(await leftOf(deleted.id)).toEqual(NOTHING_LEFT);
    expect(await malusByName()).toEqual({ resolved: 1, malus: { Sarah: 10, Julien: 30, Inès: 0, Admin: 30 } });
    expect(await getUnreadChatCount(db, sarah)).toBe(0);
    expect(await db.select().from(chatRead).where(eq(chatRead.userId, julien.id))).toEqual([{ userId: julien.id, lastReadId: result.id, updatedAt: now }]);
  });

  it("QD5: a cancelled question with predictions (resolved, then cancelled) is deleted with SUPPRIMER", async () => {
    const sarah = await player("Sarah");
    const julien = await player("Julien");
    const cancelled = await createQuestion({
      ...CLOSED,
      status: "cancelled",
      type: "choice",
      unit: null,
      options: ["Caen", "Le Havre"],
      resolvedAt: clock.at("-12h"),
      cancelledAt: clock.at("-1h"),
    });
    // The right answer points to one of its own options, deleted with it.
    await db.update(question).set({ resultOptionId: cancelled.options[1].id }).where(eq(question.id, cancelled.id));
    await createPrediction(db, { questionId: cancelled.id, userId: sarah.id, optionId: cancelled.options[0].id, joker: true });
    await createPrediction(db, { questionId: cancelled.id, userId: julien.id, optionId: cancelled.options[1].id });

    expect(await deleteQuestion(db, admin, { questionId: cancelled.id, confirmation: "SUPPRIMER" }, now)).toEqual({
      ok: true,
      data: { title: cancelled.title, predictions: 2, extensions: 0, resultMessage: false },
    });
    expect(await leftOf(cancelled.id)).toEqual(NOTHING_LEFT);
  });

  it("QD6: in a proclaimed season, a resolved or cancelled question stays; a draft closing in it is deleted", async () => {
    await db.update(season).set({ proclaimedAt: clock.at("-30d") }).where(eq(season.id, previous.id));
    const sarah = await player("Sarah");
    const inPrevious = { opensAt: new Date("2026-04-01T08:00:00Z"), closesAt: new Date("2026-04-08T16:00:00Z") };
    const resolved = await createQuestion({ ...inPrevious, status: "published", resultNumber: 180, resolvedAt: new Date("2026-04-20T08:00:00Z") });
    await createPrediction(db, { questionId: resolved.id, userId: sarah.id, valueNumber: 175 });
    await db.insert(chatMessage).values({ kind: "result", questionId: resolved.id, createdAt: new Date("2026-04-20T08:00:00Z") });
    const cancelled = await createQuestion({ ...inPrevious, status: "cancelled", cancelledAt: new Date("2026-04-05T08:00:00Z") });
    await createPrediction(db, { questionId: cancelled.id, userId: sarah.id, valueNumber: 160 });
    const draft = await createQuestion({ closesAt: new Date("2026-05-01T16:00:00Z") });
    expect([resolved.seasonId, cancelled.seasonId, draft.seasonId]).toEqual([previous.id, previous.id, previous.id]);

    const before = await snapshot();
    for (const refused of [resolved, cancelled]) {
      expect(await deleteQuestion(db, admin, { questionId: refused.id, confirmation: "SUPPRIMER" }, now)).toEqual({
        ok: false,
        code: "QUESTION_IN_PROCLAIMED_SEASON",
        message: PROCLAIMED,
      });
      // Without confirmation too: the season decides first.
      expect(await deleteQuestion(db, admin, { questionId: refused.id }, now)).toMatchObject({ code: "QUESTION_IN_PROCLAIMED_SEASON" });
    }
    expect(await snapshot(), "no table changes").toBe(before);

    expect(await deleteQuestion(db, admin, { questionId: draft.id }, now)).toMatchObject({ ok: true });
    expect(await leftOf(draft.id)).toEqual(NOTHING_LEFT);
  });

  it("QD7: a question that has a copy is deleted; the copy stays and forgets where it came from", async () => {
    const original = await createQuestion({ ...OPEN, opensAt: clock.at("+2d"), type: "choice", unit: null, options: ["BBA", "MSc"] });
    const copy = await duplicateQuestion(db, admin, { questionId: original.id }, now);
    if (!copy.ok) throw new Error(copy.message);

    expect(await deleteQuestion(db, admin, { questionId: original.id }, now)).toMatchObject({ ok: true });
    expect(await leftOf(original.id)).toEqual(NOTHING_LEFT);
    const [kept] = await db.select().from(question).where(eq(question.id, copy.data.id));
    expect(kept).toMatchObject({ status: "draft", duplicatedFromId: null, title: original.title });
    expect(await leftOf(copy.data.id)).toMatchObject({ question: 1, options: 2 });
  });

  it("QD8: refused to a player, a disabled player, a disabled admin and an anonymous visitor; no table changes", async () => {
    const sarah = await player("Sarah");
    const mehdi = await player("Mehdi");
    const resolved = await createQuestion({ ...CLOSED, resultNumber: 250, resolvedAt: clock.at("-1h") });
    const p = await createPrediction(db, { questionId: resolved.id, userId: sarah.id, valueNumber: 240 });
    await db.insert(predictionEvent).values({ predictionId: p.id, questionId: resolved.id, ownerId: sarah.id, actorId: sarah.id, type: "saved", valueNumber: 240, joker: false, createdAt: clock.at("-3d") });
    await db.insert(questionExtension).values({ questionId: resolved.id, userId: mehdi.id, closesAt: clock.at("-2h"), grantedBy: admin.id, grantedAt: clock.at("-1d") });
    await db.insert(chatMessage).values({ kind: "result", questionId: resolved.id, createdAt: clock.at("-1h") });
    const disabledPlayer = actorOf(await createUser(db, { name: "Parti", banned: true }));
    const disabledAdmin = actorOf(await createUser(db, { name: "Ancienne admin", role: "admin", banned: true }));

    const before = await snapshot();
    const input = { questionId: resolved.id, confirmation: "SUPPRIMER" };
    expect(await deleteQuestion(db, sarah, input, now)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await deleteQuestion(db, disabledPlayer, input, now)).toMatchObject({ ok: false, code: "ACCOUNT_DISABLED" });
    expect(await deleteQuestion(db, disabledAdmin, input, now)).toMatchObject({ ok: false, code: "ACCOUNT_DISABLED" });
    expect(await deleteQuestion(db, null, input, now)).toMatchObject({ ok: false, code: "NOT_AUTHENTICATED" });
    expect(await snapshot()).toBe(before);
  });

  it("QD9: an unknown question is not found; an invalid identifier is refused", async () => {
    expect(await deleteQuestion(db, admin, { questionId: 999 }, now)).toEqual({ ok: false, code: "NOT_FOUND", message: "Cette question n'existe pas." });
    expect(await deleteQuestion(db, admin, { questionId: "abc" }, now)).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });

  it("QD10: a season whose only question is deleted can then be deleted", async () => {
    const later = await ensureTestSeason(db, "2027-2028", "2027-09-27");
    const only = await createQuestion({ status: "published", opensAt: new Date("2027-10-04T07:00:00Z"), closesAt: new Date("2027-10-11T16:00:00Z") });
    expect(only.seasonId).toBe(later.id);
    expect(await deleteSeason(db, admin, { seasonId: later.id })).toMatchObject({ ok: false, code: "SEASON_HAS_QUESTIONS" });

    expect(await deleteQuestion(db, admin, { questionId: only.id }, now)).toMatchObject({ ok: true });
    expect(await deleteSeason(db, admin, { seasonId: later.id })).toEqual({ ok: true, data: undefined });
  });

  it("QD11: a scheduled question without prediction is deleted without confirmation", async () => {
    const scheduled = await createQuestion({ status: "published", opensAt: clock.at("+2d"), closesAt: clock.at("+5d") });

    expect(await deleteQuestion(db, admin, { questionId: scheduled.id }, now)).toEqual({
      ok: true,
      data: { title: scheduled.title, predictions: 0, extensions: 0, resultMessage: false },
    });
    expect(await leftOf(scheduled.id)).toEqual(NOTHING_LEFT);
  });
});

describe("getAdminQuestion: what a deletion would remove (§7.4)", () => {
  const view = () => ({ id: admin.id, role: "admin" as const });

  it("counts the predictions, the extensions and the result message, never the jokers", async () => {
    const sarah = await player("Sarah");
    const julien = await player("Julien");
    const mehdi = await player("Mehdi");
    const open = await createQuestion(OPEN);
    await createPrediction(db, { questionId: open.id, userId: sarah.id, valueNumber: 240, joker: true });
    await createPrediction(db, { questionId: open.id, userId: julien.id, valueNumber: 260 });
    await db.insert(questionExtension).values({ questionId: open.id, userId: mehdi.id, closesAt: clock.at("+7d"), grantedBy: admin.id, grantedAt: clock.at("-1h") });
    const detail = await getAdminQuestion(db, view(), open.id, now);
    expect(detail?.deletion).toEqual({ allowed: true, reason: null, predictions: 2, extensions: 1, resultMessage: false });

    const resolved = await createQuestion({ ...CLOSED, resultNumber: 250, resolvedAt: clock.at("-1h") });
    await db.insert(chatMessage).values({ kind: "result", questionId: resolved.id, createdAt: clock.at("-1h") });
    expect((await getAdminQuestion(db, view(), resolved.id, now))?.deletion).toEqual({
      allowed: true,
      reason: null,
      predictions: 0,
      extensions: 0,
      resultMessage: true,
    });
  });

  it("refuses a published or cancelled question of a proclaimed season, with the reason; not a draft", async () => {
    await db.update(season).set({ proclaimedAt: clock.at("-30d") }).where(eq(season.id, previous.id));
    const sarah = await player("Sarah");
    const inPrevious = { opensAt: new Date("2026-04-01T08:00:00Z"), closesAt: new Date("2026-04-08T16:00:00Z") };
    const resolved = await createQuestion({ ...inPrevious, status: "published", resultNumber: 180, resolvedAt: new Date("2026-04-20T08:00:00Z") });
    await createPrediction(db, { questionId: resolved.id, userId: sarah.id, valueNumber: 175 });
    const cancelled = await createQuestion({ ...inPrevious, status: "cancelled", cancelledAt: new Date("2026-04-05T08:00:00Z") });
    const draft = await createQuestion({ closesAt: new Date("2026-05-01T16:00:00Z") });

    expect((await getAdminQuestion(db, view(), resolved.id, now))?.deletion).toEqual({
      allowed: false,
      reason: PROCLAIMED,
      predictions: 1,
      extensions: 0,
      resultMessage: false,
    });
    expect((await getAdminQuestion(db, view(), cancelled.id, now))?.deletion).toMatchObject({ allowed: false, reason: PROCLAIMED });
    expect((await getAdminQuestion(db, view(), draft.id, now))?.deletion).toMatchObject({ allowed: true, reason: null });
  });
});

describe("getAdminQuestionsList: the same report on every row, for the series deletion (step 8e)", () => {
  const view = () => ({ id: admin.id, role: "admin" as const });

  it("gives each row what its deletion would remove, and refuses the questions of a proclaimed season", async () => {
    await db.update(season).set({ proclaimedAt: clock.at("-30d") }).where(eq(season.id, previous.id));
    const sarah = await player("Sarah");
    const julien = await player("Julien");
    const mehdi = await player("Mehdi");
    const open = await createQuestion(OPEN);
    await createPrediction(db, { questionId: open.id, userId: sarah.id, valueNumber: 240, joker: true });
    await createPrediction(db, { questionId: open.id, userId: julien.id, valueNumber: 260 });
    await db.insert(questionExtension).values({ questionId: open.id, userId: mehdi.id, closesAt: clock.at("+7d"), grantedBy: admin.id, grantedAt: clock.at("-1h") });
    const resolved = await createQuestion({ ...CLOSED, resultNumber: 250, resolvedAt: clock.at("-1h") });
    await db.insert(chatMessage).values({ kind: "result", questionId: resolved.id, createdAt: clock.at("-1h") });
    const inPrevious = { opensAt: new Date("2026-04-01T08:00:00Z"), closesAt: new Date("2026-04-08T16:00:00Z") };
    const proclaimed = await createQuestion({ ...inPrevious, status: "published", resultNumber: 180, resolvedAt: new Date("2026-04-20T08:00:00Z") });
    const draft = await createQuestion();

    const { rows } = await getAdminQuestionsList(db, view(), {}, now);
    const deletionOf = (id: number) => rows.find((row) => row.id === id)?.deletion;
    expect(deletionOf(open.id)).toEqual({ allowed: true, reason: null, predictions: 2, extensions: 1, resultMessage: false });
    expect(deletionOf(resolved.id)).toEqual({ allowed: true, reason: null, predictions: 0, extensions: 0, resultMessage: true });
    expect(deletionOf(proclaimed.id)).toEqual({ allowed: false, reason: PROCLAIMED, predictions: 0, extensions: 0, resultMessage: false });
    expect(deletionOf(draft.id)).toEqual({ allowed: true, reason: null, predictions: 0, extensions: 0, resultMessage: false });
    // The same as on the page of each question.
    for (const { id, deletion } of rows) expect((await getAdminQuestion(db, view(), id, now))?.deletion, `question ${id}`).toEqual(deletion);
  });
});
