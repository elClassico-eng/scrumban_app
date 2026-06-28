CREATE TYPE "public"."workspace_card_style" AS ENUM('cover', 'compact');--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "card_style" "workspace_card_style" DEFAULT 'cover' NOT NULL;