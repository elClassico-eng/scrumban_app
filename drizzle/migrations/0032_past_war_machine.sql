CREATE TABLE "sprint_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"sprint_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"changes" jsonb NOT NULL,
	"baseline_result" jsonb,
	"scenario_result" jsonb,
	"computed_at" timestamp with time zone,
	"created_by" uuid,
	"applied_at" timestamp with time zone,
	"applied_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "estimate_days" double precision;--> statement-breakpoint
ALTER TABLE "sprint_scenarios" ADD CONSTRAINT "sprint_scenarios_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_scenarios" ADD CONSTRAINT "sprint_scenarios_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_scenarios" ADD CONSTRAINT "sprint_scenarios_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_scenarios" ADD CONSTRAINT "sprint_scenarios_applied_by_users_id_fk" FOREIGN KEY ("applied_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sprint_scenarios_workspace_id_idx" ON "sprint_scenarios" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "sprint_scenarios_sprint_id_created_at_idx" ON "sprint_scenarios" USING btree ("sprint_id","created_at");--> statement-breakpoint
ALTER TABLE "sprint_scenarios" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sprint_scenarios" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "sprint_scenarios_tenant_isolation" ON "sprint_scenarios"
  USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "sprint_scenarios" TO scrumban_app;