CREATE TYPE "public"."scheduled_job_kind" AS ENUM('platform', 'workflow_template');--> statement-breakpoint
ALTER TABLE "scheduled_jobs" ADD COLUMN "kind" "scheduled_job_kind" DEFAULT 'platform' NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_jobs" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "scheduled_jobs" ADD COLUMN "workflow_template_id" uuid;--> statement-breakpoint
ALTER TABLE "scheduled_jobs" ADD COLUMN "payload" jsonb;--> statement-breakpoint
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_workflow_template_id_workflow_templates_id_fk" FOREIGN KEY ("workflow_template_id") REFERENCES "public"."workflow_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scheduled_jobs_org_kind_template_idx" ON "scheduled_jobs" USING btree ("organization_id","kind","workflow_template_id","enabled");