import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/lib/db/client";
import { category, question } from "@/lib/db/schema";
import { archiveCategory, createCategory, renameCategory, unarchiveCategory } from "@/lib/services/categories";
import type { Actor } from "@/lib/services/result";
import { makeClock } from "../helpers/clock";
import { createTestDb } from "../helpers/db";
import { createQuestion, createUser } from "../helpers/factories";

// Categories (architecture §7.3, §8.3 /admin/categories).

const now = makeClock("2026-10-05T10:00:00Z").now;

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

async function load(id: number) {
  const [row] = await db.select().from(category).where(eq(category.id, id));
  return row;
}

describe("authorization (§6.5): admin only", () => {
  const services = {
    createCategory: (actor: Actor | null) => createCategory(db, actor, { name: "JPO" }, now),
    renameCategory: async (actor: Actor | null) => {
      const [row] = await db.insert(category).values({ name: "JPO" }).returning();
      return renameCategory(db, actor, { categoryId: row.id, name: "Portes ouvertes" });
    },
    archiveCategory: async (actor: Actor | null) => {
      const [row] = await db.insert(category).values({ name: "JPO" }).returning();
      return archiveCategory(db, actor, { categoryId: row.id }, now);
    },
    unarchiveCategory: async (actor: Actor | null) => {
      const [row] = await db.insert(category).values({ name: "JPO", archivedAt: now }).returning();
      return unarchiveCategory(db, actor, { categoryId: row.id });
    },
  };

  it.each(Object.keys(services))("%s: anonymous, player and disabled admin refused; admin accepted", async (name) => {
    const service = services[name as keyof typeof services];
    const player = await createUser(db);
    const disabledAdmin = await createUser(db, { role: "admin", banned: true });
    expect(await service(null)).toMatchObject({ ok: false, code: "NOT_AUTHENTICATED" });
    await db.delete(category);
    expect(await service({ id: player.id, role: "player", banned: false })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    await db.delete(category);
    expect(await service({ id: disabledAdmin.id, role: "admin", banned: true })).toMatchObject({ code: "ACCOUNT_DISABLED" });
    await db.delete(category);
    expect(await service(admin)).toMatchObject({ ok: true });
  });
});

describe("categories", () => {
  it("creates a category with a trimmed name of 2 to 40 characters", async () => {
    const result = await createCategory(db, admin, { name: "  Candidatures  " }, now);
    expect(result).toMatchObject({ ok: true, data: { name: "Candidatures" } });
    expect(await load(result.ok ? result.data.id : 0)).toMatchObject({ name: "Candidatures", archivedAt: null, createdAt: now });

    for (const name of ["J", "x".repeat(41), "   "]) {
      expect(await createCategory(db, admin, { name }, now)).toMatchObject({
        ok: false,
        code: "INVALID_INPUT",
        fieldErrors: { name: "Le nom doit faire de 2 à 40 caractères." },
      });
    }
  });

  it("refuses a name already used, whatever the case, on creation and on renaming", async () => {
    await createCategory(db, admin, { name: "JPO" }, now);
    const other = await createCategory(db, admin, { name: "Intégration" }, now);
    expect(await createCategory(db, admin, { name: "jpo" }, now)).toMatchObject({
      ok: false,
      code: "CATEGORY_NAME_TAKEN",
      fieldErrors: { name: "Cette catégorie existe déjà." },
    });
    expect(await renameCategory(db, admin, { categoryId: other.ok ? other.data.id : 0, name: "Jpo" })).toMatchObject({
      code: "CATEGORY_NAME_TAKEN",
    });
  });

  it("renames a category, including with a change of case only", async () => {
    const created = await createCategory(db, admin, { name: "jpo" }, now);
    const id = created.ok ? created.data.id : 0;
    expect(await renameCategory(db, admin, { categoryId: id, name: "JPO" })).toEqual({ ok: true, data: { name: "JPO" } });
    expect((await load(id)).name).toBe("JPO");
    expect(await renameCategory(db, admin, { categoryId: 999, name: "Autre" })).toMatchObject({
      code: "NOT_FOUND",
      message: "Cette catégorie n'existe pas.",
    });
  });

  it("archives and unarchives a category; its questions keep it", async () => {
    const created = await createCategory(db, admin, { name: "JPO" }, now);
    const id = created.ok ? created.data.id : 0;
    const q = await createQuestion(db, { categoryId: id });

    expect(await archiveCategory(db, admin, { categoryId: id }, now)).toEqual({ ok: true, data: undefined });
    expect((await load(id)).archivedAt).toEqual(now);
    const [row] = await db.select().from(question).where(eq(question.id, q.id));
    expect(row.categoryId).toBe(id);

    expect(await unarchiveCategory(db, admin, { categoryId: id })).toEqual({ ok: true, data: undefined });
    expect((await load(id)).archivedAt).toBeNull();
    expect(await archiveCategory(db, admin, { categoryId: 999 }, now)).toMatchObject({ code: "NOT_FOUND" });
  });
});
