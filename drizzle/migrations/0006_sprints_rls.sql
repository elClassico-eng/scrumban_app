-- RLS policies for sprints + sprint_tasks. Same pattern as 0003/0004
-- (NULLIF guard against empty-string GUC, FORCE so even table owners
-- are subject to the policy).

ALTER TABLE "sprints" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sprints" FORCE ROW LEVEL SECURITY;
CREATE POLICY "sprints_tenant_isolation" ON "sprints"
  USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);

ALTER TABLE "sprint_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sprint_tasks" FORCE ROW LEVEL SECURITY;
CREATE POLICY "sprint_tasks_tenant_isolation" ON "sprint_tasks"
  USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);

-- Grant runtime DML to scrumban_app on the new tables. ALTER DEFAULT
-- PRIVILEGES (in db/init/01_app_role.sql) only fires for the role that
-- created the tables; for tests where the DB is recreated it'll cover
-- this, but in dev where init ran before these tables existed we grant
-- explicitly. Idempotent.
GRANT SELECT, INSERT, UPDATE, DELETE ON "sprints" TO scrumban_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "sprint_tasks" TO scrumban_app;
