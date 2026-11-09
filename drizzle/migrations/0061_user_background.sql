ALTER TYPE "public"."file_kind" ADD VALUE 'user_background';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "appearance_prefs" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "files" DROP CONSTRAINT "files_owner_by_kind";--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_owner_by_kind" CHECK (
  (kind::text = 'attachment' AND task_id IS NOT NULL AND workspace_id IS NOT NULL)
  OR (kind::text IN ('user_avatar', 'user_background') AND user_id IS NOT NULL AND workspace_id IS NULL)
  OR (kind::text = 'workspace_logo' AND workspace_id IS NOT NULL)
  OR (kind::text = 'board_image' AND board_id IS NOT NULL AND workspace_id IS NOT NULL)
);
