import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/lib/db/client";
import { questionExtension } from "@/lib/db/schema";
import { utcToParisLocalInput } from "@/lib/game/time";
import { cancelQuestionExtension, setQuestionExtension } from "@/lib/services/extensions";
import { savePrediction, setJoker, validatePrediction } from "@/lib/services/predictions";
import { resolveQuestion } from "@/lib/services/questions";
import type { Actor } from "@/lib/services/result";
import { makeClock } from "../helpers/clock";
import { createTestDb } from "../helpers/db";
import { createCategory, createPrediction, createQuestion, createUser, ensureTestSeason } from "../helpers/factories";

// Extensions of a question for an absent player (architecture §5.14, vectors PR1 to PR10), with an
// injected clock: now is 5 October 2026, in the season 2026-2027.

const clock = makeClock("2026-10-05T10:00:00Z");
const now = clock.now;
/** A deadline typed in the form (Paris time). */
const local = (date: Date) => utcToParisLocalInput(date);

let db: Database;
let close: () => Promise<void>;
let admin: Actor;
let otherAdmin: Actor;
let player: Actor;
let categoryId: number;

const actorOf = (row: { id: string; role: string | null; banned: boolean | null }): Actor => ({
  id: row.id,
  role: row.role === "admin" ? "admin" : "player",
  banned: row.banned === true,
});

beforeEach(async () => {
  ({ db, close } = await createTestDb());
  admin = actorOf(await createUser(db, { role: "admin", name: "Admin" }));
  otherAdmin = actorOf(await createUser(db, { role: "admin", name: "Autre admin" }));
  player = actorOf(await createUser(db, { name: "Mehdi" }));
  categoryId = (await createCategory(db, "JPO")).id;
  await ensureTestSeason(db, "2026-2027", "2026-09-28");
});

afterEach(async () => {
  await close();
});

/** A question closed yesterday, without result, unless other dates are given. */
function closedQuestion(overrides: Parameters<typeof createQuestion>[1] = {}) {
  return createQuestion(db, { categoryId, createdBy: admin.id, status: "published", opensAt: clock.at("-5d"), closesAt: clock.at("-1d"), ...overrides });
}

async function extensionOf(questionId: number, userId = player.id) {
  const [row] = await db
    .select()
    .from(questionExtension)
    .where(and(eq(questionExtension.questionId, questionId), eq(questionExtension.userId, userId)));
  return row;
}

const grant = (questionId: number, closesAt: Date, actor: Actor = admin, userId = player.id) =>
  setQuestionExtension(db, actor, { questionId, userId, closesAt: local(closesAt) }, now);

describe("authorization (§6.5)", () => {
  it("only an active admin grants or cancels an extension, never for themselves (PR5)", async () => {
    const q = await closedQuestion();
    const disabled = actorOf(await createUser(db, { role: "admin", banned: true }));
    for (const [actor, code] of [
      [null, "NOT_AUTHENTICATED"],
      [player, "FORBIDDEN"],
      [disabled, "ACCOUNT_DISABLED"],
    ] as const) {
      expect(await grant(q.id, clock.at("+2d"), actor as Actor)).toMatchObject({ ok: false, code });
      expect(await cancelQuestionExtension(db, actor, { questionId: q.id, userId: player.id }, now)).toMatchObject({ ok: false, code });
    }
    expect(await grant(q.id, clock.at("+2d"), admin, admin.id)).toEqual({
      ok: false,
      code: "SELF_EXTENSION",
      message: "Tu ne peux pas te prolonger toi-même : demande à l'autre admin.",
    });
    // The other admin can.
    expect(await grant(q.id, clock.at("+2d"), otherAdmin, admin.id)).toMatchObject({ ok: true });
    expect(await cancelQuestionExtension(db, admin, { questionId: q.id, userId: admin.id }, now)).toMatchObject({ code: "SELF_EXTENSION" });
    expect(await db.select().from(questionExtension)).toHaveLength(1);
  });
});

