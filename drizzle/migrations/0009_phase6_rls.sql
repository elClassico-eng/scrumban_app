ALTER TABLE "task_dependencies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_dependencies" FORCE ROW LEVEL SECURITY;
CREATE POLICY "task_dependencies_tenant_isolation" ON "task_dependencies"
  USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "task_dependencies" TO scrumban_app;