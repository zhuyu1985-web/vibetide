CREATE TABLE IF NOT EXISTS "skill_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skill_id" uuid NOT NULL,
	"organization_id" uuid,
	"version" text NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"snapshot" jsonb NOT NULL,
	"change_description" text,
	"changed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "skill_usage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skill_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"organization_id" uuid,
	"workflow_instance_id" uuid,
	"workflow_step_id" uuid,
	"success" integer DEFAULT 1 NOT NULL,
	"quality_score" integer,
	"execution_time_ms" integer,
	"token_usage" integer,
	"error_message" text,
	"input_summary" text,
	"output_summary" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"icon" text DEFAULT 'Zap' NOT NULL,
	"system_instruction" text NOT NULL,
	"input_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tools_hint" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN IF NOT EXISTS "plugin_config" jsonb;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'skill_versions_skill_id_skills_id_fk') THEN
    ALTER TABLE "skill_versions" ADD CONSTRAINT "skill_versions_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'skill_versions_organization_id_organizations_id_fk') THEN
    ALTER TABLE "skill_versions" ADD CONSTRAINT "skill_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'skill_usage_records_skill_id_skills_id_fk') THEN
    ALTER TABLE "skill_usage_records" ADD CONSTRAINT "skill_usage_records_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'skill_usage_records_employee_id_ai_employees_id_fk') THEN
    ALTER TABLE "skill_usage_records" ADD CONSTRAINT "skill_usage_records_employee_id_ai_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."ai_employees"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'skill_usage_records_organization_id_organizations_id_fk') THEN
    ALTER TABLE "skill_usage_records" ADD CONSTRAINT "skill_usage_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_scenarios_organization_id_organizations_id_fk') THEN
    ALTER TABLE "employee_scenarios" ADD CONSTRAINT "employee_scenarios_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
