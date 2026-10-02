import { and, asc, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/lib/db/client";
import { prediction, predictionEvent, season, user } from "@/lib/db/schema";
import { getQuestionPredictionsForViewer } from "@/lib/data/questions";
import { JOKERS_PER_SEASON } from "@/lib/game/constants";
import { utcToParisLocalInput } from "@/lib/game/time";
import { cancelQuestionExtension, setQuestionExtension } from "@/lib/services/extensions";
import { cancelQuestion } from "@/lib/services/questions";
import { savePrediction, setJoker, unlockPrediction, validatePrediction } from "@/lib/services/predictions";
import { recordVisit } from "@/lib/services/profile";
import type { Actor } from "@/lib/services/result";
import { makeClock } from "../helpers/clock";
import { createTestDb } from "../helpers/db";
import { createCategory, createPrediction, createQuestion, createUser, ensureTestSeason } from "../helpers/factories";

// Predictions of the players (architecture §5.4, §11 É6), with an injected clock. Seasons: 2025-2026
// from 29 September 2025, 2026-2027 from 28 September 2026; now is 5 October 2026.

const clock = makeClock("2026-10-05T10:00:00Z");
const now = clock.now;

let db: Database;
let close: () => Promise<void>;
let admin: Actor;
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
  player = actorOf(await createUser(db, { name: "Sarah" }));
  categoryId = (await createCategory(db, "JPO")).id;
  await ensureTestSeason(db, "2025-2026", "2025-09-29");
  await ensureTestSeason(db, "2026-2027", "2026-09-28");
});

afterEach(async () => {
  await close();
});

/** A number question, open from yesterday for 5 days, unless dates are given. */
function openQuestion(overrides: Parameters<typeof createQuestion>[1] = {}) {
  return createQuestion(db, {
    categoryId,
    createdBy: admin.id,
    status: "published",
    opensAt: clock.at("-1d"),
    closesAt: clock.at("+5d"),
    ...overrides,
  });
}

async function predictionOf(questionId: number, userId = player.id) {
  const [row] = await db
    .select()
    .from(prediction)
    .where(and(eq(prediction.questionId, questionId), eq(prediction.userId, userId)));
  return row;
}

async function eventsOf(questionId: number) {
  return db
    .select({ type: predictionEvent.type, ownerId: predictionEvent.ownerId, actorId: predictionEvent.actorId, valueNumber: predictionEvent.valueNumber, optionId: predictionEvent.optionId, joker: predictionEvent.joker, createdAt: predictionEvent.createdAt })
    .from(predictionEvent)
    .where(eq(predictionEvent.questionId, questionId))
    .orderBy(asc(predictionEvent.id));
}

describe("authorization (§6.5)", () => {
  it("refuses an anonymous visitor and a disabled account on every prediction service", async () => {
    const q = await openQuestion();
    const disabled = actorOf(await createUser(db, { banned: true }));
    const saved = await createPrediction(db, { questionId: q.id, userId: player.id, validatedAt: clock.at("-1h") });
    for (const [actor, code] of [
      [null, "NOT_AUTHENTICATED"],
      [disabled, "ACCOUNT_DISABLED"],
    ] as const) {
      expect(await savePrediction(db, actor, { questionId: q.id, rawValue: "12" }, now)).toMatchObject({ ok: false, code });
      expect(await validatePrediction(db, actor, { questionId: q.id, rawValue: "12" }, now)).toMatchObject({ ok: false, code });
      expect(await setJoker(db, actor, { questionId: q.id, enabled: true }, now)).toMatchObject({ ok: false, code });
      expect(await unlockPrediction(db, actor, { predictionId: saved.id }, now)).toMatchObject({ ok: false, code });
      expect(await recordVisit(db, actor, now)).toMatchObject({ ok: false, code });
    }
    expect(await db.select().from(prediction)).toHaveLength(1);
    expect(await eventsOf(q.id)).toEqual([]);
  });

  it("lets a player and the admin play their own predictions, and only the admin unlock", async () => {
    const q = await openQuestion();
    for (const actor of [player, admin]) {
      expect(await savePrediction(db, actor, { questionId: q.id, rawValue: "210" }, now)).toMatchObject({ ok: true });
      expect(await setJoker(db, actor, { questionId: q.id, enabled: true }, now)).toMatchObject({ ok: true });
      expect(await validatePrediction(db, actor, { questionId: q.id }, now)).toMatchObject({ ok: true });
    }
    const mine = await predictionOf(q.id);
    expect(await unlockPrediction(db, player, { predictionId: mine.id }, now)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await unlockPrediction(db, admin, { predictionId: mine.id }, now)).toEqual({ ok: true, data: undefined });
    expect(await recordVisit(db, player, now)).toMatchObject({ ok: true });
  });
});

