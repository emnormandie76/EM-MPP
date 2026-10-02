import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/db/client";
import { allowedEmail, category, chatMessage, prediction, question, questionExtension, questionOption, season, seasonStanding } from "@/lib/db/schema";
import { createTestDb } from "../helpers/db";
import { createCategory, createPrediction, createQuestion, createUser } from "../helpers/factories";

// Constraints of the data model (architecture §4.3, §4.4), checked on PGlite with the real migrations.

/** Message of the database error raised by `action` (Drizzle wraps it in `cause`). */
async function refusal(action: Promise<unknown>): Promise<string> {
  try {
    await action;
  } catch (error) {
    const cause = (error as { cause?: unknown }).cause ?? error;
    return cause instanceof Error ? cause.message : String(cause);
  }
  throw new Error("The database accepted the write");
}

const opensAt = new Date("2026-10-14T07:00:00Z");
const closesAt = new Date("2026-10-21T16:00:00Z");

describe("database schema", () => {
  let db: Database;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ db, close } = await createTestDb());
  });

  afterAll(async () => {
    await close();
  });

  describe("predictions", () => {
    it("refuses a second prediction on the same question by the same player", async () => {
      const player = await createUser(db);
      const q = await createQuestion(db, { status: "published", opensAt, closesAt });
      await createPrediction(db, { questionId: q.id, userId: player.id, valueNumber: 240 });
      expect(await refusal(createPrediction(db, { questionId: q.id, userId: player.id, valueNumber: 250 }))).toContain(
        "prediction_question_user_unique",
      );
    });

    it("refuses a prediction with both a value and an answer, or with neither", async () => {
      const player = await createUser(db);
      const q = await createQuestion(db, { type: "choice", status: "published", opensAt, closesAt });
      const both = createPrediction(db, { questionId: q.id, userId: player.id, valueNumber: 1, optionId: q.options[0].id });
      expect(await refusal(both)).toContain("prediction_value_or_option");
      const neither = db.insert(prediction).values({ questionId: q.id, userId: player.id });
      expect(await refusal(neither)).toContain("prediction_value_or_option");
    });

    it("refuses an answer that belongs to another question", async () => {
      const player = await createUser(db);
      const q1 = await createQuestion(db, { type: "choice", status: "published", opensAt, closesAt });
      const q2 = await createQuestion(db, { type: "choice", status: "published", opensAt, closesAt });
      const foreign = createPrediction(db, { questionId: q1.id, userId: player.id, optionId: q2.options[0].id });
      expect(await refusal(foreign)).toContain("prediction_option_fk");
      const own = await createPrediction(db, { questionId: q1.id, userId: player.id, optionId: q1.options[1].id });
      expect(own.optionId).toBe(q1.options[1].id);
    });

    it("refuses a negative value, and reads values back as numbers with their 2 decimals", async () => {
      const q = await createQuestion(db, { status: "published", opensAt, closesAt });
      const negative = createPrediction(db, { questionId: q.id, userId: (await createUser(db)).id, valueNumber: -3 });
      expect(await refusal(negative)).toContain("prediction_value_positive");
      const decimal = await createPrediction(db, { questionId: q.id, userId: (await createUser(db)).id, valueNumber: 2450.5 });
      const largest = await createPrediction(db, { questionId: q.id, userId: (await createUser(db)).id, valueNumber: 999_999_999.99 });
      const [read] = await db.select().from(prediction).where(eq(prediction.id, decimal.id));
      expect(read.valueNumber).toBe(2450.5);
      expect(largest.valueNumber).toBe(999_999_999.99);
    });
  });

  describe("questions", () => {
    it("refuses a coefficient of 4", async () => {
      expect(await refusal(createQuestion(db, { coefficient: 4 }))).toContain("question_coefficient");
      expect((await createQuestion(db, { coefficient: 3 })).coefficient).toBe(3);
    });

    it("refuses a published question without dates", async () => {
      expect(await refusal(createQuestion(db, { status: "published" }))).toContain("question_published_complete");
      expect(await refusal(createQuestion(db, { status: "published", closesAt }))).toContain("question_published_complete");
    });

    it("accepts a draft without any date nor season", async () => {
      const draft = await createQuestion(db);
      expect([draft.status, draft.opensAt, draft.closesAt, draft.seasonId]).toEqual(["draft", null, null, null]);
    });

    it("refuses an opening at or after the closing", async () => {
      expect(await refusal(createQuestion(db, { opensAt: closesAt, closesAt }))).toContain("question_dates_order");
    });

    it("accepts a draft closing where no season exists yet, not a published question (v1.1)", async () => {
      expect((await createQuestion(db, { closesAt, seasonId: null })).seasonId).toBeNull();
      const opensAt = new Date(closesAt.getTime() - 86_400_000);
      expect(await refusal(createQuestion(db, { status: "published", opensAt, closesAt, seasonId: null }))).toContain(
        "question_published_complete",
      );
    });

    it("refuses the Juste Prix, removed in v1.2, on any question", async () => {
      expect(await refusal(createQuestion(db, { priceIsRight: true }))).toContain("question_price_is_right_removed");
      expect(await refusal(createQuestion(db, { type: "choice", priceIsRight: true }))).toContain("question_price_is_right_removed");
    });

    it("refuses a choice question without the malus of a wrong answer, and a number question with one (v1.2)", async () => {
      expect(await refusal(createQuestion(db, { type: "choice", wrongAnswerMalus: null }))).toContain("question_wrong_answer_malus");
      expect(await refusal(createQuestion(db, { type: "number", wrongAnswerMalus: 50 }))).toContain("question_wrong_answer_malus");
      expect((await createQuestion(db, { type: "choice", wrongAnswerMalus: 12.5 })).wrongAnswerMalus).toBe(12.5);
    });

    it("refuses a malus of a wrong answer of 0 (v1.2)", async () => {
      expect(await refusal(createQuestion(db, { type: "choice", wrongAnswerMalus: 0 }))).toContain("question_wrong_answer_malus_positive");
    });

    it("refuses a title shorter than 5 or longer than 200 characters", async () => {
      expect(await refusal(createQuestion(db, { title: "Qui" }))).toContain("question_title_length");
      expect(await refusal(createQuestion(db, { title: "x".repeat(201) }))).toContain("question_title_length");
    });

    it("refuses a help link that is not http(s)", async () => {
      expect(await refusal(createQuestion(db, { helpBiUrl: "javascript:alert(1)" }))).toContain("question_help_bi_url_http");
      expect((await createQuestion(db, { helpBiUrl: "https://bi.example.test/jpo" })).helpBiUrl).toBe("https://bi.example.test/jpo");
    });

    it("refuses a right answer taken from another question", async () => {
      const q1 = await createQuestion(db, { type: "choice" });
      const q2 = await createQuestion(db, { type: "choice" });
      const update = db.update(question).set({ resultOptionId: q2.options[0].id }).where(eq(question.id, q1.id));
      expect(await refusal(update)).toContain("question_result_option_fk");
      await db.update(question).set({ resultOptionId: q1.options[0].id }).where(eq(question.id, q1.id));
    });

    it("refuses two options at the same position", async () => {
      const q = await createQuestion(db, { type: "choice" });
      const duplicate = db.insert(questionOption).values({ questionId: q.id, label: "Peut-être", position: 1 });
      expect(await refusal(duplicate)).toContain("question_option_position_unique");
    });

    it("deletes the options with their question, but never a question that has predictions", async () => {
      const draft = await createQuestion(db, { type: "choice" });
      await db.delete(question).where(eq(question.id, draft.id));
      expect(await db.select().from(questionOption).where(eq(questionOption.questionId, draft.id))).toEqual([]);

      const played = await createQuestion(db, { status: "published", opensAt, closesAt });
      await createPrediction(db, { questionId: played.id, userId: (await createUser(db)).id });
      expect(await refusal(db.delete(question).where(eq(question.id, played.id)))).toContain("prediction_question_id_question_id_fk");
    });
  });

  describe("extensions (v1.2)", () => {
    it("keeps one extension per player and question, and refuses an extension granted to oneself", async () => {
      const admin = await createUser(db, { role: "admin" });
      const player = await createUser(db);
      const q = await createQuestion(db, { status: "published", opensAt, closesAt });
      const values = { questionId: q.id, userId: player.id, closesAt: new Date(closesAt.getTime() + 86_400_000), grantedBy: admin.id, grantedAt: closesAt };
      await db.insert(questionExtension).values(values);
      expect(await refusal(db.insert(questionExtension).values(values))).toContain("question_extension_question_id_user_id_pk");
      expect(await refusal(db.insert(questionExtension).values({ ...values, userId: admin.id, grantedBy: admin.id }))).toContain(
        "question_extension_not_self",
      );
    });
  });

  describe("palmarès (v1.2)", () => {
    it("stores the malus with its decimals, and refuses a row with neither malus nor points", async () => {
      const [row] = await db.insert(season).values({ label: "Saison du palmarès", startsAt: new Date("2041-09-01T22:00:00Z") }).returning();
      const player = await createUser(db);
      const standing = { seasonId: row.id, userId: player.id, rank: 1, bullseyes: 0, meanError: null, questionsPlayed: 1, nameSnapshot: player.name };
      expect(await refusal(db.insert(seasonStanding).values(standing))).toContain("season_standing_score");
      await db.insert(seasonStanding).values({ ...standing, malus: 250.5 });
      const [read] = await db.select().from(seasonStanding).where(eq(seasonStanding.seasonId, row.id));
      expect([read.malus, read.points]).toEqual([250.5, null]);
    });
  });

  describe("chat (v1.2)", () => {
    it("ties a player's message to its author and a result message to its question, without text", async () => {
      const player = await createUser(db);
      const q = await createQuestion(db, { status: "published", opensAt, closesAt });
      const createdAt = closesAt;
      expect(await refusal(db.insert(chatMessage).values({ kind: "message", body: "Sans auteur", createdAt }))).toContain("chat_message_author");
      expect(await refusal(db.insert(chatMessage).values({ kind: "result", createdAt }))).toContain("chat_message_question");
      expect(await refusal(db.insert(chatMessage).values({ kind: "result", questionId: q.id, body: "Texte", createdAt }))).toContain(
        "chat_message_result_no_body",
      );
      expect(
        await refusal(db.insert(chatMessage).values({ kind: "message", userId: player.id, questionId: q.id, body: "Les deux", createdAt })),
      ).toContain("chat_message_question");
    });

    it("keeps one result message per question", async () => {
      const q = await createQuestion(db, { status: "published", opensAt, closesAt });
      await db.insert(chatMessage).values({ kind: "result", questionId: q.id, createdAt: closesAt });
      expect(await refusal(db.insert(chatMessage).values({ kind: "result", questionId: q.id, createdAt: closesAt }))).toContain(
        "chat_message_result_unique",
      );
    });

    it("holds a message of 1 to 500 characters until it is deleted, then no text, with who deleted it", async () => {
      const player = await createUser(db);
      const message = { kind: "message" as const, userId: player.id, createdAt: closesAt };
      for (const body of [null, "", "a".repeat(501)]) {
        expect(await refusal(db.insert(chatMessage).values({ ...message, body })), String(body?.length)).toContain("chat_message_body_length");
      }
      await db.insert(chatMessage).values({ ...message, body: "🎉".repeat(500) });
      expect(await refusal(db.insert(chatMessage).values({ ...message, body: "Texte", deletedAt: closesAt, deletedBy: player.id }))).toContain(
        "chat_message_deleted_no_body",
      );
      expect(await refusal(db.insert(chatMessage).values({ ...message, body: null, deletedAt: closesAt }))).toContain("chat_message_deleted_by");
      await db.insert(chatMessage).values({ ...message, body: null, deletedAt: closesAt, deletedBy: player.id });
    });
  });

  describe("other tables", () => {
    it("keeps category names unique whatever the case", async () => {
      await createCategory(db, "Salons");
      expect(await refusal(db.insert(category).values({ name: "SALONS" }))).toContain("category_name_unique");
    });

    it("stores allow-list addresses in lower case, without spaces", async () => {
      expect(await refusal(db.insert(allowedEmail).values({ email: "Sarah@Example.test" }))).toContain("allowed_email_normalized");
      expect(await refusal(db.insert(allowedEmail).values({ email: " sarah@example.test" }))).toContain("allowed_email_normalized");
      await db.insert(allowedEmail).values({ email: "sarah@example.test" });
    });
  });

  describe("seasons (v1.1)", () => {
    const startsAt = new Date("2030-09-01T22:00:00Z");

    it("has no end date any more: a season ends where the next one starts; jokers are allowed by default (v1.2)", async () => {
      const result = (await db.execute(sql`
        select column_name from information_schema.columns where table_schema = 'public' and table_name = 'season'
      `)) as unknown as { rows: { column_name: string }[] };
      expect(result.rows.map(({ column_name }) => column_name).sort()).toEqual(["created_at", "id", "jokers_enabled", "label", "proclaimed_at", "starts_at"]);
      const [row] = await db.insert(season).values({ label: "Saison par défaut", startsAt: new Date("2040-09-01T22:00:00Z") }).returning();
      expect(row.jokersEnabled).toBe(true);
    });

    it("keeps names unique whatever the case, between 2 and 40 characters, with any format", async () => {
      await db.insert(season).values({ label: "Saison des tests", startsAt });
      expect(await refusal(db.insert(season).values({ label: "SAISON DES TESTS", startsAt: new Date("2031-09-01T22:00:00Z") }))).toContain(
        "season_label_lower_unique",
      );
      expect(await refusal(db.insert(season).values({ label: "x", startsAt: new Date("2032-09-01T22:00:00Z") }))).toContain(
        "season_label_length",
      );
      expect(await refusal(db.insert(season).values({ label: "x".repeat(41), startsAt: new Date("2032-09-01T22:00:00Z") }))).toContain(
        "season_label_length",
      );
    });

    it("refuses two seasons starting at the same time", async () => {
      expect(await refusal(db.insert(season).values({ label: "Doublon", startsAt }))).toContain("season_starts_at_unique");
    });
  });

  it("stores every date as timestamp with time zone (§4.1), Better Auth tables included", async () => {
    const result = (await db.execute(sql`
      select table_name, column_name, data_type from information_schema.columns
      where table_schema = 'public' and data_type like 'timestamp%'
    `)) as unknown as { rows: { table_name: string; column_name: string; data_type: string }[] };
    expect(result.rows.length).toBeGreaterThan(20);
    const withoutTimeZone = result.rows.filter(({ data_type }) => data_type !== "timestamp with time zone");
    expect(withoutTimeZone.map(({ table_name, column_name }) => `${table_name}.${column_name}`)).toEqual([]);
  });

  it("has the indexes of §4.4", async () => {
    const result = (await db.execute(sql`select indexname from pg_indexes where schemaname = 'public'`)) as unknown as {
      rows: { indexname: string }[];
    };
    const names = result.rows.map(({ indexname }) => indexname);
    expect(names).toEqual(
      expect.arrayContaining([
        "prediction_user_idx",
        "prediction_question_idx",
        "question_season_status_idx",
        "question_closes_at_idx",
        "prediction_event_question_created_idx",
        "question_extension_user_idx",
        "chat_message_user_created_idx",
      ]),
    );
  });
});
