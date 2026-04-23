CREATE TABLE "workflow_template_tab_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"tab_key" text NOT NULL,
	"template_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"pinned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow_template_tab_order" ADD CONSTRAINT "workflow_template_tab_order_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_template_tab_order" ADD CONSTRAINT "workflow_template_tab_order_template_id_workflow_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workflow_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_template_tab_order_org_tab_template_uidx" ON "workflow_template_tab_order" USING btree ("organization_id","tab_key","template_id");--> statement-breakpoint
CREATE INDEX "idx_homepage_order_org_tab" ON "workflow_template_tab_order" USING btree ("organization_id","tab_key");
