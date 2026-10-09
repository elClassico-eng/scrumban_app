ALTER TABLE "automation_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "automation_rules" FORCE ROW LEVEL SECURITY;
CREATE POLICY "automation_rules_tenant_isolation" ON "automation_rules"
  USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "automation_rules" TO scrumban_app;
--> statement-breakpoint
ALTER TABLE "automation_firings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "automation_firings" FORCE ROW LEVEL SECURITY;
CREATE POLICY "automation_firings_tenant_isolation" ON "automation_firings"
  USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "automation_firings" TO scrumban_app;
--> statement-breakpoint
INSERT INTO "automation_rules" (workspace_id, board_id, trigger, trigger_params, action, action_params)
SELECT workspace_id, id, 'task_aging'::automation_trigger, '{"thresholdPct":85}'::jsonb, 'notify'::automation_action, '{"recipients":"assignee"}'::jsonb FROM boards
UNION ALL
SELECT workspace_id, id, 'sprint_forecast'::automation_trigger, '{"minProbability":70}'::jsonb, 'notify'::automation_action, '{"recipients":"scrum_masters"}'::jsonb FROM boards
UNION ALL
SELECT workspace_id, id, 'replenishment_overdue'::automation_trigger, '{}'::jsonb, 'notify'::automation_action, '{"recipients":"scrum_masters"}'::jsonb FROM boards;
