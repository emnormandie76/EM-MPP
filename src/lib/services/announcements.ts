import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/lib/db/client";
import { announcement } from "@/lib/db/schema";
import { announcementBodySchema } from "@/lib/validation/content";
import { type Actor, authorize, fail, fieldErrorsOf, isFailure, ok, type Result } from "./result";

// Announcements shown on the home page (architecture §7.3, §8.3 /admin/annonces).

const NOT_FOUND = "Cette annonce n'existe pas.";

const createInput = z.object({ body: announcementBodySchema });
const idInput = z.object({ announcementId: z.coerce.number().int().positive() });
const updateInput = idInput.extend({ body: announcementBodySchema });

export async function createAnnouncement(
  db: Database,
  actor: Actor | null,
  input: unknown,
  now: Date,
): Promise<Result<{ id: number }>> {
  const me = authorize(actor, { admin: true });
  if (isFailure(me)) return me;
  const parsed = createInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT", undefined, fieldErrorsOf(parsed.error.issues));

  const [row] = await db
    .insert(announcement)
    .values({ body: parsed.data.body, createdBy: me.id, createdAt: now, updatedAt: now })
    .returning({ id: announcement.id });
  return ok({ id: row.id });
}

export async function updateAnnouncement(db: Database, actor: Actor | null, input: unknown, now: Date): Promise<Result> {
  const me = authorize(actor, { admin: true });
  if (isFailure(me)) return me;
  const parsed = updateInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT", undefined, fieldErrorsOf(parsed.error.issues));

  const updated = await db
    .update(announcement)
    .set({ body: parsed.data.body, updatedAt: now })
    .where(eq(announcement.id, parsed.data.announcementId))
    .returning({ id: announcement.id });
  return updated.length > 0 ? ok() : fail("NOT_FOUND", NOT_FOUND);
}

export async function deleteAnnouncement(db: Database, actor: Actor | null, input: unknown): Promise<Result> {
  const me = authorize(actor, { admin: true });
  if (isFailure(me)) return me;
  const parsed = idInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");

  const deleted = await db
    .delete(announcement)
    .where(eq(announcement.id, parsed.data.announcementId))
    .returning({ id: announcement.id });
  return deleted.length > 0 ? ok() : fail("NOT_FOUND", NOT_FOUND);
}
