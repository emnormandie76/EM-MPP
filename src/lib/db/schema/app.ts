import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

// Application tables (architecture §4.3, indexes §4.4). Dates are timestamptz in UTC; typed
// numbers are numeric(14, 2) read as `number`; points are never stored, except in the palmarès.

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });
const typedNumber = (name: string) => numeric(name, { precision: 14, scale: 2, mode: "number" });
const createdAt = () => timestamptz("created_at").defaultNow().notNull();
const updatedAt = () =>
  timestamptz("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull();

export const questionType = pgEnum("question_type", ["number", "choice"]);
export const questionStatus = pgEnum("question_status", ["draft", "published", "cancelled"]);
export const predictionEventType = pgEnum("prediction_event_type", [
  "saved",
  "validated",
  "unlocked",
  "joker_on",
  "joker_off",
]);

/**
 * Technical key-value store. Only key: `environment`, set to `production` on the production
 * database by scripts/migrate.ts, which forbids seeding it.
 */
export const appMeta = pgTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value"),
});

/** Allow list: only these addresses (and ADMIN_EMAILS) can sign up. Always lower case. */
export const allowedEmail = pgTable(
  "allowed_email",
  {
    email: text("email").primaryKey(),
    createdAt: createdAt(),
    createdBy: text("created_by").references(() => user.id),
  },
  (t) => [check("allowed_email_normalized", sql`${t.email} = lower(btrim(${t.email}))`)],
);

/** One row per season, created when first needed (§5.1). */
export const season = pgTable(
  "season",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    label: text("label").notNull().unique(),
    /** 1 October 00:00, Paris time. */
    startsAt: timestamptz("starts_at").notNull(),
    /** Next 1 October 00:00, Paris time (exclusive). */
    endsAt: timestamptz("ends_at").notNull(),
    proclaimedAt: timestamptz("proclaimed_at"),
    createdAt: createdAt(),
  },
  (t) => [
    check("season_label_format", sql`${t.label} ~ '^[0-9]{4}-[0-9]{4}$'`),
    check("season_bounds_order", sql`${t.startsAt} < ${t.endsAt}`),
  ],
);

export const category = pgTable(
  "category",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    archivedAt: timestamptz("archived_at"),
    createdAt: createdAt(),
  },
  // Unique whatever the case.
  (t) => [uniqueIndex("category_name_unique").on(sql`lower(${t.name})`)],
);

export const question = pgTable(
  "question",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    /** Season of `closes_at`, recomputed whenever it changes; null while there is no closing date. */
    seasonId: integer("season_id").references(() => season.id),
    categoryId: integer("category_id")
      .notNull()
      .references(() => category.id),
    type: questionType("type").notNull(),
    priceIsRight: boolean("price_is_right").notNull().default(false),
    title: text("title").notNull(),
    description: text("description"),
    unit: text("unit"),
    /** Where the real value comes from. */
    source: text("source").notNull(),
    helpBiUrl: text("help_bi_url"),
    helpLastYear: text("help_last_year"),
    helpHint: text("help_hint"),
    opensAt: timestamptz("opens_at"),
    closesAt: timestamptz("closes_at"),
    expectedResultAt: timestamptz("expected_result_at"),
    coefficient: smallint("coefficient").notNull().default(1),
    status: questionStatus("status").notNull().default("draft"),
    resultNumber: typedNumber("result_number"),
    resultOptionId: integer("result_option_id"),
    /** First entry of the result. */
    resolvedAt: timestamptz("resolved_at"),
    /** Latest correction of the result. */
    correctedAt: timestamptz("corrected_at"),
    cancelledAt: timestamptz("cancelled_at"),
    duplicatedFromId: integer("duplicated_from_id").references((): AnyPgColumn => question.id),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("question_coefficient", sql`${t.coefficient} in (1, 2, 3)`),
    check("question_dates_order", sql`${t.opensAt} is null or ${t.closesAt} is null or ${t.opensAt} < ${t.closesAt}`),
    check(
      "question_published_complete",
      sql`${t.status} <> 'published' or (${t.opensAt} is not null and ${t.closesAt} is not null and ${t.seasonId} is not null)`,
    ),
    check("question_season_of_closing", sql`${t.closesAt} is null or ${t.seasonId} is not null`),
    check("question_title_length", sql`char_length(${t.title}) between 5 and 200`),
    check("question_description_length", sql`char_length(${t.description}) <= 2000`),
    check("question_price_is_right_number", sql`not ${t.priceIsRight} or ${t.type} = 'number'`),
    check("question_help_bi_url_http", sql`${t.helpBiUrl} ~ '^https?://'`),
    check("question_result_positive", sql`${t.resultNumber} >= 0`),
    // The right answer is one of the question's own options (§4.5).
    foreignKey({
      name: "question_result_option_fk",
      columns: [t.resultOptionId, t.id],
      foreignColumns: [questionOption.id, questionOption.questionId],
    }),
    index("question_season_status_idx").on(t.seasonId, t.status),
    index("question_closes_at_idx").on(t.closesAt),
  ],
);

