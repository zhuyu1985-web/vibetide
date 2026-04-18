CREATE TYPE "public"."channel_message_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."channel_message_status" AS ENUM('received', 'processed', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."channel_platform" AS ENUM('dingtalk', 'wechat_work');--> statement-breakpoint
CREATE TABLE "channel_configs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"platform" "channel_platform" NOT NULL,
	"name" text NOT NULL,
	"app_key" text,
	"app_secret" text,
	"robot_secret" text,
	"agent_id" text,
	"token" text,
	"encoding_aes_key" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"config_id" uuid NOT NULL,
	"platform" "channel_platform" NOT NULL,
	"direction" "channel_message_direction" NOT NULL,
	"external_message_id" text,
	"external_user_id" text,
	"chat_id" text,
	"content" jsonb NOT NULL,
	"mission_id" uuid,
	"status" "channel_message_status" DEFAULT 'received' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collected_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"content_fingerprint" text NOT NULL,
	"canonical_url" text,
	"canonical_url_hash" text,
	"title" text NOT NULL,
	"content" text,
	"summary" text,
	"published_at" timestamp with time zone,
	"first_seen_source_id" uuid,
	"first_seen_channel" text NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"source_channels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"category" text,
	"tags" text[],
	"language" text,
	"derived_modules" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"raw_metadata" jsonb,
	"enrichment_status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collected_items_org_fp_unique" UNIQUE("organization_id","content_fingerprint")
);
--> statement-breakpoint
CREATE TABLE "collection_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"level" text NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"trigger" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text NOT NULL,
	"items_attempted" integer DEFAULT 0 NOT NULL,
	"items_inserted" integer DEFAULT 0 NOT NULL,
	"items_merged" integer DEFAULT 0 NOT NULL,
	"items_failed" integer DEFAULT 0 NOT NULL,
	"error_summary" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "collection_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"source_type" text NOT NULL,
	"config" jsonb NOT NULL,
	"schedule_cron" text,
	"schedule_min_interval_seconds" integer,
	"target_modules" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"default_category" text,
	"default_tags" text[],
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_run_status" text,
	"total_items_collected" bigint DEFAULT 0 NOT NULL,
	"total_runs" bigint DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "collection_sources_org_name_unique" UNIQUE("organization_id","name")
);
--> statement-breakpoint
ALTER TABLE "channel_configs" ADD CONSTRAINT "channel_configs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_messages" ADD CONSTRAINT "channel_messages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_messages" ADD CONSTRAINT "channel_messages_config_id_channel_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."channel_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_messages" ADD CONSTRAINT "channel_messages_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collected_items" ADD CONSTRAINT "collected_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collected_items" ADD CONSTRAINT "collected_items_first_seen_source_id_collection_sources_id_fk" FOREIGN KEY ("first_seen_source_id") REFERENCES "public"."collection_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_logs" ADD CONSTRAINT "collection_logs_run_id_collection_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."collection_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_logs" ADD CONSTRAINT "collection_logs_source_id_collection_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."collection_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_runs" ADD CONSTRAINT "collection_runs_source_id_collection_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."collection_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_runs" ADD CONSTRAINT "collection_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_sources" ADD CONSTRAINT "collection_sources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_sources" ADD CONSTRAINT "collection_sources_created_by_user_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collected_items_org_pub_idx" ON "collected_items" USING btree ("organization_id","published_at");--> statement-breakpoint
CREATE INDEX "collected_items_url_hash_idx" ON "collected_items" USING btree ("canonical_url_hash");--> statement-breakpoint
CREATE INDEX "collected_items_org_category_idx" ON "collected_items" USING btree ("organization_id","category");--> statement-breakpoint
CREATE INDEX "collected_items_tags_gin" ON "collected_items" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "collected_items_derived_gin" ON "collected_items" USING gin ("derived_modules");--> statement-breakpoint
CREATE INDEX "collected_items_title_trgm" ON "collected_items" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "collected_items_content_trgm" ON "collected_items" USING gin ("content" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "collection_logs_run_logged_idx" ON "collection_logs" USING btree ("run_id","logged_at");--> statement-breakpoint
CREATE INDEX "collection_runs_source_started_idx" ON "collection_runs" USING btree ("source_id","started_at");--> statement-breakpoint
CREATE INDEX "collection_sources_org_enabled_idx" ON "collection_sources" USING btree ("organization_id","enabled");