CREATE TABLE "question_extension" (
	"question_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"granted_by" text NOT NULL,
	"granted_at" timestamp with time zone NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone,
	CONSTRAINT "question_extension_question_id_user_id_pk" PRIMARY KEY("question_id","user_id"),
	CONSTRAINT "question_extension_not_self" CHECK ("question_extension"."user_id" <> "question_extension"."granted_by")
);
--> statement-breakpoint
ALTER TABLE "question" DROP CONSTRAINT "question_price_is_right_number";--> statement-breakpoint
ALTER TABLE "season_standing" ALTER COLUMN "points" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "question" ADD COLUMN "wrong_answer_malus" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "season" ADD COLUMN "jokers_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "season_standing" ADD COLUMN "malus" numeric(16, 2);--> statement-breakpoint
-- v1.2 (architecture §4.3): existing choice questions get a wrong-answer malus of 50, and the removed
-- Juste Prix is turned off, before the constraints below are added. Only additions, no data lost.
UPDATE "question" SET "wrong_answer_malus" = 50 WHERE "type" = 'choice' AND "wrong_answer_malus" IS NULL;--> statement-breakpoint
UPDATE "question" SET "price_is_right" = false WHERE "price_is_right";--> statement-breakpoint
ALTER TABLE "question_extension" ADD CONSTRAINT "question_extension_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_extension" ADD CONSTRAINT "question_extension_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_extension" ADD CONSTRAINT "question_extension_granted_by_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_extension" ADD CONSTRAINT "question_extension_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "question_extension_user_idx" ON "question_extension" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_price_is_right_removed" CHECK (not "question"."price_is_right");--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_wrong_answer_malus" CHECK (("question"."type" = 'choice') = ("question"."wrong_answer_malus" is not null));--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_wrong_answer_malus_positive" CHECK ("question"."wrong_answer_malus" > 0);--> statement-breakpoint
ALTER TABLE "season_standing" ADD CONSTRAINT "season_standing_score" CHECK ("season_standing"."malus" is not null or "season_standing"."points" is not null);