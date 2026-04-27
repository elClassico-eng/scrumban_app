CREATE TYPE "public"."column_role" AS ENUM('backlog', 'in_progress', 'review', 'done', 'archived');--> statement-breakpoint
CREATE TYPE "public"."task_event_type" AS ENUM('task_created', 'task_moved', 'task_closed', 'task_reopened', 'task_assigned', 'task_updated', 'task_archived');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TABLE "board_columns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"board_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"position" integer NOT NULL,
	"wip_limit" integer,
	"column_role" "column_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "boards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"event_type" "task_event_type" NOT NULL,
	"from_column_id" uuid,
	"to_column_id" uuid,
	"actor_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"board_id" uuid NOT NULL,
	"column_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"assignee_id" uuid,
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"position" integer NOT NULL,
	"closed_at" timestamp with time zone,
	"reopened_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "board_columns" ADD CONSTRAINT "board_columns_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_columns" ADD CONSTRAINT "board_columns_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_column_id_board_columns_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."board_columns"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "board_columns_board_position_idx" ON "board_columns" USING btree ("board_id","position");--> statement-breakpoint
CREATE INDEX "board_columns_board_id_idx" ON "board_columns" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "board_columns_workspace_id_idx" ON "board_columns" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "boards_workspace_slug_idx" ON "boards" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "boards_workspace_id_idx" ON "boards" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "task_events_workspace_id_idx" ON "task_events" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "task_events_task_id_idx" ON "task_events" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_events_workspace_created_idx" ON "task_events" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "tasks_workspace_id_idx" ON "tasks" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "tasks_board_column_position_idx" ON "tasks" USING btree ("board_id","column_id","position");--> statement-breakpoint
CREATE INDEX "tasks_assignee_id_idx" ON "tasks" USING btree ("assignee_id");