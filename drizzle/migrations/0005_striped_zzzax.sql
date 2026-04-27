CREATE TYPE "public"."sprint_state" AS ENUM('planned', 'active', 'closed');--> statement-breakpoint
CREATE TABLE "sprint_tasks" (
	"sprint_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sprint_tasks_sprint_id_task_id_pk" PRIMARY KEY("sprint_id","task_id")
);
--> statement-breakpoint
CREATE TABLE "sprints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"board_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"goal" text DEFAULT '' NOT NULL,
	"state" "sprint_state" DEFAULT 'planned' NOT NULL,
	"planned_start_at" timestamp with time zone,
	"planned_end_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sprint_tasks" ADD CONSTRAINT "sprint_tasks_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_tasks" ADD CONSTRAINT "sprint_tasks_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_tasks" ADD CONSTRAINT "sprint_tasks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sprint_tasks_task_id_idx" ON "sprint_tasks" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "sprint_tasks_workspace_id_idx" ON "sprint_tasks" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "sprints_workspace_id_idx" ON "sprints" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "sprints_board_id_idx" ON "sprints" USING btree ("board_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sprints_one_active_per_board_idx" ON "sprints" USING btree ("board_id") WHERE state = 'active';