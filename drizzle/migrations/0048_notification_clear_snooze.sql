ALTER TABLE "notifications" ADD COLUMN "cleared_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "snoozed_until" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "notifications_user_ws_cleared_idx" ON "notifications" USING btree ("user_id","workspace_id","cleared_at","created_at");