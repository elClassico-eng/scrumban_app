CREATE TYPE "public"."forecast_trigger" AS ENUM('sprint_start', 'sprint_close', 'daily');--> statement-breakpoint
CREATE TABLE "forecast_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"board_id" uuid NOT NULL,
	"sprint_id" uuid NOT NULL,
	"trigger" "forecast_trigger" NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forecast_snapshots" ADD CONSTRAINT "forecast_snapshots_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecast_snapshots" ADD CONSTRAINT "forecast_snapshots_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecast_snapshots" ADD CONSTRAINT "forecast_snapshots_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "forecast_snapshots_sprint_id_taken_at_idx" ON "forecast_snapshots" USING btree ("sprint_id","taken_at");--> statement-breakpoint
CREATE INDEX "forecast_snapshots_workspace_id_idx" ON "forecast_snapshots" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "forecast_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "forecast_snapshots" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "forecast_snapshots_tenant_isolation" ON "forecast_snapshots"
  USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "forecast_snapshots" TO scrumban_app;