describe("savePrediction (§5.4)", () => {
  it("is refused before the opening, accepted at the exact opening, refused at the exact closing", async () => {
    const q = await openQuestion({ opensAt: clock.at("+1h"), closesAt: clock.at("+2d") });
    const at = (ms: number) => new Date(q.opensAt!.getTime() + ms);

    expect(await savePrediction(db, player, { questionId: q.id, rawValue: "200" }, at(-1))).toMatchObject({
      ok: false,
      code: "QUESTION_NOT_OPEN",
      message: "Cette question n'est pas ouverte aux pronos.",
    });
    expect(await savePrediction(db, player, { questionId: q.id, rawValue: "200" }, at(0))).toMatchObject({ ok: true });
    expect(await savePrediction(db, player, { questionId: q.id, rawValue: "201" }, new Date(q.closesAt!.getTime() - 1))).toMatchObject({ ok: true });
    expect(await savePrediction(db, player, { questionId: q.id, rawValue: "202" }, q.closesAt!)).toMatchObject({
      ok: false,
      code: "QUESTION_NOT_OPEN",
    });
    expect((await predictionOf(q.id)).valueNumber).toBe(201);
  });

  it("refuses drafts, cancelled and unknown questions", async () => {
    const draft = await openQuestion({ status: "draft" });
    const cancelled = await openQuestion({ status: "cancelled", cancelledAt: clock.at("-1h") });
    for (const questionId of [draft.id, cancelled.id, 999_999]) {
      expect(await savePrediction(db, player, { questionId, rawValue: "12" }, now)).toMatchObject({ ok: false, code: "QUESTION_NOT_OPEN" });
    }
    expect(await savePrediction(db, player, { questionId: "abc", rawValue: "12" }, now)).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });

  it("reads the value as typed (§5.3) and can change it as long as the prediction is not validated", async () => {
    const q = await openQuestion();
    expect(await savePrediction(db, player, { questionId: q.id, rawValue: "2 450" }, clock.at("-2h"))).toMatchObject({ ok: true });
    expect(await predictionOf(q.id)).toMatchObject({ valueNumber: 2450, optionId: null, joker: false, validatedAt: null });

    expect(await savePrediction(db, player, { questionId: q.id, rawValue: "2450,5" }, now)).toMatchObject({ ok: true });
    expect(await predictionOf(q.id)).toMatchObject({ valueNumber: 2450.5, updatedAt: now });
    expect(await db.select().from(prediction)).toHaveLength(1);
  });

  it("returns the message of parseNumberInput for a value it cannot read", async () => {
    const q = await openQuestion();
    // Grouped like formatNumber, with a no-break space (the narrow one could not be seen; R-07).
    const message = "Écris 2450 ou 2 450 (pas de point pour les milliers).";
    expect(await savePrediction(db, player, { questionId: q.id, rawValue: "2.450" }, now)).toEqual({
      ok: false,
      code: "INVALID_VALUE",
      message,
      fieldErrors: { rawValue: message },
    });
    expect(await savePrediction(db, player, { questionId: q.id, rawValue: "" }, now)).toMatchObject({ code: "INVALID_VALUE", message: "Saisis un nombre." });
    expect(await savePrediction(db, player, { questionId: q.id }, now)).toMatchObject({ code: "INVALID_VALUE" });
    expect(await predictionOf(q.id)).toBeUndefined();
  });

  it("accepts an answer of the question, and refuses an answer of another question", async () => {
    const q = await openQuestion({ type: "choice", unit: null, options: ["BBA", "Grande École", "MSc"] });
    const other = await openQuestion({ type: "choice", unit: null, options: ["Oui", "Non"] });

    expect(await savePrediction(db, player, { questionId: q.id, optionId: other.options[0].id }, now)).toEqual({
      ok: false,
      code: "INVALID_OPTION",
      message: "Réponse inconnue.",
      fieldErrors: { optionId: "Réponse inconnue." },
    });
    expect(await savePrediction(db, player, { questionId: q.id }, now)).toMatchObject({ ok: false, code: "INVALID_OPTION" });
    expect(await predictionOf(q.id)).toBeUndefined();

    expect(await savePrediction(db, player, { questionId: q.id, optionId: String(q.options[1].id) }, now)).toMatchObject({ ok: true });
    expect(await predictionOf(q.id)).toMatchObject({ valueNumber: null, optionId: q.options[1].id });
  });
});

