ALTER TYPE "public"."notification_type" ADD VALUE 'reply';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'comment_assigned';--> statement-breakpoint
ALTER TABLE "task_comments" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "task_comments" ADD COLUMN "assignee_id" uuid;--> statement-breakpoint
ALTER TABLE "task_comments" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "task_comments" ADD COLUMN "resolved_by" uuid;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_parent_id_task_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."task_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_comments_assignee_idx" ON "task_comments" USING btree ("workspace_id","assignee_id","resolved_at");