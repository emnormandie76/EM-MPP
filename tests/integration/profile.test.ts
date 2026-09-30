import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AVATAR_KEYS } from "@/lib/avatars";
import type { Database } from "@/lib/db/client";
import { user } from "@/lib/db/schema";
import { updateAvatar, updateDisplayName } from "@/lib/services/profile";
import type { Actor } from "@/lib/services/result";
import { makeClock } from "../helpers/clock";
import { createTestDb } from "../helpers/db";
import { createUser } from "../helpers/factories";

// Profile services (architecture §6.2, §8.3 /profil, §11 É4).

const now = makeClock("2026-10-20T10:00:00Z").now;

let db: Database;
let close: () => Promise<void>;

beforeEach(async () => {
  ({ db, close } = await createTestDb());
});

afterEach(async () => {
  await close();
});

const actorOf = (row: { id: string }): Actor => ({ id: row.id, role: "player", banned: false });

async function nameOf(id: string) {
  const [row] = await db.select({ name: user.name }).from(user).where(eq(user.id, id));
  return row.name;
}

describe("updateDisplayName", () => {
  it("accepts 2 to 30 characters once trimmed", async () => {
    const me = await createUser(db, { name: "Sarah" });

    expect(await updateDisplayName(db, actorOf(me), { name: "  Sarah L.  " }, now)).toEqual({ ok: true, data: { name: "Sarah L." } });
    expect(await nameOf(me.id)).toBe("Sarah L.");
    expect((await updateDisplayName(db, actorOf(me), { name: "Sa" }, now)).ok).toBe(true);
    expect((await updateDisplayName(db, actorOf(me), { name: "S".repeat(30) }, now)).ok).toBe(true);

    for (const name of [" S ", "S".repeat(31), "", 42]) {
      expect(await updateDisplayName(db, actorOf(me), { name }, now)).toMatchObject({
        ok: false,
        code: "INVALID_INPUT",
        fieldErrors: { name: "Ton nom doit faire de 2 à 30 caractères." },
      });
    }
    expect(await nameOf(me.id)).toBe("S".repeat(30));
  });

  it("refuses a name taken by another account, whatever the case", async () => {
    const me = await createUser(db, { name: "Sarah" });
    await createUser(db, { name: "Julien" });
    expect(await updateDisplayName(db, actorOf(me), { name: "JULIEN" }, now)).toMatchObject({
      ok: false,
      code: "NAME_TAKEN",
      fieldErrors: { name: "Ce nom est déjà pris." },
    });
    expect(await nameOf(me.id)).toBe("Sarah");
  });

  it("lets a player change the case of their own name", async () => {
    const me = await createUser(db, { name: "sarah" });
    expect(await updateDisplayName(db, actorOf(me), { name: "Sarah" }, now)).toEqual({ ok: true, data: { name: "Sarah" } });
    const [row] = await db.select().from(user).where(eq(user.id, me.id));
    expect(row.updatedAt).toEqual(now);
  });

  it("refuses an anonymous or disabled actor", async () => {
    const me = await createUser(db, { name: "Sarah", banned: true });
    expect(await updateDisplayName(db, null, { name: "Nouveau" }, now)).toMatchObject({ code: "NOT_AUTHENTICATED" });
    expect(await updateDisplayName(db, { ...actorOf(me), banned: true }, { name: "Nouveau" }, now)).toMatchObject({
      code: "ACCOUNT_DISABLED",
    });
    expect(await nameOf(me.id)).toBe("Sarah");
  });
});

describe("updateAvatar", () => {
  it("accepts each of the 16 jerseys", async () => {
    const me = await createUser(db);
    for (const avatar of AVATAR_KEYS) {
      expect(await updateAvatar(db, actorOf(me), { avatar }, now)).toEqual({ ok: true, data: { avatar } });
    }
    const [row] = await db.select().from(user).where(eq(user.id, me.id));
    expect(row.avatar).toBe(AVATAR_KEYS[AVATAR_KEYS.length - 1]);
  });

  it("refuses any other value", async () => {
    const me = await createUser(db, { avatar: "maillot-bleu-uni" });
    for (const avatar of ["maillot-noir-uni", "", "https://example.test/photo.png", null]) {
      expect(await updateAvatar(db, actorOf(me), { avatar }, now)).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    }
    const [row] = await db.select().from(user).where(eq(user.id, me.id));
    expect(row.avatar).toBe("maillot-bleu-uni");
  });

  it("refuses an anonymous actor", async () => {
    expect(await updateAvatar(db, null, { avatar: AVATAR_KEYS[0] }, now)).toMatchObject({ code: "NOT_AUTHENTICATED" });
  });
});