describe("validatePrediction (§5.4)", () => {
  it("saves and validates the value shown in one transaction", async () => {
    const q = await openQuestion();
    expect(await validatePrediction(db, player, { questionId: q.id, rawValue: "240" }, now)).toMatchObject({ ok: true });
    expect(await predictionOf(q.id)).toMatchObject({ valueNumber: 240, validatedAt: now });
    expect((await eventsOf(q.id)).map(({ type, valueNumber }) => ({ type, valueNumber }))).toEqual([
      { type: "saved", valueNumber: 240 },
      { type: "validated", valueNumber: 240 },
    ]);
  });

  it("writes nothing when the value shown cannot be read", async () => {
    const q = await openQuestion();
    await savePrediction(db, player, { questionId: q.id, rawValue: "240" }, clock.at("-1h"));
    expect(await validatePrediction(db, player, { questionId: q.id, rawValue: "-3" }, now)).toMatchObject({ ok: false, code: "INVALID_VALUE" });
    expect(await predictionOf(q.id)).toMatchObject({ valueNumber: 240, validatedAt: null });
    expect(await eventsOf(q.id)).toHaveLength(1);
  });

  it("validates the saved prediction when no value is sent, and needs one otherwise", async () => {
    const q = await openQuestion();
    expect(await validatePrediction(db, player, { questionId: q.id }, now)).toEqual({
      ok: false,
      code: "NO_PREDICTION",
      message: "Enregistre d'abord ton prono.",
    });
    await savePrediction(db, player, { questionId: q.id, rawValue: "300" }, clock.at("-1h"));
    expect(await validatePrediction(db, player, { questionId: q.id }, now)).toMatchObject({ ok: true });
    expect(await predictionOf(q.id)).toMatchObject({ valueNumber: 300, validatedAt: now });
  });

  it("is refused at the exact closing", async () => {
    const q = await openQuestion({ closesAt: clock.at("+1h") });
    expect(await validatePrediction(db, player, { questionId: q.id, rawValue: "12" }, q.closesAt!)).toMatchObject({
      ok: false,
      code: "QUESTION_NOT_OPEN",
    });
  });

  it("makes the prediction final: no new value, no second validation, no joker change", async () => {
    const q = await openQuestion();
    await savePrediction(db, player, { questionId: q.id, rawValue: "300" }, clock.at("-1h"));
    await validatePrediction(db, player, { questionId: q.id }, now);
    const message = "Ton prono est validé : il ne peut plus être modifié.";

    expect(await savePrediction(db, player, { questionId: q.id, rawValue: "310" }, now)).toEqual({ ok: false, code: "ALREADY_VALIDATED", message });
    expect(await validatePrediction(db, player, { questionId: q.id, rawValue: "310" }, now)).toMatchObject({ code: "ALREADY_VALIDATED" });
    expect(await setJoker(db, player, { questionId: q.id, enabled: true }, now)).toMatchObject({ code: "ALREADY_VALIDATED" });
    expect(await predictionOf(q.id)).toMatchObject({ valueNumber: 300, joker: false });
  });
});

