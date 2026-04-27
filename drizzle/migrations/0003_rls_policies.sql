-- RLS for tenant-scoped tables (Phase 2 schema).
--
-- Each policy filters rows by the per-transaction setting `app.workspace_id`,
-- which the app sets via `SET LOCAL app.workspace_id = '<uuid>'` at the
-- start of every workspace-scoped transaction (see server/utils/db.ts).
--
-- FORCE ROW LEVEL SECURITY makes the policy apply even to the table owner
-- (our scrumban superuser), so a forgotten WHERE in app code returns 0 rows
-- instead of leaking cross-tenant data.
--
-- The `current_setting('app.workspace_id', true)` form returns NULL when
-- the GUC is unset; the policy then admits no rows. That's the intended
-- safe default for any code that forgets to wrap queries in withTenant().

ALTER TABLE "boards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "boards" FORCE ROW LEVEL SECURITY;
CREATE POLICY "boards_tenant_isolation" ON "boards"
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);

ALTER TABLE "board_columns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "board_columns" FORCE ROW LEVEL SECURITY;
CREATE POLICY "board_columns_tenant_isolation" ON "board_columns"
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);

ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tasks" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tasks_tenant_isolation" ON "tasks"
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);

ALTER TABLE "task_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "task_events_tenant_isolation" ON "task_events"
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
