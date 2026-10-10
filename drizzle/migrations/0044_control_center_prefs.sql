ALTER TABLE "users" ADD COLUMN "control_center_prefs" jsonb DEFAULT '{}'::jsonb NOT NULL;
