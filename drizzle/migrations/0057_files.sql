CREATE TYPE "public"."file_kind" AS ENUM('attachment', 'user_avatar', 'workspace_logo', 'board_image');--> statement-breakpoint
CREATE TYPE "public"."file_status" AS ENUM('pending', 'staged', 'ready');--> statement-breakpoint
ALTER TYPE "public"."task_event_type" ADD VALUE 'task_attachment_added';--> statement-breakpoint
ALTER TYPE "public"."task_event_type" ADD VALUE 'task_attachment_removed';--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"kind" "file_kind" NOT NULL,
	"status" "file_status" DEFAULT 'pending' NOT NULL,
	"for_comment" boolean DEFAULT false NOT NULL,
	"task_id" uuid,
	"comment_id" uuid,
	"board_id" uuid,
	"user_id" uuid,
	"storage_key" text NOT NULL,
	"thumb_key" text,
	"name" varchar(255) NOT NULL,
	"content_type" varchar(127) NOT NULL,
	"size_bytes" bigint NOT NULL,
	"thumb_bytes" integer DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "files_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "storage_trash" (
	"key" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_comment_id_task_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."task_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "files_workspace_idx" ON "files" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "files_task_idx" ON "files" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "files_comment_idx" ON "files" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "files_status_created_idx" ON "files" USING btree ("status","created_at");--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_owner_by_kind" CHECK (
  (kind = 'attachment' AND task_id IS NOT NULL AND workspace_id IS NOT NULL)
  OR (kind = 'user_avatar' AND user_id IS NOT NULL AND workspace_id IS NULL)
  OR (kind = 'workspace_logo' AND workspace_id IS NOT NULL)
  OR (kind = 'board_image' AND board_id IS NOT NULL AND workspace_id IS NOT NULL)
);--> statement-breakpoint
CREATE OR REPLACE FUNCTION files_to_trash() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO storage_trash (key) VALUES (OLD.storage_key) ON CONFLICT DO NOTHING;
  IF OLD.thumb_key IS NOT NULL THEN
    INSERT INTO storage_trash (key) VALUES (OLD.thumb_key) ON CONFLICT DO NOTHING;
  END IF;
  RETURN OLD;
END;
$$;--> statement-breakpoint
CREATE TRIGGER files_after_delete AFTER DELETE ON files FOR EACH ROW EXECUTE FUNCTION files_to_trash();--> statement-breakpoint
ALTER TABLE "files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "files" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "files_tenant_isolation" ON "files"
  USING (workspace_id IS NULL OR workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id IS NULL OR workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "files", "storage_trash" TO scrumban_app;
