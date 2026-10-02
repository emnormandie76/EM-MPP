import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/lib/db/client";
import { prize, question, season } from "@/lib/db/schema";
import { parisLocalToUtc, seasonAt, seasonStartFromLocalDate } from "@/lib/game/time";
import { setJoker } from "@/lib/services/predictions";
import { publishQuestions, setQuestionDates, updateQuestion } from "@/lib/services/questions";
import type { Actor } from "@/lib/services/result";
import { createSeason, deleteSeason, updateSeason, upsertPrizes } from "@/lib/services/seasons";
import { makeClock } from "../helpers/clock";
import { createTestDb } from "../helpers/db";
import { createCategory, createPrediction, createQuestion, createUser } from "../helpers/factories";

// Seasons created by the admin (architecture §5.1, §5.13, vectors SA1 to SA13). Season A starts on
// 29 September 2025, season B on 1 October 2026; now is 5 October 2026.

const clock = makeClock("2026-10-05T10:00:00Z");
const now = clock.now;

let db: Database;
let close: () => Promise<void>;
let admin: Actor;
let categoryId: number;
let A: number;
let B: number;

async function created(label: string, startsOn: string): Promise<number> {
  const result = await createSeason(db, admin, { label, startsOn }, now);
  if (!result.ok) throw new Error(`createSeason failed: ${result.message}`);
  return result.data.id;
}

beforeEach(async () => {
  ({ db, close } = await createTestDb());
  admin = { id: (await createUser(db, { role: "admin" })).id, role: "admin", banned: false };
  categoryId = (await createCategory(db, "JPO")).id;
  A = await created("2025-2026", "2025-09-29");
  B = await created("2026-2027", "2026-10-01");
});

afterEach(async () => {
  await close();
});

/** A question closing at `closes` (Paris time), in the season the services would give it. */
async function questionClosing(closes: string, overrides: Parameters<typeof createQuestion>[1] = {}) {
  const closesAt = parisLocalToUtc(closes);
  return createQuestion(db, { categoryId, opensAt: new Date(closesAt.getTime() - 7 * 86_400_000), closesAt, ...overrides });
}

async function seasonOf(questionId: number): Promise<number | null> {
  const [row] = await db.select({ seasonId: question.seasonId }).from(question).where(eq(question.id, questionId));
  return row.seasonId;
}

async function seasonRow(id: number) {
  const [row] = await db.select().from(season).where(eq(season.id, id));
  return row;
}

async function proclaim(id: number) {
  await db.update(season).set({ proclaimedAt: clock.at("-1d") }).where(eq(season.id, id));
}

describe("authorization (§6.5)", () => {
  it("lets only an active admin create, update or delete a season", async () => {
    const player = await createUser(db);
    const disabledAdmin = await createUser(db, { role: "admin", banned: true });
    const profiles: [Actor | null, string][] = [
      [null, "NOT_AUTHENTICATED"],
      [{ id: player.id, role: "player", banned: false }, "FORBIDDEN"],
      [{ id: disabledAdmin.id, role: "admin", banned: true }, "ACCOUNT_DISABLED"],
    ];
    for (const [actor, code] of profiles) {
      expect(await createSeason(db, actor, { label: "2027-2028", startsOn: "2027-09-06" }, now)).toMatchObject({ ok: false, code });
      expect(await updateSeason(db, actor, { seasonId: B, label: "Renommée", startsOn: "2026-10-01" }, now)).toMatchObject({ ok: false, code });
      expect(await deleteSeason(db, actor, { seasonId: B })).toMatchObject({ ok: false, code });
    }
    expect(await db.select().from(season)).toHaveLength(2);
    expect((await seasonRow(B)).label).toBe("2026-2027");

    expect(await createSeason(db, admin, { label: "2027-2028", startsOn: "2027-09-06" }, now)).toMatchObject({ ok: true });
    expect(await updateSeason(db, admin, { seasonId: B, label: "Renommée", startsOn: "2026-10-01" }, now)).toMatchObject({ ok: true });
    expect(await deleteSeason(db, admin, { seasonId: B })).toEqual({ ok: true, data: undefined });
  });
});

