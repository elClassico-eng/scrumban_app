CREATE TABLE "sprint_reports" (
	"sprint_id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"generated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "sprint_reports" ADD CONSTRAINT "sprint_reports_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_reports" ADD CONSTRAINT "sprint_reports_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_reports" ADD CONSTRAINT "sprint_reports_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sprint_reports_workspace_id_idx" ON "sprint_reports" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "sprint_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sprint_reports" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "sprint_reports_tenant_isolation" ON "sprint_reports"
  USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "sprint_reports" TO scrumban_app;
