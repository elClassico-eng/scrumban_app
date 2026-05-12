-- Phase 5 — Scrumban-distinct features.
-- Adds service_class (Anderson 2010 Classes of Service) replacing the
-- priority enum, plus board-level SLE + replenishment cadence fields.
-- The two UPDATE statements before DROP COLUMN map old priority values:
--   high   → expedite    (urgent = jumps queue)
--   medium → standard    (already the DEFAULT, no UPDATE needed)
--   low    → intangible  (deferred, lowest pull priority)
CREATE TYPE "public"."service_class" AS ENUM('expedite', 'fixed_date', 'standard', 'intangible');--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "sle_days" integer;--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "sle_probability" numeric(3, 2) DEFAULT '0.85' NOT NULL;--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "last_replenishment_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "replenishment_period_days" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "service_class" "service_class" DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "due_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "expedited_at" timestamp with time zone;--> statement-breakpoint
UPDATE "tasks" SET "service_class" = 'expedite'::service_class WHERE "priority" = 'high'::task_priority;--> statement-breakpoint
UPDATE "tasks" SET "service_class" = 'intangible'::service_class WHERE "priority" = 'low'::task_priority;--> statement-breakpoint
CREATE INDEX "tasks_board_service_class_idx" ON "tasks" USING btree ("board_id","service_class");--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "priority";--> statement-breakpoint
DROP TYPE "public"."task_priority";