/** Possible answers of a choice question. */
export const questionOption = pgTable(
  "question_option",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    questionId: integer("question_id")
      .notNull()
      .references((): AnyPgColumn => question.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    position: smallint("position").notNull(),
  },
  (t) => [
    unique("question_option_position_unique").on(t.questionId, t.position),
    // Target of the composite foreign keys that tie an option to its question.
    unique("question_option_of_question_unique").on(t.id, t.questionId),
    check("question_option_label_length", sql`char_length(${t.label}) between 1 and 80`),
  ],
);

export const prediction = pgTable(
  "prediction",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    questionId: integer("question_id")
      .notNull()
      .references(() => question.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    valueNumber: typedNumber("value_number"),
    optionId: integer("option_id"),
    joker: boolean("joker").notNull().default(false),
    /** Null: saved, still editable. */
    validatedAt: timestamptz("validated_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("prediction_question_user_unique").on(t.questionId, t.userId),
    check("prediction_value_or_option", sql`(${t.valueNumber} is null) <> (${t.optionId} is null)`),
    check("prediction_value_positive", sql`${t.valueNumber} >= 0`),
    // The chosen answer is one of the question's own options (§4.5).
    foreignKey({
      name: "prediction_option_fk",
      columns: [t.optionId, t.questionId],
      foreignColumns: [questionOption.id, questionOption.questionId],
    }),
    index("prediction_user_idx").on(t.userId),
    index("prediction_question_idx").on(t.questionId),
  ],
);

/** Timestamped history of predictions, never updated nor deleted. */
export const predictionEvent = pgTable(
  "prediction_event",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    predictionId: integer("prediction_id")
      .notNull()
      .references(() => prediction.id),
    questionId: integer("question_id")
      .notNull()
      .references(() => question.id),
    /** The player who owns the prediction. */
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id),
    /** Who acted: the player, or the admin for an unlock. */
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id),
    type: predictionEventType("type").notNull(),
    /** Value at the time of the event. */
    valueNumber: typedNumber("value_number"),
    optionId: integer("option_id"),
    /** Joker state after the event. */
    joker: boolean("joker").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("prediction_event_question_created_idx").on(t.questionId, t.createdAt)],
);

export const prize = pgTable("prize", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  seasonId: integer("season_id")
    .notNull()
    .references(() => season.id),
  /** "1er", "2e", "3e". */
  rankLabel: text("rank_label").notNull(),
  description: text("description").notNull(),
  position: smallint("position").notNull(),
});

export const announcement = pgTable(
  "announcement",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    body: text("body").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check("announcement_body_length", sql`char_length(${t.body}) between 1 and 500`)],
);

/** Final standings frozen at proclamation: the palmarès. */
export const seasonStanding = pgTable(
  "season_standing",
  {
    seasonId: integer("season_id")
      .notNull()
      .references(() => season.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    /** With ties: 1, 1, 3… */
    rank: integer("rank").notNull(),
    points: integer("points").notNull(),
    bullseyes: integer("bullseyes").notNull(),
    // numeric(18, 6) rather than (10, 6): a relative error can exceed 9 999 (typing mistake).
    meanError: numeric("mean_error", { precision: 18, scale: 6, mode: "number" }),
    questionsPlayed: integer("questions_played").notNull(),
    /** Display name at the time of the proclamation. */
    nameSnapshot: text("name_snapshot").notNull(),
  },
  (t) => [primaryKey({ columns: [t.seasonId, t.userId] })],
);
