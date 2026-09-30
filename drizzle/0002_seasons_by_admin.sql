ALTER TABLE "season" DROP CONSTRAINT "season_label_unique";--> statement-breakpoint
ALTER TABLE "question" DROP CONSTRAINT "question_season_of_closing";--> statement-breakpoint
ALTER TABLE "season" DROP CONSTRAINT "season_label_format";--> statement-breakpoint
ALTER TABLE "season" DROP CONSTRAINT "season_bounds_order";--> statement-breakpoint
CREATE UNIQUE INDEX "season_label_lower_unique" ON "season" USING btree (lower("label"));--> statement-breakpoint
ALTER TABLE "season" DROP COLUMN "ends_at";--> statement-breakpoint
ALTER TABLE "season" ADD CONSTRAINT "season_starts_at_unique" UNIQUE("starts_at");--> statement-breakpoint
ALTER TABLE "season" ADD CONSTRAINT "season_label_length" CHECK (char_length("season"."label") between 2 and 40);