describe("setQuestionExtension (§5.14)", () => {
  it("PR1: a closed question without result, a player without prediction, a deadline in 48 h", async () => {
    const q = await closedQuestion();
    const deadline = clock.at("+48h");
    expect(await grant(q.id, deadline)).toEqual({ ok: true, data: { closesAt: deadline } });
    expect(await extensionOf(q.id)).toMatchObject({ closesAt: deadline, grantedBy: admin.id, grantedAt: now, updatedBy: null, updatedAt: null });
    expect(await savePrediction(db, player, { questionId: q.id, rawValue: "240" }, now)).toMatchObject({ ok: true });
    expect(await setJoker(db, player, { questionId: q.id, enabled: true }, now)).toMatchObject({ ok: true });
    expect(await validatePrediction(db, player, { questionId: q.id }, now)).toMatchObject({ ok: true });
    const other = actorOf(await createUser(db));
    expect(await savePrediction(db, other, { questionId: q.id, rawValue: "250" }, now)).toMatchObject({ code: "QUESTION_NOT_OPEN" });
  });

  it("PR2: refused on a resolved question", async () => {
    const q = await closedQuestion({ resultNumber: 250, resolvedAt: clock.at("-1h") });
    expect(await grant(q.id, clock.at("+2d"))).toEqual({
      ok: false,
      code: "EXTENSION_NOT_ALLOWED",
      message: "Prolongation impossible : la question doit être ouverte ou clôturée, sans résultat.",
    });
  });

  it("PR3: refused on a scheduled, cancelled or draft question", async () => {
    const scheduled = await closedQuestion({ opensAt: clock.at("+1d"), closesAt: clock.at("+3d") });
    const cancelled = await closedQuestion({ status: "cancelled", cancelledAt: clock.at("-2d") });
    const draft = await createQuestion(db, { categoryId, createdBy: admin.id, opensAt: clock.at("-5d"), closesAt: clock.at("-1d") });
    for (const q of [scheduled, cancelled, draft]) {
      expect(await grant(q.id, clock.at("+5d"))).toMatchObject({ ok: false, code: "EXTENSION_NOT_ALLOWED" });
    }
    expect(await db.select().from(questionExtension)).toEqual([]);
  });

  it("PR4: refused for a player who already has a prediction", async () => {
    const q = await closedQuestion();
    await createPrediction(db, { questionId: q.id, userId: player.id, valueNumber: 240 });
    expect(await grant(q.id, clock.at("+2d"))).toEqual({
      ok: false,
      code: "EXTENSION_HAS_PREDICTION",
      message: "Ce joueur a déjà un prono sur cette question.",
    });
  });

  it("PR6: refused for a deadline in the past, or before the closing of the question", async () => {
    const q = await closedQuestion();
    expect(await grant(q.id, clock.at("-1h"))).toMatchObject({
      ok: false,
      code: "INVALID_EXTENSION_DATE",
      fieldErrors: { closesAt: "La date limite doit être dans le futur et après la clôture de la question." },
    });
    const open = await closedQuestion({ opensAt: clock.at("-1d"), closesAt: clock.at("+3d") });
    expect(await grant(open.id, clock.at("+2d"))).toMatchObject({ code: "INVALID_EXTENSION_DATE" });
    expect(await setQuestionExtension(db, admin, { questionId: q.id, userId: player.id, closesAt: "" }, now)).toMatchObject({
      code: "INVALID_EXTENSION_DATE",
    });
    expect(await setQuestionExtension(db, admin, { questionId: q.id, userId: player.id, closesAt: "demain" }, now)).toMatchObject({
      code: "INVALID_EXTENSION_DATE",
    });
  });

  it("PR10: an open question (absence planned), deadline after its closing; after the closing, the player still plays", async () => {
    const q = await closedQuestion({ opensAt: clock.at("-1d"), closesAt: clock.at("+1d") });
    expect(await grant(q.id, clock.at("+3d"))).toMatchObject({ ok: true });
    const afterClosing = clock.at("+2d");
    expect(await savePrediction(db, player, { questionId: q.id, rawValue: "240" }, afterClosing)).toMatchObject({ ok: true });
  });

  it("changes the deadline of a running extension, even with a prediction; records who changed it", async () => {
    const q = await closedQuestion();
    await grant(q.id, clock.at("+1d"));
    await savePrediction(db, player, { questionId: q.id, rawValue: "240" }, now);
    const later = clock.at("+3d");
    expect(await grant(q.id, later, otherAdmin)).toEqual({ ok: true, data: { closesAt: later } });
    expect(await extensionOf(q.id)).toMatchObject({ closesAt: later, grantedBy: admin.id, updatedBy: otherAdmin.id, updatedAt: now });
  });

  it("grants an expired extension again when the player has no prediction; not once a prediction is final", async () => {
    const q = await closedQuestion();
    await grant(q.id, clock.at("+1h"));
    const afterIt = clock.at("+2h");
    expect(await setQuestionExtension(db, admin, { questionId: q.id, userId: player.id, closesAt: local(clock.at("+1d")) }, afterIt)).toMatchObject({
      ok: true,
    });

    const other = await closedQuestion();
    await grant(other.id, clock.at("+1h"));
    await savePrediction(db, player, { questionId: other.id, rawValue: "240" }, now);
    expect(await setQuestionExtension(db, admin, { questionId: other.id, userId: player.id, closesAt: local(clock.at("+1d")) }, afterIt)).toMatchObject({
      code: "EXTENSION_HAS_PREDICTION",
    });
  });

  it("refuses an unknown question, an unknown or disabled account, and a malformed input", async () => {
    const q = await closedQuestion();
    const disabled = await createUser(db, { banned: true });
    expect(await setQuestionExtension(db, admin, { questionId: 9999, userId: player.id, closesAt: local(clock.at("+1d")) }, now)).toMatchObject({
      code: "NOT_FOUND",
      message: "Cette question n'existe pas.",
    });
    expect(await setQuestionExtension(db, admin, { questionId: q.id, userId: "inconnu", closesAt: local(clock.at("+1d")) }, now)).toMatchObject({
      code: "NOT_FOUND",
      message: "Ce compte n'existe pas.",
    });
    expect(await setQuestionExtension(db, admin, { questionId: q.id, userId: disabled.id, closesAt: local(clock.at("+1d")) }, now)).toMatchObject({
      code: "EXTENSION_NOT_ALLOWED",
    });
    expect(await setQuestionExtension(db, admin, { questionId: "x", userId: player.id }, now)).toMatchObject({ code: "INVALID_INPUT" });
    expect(await db.select().from(questionExtension)).toEqual([]);
  });
});

