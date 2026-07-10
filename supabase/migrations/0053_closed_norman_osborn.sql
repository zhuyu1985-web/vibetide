CREATE TABLE "cli_tool_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"cli_tool_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"input_asset_id" uuid,
	"output_asset_id" uuid,
	"argv_resolved" jsonb,
	"exit_code" integer,
	"error_message" text,
	"stderr_tail" text,
	"mission_id" uuid,
	"task_id" uuid,
	"conversation_id" uuid,
	"job_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cli_tools" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text NOT NULL,
	"command" text NOT NULL,
	"args_schema" jsonb NOT NULL,
	"argv_template" jsonb NOT NULL,
	"execution_mode" text DEFAULT 'async' NOT NULL,
	"sync_timeout_ms" integer DEFAULT 20000 NOT NULL,
	"output_kind" text DEFAULT 'media_asset' NOT NULL,
	"tool_class" text DEFAULT 'write' NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cli_tool_runs" ADD CONSTRAINT "cli_tool_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cli_tool_runs" ADD CONSTRAINT "cli_tool_runs_cli_tool_id_cli_tools_id_fk" FOREIGN KEY ("cli_tool_id") REFERENCES "public"."cli_tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cli_tools" ADD CONSTRAINT "cli_tools_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cli_tool_runs_org_tool_idx" ON "cli_tool_runs" USING btree ("organization_id","cli_tool_id");--> statement-breakpoint
CREATE INDEX "cli_tool_runs_job_idx" ON "cli_tool_runs" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cli_tools_org_slug_uidx" ON "cli_tools" USING btree ("organization_id","slug");