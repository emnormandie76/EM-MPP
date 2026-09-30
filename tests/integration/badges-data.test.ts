import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getBadgesOnQuestion, getPlayerBadges } from "@/lib/data/badges";
import type { Database } from "@/lib/db/client";
import { question, user } from "@/lib/db/schema";
import type { BadgeKey } from "@/lib/game/badges";
import { seedDatabase } from "../../scripts/lib/seed";
import { createTestDb } from "../helpers/db";

// Badges of the seed accounts (architecture §5.8, §11 É7), deduced from the resolved questions and
// the palmarès. The seed (read-only here):
// - 2024-2025, not proclaimed: JPO de décembre (real 180), Camille 185 is the closest.
// - 2025-2026, proclaimed: candidatures (real 1 200), Sarah 1 210 (Dans le mille, closest), Inès, Julien,
//   Camille, Thomas; choice "Oui": Sarah and Thomas wrong. Palmarès: Inès first. Sarah, Inès,
//   Julien, Camille and Thomas played both questions (Assidu); Mehdi only the second.
// - 2026-2027: Sarah closest on the JPO (P1) and on the Juste Prix (J3); Julien's joker on the JPO
//   (2nd); Thomas's joker on the right campus.

let db: Database;
let close: () => Promise<void>;
let ids: Record<string, string>;
const viewer = { id: "", role: "player" as const };

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await seedDatabase(db, { now: new Date("2026-11-20T10:00:00Z"), env: {} });
  const users = await db.select({ id: user.id, name: user.name }).from(user);
  ids = Object.fromEntries(users.map(({ id, name }) => [name, id]));
  viewer.id = ids.Hugo;
});

afterAll(async () => {
  await close();
});

async function earned(name: string): Promise<Partial<Record<BadgeKey, number>>> {
  const badges = await getPlayerBadges(db, viewer, ids[name]);
  expect(badges.map(({ key }) => key)).toEqual(["first_bullseye", "nostradamus", "sharpshooter", "joker_win", "assiduous", "champion"]);
  return Object.fromEntries(badges.filter(({ count }) => count > 0).map(({ key, count }) => [key, count]));
}

async function questionId(title: string): Promise<number> {
  const [row] = await db.select({ id: question.id }).from(question).where(eq(question.title, title));
  return row.id;
}

describe("getPlayerBadges on the seed (§5.8)", () => {
  it.each<[string, Partial<Record<BadgeKey, number>>]>([
    ["Sarah", { first_bullseye: 1, sharpshooter: 3, assiduous: 1 }],
    ["Inès", { assiduous: 1, champion: 1 }],
    ["Julien", { joker_win: 1, assiduous: 1 }],
    ["Camille", { sharpshooter: 1, assiduous: 1 }],
    ["Thomas", { joker_win: 1, assiduous: 1 }],
    ["Mehdi", {}],
    ["Léa", {}],
    ["Hugo", {}],
    ["Admin", {}],
    ["Nora", {}],
  ])("%s", async (name, expected) => {
    expect(await earned(name)).toEqual(expected);
  });

  it("gives the name of each badge and the date it was last earned", async () => {
    const badges = await getPlayerBadges(db, viewer, ids.Sarah);
    const first = badges.find(({ key }) => key === "first_bullseye")!;
    // The French quotes hold no-break spaces.
    expect(first.name).toMatch(/^Premier «\s?Dans le mille\s?»$/u);
    const [pr1] = await db.select().from(question).where(eq(question.title, "Combien de candidatures Grande École au 31 mars ?"));
    expect(first.lastEarnedAt).toEqual(pr1.resolvedAt);
    expect(badges.find(({ key }) => key === "nostradamus")).toMatchObject({ count: 0, lastEarnedAt: null });
  });
});

describe("getBadgesOnQuestion (ResultPanel)", () => {
  it("lists the badges earned on one question", async () => {
    const candidatures = await questionId("Combien de candidatures Grande École au 31 mars ?");
    const jpo = await questionId("Combien de participants à la JPO de septembre ?");
    const campus = await questionId("Quel campus comptera le plus d'intégrés en Bachelor ?");
    expect(await getBadgesOnQuestion(db, viewer, ids.Sarah, candidatures)).toEqual(["first_bullseye", "sharpshooter"]);
    expect(await getBadgesOnQuestion(db, viewer, ids.Sarah, jpo)).toEqual(["sharpshooter"]);
    expect(await getBadgesOnQuestion(db, viewer, ids.Julien, jpo)).toEqual(["joker_win"]);
    expect(await getBadgesOnQuestion(db, viewer, ids.Thomas, campus)).toEqual(["joker_win"]);
    expect(await getBadgesOnQuestion(db, viewer, ids.Hugo, campus)).toEqual([]);
  });
});