describe("createSeason (§5.13)", () => {
  it("stores the name and 00:00 on the start day, Paris time", async () => {
    const result = await createSeason(db, admin, { label: "  Saison 2027  ", startsOn: "2027-09-06" }, now);
    expect(result).toMatchObject({ ok: true, data: { moved: 0 } });
    const row = await seasonRow(result.ok ? result.data.id : 0);
    expect(row).toMatchObject({ label: "Saison 2027", startsAt: new Date("2027-09-05T22:00:00Z"), proclaimedAt: null });
  });

  it("SA1: takes over from the season before it the questions closing from its start on", async () => {
    const moving = await questionClosing("2027-09-10T18:00");
    const staying = await questionClosing("2027-09-05T23:59");
    const draft = await questionClosing("2027-10-01T18:00", { status: "draft" });
    expect(await seasonOf(moving.id)).toBe(B);

    const result = await createSeason(db, admin, { label: "2027-2028", startsOn: "2027-09-06" }, now);
    expect(result).toMatchObject({ ok: true, data: { moved: 2 } });
    const C = result.ok ? result.data.id : 0;
    expect(await seasonOf(moving.id)).toBe(C);
    expect(await seasonOf(draft.id)).toBe(C);
    expect(await seasonOf(staying.id)).toBe(B);
  });

  it("SA2: is refused when one of these questions has a prediction, and nothing changes", async () => {
    const player = await createUser(db);
    const moving = await questionClosing("2027-09-10T18:00", { status: "published" });
    await createPrediction(db, { questionId: moving.id, userId: player.id });
    const other = await questionClosing("2027-09-20T18:00");

    const result = await createSeason(db, admin, { label: "2027-2028", startsOn: "2027-09-06" }, now);
    expect(result).toMatchObject({ ok: false, code: "SEASON_CHANGE_REFUSED" });
    expect(result.ok ? "" : result.message).toContain("Des questions avec des pronos clôturent après cette date : elles changeraient de saison");
    expect(result.ok ? "" : result.message).toContain("« Combien de participants à la JPO ? »");
    expect(await db.select().from(season)).toHaveLength(2);
    expect(await seasonOf(moving.id)).toBe(B);
    expect(await seasonOf(other.id)).toBe(B);
  });

  it("can come before the first season: drafts without a season get it", async () => {
    const draft = await questionClosing("2025-06-10T18:00", { status: "draft", seasonId: null });
    const result = await createSeason(db, admin, { label: "2024-2025", startsOn: "2024-10-01" }, now);
    expect(result).toMatchObject({ ok: true, data: { moved: 1 } });
    expect(await seasonOf(draft.id)).toBe(result.ok ? result.data.id : 0);
  });

  it("refuses a name already taken, whatever the case, and a start day already taken", async () => {
    expect(await createSeason(db, admin, { label: "2026-2027", startsOn: "2027-09-06" }, now)).toMatchObject({
      ok: false,
      code: "SEASON_NAME_TAKEN",
      fieldErrors: { label: "Cette saison existe déjà." },
    });
    await created("Saison des Tests", "2028-09-04");
    expect(await createSeason(db, admin, { label: "saison des tests", startsOn: "2029-09-03" }, now)).toMatchObject({
      code: "SEASON_NAME_TAKEN",
    });
    expect(await createSeason(db, admin, { label: "Autre", startsOn: "2026-10-01" }, now)).toMatchObject({
      ok: false,
      code: "SEASON_START_TAKEN",
      fieldErrors: { startsOn: "Une saison commence déjà ce jour-là." },
    });
    expect(await db.select().from(season)).toHaveLength(3);
  });

  it("checks the name and the start day", async () => {
    expect(await createSeason(db, admin, { label: " a ", startsOn: "2027-09-06" }, now)).toMatchObject({
      fieldErrors: { label: "Le nom doit faire de 2 à 40 caractères." },
    });
    expect(await createSeason(db, admin, { label: "x".repeat(41), startsOn: "2027-09-06" }, now)).toMatchObject({
      fieldErrors: { label: "Le nom doit faire de 2 à 40 caractères." },
    });
    expect(await createSeason(db, admin, { label: "2027-2028", startsOn: "" }, now)).toMatchObject({
      fieldErrors: { startsOn: "Indique la date de début." },
    });
    expect(await createSeason(db, admin, { label: "2027-2028", startsOn: "2027-02-30" }, now)).toMatchObject({
      fieldErrors: { startsOn: "Date invalide." },
    });
    expect(await createSeason(db, admin, { label: "2027-2028" }, now)).toMatchObject({ code: "INVALID_INPUT" });
  });
});

