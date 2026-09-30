CREATE TYPE "public"."prediction_event_type" AS ENUM('saved', 'validated', 'unlocked', 'joker_on', 'joker_off');--> statement-breakpoint
CREATE TYPE "public"."question_status" AS ENUM('draft', 'published', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('number', 'choice');--> statement-breakpoint
CREATE TABLE "allowed_email" (
	"email" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	CONSTRAINT "allowed_email_normalized" CHECK ("allowed_email"."email" = lower(btrim("allowed_email"."email")))
);
--> statement-breakpoint
CREATE TABLE "announcement" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "announcement_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"body" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "announcement_body_length" CHECK (char_length("announcement"."body") between 1 and 500)
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "category_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prediction" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "prediction_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"question_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"value_number" numeric(14, 2),
	"option_id" integer,
	"joker" boolean DEFAULT false NOT NULL,
	"validated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prediction_question_user_unique" UNIQUE("question_id","user_id"),
	CONSTRAINT "prediction_value_or_option" CHECK (("prediction"."value_number" is null) <> ("prediction"."option_id" is null)),
	CONSTRAINT "prediction_value_positive" CHECK ("prediction"."value_number" >= 0)
);
--> statement-breakpoint
CREATE TABLE "prediction_event" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "prediction_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"prediction_id" integer NOT NULL,
	"question_id" integer NOT NULL,
	"owner_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"type" "prediction_event_type" NOT NULL,
	"value_number" numeric(14, 2),
	"option_id" integer,
	"joker" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prize" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "prize_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"season_id" integer NOT NULL,
	"rank_label" text NOT NULL,
	"description" text NOT NULL,
	"position" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "question_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"season_id" integer,
	"category_id" integer NOT NULL,
	"type" "question_type" NOT NULL,
	"price_is_right" boolean DEFAULT false NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"unit" text,
	"source" text NOT NULL,
	"help_bi_url" text,
	"help_last_year" text,
	"help_hint" text,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"expected_result_at" timestamp with time zone,
	"coefficient" smallint DEFAULT 1 NOT NULL,
	"status" "question_status" DEFAULT 'draft' NOT NULL,
	"result_number" numeric(14, 2),
	"result_option_id" integer,
	"resolved_at" timestamp with time zone,
	"corrected_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"duplicated_from_id" integer,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_coefficient" CHECK ("question"."coefficient" in (1, 2, 3)),
	CONSTRAINT "question_dates_order" CHECK ("question"."opens_at" is null or "question"."closes_at" is null or "question"."opens_at" < "question"."closes_at"),
	CONSTRAINT "question_published_complete" CHECK ("question"."status" <> 'published' or ("question"."opens_at" is not null and "question"."closes_at" is not null and "question"."season_id" is not null)),
	CONSTRAINT "question_season_of_closing" CHECK ("question"."closes_at" is null or "question"."season_id" is not null),
	CONSTRAINT "question_title_length" CHECK (char_length("question"."title") between 5 and 200),
	CONSTRAINT "question_description_length" CHECK (char_length("question"."description") <= 2000),
	CONSTRAINT "question_price_is_right_number" CHECK (not "question"."price_is_right" or "question"."type" = 'number'),
	CONSTRAINT "question_help_bi_url_http" CHECK ("question"."help_bi_url" ~ '^https?://'),
	CONSTRAINT "question_result_positive" CHECK ("question"."result_number" >= 0)
);
--> statement-breakpoint
CREATE TABLE "question_option" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "question_option_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"question_id" integer NOT NULL,
	"label" text NOT NULL,
	"position" smallint NOT NULL,
	CONSTRAINT "question_option_position_unique" UNIQUE("question_id","position"),
	CONSTRAINT "question_option_of_question_unique" UNIQUE("id","question_id"),
	CONSTRAINT "question_option_label_length" CHECK (char_length("question_option"."label") between 1 and 80)
);
--> statement-breakpoint
CREATE TABLE "season" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "season_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"label" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"proclaimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "season_label_unique" UNIQUE("label"),
	CONSTRAINT "season_label_format" CHECK ("season"."label" ~ '^[0-9]{4}-[0-9]{4}$'),
	CONSTRAINT "season_bounds_order" CHECK ("season"."starts_at" < "season"."ends_at")
);
--> statement-breakpoint
CREATE TABLE "season_standing" (
	"season_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"rank" integer NOT NULL,
	"points" integer NOT NULL,
	"bullseyes" integer NOT NULL,
	"mean_error" numeric(18, 6),
	"questions_played" integer NOT NULL,
	"name_snapshot" text NOT NULL,
	CONSTRAINT "season_standing_season_id_user_id_pk" PRIMARY KEY("season_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"avatar" text NOT NULL,
	"last_seen_at" timestamp with time zone,
	"previous_visit_at" timestamp with time zone,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "allowed_email" ADD CONSTRAINT "allowed_email_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction" ADD CONSTRAINT "prediction_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction" ADD CONSTRAINT "prediction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction" ADD CONSTRAINT "prediction_option_fk" FOREIGN KEY ("option_id","question_id") REFERENCES "public"."question_option"("id","question_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_event" ADD CONSTRAINT "prediction_event_prediction_id_prediction_id_fk" FOREIGN KEY ("prediction_id") REFERENCES "public"."prediction"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_event" ADD CONSTRAINT "prediction_event_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_event" ADD CONSTRAINT "prediction_event_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_event" ADD CONSTRAINT "prediction_event_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize" ADD CONSTRAINT "prize_season_id_season_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."season"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_season_id_season_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."season"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_duplicated_from_id_question_id_fk" FOREIGN KEY ("duplicated_from_id") REFERENCES "public"."question"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_result_option_fk" FOREIGN KEY ("result_option_id","id") REFERENCES "public"."question_option"("id","question_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_option" ADD CONSTRAINT "question_option_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_standing" ADD CONSTRAINT "season_standing_season_id_season_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."season"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_standing" ADD CONSTRAINT "season_standing_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "category_name_unique" ON "category" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "prediction_user_idx" ON "prediction" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "prediction_question_idx" ON "prediction" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "prediction_event_question_created_idx" ON "prediction_event" USING btree ("question_id","created_at");--> statement-breakpoint
CREATE INDEX "question_season_status_idx" ON "question" USING btree ("season_id","status");--> statement-breakpoint
CREATE INDEX "question_closes_at_idx" ON "question" USING btree ("closes_at");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");