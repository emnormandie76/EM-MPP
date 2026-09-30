import { eq } from "drizzle-orm";
import { defaultAvatarFor } from "@/lib/avatars";
import type { Database } from "@/lib/db/client";
import { category, prediction, question, questionOption, season, user } from "@/lib/db/schema";
import { seasonAt, seasonStartFromLocalDate, utcToParisLocalDate } from "@/lib/game/time";

// Test data factories (architecture §9.2), with valid default values.

let sequence = 0;
const next = () => (sequence += 1);

type UserInsert = typeof user.$inferInsert;
type QuestionInsert = typeof question.$inferInsert;
type PredictionInsert = typeof prediction.$inferInsert;

export async function createUser(db: Database, overrides: Partial<UserInsert> = {}) {
  const n = next();
  const id = overrides.id ?? `test-user-${n}`;
  const [row] = await db
    .insert(user)
    .values({ id, name: `Joueur ${n}`, email: `joueur-${n}@example.test`, role: "player", avatar: defaultAvatarFor(id), ...overrides })
    .returning();
  return row;
}

export async function createCategory(db: Database, name = `Catégorie ${next()}`) {
  const [row] = await db.insert(category).values({ name }).returning();
  return row;
}

/**
 * The season row of `label`, created if needed. By default a season "2026-2027" starts on
 * 1 October 2026, like the seed's; `startsOn` (`YYYY-MM-DD`) sets another start day.
 */
export async function ensureTestSeason(db: Database, label: string, startsOn = `${label.slice(0, 4)}-10-01`) {
  const [existing] = await db.select().from(season).where(eq(season.label, label));
  if (existing) return existing;
  const [row] = await db.insert(season).values({ label, startsAt: seasonStartFromLocalDate(startsOn) }).returning();
  return row;
}

/**
 * The season of `closesAt` among the existing ones (§5.1). Before the first season, the 1 October
 * season containing it is created, so that tests need not create their seasons by hand.
 */
async function seasonOfClosing(db: Database, closesAt: Date) {
  const found = seasonAt(await db.select().from(season), closesAt);
  if (found) return found;
  const day = utcToParisLocalDate(closesAt);
  const year = Number(day.slice(0, 4)) - (day.slice(5) >= "10-01" ? 0 : 1);
  return ensureTestSeason(db, `${year}-${year + 1}`);
}

/**
 * A question, draft by default. With a closing date, its season is set as the services do (§4.5).
 * A choice question gets `options` (default: Oui, Non).
 */
export async function createQuestion(db: Database, overrides: Partial<QuestionInsert> & { options?: string[] } = {}) {
  const { options, ...values } = overrides;
  const categoryId = values.categoryId ?? (await createCategory(db)).id;
  const createdBy = values.createdBy ?? (await createUser(db, { role: "admin" })).id;
  // An explicit `seasonId`, even null, is kept as given.
  const seasonId =
    "seasonId" in values || !values.closesAt
      ? values.seasonId
      : (await seasonOfClosing(db, values.closesAt)).id;
  const [row] = await db
    .insert(question)
    .values({
      type: "number",
      title: "Combien de participants à la JPO ?",
      unit: "participants",
      source: "Tableau BI « JPO », total du jour",
      ...values,
      categoryId,
      createdBy,
      seasonId,
    })
    .returning();

  const labels = row.type === "choice" ? (options ?? ["Oui", "Non"]) : [];
  const optionRows =
    labels.length > 0
      ? await db
          .insert(questionOption)
          .values(labels.map((label, index) => ({ questionId: row.id, label, position: index + 1 })))
          .returning()
      : [];
  return { ...row, options: optionRows };
}

/** A saved prediction, 100 by default when no answer is given. */
export async function createPrediction(
  db: Database,
  overrides: Partial<PredictionInsert> & Pick<PredictionInsert, "questionId" | "userId">,
) {
  const answer = overrides.optionId === undefined && overrides.valueNumber === undefined ? { valueNumber: 100 } : {};
  const [row] = await db
    .insert(prediction)
    .values({ ...answer, ...overrides })
    .returning();
  return row;
}
