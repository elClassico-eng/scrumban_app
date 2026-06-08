CREATE TABLE "workspace_user_labels" (
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"label" varchar(40) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_user_labels_user_id_workspace_id_pk" PRIMARY KEY("user_id","workspace_id")
);
--> statement-breakpoint
ALTER TABLE "workspace_user_labels" ADD CONSTRAINT "workspace_user_labels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_user_labels" ADD CONSTRAINT "workspace_user_labels_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_user_labels_user_id_idx" ON "workspace_user_labels" USING btree ("user_id");