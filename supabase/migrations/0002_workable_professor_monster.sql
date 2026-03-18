CREATE TABLE "execution_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"employee_id" uuid NOT NULL,
	"workflow_instance_id" uuid,
	"workflow_step_key" text,
	"step_label" text,
	"topic_title" text,
	"scenario" text,
	"output_summary" text,
	"output_full" jsonb,
	"tokens_input" integer DEFAULT 0 NOT NULL,
	"tokens_output" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"tool_call_count" integer DEFAULT 0 NOT NULL,
	"model_id" text,
	"temperature" jsonb,
	"status" text DEFAULT 'success' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_employees" ADD COLUMN "disabled" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "execution_logs" ADD CONSTRAINT "execution_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_logs" ADD CONSTRAINT "execution_logs_employee_id_ai_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."ai_employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_logs" ADD CONSTRAINT "execution_logs_workflow_instance_id_workflow_instances_id_fk" FOREIGN KEY ("workflow_instance_id") REFERENCES "public"."workflow_instances"("id") ON DELETE no action ON UPDATE no action;