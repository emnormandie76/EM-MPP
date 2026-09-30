import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/lib/db/client";
import { category } from "@/lib/db/schema";
import { categoryNameSchema } from "@/lib/validation/content";
import { isUniqueViolation } from "./db-errors";
import { type Actor, authorize, fail, fieldErrorsOf, isFailure, ok, type Result } from "./result";

// Categories (architecture §7.3, §8.3 /admin/categories). An archived category leaves the choices
// of the question form but stays on its questions.

type CategoryRow = typeof category.$inferSelect;

const NOT_FOUND = "Cette catégorie n'existe pas.";
const nameTaken = () => fail("CATEGORY_NAME_TAKEN", undefined, { name: "Cette catégorie existe déjà." });

async function isNameTaken(db: Database, name: string, exceptId?: number): Promise<boolean> {
  const rows = await db
    .select({ id: category.id })
    .from(category)
    .where(and(sql`lower(${category.name}) = lower(${name})`, exceptId ? ne(category.id, exceptId) : undefined))
    .limit(1);
  return rows.length > 0;
}

const createInput = z.object({ name: categoryNameSchema });

/** New category; its name is unique whatever the case. */
export async function createCategory(
  db: Database,
  actor: Actor | null,
  input: unknown,
  now: Date,
): Promise<Result<{ id: number; name: string }>> {
  const me = authorize(actor, { admin: true });
  if (isFailure(me)) return me;
  const parsed = createInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT", undefined, fieldErrorsOf(parsed.error.issues));
  const { name } = parsed.data;

  if (await isNameTaken(db, name)) return nameTaken();
  try {
    const [row] = await db.insert(category).values({ name, createdAt: now }).returning();
    return ok({ id: row.id, name: row.name });
  } catch (error) {
    // Two admins creating the same name at once: the unique index decides.
    if (isUniqueViolation(error)) return nameTaken();
    throw error;
  }
}

const idInput = z.object({ categoryId: z.coerce.number().int().positive() });
const renameInput = idInput.extend({ name: categoryNameSchema });

async function loadCategory(db: Database, categoryId: number): Promise<CategoryRow | undefined> {
  const [row] = await db.select().from(category).where(eq(category.id, categoryId));
  return row;
}

export async function renameCategory(
  db: Database,
  actor: Actor | null,
  input: unknown,
): Promise<Result<{ name: string }>> {
  const me = authorize(actor, { admin: true });
  if (isFailure(me)) return me;
  const parsed = renameInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT", undefined, fieldErrorsOf(parsed.error.issues));
  const { categoryId, name } = parsed.data;

  if (!(await loadCategory(db, categoryId))) return fail("NOT_FOUND", NOT_FOUND);
  if (await isNameTaken(db, name, categoryId)) return nameTaken();
  try {
    await db.update(category).set({ name }).where(eq(category.id, categoryId));
    return ok({ name });
  } catch (error) {
    if (isUniqueViolation(error)) return nameTaken();
    throw error;
  }
}

async function setArchived(db: Database, actor: Actor | null, input: unknown, archivedAt: Date | null): Promise<Result> {
  const me = authorize(actor, { admin: true });
  if (isFailure(me)) return me;
  const parsed = idInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  const updated = await db
    .update(category)
    .set({ archivedAt })
    .where(eq(category.id, parsed.data.categoryId))
    .returning({ id: category.id });
  return updated.length > 0 ? ok() : fail("NOT_FOUND", NOT_FOUND);
}

/** Removes a category from the choices; its questions keep it. */
export async function archiveCategory(db: Database, actor: Actor | null, input: unknown, now: Date): Promise<Result> {
  return setArchived(db, actor, input, now);
}

export async function unarchiveCategory(db: Database, actor: Actor | null, input: unknown): Promise<Result> {
  return setArchived(db, actor, input, null);
}
