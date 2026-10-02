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
// numbers are numeric(14, 2) read as `number`; malus are never stored, except in the palmarès.

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

/**
 * One row per season, created by the admin (v1.1, §5.13). A season has no stored end: it ends where
 * the next one starts, and the last one goes on until the next one is created (§5.1).
 */
export const season = pgTable(
  "season",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    /** Display name ("2026-2027"), unique whatever the case. */
    label: text("label").notNull(),
    /** 00:00 on its start day, Paris time; two seasons never start the same day. */
    startsAt: timestamptz("starts_at").notNull().unique(),
    /** Jokers allowed during the season (v1.2, §5.13). */
    jokersEnabled: boolean("jokers_enabled").notNull().default(true),
    proclaimedAt: timestamptz("proclaimed_at"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("season_label_lower_unique").on(sql`lower(${t.label})`),
    check("season_label_length", sql`char_length(${t.label}) between 2 and 40`),
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
    /**
     * Season of `closes_at`, recomputed whenever it or the seasons change (§4.5); null without a
     * closing date or when no season covers it (a draft only).
     */
    seasonId: integer("season_id").references(() => season.id),
    categoryId: integer("category_id")
      .notNull()
      .references(() => category.id),
    type: questionType("type").notNull(),
    /**
     * Juste Prix, removed in v1.2: the column stays (dropping it would be a destructive migration,
     * §0.4), always false, and the code no longer reads it.
     */
    priceIsRight: boolean("price_is_right").notNull().default(false),
    /** Malus of a wrong answer, set on each choice question (v1.2, §5.5); null for a number. */
    wrongAnswerMalus: typedNumber("wrong_answer_malus"),
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
    check("question_title_length", sql`char_length(${t.title}) between 5 and 200`),
    check("question_description_length", sql`char_length(${t.description}) <= 2000`),
    check("question_price_is_right_removed", sql`not ${t.priceIsRight}`),
    check("question_wrong_answer_malus", sql`(${t.type} = 'choice') = (${t.wrongAnswerMalus} is not null)`),
    check("question_wrong_answer_malus_positive", sql`${t.wrongAnswerMalus} > 0`),
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

/**
 * Extension of a question for one player (v1.2, §5.14): the admin reopens it for an absent player,
 * until a personal deadline. At most one per player and question; changing it updates the row.
 */
export const questionExtension = pgTable(
  "question_extension",
  {
    questionId: integer("question_id")
      .notNull()
      .references(() => question.id),
    /** The player the question is extended for. */
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    /** The player's own deadline (excluded, like a closing). */
    closesAt: timestamptz("closes_at").notNull(),
    grantedBy: text("granted_by")
      .notNull()
      .references(() => user.id),
    grantedAt: timestamptz("granted_at").notNull(),
    /** Latest admin who changed the deadline or ended the extension. */
    updatedBy: text("updated_by").references(() => user.id),
    updatedAt: timestamptz("updated_at"),
  },
  (t) => [
    primaryKey({ columns: [t.questionId, t.userId] }),
    // No one extends a question for themselves.
    check("question_extension_not_self", sql`${t.userId} <> ${t.grantedBy}`),
    index("question_extension_user_idx").on(t.userId),
  ],
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

export const chatMessageKind = pgEnum("chat_message_kind", ["message", "result"]);

/**
 * Messages of the general chat (v1.2, §5.15), kept forever; their order is the one of the ids. A
 * `message` is written by a player; a `result` is posted by the first entry of a question's result,
 * and its text is computed on reading. Deleting a message erases its text.
 */
export const chatMessage = pgTable(
  "chat_message",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    kind: chatMessageKind("kind").notNull(),
    /** The author of a `message`; null for a `result`. */
    userId: text("user_id").references(() => user.id),
    /** The question of a `result`; null for a `message`. */
    questionId: integer("question_id").references(() => question.id),
    /** Text of a `message`; null for a `result` and once deleted. */
    body: text("body"),
    createdAt: timestamptz("created_at").notNull(),
    deletedAt: timestamptz("deleted_at"),
    deletedBy: text("deleted_by").references(() => user.id),
  },
  (t) => [
    check("chat_message_author", sql`(${t.kind} = 'message') = (${t.userId} is not null)`),
    check("chat_message_question", sql`(${t.kind} = 'result') = (${t.questionId} is not null)`),
    check("chat_message_result_no_body", sql`${t.kind} = 'message' or ${t.body} is null`),
    check(
      "chat_message_body_length",
      sql`${t.kind} <> 'message' or ${t.deletedAt} is not null or coalesce(char_length(${t.body}), 0) between 1 and 500`,
    ),
    check("chat_message_deleted_no_body", sql`${t.deletedAt} is null or ${t.body} is null`),
    check("chat_message_deleted_by", sql`(${t.deletedAt} is null) = (${t.deletedBy} is null)`),
    // One result message per question.
    uniqueIndex("chat_message_result_unique").on(t.questionId).where(sql`${t.kind} = 'result'`),
    // The limit of 10 messages a minute (§5.15).
    index("chat_message_user_created_idx").on(t.userId, t.createdAt),
  ],
);

/** Latest chat message read by each account: the unread badge of the Chat tab (§5.15). */
export const chatRead = pgTable("chat_read", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id),
  /** No foreign key: a deleted message must not be blocked by it. */
  lastReadId: integer("last_read_id").notNull(),
  updatedAt: timestamptz("updated_at").notNull(),
});

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
    /** Points of the seasons proclaimed with the v1.1 scale; never written since v1.2. */
    points: integer("points"),
    /** Total malus of the season (v1.2), written by every new proclamation. */
    malus: numeric("malus", { precision: 16, scale: 2, mode: "number" }),
    bullseyes: integer("bullseyes").notNull(),
    // numeric(18, 6) rather than (10, 6): a relative error can exceed 9 999 (typing mistake).
    meanError: numeric("mean_error", { precision: 18, scale: 6, mode: "number" }),
    questionsPlayed: integer("questions_played").notNull(),
    /** Display name at the time of the proclamation. */
    nameSnapshot: text("name_snapshot").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.seasonId, t.userId] }),
    check("season_standing_score", sql`${t.malus} is not null or ${t.points} is not null`),
  ],
);
