ALTER TABLE "task_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_comments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "task_comments_tenant_isolation" ON "task_comments"
  USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "task_comments" TO scrumban_app;