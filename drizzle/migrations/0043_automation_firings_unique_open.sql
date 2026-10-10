CREATE UNIQUE INDEX "automation_firings_open_subject_uniq" ON "automation_firings" ("rule_id", "subject_type", "subject_id") WHERE "resolved_at" IS NULL;
