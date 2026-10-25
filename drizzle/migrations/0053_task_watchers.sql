ALTER TYPE "public"."notification_type" ADD VALUE 'watched_comment';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'watched_status';--> statement-breakpoint
CREATE TABLE "task_watchers" (
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_watchers_task_id_user_id_pk" PRIMARY KEY("task_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "task_watchers" ADD CONSTRAINT "task_watchers_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_watchers" ADD CONSTRAINT "task_watchers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_watchers" ADD CONSTRAINT "task_watchers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_watchers_workspace_id_idx" ON "task_watchers" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "task_watchers_user_id_idx" ON "task_watchers" USING btree ("user_id");--> statement-breakpoint
INSERT INTO "task_watchers" ("task_id", "user_id", "workspace_id")
SELECT "task_id", "user_id", "workspace_id" FROM "task_assignees"
UNION
SELECT "task_id", "author_id", "workspace_id" FROM "task_comments" WHERE "author_id" IS NOT NULL
UNION
SELECT "task_id", "actor_id", "workspace_id" FROM "task_events" WHERE "event_type" = 'task_created' AND "actor_id" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "task_watchers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "task_watchers" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "task_watchers_tenant_isolation" ON "task_watchers"
  USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON "task_watchers" TO scrumban_app;
