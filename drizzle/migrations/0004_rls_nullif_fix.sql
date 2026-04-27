-- Fix for 0003: once a custom GUC like `app.workspace_id` has been SET LOCAL
-- in any transaction during the session, current_setting('app.workspace_id',
-- true) reverts to '' (empty string) rather than NULL. The original policies
-- did `''::uuid` which raises "invalid input syntax for type uuid: ''".
--
-- Wrap the read in NULLIF(value, '') so empty string becomes NULL, NULL::uuid
-- is NULL, and the equality test cleanly returns NULL → policy admits no rows
-- (the safe default for "no tenant context set").

ALTER POLICY "boards_tenant_isolation" ON "boards"
  USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);

ALTER POLICY "board_columns_tenant_isolation" ON "board_columns"
  USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);

ALTER POLICY "tasks_tenant_isolation" ON "tasks"
  USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);

ALTER POLICY "task_events_tenant_isolation" ON "task_events"
  USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
