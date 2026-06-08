-- Custom SQL migration file, put your code below! --
ALTER TABLE "workspace_user_labels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_user_labels" FORCE ROW LEVEL SECURITY;
CREATE POLICY "workspace_user_labels_self" ON "workspace_user_labels"
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "workspace_user_labels" TO scrumban_app;