INSERT INTO "task_assignees" ("task_id", "user_id", "workspace_id", "added_at")
SELECT "id", "assignee_id", "workspace_id", "created_at"
FROM "tasks"
WHERE "assignee_id" IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE "task_assignees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_assignees" FORCE ROW LEVEL SECURITY;
CREATE POLICY "task_assignees_tenant_isolation" ON "task_assignees"
  USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "task_assignees" TO scrumban_app;
