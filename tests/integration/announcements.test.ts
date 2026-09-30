import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAnnouncements } from "@/lib/data/content";
import type { Database } from "@/lib/db/client";
import { announcement } from "@/lib/db/schema";
import { createAnnouncement, deleteAnnouncement, updateAnnouncement } from "@/lib/services/announcements";
import type { Actor } from "@/lib/services/result";
import { makeClock } from "../helpers/clock";
import { createTestDb } from "../helpers/db";
import { createUser } from "../helpers/factories";

// Announcements (architecture §7.3, §8.3 /admin/annonces).

const clock = makeClock("2026-10-05T10:00:00Z");
const now = clock.now;

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

async function insertAnnouncement(body = "Bienvenue !") {
  const [row] = await db.insert(announcement).values({ body, createdBy: admin.id }).returning();
  return row;
}

describe("authorization (§6.5): admin only", () => {
  const services = {
    createAnnouncement: (actor: Actor | null) => createAnnouncement(db, actor, { body: "Bienvenue !" }, now),
    updateAnnouncement: async (actor: Actor | null) => {
      const row = await insertAnnouncement();
      return updateAnnouncement(db, actor, { announcementId: row.id, body: "Bonjour !" }, now);
    },
    deleteAnnouncement: async (actor: Actor | null) => {
      const row = await insertAnnouncement();
      return deleteAnnouncement(db, actor, { announcementId: row.id });
    },
  };

  it.each(Object.keys(services))("%s: anonymous, player and disabled admin refused; admin accepted", async (name) => {
    const service = services[name as keyof typeof services];
    const player = await createUser(db);
    const disabledAdmin = await createUser(db, { role: "admin", banned: true });
    expect(await service(null)).toMatchObject({ ok: false, code: "NOT_AUTHENTICATED" });
    expect(await service({ id: player.id, role: "player", banned: false })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await service({ id: disabledAdmin.id, role: "admin", banned: true })).toMatchObject({ code: "ACCOUNT_DISABLED" });
    expect(await service(admin)).toMatchObject({ ok: true });
  });
});

describe("announcements", () => {
  it("creates an announcement of 1 to 500 characters, dated and signed", async () => {
    const result = await createAnnouncement(db, admin, { body: "  Les questions sont ouvertes !  " }, now);
    expect(result.ok).toBe(true);
    const [row] = await db.select().from(announcement).where(eq(announcement.id, result.ok ? result.data.id : 0));
    expect(row).toMatchObject({ body: "Les questions sont ouvertes !", createdBy: admin.id, createdAt: now, updatedAt: now });

    expect(await createAnnouncement(db, admin, { body: "x".repeat(500) }, now)).toMatchObject({ ok: true });
    for (const body of ["", "   ", "x".repeat(501)]) {
      expect(await createAnnouncement(db, admin, { body }, now)).toMatchObject({
        ok: false,
        code: "INVALID_INPUT",
        fieldErrors: { body: "L'annonce doit faire de 1 à 500 caractères." },
      });
    }
  });

  it("updates the text and the modification date, not the creation date", async () => {
    const row = await insertAnnouncement();
    const later = clock.at("+1h");
    expect(await updateAnnouncement(db, admin, { announcementId: row.id, body: "Nouveau texte" }, later)).toEqual({
      ok: true,
      data: undefined,
    });
    const [updated] = await db.select().from(announcement).where(eq(announcement.id, row.id));
    expect(updated).toMatchObject({ body: "Nouveau texte", createdAt: row.createdAt, updatedAt: later });
    expect(await updateAnnouncement(db, admin, { announcementId: 999, body: "Texte" }, later)).toMatchObject({
      code: "NOT_FOUND",
      message: "Cette annonce n'existe pas.",
    });
  });

  it("deletes an announcement", async () => {
    const row = await insertAnnouncement();
    expect(await deleteAnnouncement(db, admin, { announcementId: row.id })).toEqual({ ok: true, data: undefined });
    expect(await db.select().from(announcement)).toEqual([]);
    expect(await deleteAnnouncement(db, admin, { announcementId: row.id })).toMatchObject({ code: "NOT_FOUND" });
  });

  it("are listed newest first, with an optional limit", async () => {
    await createAnnouncement(db, admin, { body: "Première" }, clock.at("-2d"));
    await createAnnouncement(db, admin, { body: "Troisième" }, clock.at("-1h"));
    await createAnnouncement(db, admin, { body: "Deuxième" }, clock.at("-1d"));
    const player = await createUser(db);
    const viewer = { id: player.id, role: "player" as const };
    expect((await getAnnouncements(db, viewer)).map(({ body }) => body)).toEqual(["Troisième", "Deuxième", "Première"]);
    expect((await getAnnouncements(db, viewer, { limit: 2 })).map(({ body }) => body)).toEqual(["Troisième", "Deuxième"]);
  });
});
