CREATE TYPE "public"."sprint_event_type" AS ENUM('sprint_started', 'sprint_closed', 'dates_changed', 'capacity_changed');--> statement-breakpoint
ALTER TYPE "public"."task_event_type" ADD VALUE 'task_added_to_sprint';--> statement-breakpoint
ALTER TYPE "public"."task_event_type" ADD VALUE 'task_removed_from_sprint';--> statement-breakpoint
ALTER TYPE "public"."task_event_type" ADD VALUE 'task_blocked';--> statement-breakpoint
ALTER TYPE "public"."task_event_type" ADD VALUE 'task_unblocked';--> statement-breakpoint
CREATE TABLE "sprint_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"sprint_id" uuid NOT NULL,
	"event_type" "sprint_event_type" NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sprint_events" ADD CONSTRAINT "sprint_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_events" ADD CONSTRAINT "sprint_events_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_events" ADD CONSTRAINT "sprint_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sprint_events_workspace_id_idx" ON "sprint_events" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "sprint_events_sprint_id_created_at_idx" ON "sprint_events" USING btree ("sprint_id","created_at");--> statement-breakpoint
ALTER TABLE "sprint_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sprint_events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "sprint_events_tenant_isolation" ON "sprint_events"
  USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "sprint_events" TO scrumban_app;
