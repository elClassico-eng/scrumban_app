CREATE TYPE "public"."automation_action" AS ENUM('notify', 'comment', 'daily_agenda');--> statement-breakpoint
CREATE TYPE "public"."automation_trigger" AS ENUM('task_aging', 'task_blocked', 'sprint_forecast', 'wip_exceeded', 'replenishment_overdue');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'automation';--> statement-breakpoint
CREATE TABLE "automation_firings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"rule_id" uuid NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"fired_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "automation_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"board_id" uuid NOT NULL,
	"trigger" "automation_trigger" NOT NULL,
	"trigger_params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action" "automation_action" NOT NULL,
	"action_params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_comments" ADD COLUMN "automation_rule_id" uuid;--> statement-breakpoint
ALTER TABLE "automation_firings" ADD CONSTRAINT "automation_firings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_firings" ADD CONSTRAINT "automation_firings_rule_id_automation_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."automation_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automation_firings_rule_resolved_idx" ON "automation_firings" USING btree ("rule_id","resolved_at");--> statement-breakpoint
CREATE INDEX "automation_firings_workspace_resolved_idx" ON "automation_firings" USING btree ("workspace_id","resolved_at");--> statement-breakpoint
CREATE INDEX "automation_rules_workspace_id_idx" ON "automation_rules" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "automation_rules_board_id_idx" ON "automation_rules" USING btree ("board_id");--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_automation_rule_id_automation_rules_id_fk" FOREIGN KEY ("automation_rule_id") REFERENCES "public"."automation_rules"("id") ON DELETE set null ON UPDATE no action;