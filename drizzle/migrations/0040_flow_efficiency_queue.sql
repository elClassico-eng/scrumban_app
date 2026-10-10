ALTER TABLE "board_columns" ADD COLUMN "is_queue" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "board_columns" SET "is_queue" = true WHERE "column_role" = 'backlog';
