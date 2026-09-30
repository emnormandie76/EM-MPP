import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getPrizes } from "@/lib/data/content";
import type { Database } from "@/lib/db/client";
import { prize, season } from "@/lib/db/schema";
import type { Actor } from "@/lib/services/result";
import { ensureSeason, upsertPrizes } from "@/lib/services/seasons";
import { makeClock } from "../helpers/clock";
import { createTestDb } from "../helpers/db";
import { createUser, ensureTestSeason } from "../helpers/factories";

// Seasons and prizes (architecture §5.1, §7.3, §8.3 /admin/saisons).

const now = makeClock("2026-10-05T10:00:00Z").now;
const PRIZES = [
  { rankLabel: "1er", description: "Un déjeuner d'équipe offert" },
  { rankLabel: "2e", description: "Un sweat de l'école" },
  { rankLabel: "3e", description: "Un mug de l'école" },
];

let db: Database;
let close: () => Promise<void>;
let admin: Actor;

beforeEach(async () => {
  ({ db, close } = await createTestDb());
  admin = { id: (await createUser(db, { role: "admin" })).id, role: "admin", banned: false };
});

afterEach(async () => {
  await close();
});

async function prizesOf(seasonId: number) {
  return (await getPrizes(db, { id: admin.id, role: "admin" }, seasonId)).map(({ rankLabel, description }) => ({ rankLabel, description }));
}

describe("ensureSeason (§5.1)", () => {
  it("creates the season with its Paris bounds once, then returns the same row", async () => {
    const id = await ensureSeason(db, "2026-2027");
    expect(await ensureSeason(db, "2026-2027")).toBe(id);
    const rows = await db.select().from(season);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      label: "2026-2027",
      startsAt: new Date("2026-09-30T22:00:00Z"),
      endsAt: new Date("2027-09-30T22:00:00Z"),
      proclaimedAt: null,
    });
  });
});

describe("upsertPrizes", () => {
  it("is for admins only", async () => {
    const player = await createUser(db);
    const disabledAdmin = await createUser(db, { role: "admin", banned: true });
    const input = { seasonLabel: "2026-2027", prizes: PRIZES };
    expect(await upsertPrizes(db, null, input, now)).toMatchObject({ code: "NOT_AUTHENTICATED" });
    expect(await upsertPrizes(db, { id: player.id, role: "player", banned: false }, input, now)).toMatchObject({ code: "FORBIDDEN" });
    expect(await upsertPrizes(db, { id: disabledAdmin.id, role: "admin", banned: true }, input, now)).toMatchObject({
      code: "ACCOUNT_DISABLED",
    });
    expect(await upsertPrizes(db, admin, input, now)).toMatchObject({ ok: true });
  });

  it("creates the current season if needed and saves the prizes in order", async () => {
    const result = await upsertPrizes(db, admin, { seasonLabel: "2026-2027", prizes: PRIZES }, now);
    expect(result).toMatchObject({ ok: true, data: { count: 3 } });
    const seasonId = result.ok ? result.data.seasonId : 0;
    expect(await prizesOf(seasonId)).toEqual(PRIZES);
    const rows = await db.select().from(prize).where(eq(prize.seasonId, seasonId));
    expect(rows.map(({ position }) => position).sort()).toEqual([1, 2, 3]);
  });

  it("replaces the whole list: new order, removed and added prizes, trimmed texts", async () => {
    await upsertPrizes(db, admin, { seasonLabel: "2026-2027", prizes: PRIZES }, now);
    const result = await upsertPrizes(
      db,
      admin,
      {
        seasonLabel: "2026-2027",
        prizes: [
          { rankLabel: " 1er ", description: " Un sweat de l'école " },
          { rankLabel: "Tous", description: "Un café offert" },
        ],
      },
      now,
    );
    expect(await prizesOf(result.ok ? result.data.seasonId : 0)).toEqual([
      { rankLabel: "1er", description: "Un sweat de l'école" },
      { rankLabel: "Tous", description: "Un café offert" },
    ]);
    expect(await upsertPrizes(db, admin, { seasonLabel: "2026-2027", prizes: [] }, now)).toMatchObject({ ok: true, data: { count: 0 } });
    expect(await db.select().from(prize)).toEqual([]);
  });

  it("refuses an empty rank or description and more than 10 prizes", async () => {
    expect(await upsertPrizes(db, admin, { seasonLabel: "2026-2027", prizes: [{ rankLabel: "", description: "Un mug" }] }, now)).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: { prizes: "Le rang doit faire de 1 à 20 caractères (par exemple « 1er »)." },
    });
    const eleven = Array.from({ length: 11 }, (_, i) => ({ rankLabel: `${i + 1}e`, description: "Un mug" }));
    expect(await upsertPrizes(db, admin, { seasonLabel: "2026-2027", prizes: eleven }, now)).toMatchObject({
      fieldErrors: { prizes: "10 lots au plus." },
    });
  });

  it("accepts an existing past season, refuses an unknown one and a proclaimed one", async () => {
    await ensureTestSeason(db, "2025-2026");
    expect(await upsertPrizes(db, admin, { seasonLabel: "2025-2026", prizes: PRIZES }, now)).toMatchObject({ ok: true });
    expect(await upsertPrizes(db, admin, { seasonLabel: "2030-2031", prizes: PRIZES }, now)).toMatchObject({
      code: "NOT_FOUND",
      message: "Cette saison n'existe pas.",
    });
    const proclaimed = await ensureTestSeason(db, "2024-2025");
    await db.update(season).set({ proclaimedAt: now }).where(eq(season.id, proclaimed.id));
    expect(await upsertPrizes(db, admin, { seasonLabel: "2024-2025", prizes: PRIZES }, now)).toMatchObject({
      code: "SEASON_PROCLAIMED",
    });
  });
});
