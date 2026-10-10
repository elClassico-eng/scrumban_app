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
