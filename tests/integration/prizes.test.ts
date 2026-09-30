import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getPrizes } from "@/lib/data/content";
import type { Database } from "@/lib/db/client";
import { prize, season } from "@/lib/db/schema";
import type { Actor } from "@/lib/services/result";
import { upsertPrizes } from "@/lib/services/seasons";
import { makeClock } from "../helpers/clock";
import { createTestDb } from "../helpers/db";
import { createUser, ensureTestSeason } from "../helpers/factories";

// Prizes of a season (architecture §5.13, §7.3, §8.3 /admin/saisons).

const now = makeClock("2026-10-05T10:00:00Z").now;
const PRIZES = [
  { rankLabel: "1er", description: "Un déjeuner d'équipe offert" },
  { rankLabel: "2e", description: "Un sweat de l'école" },
  { rankLabel: "3e", description: "Un mug de l'école" },
];

let db: Database;
let close: () => Promise<void>;
let admin: Actor;
let seasonId: number;

beforeEach(async () => {
  ({ db, close } = await createTestDb());
  admin = { id: (await createUser(db, { role: "admin" })).id, role: "admin", banned: false };
  seasonId = (await ensureTestSeason(db, "2026-2027")).id;
});

afterEach(async () => {
  await close();
});

async function prizesOf(id: number) {
  return (await getPrizes(db, { id: admin.id, role: "admin" }, id)).map(({ rankLabel, description }) => ({ rankLabel, description }));
}

describe("upsertPrizes", () => {
  it("is for admins only", async () => {
    const player = await createUser(db);
    const disabledAdmin = await createUser(db, { role: "admin", banned: true });
    const input = { seasonId, prizes: PRIZES };
    expect(await upsertPrizes(db, null, input)).toMatchObject({ code: "NOT_AUTHENTICATED" });
    expect(await upsertPrizes(db, { id: player.id, role: "player", banned: false }, input)).toMatchObject({ code: "FORBIDDEN" });
    expect(await upsertPrizes(db, { id: disabledAdmin.id, role: "admin", banned: true }, input)).toMatchObject({
      code: "ACCOUNT_DISABLED",
    });
    expect(await upsertPrizes(db, admin, input)).toMatchObject({ ok: true });
  });

  it("saves the prizes of a season in order", async () => {
    const result = await upsertPrizes(db, admin, { seasonId, prizes: PRIZES });
    expect(result).toEqual({ ok: true, data: { seasonId, count: 3 } });
    expect(await prizesOf(seasonId)).toEqual(PRIZES);
    const rows = await db.select().from(prize).where(eq(prize.seasonId, seasonId));
    expect(rows.map(({ position }) => position).sort()).toEqual([1, 2, 3]);
  });

  it("replaces the whole list: new order, removed and added prizes, trimmed texts", async () => {
    await upsertPrizes(db, admin, { seasonId, prizes: PRIZES });
    const prizes = [
      { rankLabel: " 1er ", description: " Un sweat de l'école " },
      { rankLabel: "Tous", description: "Un café offert" },
    ];
    expect(await upsertPrizes(db, admin, { seasonId, prizes })).toMatchObject({ ok: true });
    expect(await prizesOf(seasonId)).toEqual([
      { rankLabel: "1er", description: "Un sweat de l'école" },
      { rankLabel: "Tous", description: "Un café offert" },
    ]);
    expect(await upsertPrizes(db, admin, { seasonId, prizes: [] })).toMatchObject({ ok: true, data: { count: 0 } });
    expect(await db.select().from(prize)).toEqual([]);
  });

  it("refuses an empty rank or description and more than 10 prizes", async () => {
    expect(await upsertPrizes(db, admin, { seasonId, prizes: [{ rankLabel: "", description: "Un mug" }] })).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: { prizes: "Le rang doit faire de 1 à 20 caractères (par exemple « 1er »)." },
    });
    const eleven = Array.from({ length: 11 }, (_, i) => ({ rankLabel: `${i + 1}e`, description: "Un mug" }));
    expect(await upsertPrizes(db, admin, { seasonId, prizes: eleven })).toMatchObject({
      fieldErrors: { prizes: "10 lots au plus." },
    });
  });

  it("accepts a past or future season, refuses an unknown one and a proclaimed one, without creating any season", async () => {
    const past = await ensureTestSeason(db, "2025-2026");
    const future = await ensureTestSeason(db, "2027-2028", "2027-09-06");
    expect(await upsertPrizes(db, admin, { seasonId: past.id, prizes: PRIZES })).toMatchObject({ ok: true });
    expect(await upsertPrizes(db, admin, { seasonId: future.id, prizes: PRIZES })).toMatchObject({ ok: true });
    expect(await upsertPrizes(db, admin, { seasonId: 999, prizes: PRIZES })).toMatchObject({
      code: "NOT_FOUND",
      message: "Cette saison n'existe pas.",
    });
    expect(await db.select().from(season)).toHaveLength(3);

    const proclaimed = await ensureTestSeason(db, "2024-2025");
    await db.update(season).set({ proclaimedAt: now }).where(eq(season.id, proclaimed.id));
    expect(await upsertPrizes(db, admin, { seasonId: proclaimed.id, prizes: PRIZES })).toMatchObject({
      code: "SEASON_PROCLAIMED",
    });
    expect(await prizesOf(proclaimed.id)).toEqual([]);
  });
});
