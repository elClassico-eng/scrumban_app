DROP POLICY IF EXISTS "files_tenant_isolation" ON "files";--> statement-breakpoint
CREATE POLICY "files_select" ON "files" FOR SELECT
  USING (workspace_id IS NULL OR workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "files_insert" ON "files" FOR INSERT
  WITH CHECK (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
    OR (workspace_id IS NULL AND user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  );--> statement-breakpoint
CREATE POLICY "files_update" ON "files" FOR UPDATE
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
    OR (workspace_id IS NULL AND user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  )
  WITH CHECK (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
    OR (workspace_id IS NULL AND user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  );--> statement-breakpoint
CREATE POLICY "files_delete" ON "files" FOR DELETE
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
    OR (workspace_id IS NULL AND user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  );
