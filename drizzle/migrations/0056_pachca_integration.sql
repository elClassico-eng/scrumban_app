CREATE TYPE "public"."integration_provider" AS ENUM('pachca');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('active', 'error');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'integration_failed';--> statement-breakpoint
CREATE TABLE "board_feeds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"board_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"chat_id" varchar(64) NOT NULL,
	"chat_name" varchar(255) NOT NULL,
	"events" text[] NOT NULL,
	"standup_time" varchar(5),
	"standup_sent_on" date,
	"cursor" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "integration_status" DEFAULT 'active' NOT NULL,
	"failing_since" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messenger_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"external_id" varchar(64) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"instant_types" text[] DEFAULT '{"mention","reply","comment_assigned","assigned"}' NOT NULL,
	"digest" boolean DEFAULT false NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messenger_link_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"external_id" varchar(64) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messenger_link_requests_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "workspace_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"bot_token_enc" text NOT NULL,
	"signing_secret_enc" text,
	"token_hint" varchar(8) NOT NULL,
	"bot_user_id" varchar(32) NOT NULL,
	"external_name" varchar(255) NOT NULL,
	"emails_visible" boolean DEFAULT false NOT NULL,
	"status" "integration_status" DEFAULT 'active' NOT NULL,
	"last_error" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "board_feeds" ADD CONSTRAINT "board_feeds_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_feeds" ADD CONSTRAINT "board_feeds_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_feeds" ADD CONSTRAINT "board_feeds_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messenger_accounts" ADD CONSTRAINT "messenger_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messenger_accounts" ADD CONSTRAINT "messenger_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messenger_link_requests" ADD CONSTRAINT "messenger_link_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messenger_link_requests" ADD CONSTRAINT "messenger_link_requests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_integrations" ADD CONSTRAINT "workspace_integrations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_integrations" ADD CONSTRAINT "workspace_integrations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "board_feeds_board_chat_uq" ON "board_feeds" USING btree ("board_id","provider","chat_id");--> statement-breakpoint
CREATE INDEX "board_feeds_workspace_idx" ON "board_feeds" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "messenger_accounts_external_uq" ON "messenger_accounts" USING btree ("provider","workspace_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "messenger_accounts_user_uq" ON "messenger_accounts" USING btree ("user_id","provider","workspace_id");--> statement-breakpoint
CREATE INDEX "messenger_accounts_workspace_idx" ON "messenger_accounts" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "messenger_link_requests_user_idx" ON "messenger_link_requests" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_integrations_ws_provider_uq" ON "workspace_integrations" USING btree ("workspace_id","provider");--> statement-breakpoint
ALTER TABLE "workspace_integrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workspace_integrations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "workspace_integrations_tenant_isolation" ON "workspace_integrations"
  USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "messenger_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "messenger_accounts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "messenger_accounts_tenant_isolation" ON "messenger_accounts"
  USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "board_feeds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "board_feeds" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "board_feeds_tenant_isolation" ON "board_feeds"
  USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "workspace_integrations", "messenger_accounts", "messenger_link_requests", "board_feeds" TO scrumban_app;
