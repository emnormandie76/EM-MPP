ALTER TABLE "question" ADD COLUMN "place_malus" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_place_malus_number" CHECK ("question"."place_malus" is null or "question"."type" = 'number');--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_place_malus_coefficient" CHECK ("question"."place_malus" is null or "question"."coefficient" = 1);--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_place_malus_positive" CHECK ("question"."place_malus" > 0);