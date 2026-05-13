ALTER TABLE "users" ADD COLUMN "first_name" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_name" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "middle_name" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "job_title" varchar(150);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "purpose" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "industry" varchar(100);--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "logo_url" text;