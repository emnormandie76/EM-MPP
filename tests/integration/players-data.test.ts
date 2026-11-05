import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAccounts } from "@/lib/data/players";
import type { Database } from "@/lib/db/client";
import { anonymizeUser } from "@/lib/services/players";
import { createTestDb } from "../helpers/db";
import { createUser } from "../helpers/factories";

// Reads of /admin/joueurs (architecture §7.4, §8.3).

let db: Database;
let close: () => Promise<void>;

beforeEach(async () => {
  ({ db, close } = await createTestDb());
});

afterEach(async () => {
  await close();
});

describe("getAccounts", () => {
  it("sorts by name in French order, anonymized accounts last, and marks the viewer", async () => {
    const admin = await createUser(db, { role: "admin", name: "Admin" });
    await createUser(db, { name: "Élodie" });
    await createUser(db, { name: "eric", banned: true });
    const leaving = await createUser(db, { name: "Zoé" });
    await anonymizeUser(db, { id: admin.id, role: "admin", banned: false }, { userId: leaving.id }, new Date("2026-10-20T10:00:00Z"));

    const accounts = await getAccounts(db, { id: admin.id, role: "admin" });
    expect(accounts.map(({ name, role, banned, anonymized, isViewer }) => ({ name, role, banned, anonymized, isViewer }))).toEqual([
      { name: "Admin", role: "admin", banned: false, anonymized: false, isViewer: true },
      { name: "Élodie", role: "player", banned: false, anonymized: false, isViewer: false },
      { name: "eric", role: "player", banned: true, anonymized: false, isViewer: false },
      { name: "Ancien joueur 1", role: "player", banned: true, anonymized: true, isViewer: false },
    ]);
  });

  it("is refused to a player", async () => {
    const player = await createUser(db);
    await expect(getAccounts(db, { id: player.id, role: "player" })).rejects.toThrow("FORBIDDEN");
  });
});