describe("updateSeason (§5.13)", () => {
  it("SA3: moving the start of B earlier brings the questions without predictions of 28, 29 and 30 September into B", async () => {
    const days = ["2026-09-28T09:00", "2026-09-29T12:00", "2026-09-30T23:59"];
    const moving = await Promise.all(days.map((day) => questionClosing(day)));
    const staying = await questionClosing("2026-09-27T23:59");
    for (const q of moving) expect(await seasonOf(q.id)).toBe(A);

    const result = await updateSeason(db, admin, { seasonId: B, label: "2026-2027", startsOn: "2026-09-28" }, now);
    expect(result).toEqual({ ok: true, data: { id: B, moved: 3 } });
    expect((await seasonRow(B)).startsAt).toEqual(seasonStartFromLocalDate("2026-09-28"));
    for (const q of moving) expect(await seasonOf(q.id)).toBe(B);
    expect(await seasonOf(staying.id)).toBe(A);

    // And back: they return to A.
    expect(await updateSeason(db, admin, { seasonId: B, label: "2026-2027", startsOn: "2026-10-01" }, now)).toMatchObject({
      data: { moved: 3 },
    });
    for (const q of moving) expect(await seasonOf(q.id)).toBe(A);
  });

  it("SA4: the start day stays strictly between the starts of the seasons around it", async () => {
    const C = await created("2027-2028", "2027-09-06");
    for (const startsOn of ["2025-09-28", "2025-09-29"]) {
      const result = await updateSeason(db, admin, { seasonId: B, label: "2026-2027", startsOn }, now);
      expect(result).toMatchObject({ ok: false, code: "SEASON_ORDER" });
      expect(result.ok ? "" : result.message).toBe(
        "La date de début doit rester entre celle de la saison précédente et celle de la suivante : après le 29 sept. 2025 et avant le 6 sept. 2027.",
      );
    }
    for (const startsOn of ["2027-09-06", "2028-01-01"]) {
      expect(await updateSeason(db, admin, { seasonId: B, label: "2026-2027", startsOn }, now)).toMatchObject({ code: "SEASON_ORDER" });
    }
    expect((await seasonRow(B)).startsAt).toEqual(seasonStartFromLocalDate("2026-10-01"));
    // The last season can move as late as wanted, the first one as early as wanted.
    expect(await updateSeason(db, admin, { seasonId: C, label: "2027-2028", startsOn: "2030-01-01" }, now)).toMatchObject({ ok: true });
    expect(await updateSeason(db, admin, { seasonId: A, label: "2025-2026", startsOn: "2020-01-01" }, now)).toMatchObject({ ok: true });
  });

  it("is refused when a question with predictions would change season, and nothing changes", async () => {
    const player = await createUser(db);
    const q = await questionClosing("2026-09-29T12:00", { status: "published" });
    await createPrediction(db, { questionId: q.id, userId: player.id });

    const result = await updateSeason(db, admin, { seasonId: B, label: "Nouveau nom", startsOn: "2026-09-28" }, now);
    expect(result).toMatchObject({ ok: false, code: "SEASON_CHANGE_REFUSED" });
    expect(result.ok ? "" : result.message).toContain("Des questions avec des pronos changeraient de saison avec cette date");
    expect(await seasonRow(B)).toMatchObject({ label: "2026-2027", startsAt: seasonStartFromLocalDate("2026-10-01") });
    expect(await seasonOf(q.id)).toBe(A);
  });

  it("refuses to leave a published question without a season; a draft simply loses its season", async () => {
    const draft = await questionClosing("2025-10-10T18:00", { status: "draft" });
    expect(await updateSeason(db, admin, { seasonId: A, label: "2025-2026", startsOn: "2025-11-01" }, now)).toMatchObject({
      ok: true,
      data: { moved: 1 },
    });
    expect(await seasonOf(draft.id)).toBeNull();

    const published = await questionClosing("2025-11-10T18:00", { status: "published" });
    const result = await updateSeason(db, admin, { seasonId: A, label: "2025-2026", startsOn: "2025-12-01" }, now);
    expect(result).toMatchObject({ ok: false, code: "SEASON_CHANGE_REFUSED" });
    expect(result.ok ? "" : result.message).toContain("Des questions publiées se retrouveraient sans saison");
    expect(await seasonOf(published.id)).toBe(A);
  });

  it("renames without moving anything; the name stays unique whatever the case", async () => {
    const q = await questionClosing("2026-12-01T18:00", { status: "published" });
    const result = await updateSeason(db, admin, { seasonId: B, label: "Saison 2026", startsOn: "2026-10-01" }, now);
    expect(result).toEqual({ ok: true, data: { id: B, moved: 0 } });
    expect((await seasonRow(B)).label).toBe("Saison 2026");
    expect(await seasonOf(q.id)).toBe(B);

    expect(await updateSeason(db, admin, { seasonId: B, label: "SAISON 2026", startsOn: "2026-10-01" }, now)).toMatchObject({ ok: true });
    expect(await updateSeason(db, admin, { seasonId: B, label: "2025-2026", startsOn: "2026-10-01" }, now)).toMatchObject({
      code: "SEASON_NAME_TAKEN",
    });
    expect(await updateSeason(db, admin, { seasonId: 999, label: "Inconnue", startsOn: "2026-10-01" }, now)).toMatchObject({
      code: "NOT_FOUND",
      message: "Cette saison n'existe pas.",
    });
  });
});

