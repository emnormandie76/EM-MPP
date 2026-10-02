CREATE TYPE "public"."chat_message_kind" AS ENUM('message', 'result');--> statement-breakpoint
CREATE TABLE "chat_message" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "chat_message_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"kind" "chat_message_kind" NOT NULL,
	"user_id" text,
	"question_id" integer,
	"body" text,
	"created_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text,
	CONSTRAINT "chat_message_author" CHECK (("chat_message"."kind" = 'message') = ("chat_message"."user_id" is not null)),
	CONSTRAINT "chat_message_question" CHECK (("chat_message"."kind" = 'result') = ("chat_message"."question_id" is not null)),
	CONSTRAINT "chat_message_result_no_body" CHECK ("chat_message"."kind" = 'message' or "chat_message"."body" is null),
	CONSTRAINT "chat_message_body_length" CHECK ("chat_message"."kind" <> 'message' or "chat_message"."deleted_at" is not null or coalesce(char_length("chat_message"."body"), 0) between 1 and 500),
	CONSTRAINT "chat_message_deleted_no_body" CHECK ("chat_message"."deleted_at" is null or "chat_message"."body" is null),
	CONSTRAINT "chat_message_deleted_by" CHECK (("chat_message"."deleted_at" is null) = ("chat_message"."deleted_by" is null))
);
--> statement-breakpoint
CREATE TABLE "chat_read" (
	"user_id" text PRIMARY KEY NOT NULL,
	"last_read_id" integer NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_deleted_by_user_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_read" ADD CONSTRAINT "chat_read_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_message_result_unique" ON "chat_message" USING btree ("question_id") WHERE "chat_message"."kind" = 'result';--> statement-breakpoint
CREATE INDEX "chat_message_user_created_idx" ON "chat_message" USING btree ("user_id","created_at");