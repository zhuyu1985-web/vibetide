CREATE TYPE "public"."skill_kind" AS ENUM('tool', 'skill');--> statement-breakpoint
CREATE TABLE "domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"prompt_guidance" text,
	"authority_sources" jsonb DEFAULT '[]'::jsonb,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"config_id" uuid NOT NULL,
	"platform" "channel_platform" NOT NULL,
	"chat_id" text NOT NULL,
	"external_user_id" text NOT NULL,
	"status" text DEFAULT 'idle' NOT NULL,
	"context_turns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active_mission_id" uuid,
	"clarify_rounds" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_sessions_triple_uidx" UNIQUE("config_id","chat_id","external_user_id")
);
--> statement-breakpoint
ALTER TABLE "ai_employees" ADD COLUMN "instance_config" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "ai_employees" ADD COLUMN "domain_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_employees" ADD COLUMN "hidden" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "kind" "skill_kind" DEFAULT 'skill' NOT NULL;--> statement-breakpoint
ALTER TABLE "mission_tasks" ADD COLUMN "domain_fallback" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow_templates" ADD COLUMN "default_domain_id" uuid;--> statement-breakpoint
ALTER TABLE "channel_configs" ADD COLUMN "inbound_secret" text;--> statement-breakpoint
ALTER TABLE "channel_configs" ADD COLUMN "client_id" text;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_sessions" ADD CONSTRAINT "channel_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_sessions" ADD CONSTRAINT "channel_sessions_config_id_channel_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."channel_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_sessions" ADD CONSTRAINT "channel_sessions_active_mission_id_missions_id_fk" FOREIGN KEY ("active_mission_id") REFERENCES "public"."missions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "domains_org_slug_uidx" ON "domains" USING btree ("organization_id","slug");--> statement-breakpoint
ALTER TABLE "ai_employees" ADD CONSTRAINT "ai_employees_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_templates" ADD CONSTRAINT "workflow_templates_default_domain_id_domains_id_fk" FOREIGN KEY ("default_domain_id") REFERENCES "public"."domains"("id") ON DELETE no action ON UPDATE no action;