describe("deleteSeason (§5.13)", () => {
  it("SA5: is refused while a question is attached, even a draft", async () => {
    const C = await created("2027-2028", "2027-09-06");
    await questionClosing("2027-10-01T18:00", { status: "draft" });
    expect(await deleteSeason(db, admin, { seasonId: C })).toMatchObject({
      ok: false,
      code: "SEASON_HAS_QUESTIONS",
      message: "Des questions sont rattachées à cette saison : elle ne peut pas être supprimée.",
    });
    expect(await seasonRow(C)).toBeDefined();
  });

  it("SA6: deletes an empty season with its prizes; the season before it goes on", async () => {
    const C = await created("2027-2028", "2027-09-06");
    await upsertPrizes(db, admin, { seasonId: C, prizes: [{ rankLabel: "1er", description: "Un mug" }] });
    expect(await deleteSeason(db, admin, { seasonId: C })).toMatchObject({ ok: true });
    expect(await seasonRow(C)).toBeUndefined();
    expect(await db.select().from(prize)).toEqual([]);
    expect(seasonAt(await db.select().from(season), new Date("2027-11-01T00:00:00Z"))?.id).toBe(B);
  });

  it("is refused for a proclaimed season or an unknown one", async () => {
    await proclaim(A);
    expect(await deleteSeason(db, admin, { seasonId: A })).toMatchObject({
      code: "SEASON_PROCLAIMED",
      message: "Cette saison est proclamée : elle ne peut pas être supprimée.",
    });
    expect(await deleteSeason(db, admin, { seasonId: 999 })).toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("questions and seasons", () => {
  /** Only one season, which starts on 1 December 2026, after now. */
  async function firstSeasonInDecember(): Promise<number> {
    await deleteSeason(db, admin, { seasonId: B });
    await deleteSeason(db, admin, { seasonId: A });
    return created("Première", "2026-12-01");
  }
  const NO_SEASON = "Aucune saison ne couvre cette date de clôture : crée d'abord la saison dans Saisons et lots.";

  it("SA7: a question closing before the first season cannot be published", async () => {
    await firstSeasonInDecember();
    const q = await questionClosing("2026-11-15T18:00", { status: "draft", seasonId: null, opensAt: clock.at("+1d") });
    expect(await publishQuestions(db, admin, { questionIds: [q.id] }, now)).toMatchObject({
      ok: true,
      data: { succeeded: [], failed: [{ id: q.id, reasons: [NO_SEASON] }] },
    });
  });

  it("a published question cannot move its closing date where no season exists", async () => {
    const first = await firstSeasonInDecember();
    const draft = await questionClosing("2026-12-15T18:00", { status: "draft", opensAt: clock.at("+1d") });
    const published = await questionClosing("2026-12-10T18:00", { status: "published", opensAt: clock.at("+1d") });
    expect(await seasonOf(published.id)).toBe(first);

    expect(await updateQuestion(db, admin, { questionId: published.id, closesAt: "2026-11-10T18:00" }, now)).toMatchObject({
      ok: false,
      fieldErrors: { closesAt: NO_SEASON },
    });
    const report = await setQuestionDates(
      db,
      admin,
      { questionIds: [draft.id, published.id], opensAt: "2026-10-20T09:00", closesAt: "2026-11-10T18:00" },
      now,
    );
    expect(report).toMatchObject({
      ok: true,
      data: { succeeded: [{ id: draft.id }], failed: [{ id: published.id, reasons: [NO_SEASON] }] },
    });
    expect(await seasonOf(draft.id)).toBeNull();
    expect(await seasonOf(published.id)).toBe(first);
  });

  it("a draft keeps no season when no season covers its closing date, and gets one when the season is created", async () => {
    const q = await questionClosing("2026-12-01T18:00", { status: "draft" });
    expect(await updateQuestion(db, admin, { questionId: q.id, opensAt: "2020-01-03T09:00", closesAt: "2020-01-10T18:00" }, now)).toMatchObject({ ok: true });
    expect(await seasonOf(q.id)).toBeNull();
    const created2019 = await created("2019-2020", "2019-09-02");
    expect(await seasonOf(q.id)).toBe(created2019);
  });
});

describe("proclaimed seasons (§5.13, decision of 30/09/2026)", () => {
  it("SA8: a proclaimed season keeps its start day but can be renamed", async () => {
    await proclaim(A);
    const moved = await updateSeason(db, admin, { seasonId: A, label: "2025-2026", startsOn: "2025-09-15" }, now);
    expect(moved).toMatchObject({
      ok: false,
      code: "SEASON_PROCLAIMED",
      fieldErrors: { startsOn: "Cette saison est proclamée : sa date de début ne peut plus changer." },
    });
    expect(await updateSeason(db, admin, { seasonId: A, label: "Saison 2025", startsOn: "2025-09-29" }, now)).toMatchObject({ ok: true });
    expect(await seasonRow(A)).toMatchObject({ label: "Saison 2025", startsAt: seasonStartFromLocalDate("2025-09-29") });
  });

  it("the season after a proclaimed one can be created, and drafts move into it", async () => {
    await proclaim(B);
    const draft = await questionClosing("2027-10-01T18:00", { status: "draft" });
    const result = await createSeason(db, admin, { label: "2027-2028", startsOn: "2027-09-06" }, now);
    expect(result).toMatchObject({ ok: true, data: { moved: 1 } });
    expect(await seasonOf(draft.id)).toBe(result.ok ? result.data.id : 0);
  });

  it("refuses to take a published or cancelled question out of a proclaimed season", async () => {
    await proclaim(A);
    const resolved = await questionClosing("2026-09-20T18:00", { status: "published", resultNumber: 250, resolvedAt: clock.at("-10d") });
    for (const startsOn of ["2026-09-15", "2026-09-10"]) {
      const result = await createSeason(db, admin, { label: "Rétroactive", startsOn }, now);
      expect(result).toMatchObject({ ok: false, code: "SEASON_CHANGE_REFUSED" });
      expect(result.ok ? "" : result.message).toContain("Des questions entreraient dans une saison proclamée ou en sortiraient");
    }
    expect(await updateSeason(db, admin, { seasonId: B, label: "2026-2027", startsOn: "2026-09-15" }, now)).toMatchObject({
      code: "SEASON_CHANGE_REFUSED",
    });
    await db.update(question).set({ status: "cancelled", cancelledAt: clock.at("-1d") }).where(eq(question.id, resolved.id));
    expect(await createSeason(db, admin, { label: "Rétroactive", startsOn: "2026-09-15" }, now)).toMatchObject({
      code: "SEASON_CHANGE_REFUSED",
    });
    expect(await seasonOf(resolved.id)).toBe(A);
    expect(await db.select().from(season)).toHaveLength(2);
  });

  it("refuses to bring a published question into a proclaimed season", async () => {
    await proclaim(A);
    const q = await questionClosing("2026-10-02T18:00", { status: "published" });
    expect(await seasonOf(q.id)).toBe(B);
    expect(await updateSeason(db, admin, { seasonId: B, label: "2026-2027", startsOn: "2026-10-03" }, now)).toMatchObject({
      code: "SEASON_CHANGE_REFUSED",
    });
    // A start day that moves no question is accepted, even next to a proclaimed season.
    expect(await updateSeason(db, admin, { seasonId: B, label: "2026-2027", startsOn: "2026-10-02" }, now)).toMatchObject({ ok: true });
  });

  it("refuses the prizes of a proclaimed season", async () => {
    await proclaim(A);
    expect(await upsertPrizes(db, admin, { seasonId: A, prizes: [{ rankLabel: "1er", description: "Un mug" }] })).toMatchObject({
      code: "SEASON_PROCLAIMED",
    });
  });
});

describe("jokers allowed by season (v1.2, §5.13, vectors SA9 to SA13)", () => {
  /** An open question of season B, with a saved prediction of a new player. */
  async function openWithPrediction(joker: boolean, status: "published" | "cancelled" = "published") {
    const q = await createQuestion(db, { categoryId, status, opensAt: clock.at("-1d"), closesAt: clock.at("+5d") });
    const player = await createUser(db);
    await createPrediction(db, { questionId: q.id, userId: player.id, valueNumber: 240, joker });
    return { q, player: { id: player.id, role: "player" as const, banned: false } };
  }

  it("a new season allows jokers by default, or not when the admin says so", async () => {
    expect(await seasonRow(B)).toMatchObject({ jokersEnabled: true });
    const without = await createSeason(db, admin, { label: "Sans jokers", startsOn: "2027-09-06", jokersEnabled: false }, now);
    expect(await seasonRow(without.ok ? without.data.id : 0)).toMatchObject({ jokersEnabled: false });
  });

  it("SA9: takes the jokers away from a season without any joker posed; setJoker then refuses", async () => {
    const { q, player } = await openWithPrediction(false);
    expect(await updateSeason(db, admin, { seasonId: B, jokersEnabled: false }, now)).toMatchObject({ ok: true });
    expect(await seasonRow(B)).toMatchObject({ label: "2026-2027", startsAt: seasonStartFromLocalDate("2026-10-01"), jokersEnabled: false });
    expect(await setJoker(db, player, { questionId: q.id, enabled: true }, now)).toMatchObject({ code: "JOKERS_DISABLED" });
  });

  it("SA10: refuses to take the jokers away once a player has posed one; nothing changes", async () => {
    await openWithPrediction(true);
    expect(await updateSeason(db, admin, { seasonId: B, label: "Nouveau nom", jokersEnabled: false }, now)).toEqual({
      ok: false,
      code: "JOKERS_IN_USE",
      message: "Des jokers sont déjà posés dans cette saison : impossible de les retirer.",
      fieldErrors: { jokersEnabled: "Des jokers sont déjà posés dans cette saison : impossible de les retirer." },
    });
    expect(await seasonRow(B)).toMatchObject({ label: "2026-2027", jokersEnabled: true });
  });

  it("SA11: a joker posed on a cancelled question was given back: it does not prevent taking them away", async () => {
    await openWithPrediction(true, "cancelled");
    expect(await updateSeason(db, admin, { seasonId: B, jokersEnabled: false }, now)).toMatchObject({ ok: true });
  });

  it("SA12: allows the jokers again; setJoker works, with the limit of 2", async () => {
    const { q, player } = await openWithPrediction(false);
    await updateSeason(db, admin, { seasonId: B, jokersEnabled: false }, now);
    expect(await updateSeason(db, admin, { seasonId: B, jokersEnabled: true }, now)).toMatchObject({ ok: true });
    expect(await setJoker(db, player, { questionId: q.id, enabled: true }, now)).toMatchObject({ ok: true, data: { joker: true, jokersLeft: 1 } });
  });

  it("SA13: a proclaimed season keeps its jokers setting, either way", async () => {
    await proclaim(A);
    expect(await updateSeason(db, admin, { seasonId: A, jokersEnabled: false }, now)).toMatchObject({
      ok: false,
      code: "SEASON_PROCLAIMED",
      fieldErrors: { jokersEnabled: "Cette saison est proclamée : le réglage des jokers ne peut plus changer." },
    });
    await db.update(season).set({ jokersEnabled: false }).where(eq(season.id, A));
    expect(await updateSeason(db, admin, { seasonId: A, jokersEnabled: true }, now)).toMatchObject({ code: "SEASON_PROCLAIMED" });
    // Sending the same setting, with a new name, is accepted.
    expect(await updateSeason(db, admin, { seasonId: A, label: "Saison 2025", jokersEnabled: false }, now)).toMatchObject({ ok: true });
  });

  it("an update without a field keeps its value", async () => {
    expect(await updateSeason(db, admin, { seasonId: B, label: "Renommée" }, now)).toMatchObject({ ok: true });
    expect(await seasonRow(B)).toMatchObject({ label: "Renommée", startsAt: seasonStartFromLocalDate("2026-10-01"), jokersEnabled: true });
  });
});
