ALTER TABLE "task_checklist_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_checklist_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY "task_checklist_items_tenant_isolation" ON "task_checklist_items"
  USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "task_checklist_items" TO scrumban_app;