describe("cancelQuestionExtension (§5.14)", () => {
  it("PR8: without a prediction, the row is deleted; with one, the extension ends now and the prediction counts", async () => {
    const q = await closedQuestion();
    await grant(q.id, clock.at("+2d"));
    expect(await cancelQuestionExtension(db, admin, { questionId: q.id, userId: player.id }, now)).toEqual({ ok: true, data: { ended: "deleted" } });
    expect(await extensionOf(q.id)).toBeUndefined();

    const other = await closedQuestion();
    await grant(other.id, clock.at("+2d"));
    await savePrediction(db, player, { questionId: other.id, rawValue: "240" }, now);
    const later = clock.at("+1h");
    expect(await cancelQuestionExtension(db, otherAdmin, { questionId: other.id, userId: player.id }, later)).toEqual({ ok: true, data: { ended: "closed" } });
    expect(await extensionOf(other.id)).toMatchObject({ closesAt: later, updatedBy: otherAdmin.id, updatedAt: later });
    expect(await savePrediction(db, player, { questionId: other.id, rawValue: "241" }, later)).toMatchObject({ code: "QUESTION_NOT_OPEN" });
  });

  it("refuses when no extension runs", async () => {
    const q = await closedQuestion();
    expect(await cancelQuestionExtension(db, admin, { questionId: q.id, userId: player.id }, now)).toEqual({
      ok: false,
      code: "NO_EXTENSION",
      message: "Aucune prolongation en cours pour ce joueur.",
    });
    await grant(q.id, clock.at("+1h"));
    expect(await cancelQuestionExtension(db, admin, { questionId: q.id, userId: player.id }, clock.at("+1h"))).toMatchObject({ code: "NO_EXTENSION" });
  });
});

describe("result and extensions (§5.11)", () => {
  it("PR7: the result is refused while an extension runs; accepted after its deadline", async () => {
    const q = await closedQuestion();
    const deadline = clock.at("+2d");
    await grant(q.id, deadline);
    expect(await resolveQuestion(db, admin, { questionId: q.id, rawValue: "250" }, now)).toMatchObject({ ok: false, code: "EXTENSION_RUNNING" });
    expect(await resolveQuestion(db, admin, { questionId: q.id, rawValue: "250" }, deadline)).toMatchObject({ ok: true });
    // Once resolved, no extension any more.
    expect(await setQuestionExtension(db, otherAdmin, { questionId: q.id, userId: admin.id, closesAt: local(clock.at("+5d")) }, deadline)).toMatchObject({
      code: "EXTENSION_NOT_ALLOWED",
    });
  });

  it("PR9: after the deadline, the player can no longer save", async () => {
    const q = await closedQuestion();
    const deadline = clock.at("+1d");
    await grant(q.id, deadline);
    expect(await savePrediction(db, player, { questionId: q.id, rawValue: "240" }, deadline)).toMatchObject({ code: "QUESTION_NOT_OPEN" });
  });
});
