CREATE TYPE "public"."scope_unit_tier" AS ENUM('central', 'industry', 'municipal', 'district_rmt', 'district_gov');--> statement-breakpoint
CREATE TABLE "research_media_scope_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_id" uuid NOT NULL,
	"name" text NOT NULL,
	"display_name" text,
	"tier" "scope_unit_tier" NOT NULL,
	"district_normalized" text,
	"district_orig" text,
	"websites" text[] DEFAULT '{}'::text[] NOT NULL,
	"wechat_names" text[] DEFAULT '{}'::text[] NOT NULL,
	"wechat_ghid" text,
	"weibo_uid" text,
	"weibo_handle" text,
	"douyin_url" text,
	"kuaishou_url" text,
	"xlsx_row" integer NOT NULL,
	"resolved_outlet_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"matched_item_count_2025" integer DEFAULT 0,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "research_media_scopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source_file_name" text,
	"source_file_url" text,
	"total_units" integer NOT NULL,
	"central_count" integer DEFAULT 0 NOT NULL,
	"industry_count" integer DEFAULT 0 NOT NULL,
	"municipal_count" integer DEFAULT 0 NOT NULL,
	"district_rmt_count" integer DEFAULT 0 NOT NULL,
	"district_gov_count" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_activity_datasets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"year" integer NOT NULL,
	"source_file_name" text,
	"source_file_url" text,
	"district_count" integer NOT NULL,
	"total_activities" integer NOT NULL,
	"activity_themes" text[] NOT NULL,
	"data" jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "research_reports" ADD COLUMN "content_source_file_urls" jsonb;--> statement-breakpoint
ALTER TABLE "research_media_scope_units" ADD CONSTRAINT "research_media_scope_units_scope_id_research_media_scopes_id_fk" FOREIGN KEY ("scope_id") REFERENCES "public"."research_media_scopes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_media_scopes" ADD CONSTRAINT "research_media_scopes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_media_scopes" ADD CONSTRAINT "research_media_scopes_created_by_user_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_activity_datasets" ADD CONSTRAINT "research_activity_datasets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_activity_datasets" ADD CONSTRAINT "research_activity_datasets_created_by_user_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "research_media_scope_units_scope_idx" ON "research_media_scope_units" USING btree ("scope_id","tier");--> statement-breakpoint
CREATE UNIQUE INDEX "research_media_scope_units_scope_row_uniq" ON "research_media_scope_units" USING btree ("scope_id","xlsx_row");--> statement-breakpoint
CREATE INDEX "research_media_scopes_org_idx" ON "research_media_scopes" USING btree ("organization_id","is_default");--> statement-breakpoint
CREATE UNIQUE INDEX "research_media_scopes_org_name_uniq" ON "research_media_scopes" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "research_activity_datasets_org_year_idx" ON "research_activity_datasets" USING btree ("organization_id","year","is_default");--> statement-breakpoint
CREATE UNIQUE INDEX "research_activity_datasets_org_name_uniq" ON "research_activity_datasets" USING btree ("organization_id","name");