describe("setJoker (§5.4)", () => {
  /** An open question of 2026-2027 with a saved prediction of the player. */
  async function savedQuestion(overrides: Parameters<typeof createQuestion>[1] = {}) {
    const q = await openQuestion(overrides);
    await createPrediction(db, { questionId: q.id, userId: player.id, valueNumber: 100 });
    return q;
  }

  it("is refused without a saved prediction", async () => {
    const q = await openQuestion();
    expect(await setJoker(db, player, { questionId: q.id, enabled: true }, now)).toEqual({
      ok: false,
      code: "NO_PREDICTION",
      message: "Enregistre d'abord ton prono.",
    });
  });

  it("is refused on a closed question", async () => {
    const q = await savedQuestion({ opensAt: clock.at("-7d"), closesAt: clock.at("-1h") });
    expect(await setJoker(db, player, { questionId: q.id, enabled: true }, now)).toMatchObject({ ok: false, code: "QUESTION_NOT_OPEN" });
  });

  it(`allows ${JOKERS_PER_SEASON} jokers per season, and a joker can be moved`, async () => {
    const [q1, q2, q3] = [await savedQuestion(), await savedQuestion(), await savedQuestion()];
    expect(await setJoker(db, player, { questionId: q1.id, enabled: true }, now)).toEqual({ ok: true, data: { joker: true, jokersLeft: 1 } });
    expect(await setJoker(db, player, { questionId: q2.id, enabled: true }, now)).toEqual({ ok: true, data: { joker: true, jokersLeft: 0 } });
    expect(await setJoker(db, player, { questionId: q3.id, enabled: true }, now)).toEqual({
      ok: false,
      code: "NO_JOKER_LEFT",
      message: "Tu as déjà utilisé tes 2 jokers cette saison.",
    });
    expect((await predictionOf(q3.id)).joker).toBe(false);

    // Taking one back frees it for another question.
    expect(await setJoker(db, player, { questionId: q1.id, enabled: false }, now)).toEqual({ ok: true, data: { joker: false, jokersLeft: 1 } });
    expect(await setJoker(db, player, { questionId: q3.id, enabled: true }, now)).toMatchObject({ ok: true, data: { jokersLeft: 0 } });
  });

  it("counts the jokers of validated, closed and resolved questions of the same season", async () => {
    const resolved = await openQuestion({ opensAt: clock.at("-6d"), closesAt: clock.at("-4d"), resultNumber: 10, resolvedAt: clock.at("-1d") });
    await createPrediction(db, { questionId: resolved.id, userId: player.id, joker: true, validatedAt: clock.at("-5d") });
    const validated = await openQuestion();
    await createPrediction(db, { questionId: validated.id, userId: player.id, joker: true, validatedAt: clock.at("-1h") });
    const q = await savedQuestion();
    expect(await setJoker(db, player, { questionId: q.id, enabled: true }, now)).toMatchObject({ ok: false, code: "NO_JOKER_LEFT" });
  });

  it("does not count the jokers of another season, nor another player's", async () => {
    // Closes on 27 September 2026: season 2025-2026.
    const previous = await openQuestion({ opensAt: new Date("2026-09-20T08:00:00Z"), closesAt: new Date("2026-09-27T16:00:00Z") });
    await createPrediction(db, { questionId: previous.id, userId: player.id, joker: true });
    const other = await createUser(db);
    const shared = await openQuestion();
    await createPrediction(db, { questionId: shared.id, userId: other.id, joker: true });
    const [q1, q2] = [await savedQuestion(), await savedQuestion()];
    expect(await setJoker(db, player, { questionId: q1.id, enabled: true }, now)).toMatchObject({ ok: true, data: { jokersLeft: 1 } });
    expect(await setJoker(db, player, { questionId: q2.id, enabled: true }, now)).toMatchObject({ ok: true, data: { jokersLeft: 0 } });
  });

  it("gives back the joker of a cancelled question", async () => {
    const [q1, q2, q3] = [await savedQuestion(), await savedQuestion(), await savedQuestion()];
    await setJoker(db, player, { questionId: q1.id, enabled: true }, now);
    await setJoker(db, player, { questionId: q2.id, enabled: true }, now);
    expect(await setJoker(db, player, { questionId: q3.id, enabled: true }, now)).toMatchObject({ code: "NO_JOKER_LEFT" });

    expect(await cancelQuestion(db, admin, { questionId: q1.id }, now)).toMatchObject({ ok: true });
    expect(await setJoker(db, player, { questionId: q3.id, enabled: true }, now)).toMatchObject({ ok: true, data: { jokersLeft: 0 } });
  });

  it("two simultaneous calls do not pose a third joker", async () => {
    const used = await savedQuestion();
    await setJoker(db, player, { questionId: used.id, enabled: true }, now);
    const [q1, q2] = [await savedQuestion(), await savedQuestion()];
    const results = await Promise.all([
      setJoker(db, player, { questionId: q1.id, enabled: true }, now),
      setJoker(db, player, { questionId: q2.id, enabled: true }, now),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([expect.objectContaining({ code: "NO_JOKER_LEFT" })]);
    const jokers = await db.select().from(prediction).where(and(eq(prediction.userId, player.id), eq(prediction.joker, true)));
    expect(jokers).toHaveLength(JOKERS_PER_SEASON);
  });

  it("sending the current state again changes nothing and writes no event", async () => {
    const q = await savedQuestion();
    expect(await setJoker(db, player, { questionId: q.id, enabled: false }, now)).toEqual({ ok: true, data: { joker: false, jokersLeft: 2 } });
    expect(await eventsOf(q.id)).toEqual([]);
  });

  it("refuses a malformed input", async () => {
    const q = await savedQuestion();
    expect(await setJoker(db, player, { questionId: q.id, enabled: "yes" }, now)).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });
});

describe("unlockPrediction (§5.4)", () => {
  it("lets the admin unlock a validated prediction before the closing: the player can change it again", async () => {
    const q = await openQuestion();
    await validatePrediction(db, player, { questionId: q.id, rawValue: "250" }, clock.at("-2h"));
    const validated = await predictionOf(q.id);

    expect(await unlockPrediction(db, admin, { predictionId: validated.id }, now)).toEqual({ ok: true, data: undefined });
    expect(await predictionOf(q.id)).toMatchObject({ valueNumber: 250, validatedAt: null });
    expect((await eventsOf(q.id)).at(-1)).toMatchObject({ type: "unlocked", ownerId: player.id, actorId: admin.id, valueNumber: 250, createdAt: now });

    expect(await savePrediction(db, player, { questionId: q.id, rawValue: "260" }, now)).toMatchObject({ ok: true });
    expect((await predictionOf(q.id)).valueNumber).toBe(260);
  });

  it("is refused for a prediction that is not validated, after the closing, and for an unknown prediction", async () => {
    const q = await openQuestion({ closesAt: clock.at("+1h") });
    const saved = await createPrediction(db, { questionId: q.id, userId: player.id });
    expect(await unlockPrediction(db, admin, { predictionId: saved.id }, now)).toEqual({
      ok: false,
      code: "NOT_VALIDATED",
      message: "Ce prono n'est pas validé.",
    });

    await db.update(prediction).set({ validatedAt: clock.at("-1h") }).where(eq(prediction.id, saved.id));
    expect(await unlockPrediction(db, admin, { predictionId: saved.id }, q.closesAt!)).toMatchObject({ ok: false, code: "QUESTION_NOT_OPEN" });
    expect((await predictionOf(q.id)).validatedAt).toEqual(clock.at("-1h"));

    expect(await unlockPrediction(db, admin, { predictionId: 999_999 }, now)).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await unlockPrediction(db, admin, { predictionId: "abc" }, now)).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });
});

describe("jokers allowed by season (v1.2, §5.13)", () => {
  it("JOKERS_DISABLED: no joker can be posed nor removed in a season that does not allow them", async () => {
    const q = await openQuestion();
    await createPrediction(db, { questionId: q.id, userId: player.id, valueNumber: 240, joker: true });
    await db.update(season).set({ jokersEnabled: false }).where(eq(season.id, q.seasonId!));
    expect(await setJoker(db, player, { questionId: q.id, enabled: false }, now)).toEqual({
      ok: false,
      code: "JOKERS_DISABLED",
      message: "Pas de joker cette saison.",
    });
    const other = await openQuestion();
    await savePrediction(db, player, { questionId: other.id, rawValue: "12" }, now);
    expect(await setJoker(db, player, { questionId: other.id, enabled: true }, now)).toMatchObject({ code: "JOKERS_DISABLED" });
    expect((await predictionOf(other.id)).joker).toBe(false);
  });

  it("a question that is not open stays « not open », whatever the season allows", async () => {
    const closed = await openQuestion({ opensAt: clock.at("-3d"), closesAt: clock.at("-1d") });
    await db.update(season).set({ jokersEnabled: false }).where(eq(season.id, closed.seasonId!));
    expect(await setJoker(db, player, { questionId: closed.id, enabled: true }, now)).toMatchObject({ code: "QUESTION_NOT_OPEN" });
  });
});

describe("extensions (v1.2, §5.2, §5.4, §5.14)", () => {
  /** A question closed yesterday, without result, and an extension for the player until `deadline`. */
  async function extended(deadline = clock.at("+2d")) {
    const q = await openQuestion({ opensAt: clock.at("-5d"), closesAt: clock.at("-1d") });
    const granted = await setQuestionExtension(db, admin, { questionId: q.id, userId: player.id, closesAt: utcToParisLocalInput(deadline) }, now);
    expect(granted).toMatchObject({ ok: true });
    return q;
  }

  it("the extended player saves, validates and poses a joker until the deadline; another player is still refused", async () => {
    const q = await extended();
    expect(await savePrediction(db, player, { questionId: q.id, rawValue: "240" }, now)).toMatchObject({ ok: true });
    expect(await setJoker(db, player, { questionId: q.id, enabled: true }, now)).toMatchObject({ ok: true, data: { joker: true } });
    const other = actorOf(await createUser(db));
    expect(await savePrediction(db, other, { questionId: q.id, rawValue: "250" }, now)).toMatchObject({ code: "QUESTION_NOT_OPEN" });
    expect(await validatePrediction(db, player, { questionId: q.id, rawValue: "245" }, clock.at("+1d"))).toMatchObject({ ok: true });
    expect(await predictionOf(q.id)).toMatchObject({ valueNumber: 245, joker: true, validatedAt: clock.at("+1d") });
  });

  it("the deadline is excluded, like a closing: refused at the deadline, and a saved prediction counts as validated (PR9)", async () => {
    const deadline = clock.at("+2d");
    const q = await extended(deadline);
    await savePrediction(db, player, { questionId: q.id, rawValue: "240" }, now);
    const lastMoment = new Date(deadline.getTime() - 1);
    expect(await savePrediction(db, player, { questionId: q.id, rawValue: "241" }, lastMoment)).toMatchObject({ ok: true });
    expect(await savePrediction(db, player, { questionId: q.id, rawValue: "242" }, deadline)).toMatchObject({ code: "QUESTION_NOT_OPEN" });
    expect(await setJoker(db, player, { questionId: q.id, enabled: true }, deadline)).toMatchObject({ code: "QUESTION_NOT_OPEN" });
    const views = await getQuestionPredictionsForViewer(db, admin, q.id, deadline);
    expect(views?.find(({ userId }) => userId === player.id)?.state).toBe("validated");
    // Before the deadline, the same prediction was only saved.
    const before = await getQuestionPredictionsForViewer(db, admin, q.id, lastMoment);
    expect(before?.find(({ userId }) => userId === player.id)?.state).toBe("saved");
  });

  it("a prediction saved during the extension counts as validated once the extension is cancelled (PR8)", async () => {
    const q = await extended();
    await savePrediction(db, player, { questionId: q.id, rawValue: "240" }, now);
    expect(await cancelQuestionExtension(db, admin, { questionId: q.id, userId: player.id }, now)).toEqual({ ok: true, data: { ended: "closed" } });
    expect(await savePrediction(db, player, { questionId: q.id, rawValue: "241" }, now)).toMatchObject({ code: "QUESTION_NOT_OPEN" });
    const views = await getQuestionPredictionsForViewer(db, admin, q.id, now);
    expect(views?.find(({ userId }) => userId === player.id)?.state).toBe("validated");
  });

  it("the admin unlocks a prediction validated during the extension, and the player changes it", async () => {
    const q = await extended();
    await validatePrediction(db, player, { questionId: q.id, rawValue: "240" }, now);
    const { id: predictionId } = await predictionOf(q.id);
    expect(await unlockPrediction(db, admin, { predictionId }, now)).toEqual({ ok: true, data: undefined });
    expect(await savePrediction(db, player, { questionId: q.id, rawValue: "250" }, now)).toMatchObject({ ok: true });
    // After the deadline, no more unlocking.
    await validatePrediction(db, player, { questionId: q.id }, now);
    expect(await unlockPrediction(db, admin, { predictionId }, clock.at("+3d"))).toMatchObject({ code: "QUESTION_NOT_OPEN" });
  });

  it("counts the joker of the extended question in its season, with the limit of 2", async () => {
    const q = await extended();
    for (let posed = 0; posed < 2; posed += 1) {
      const other = await openQuestion();
      await createPrediction(db, { questionId: other.id, userId: player.id, valueNumber: 1, joker: true });
    }
    await savePrediction(db, player, { questionId: q.id, rawValue: "240" }, now);
    expect(await setJoker(db, player, { questionId: q.id, enabled: true }, now)).toMatchObject({ code: "NO_JOKER_LEFT" });
  });
});

describe("history (§4.3 prediction_event)", () => {
  it("writes one event per action, with the value, the joker after the event and the right actor", async () => {
    const q = await openQuestion();
    await savePrediction(db, player, { questionId: q.id, rawValue: "200" }, clock.at("-4h"));
    await savePrediction(db, player, { questionId: q.id, rawValue: "210" }, clock.at("-3h"));
    await setJoker(db, player, { questionId: q.id, enabled: true }, clock.at("-2h"));
    await validatePrediction(db, player, { questionId: q.id }, clock.at("-1h"));
    const { id } = await predictionOf(q.id);
    await unlockPrediction(db, admin, { predictionId: id }, clock.at("-30min"));
    await setJoker(db, player, { questionId: q.id, enabled: false }, clock.at("-10min"));

    const mine = { ownerId: player.id, optionId: null };
    expect(await eventsOf(q.id)).toEqual([
      { ...mine, type: "saved", actorId: player.id, valueNumber: 200, joker: false, createdAt: clock.at("-4h") },
      { ...mine, type: "saved", actorId: player.id, valueNumber: 210, joker: false, createdAt: clock.at("-3h") },
      { ...mine, type: "joker_on", actorId: player.id, valueNumber: 210, joker: true, createdAt: clock.at("-2h") },
      { ...mine, type: "validated", actorId: player.id, valueNumber: 210, joker: true, createdAt: clock.at("-1h") },
      { ...mine, type: "unlocked", actorId: admin.id, valueNumber: 210, joker: true, createdAt: clock.at("-30min") },
      { ...mine, type: "joker_off", actorId: player.id, valueNumber: 210, joker: false, createdAt: clock.at("-10min") },
    ]);
  });

  it("a refused action writes no event", async () => {
    const q = await openQuestion();
    await savePrediction(db, player, { questionId: q.id, rawValue: "abc" }, now);
    await setJoker(db, player, { questionId: q.id, enabled: true }, now);
    await validatePrediction(db, player, { questionId: q.id }, now);
    expect(await eventsOf(q.id)).toEqual([]);
  });
});

describe("recordVisit (§5.9)", () => {
  async function visitFields(userId = player.id) {
    const [row] = await db.select({ lastSeenAt: user.lastSeenAt, previousVisitAt: user.previousVisitAt }).from(user).where(eq(user.id, userId));
    return row;
  }

  it("records the first page seen, without a previous visit", async () => {
    expect(await recordVisit(db, player, now)).toEqual({ ok: true, data: { lastSeenAt: now, previousVisitAt: null } });
    expect(await visitFields()).toEqual({ lastSeenAt: now, previousVisitAt: null });
  });

  it("within 30 minutes, the same visit goes on; after, the last visit becomes the previous one", async () => {
    await db.update(user).set({ lastSeenAt: clock.at("-3d"), previousVisitAt: clock.at("-10d") }).where(eq(user.id, player.id));
    await recordVisit(db, player, clock.at("-40min"));
    expect(await visitFields()).toEqual({ lastSeenAt: clock.at("-40min"), previousVisitAt: clock.at("-3d") });

    await recordVisit(db, player, clock.at("-15min"));
    expect(await visitFields()).toEqual({ lastSeenAt: clock.at("-15min"), previousVisitAt: clock.at("-3d") });

    await recordVisit(db, player, clock.at("+20min"));
    expect(await visitFields()).toEqual({ lastSeenAt: clock.at("+20min"), previousVisitAt: clock.at("-15min") });
  });

  it("does not change the account's update date", async () => {
    const [before] = await db.select({ updatedAt: user.updatedAt }).from(user).where(eq(user.id, player.id));
    await recordVisit(db, player, now);
    const [after] = await db.select({ updatedAt: user.updatedAt }).from(user).where(eq(user.id, player.id));
    expect(after.updatedAt).toEqual(before.updatedAt);
  });
});
