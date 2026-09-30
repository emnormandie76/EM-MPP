import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/lib/db/client";
import { prize, season } from "@/lib/db/schema";
import { seasonBounds, seasonLabelFor } from "@/lib/game/time";
import { prizesSchema } from "@/lib/validation/content";
import { type Actor, authorize, fail, fieldErrorsOf, isFailure, ok, type Result } from "./result";

// Seasons and prizes (architecture §5.1, §5.12, §7.3). The proclamation arrives in step 7.

/**
 * Id of the season `label`, created on first need (§5.11): a question's season is the one of its
 * closing date. Safe when two writers create it at once.
 */
export async function ensureSeason(db: Database, label: string): Promise<number> {
  const bounds = seasonBounds(label);
  await db
    .insert(season)
    .values({ label, ...bounds })
    .onConflictDoNothing({ target: season.label });
  const [row] = await db.select({ id: season.id }).from(season).where(eq(season.label, label));
  return row.id;
}

const prizesInput = z.object({
  seasonLabel: z.string().regex(/^\d{4}-\d{4}$/),
  prizes: prizesSchema,
});

export type PrizeInput = z.infer<typeof prizesInput>["prizes"][number];

/**
 * Replaces the prizes of a season, in the given order (§8.3 /admin/saisons). Only an existing
 * season or the current one (created if needed, so that its prizes can be set before its first
 * question); never a proclaimed season, whose palmarès is frozen.
 */
export async function upsertPrizes(
  db: Database,
  actor: Actor | null,
  input: unknown,
  now: Date,
): Promise<Result<{ seasonId: number; count: number }>> {
  const me = authorize(actor, { admin: true });
  if (isFailure(me)) return me;
  const parsed = prizesInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT", undefined, fieldErrorsOf(parsed.error.issues));
  const { seasonLabel, prizes } = parsed.data;

  return db.transaction(async (tx) => {
    let [row] = await tx.select().from(season).where(eq(season.label, seasonLabel)).for("update");
    if (!row) {
      if (seasonLabel !== seasonLabelFor(now)) return fail("NOT_FOUND", "Cette saison n'existe pas.");
      const id = await ensureSeason(tx, seasonLabel);
      [row] = await tx.select().from(season).where(eq(season.id, id)).for("update");
    }
    if (row.proclaimedAt) return fail("SEASON_PROCLAIMED");

    await tx.delete(prize).where(eq(prize.seasonId, row.id));
    if (prizes.length > 0) {
      await tx
        .insert(prize)
        .values(prizes.map((item, index) => ({ seasonId: row.id, ...item, position: index + 1 })));
    }
    return ok({ seasonId: row.id, count: prizes.length });
  });
}
