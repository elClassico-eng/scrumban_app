ALTER TABLE "board_columns" ADD COLUMN "color" varchar(7);--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "column_tint" boolean DEFAULT false NOT NULL;