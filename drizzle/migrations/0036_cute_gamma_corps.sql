CREATE TYPE "public"."retro_category" AS ENUM('went_well', 'to_improve', 'action_item');--> statement-breakpoint
CREATE TABLE "sprint_retro_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"sprint_id" uuid NOT NULL,
	"category" "retro_category" NOT NULL,
	"body" text NOT NULL,
	"author_id" uuid,
	"task_id" uuid,
	"converted_task_id" uuid,
	"is_resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sprint_retro_notes" ADD CONSTRAINT "sprint_retro_notes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_retro_notes" ADD CONSTRAINT "sprint_retro_notes_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_retro_notes" ADD CONSTRAINT "sprint_retro_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_retro_notes" ADD CONSTRAINT "sprint_retro_notes_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_retro_notes" ADD CONSTRAINT "sprint_retro_notes_converted_task_id_tasks_id_fk" FOREIGN KEY ("converted_task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sprint_retro_notes_workspace_id_idx" ON "sprint_retro_notes" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "sprint_retro_notes_sprint_id_created_at_idx" ON "sprint_retro_notes" USING btree ("sprint_id","created_at");--> statement-breakpoint
ALTER TABLE "sprint_retro_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sprint_retro_notes" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "sprint_retro_notes_tenant_isolation" ON "sprint_retro_notes"
  USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "sprint_retro_notes" TO scrumban_app;
