CREATE TYPE "public"."retro_phase" AS ENUM('collect', 'discuss');--> statement-breakpoint
CREATE TABLE "sprint_retro_votes" (
	"note_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sprint_retro_votes_note_id_user_id_pk" PRIMARY KEY("note_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "sprints" ADD COLUMN "retro_phase" "retro_phase" DEFAULT 'collect' NOT NULL;--> statement-breakpoint
ALTER TABLE "sprint_retro_notes" ADD COLUMN "assignee_id" uuid;--> statement-breakpoint
ALTER TABLE "sprint_retro_notes" ADD COLUMN "due_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sprint_retro_votes" ADD CONSTRAINT "sprint_retro_votes_note_id_sprint_retro_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."sprint_retro_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_retro_votes" ADD CONSTRAINT "sprint_retro_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_retro_votes" ADD CONSTRAINT "sprint_retro_votes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sprint_retro_votes_workspace_id_idx" ON "sprint_retro_votes" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "sprint_retro_notes" ADD CONSTRAINT "sprint_retro_notes_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
UPDATE "sprints" SET "retro_phase" = 'discuss'
WHERE "id" IN (SELECT DISTINCT "sprint_id" FROM "sprint_retro_notes");--> statement-breakpoint
ALTER TABLE "sprint_retro_votes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sprint_retro_votes" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "sprint_retro_votes_tenant_isolation" ON "sprint_retro_votes"
  USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON "sprint_retro_votes" TO scrumban_app;
