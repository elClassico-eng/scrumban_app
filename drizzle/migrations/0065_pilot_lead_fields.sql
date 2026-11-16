ALTER TABLE "leads" ADD COLUMN "team_size" varchar(50);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "current_tool" varchar(200);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "consent_at" timestamp with time zone;