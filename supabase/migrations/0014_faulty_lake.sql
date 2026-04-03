CREATE TYPE "public"."ai_analysis_perspective" AS ENUM('summary', 'journalist', 'quotes', 'timeline', 'qa', 'deep');--> statement-breakpoint
CREATE TYPE "public"."ai_sentiment" AS ENUM('neutral', 'bullish', 'critical', 'advertorial');--> statement-breakpoint
CREATE TYPE "public"."annotation_color" AS ENUM('red', 'yellow', 'green', 'blue', 'purple');--> statement-breakpoint
CREATE TYPE "public"."category_permission_type" AS ENUM('read', 'write', 'manage');--> statement-breakpoint
CREATE TYPE "public"."library_type" AS ENUM('personal', 'product', 'public');--> statement-breakpoint
CREATE TYPE "public"."media_catalog_status" AS ENUM('uncataloged', 'cataloged');--> statement-breakpoint
CREATE TYPE "public"."media_cdn_status" AS ENUM('not_started', 'processing', 'completed', 'failed', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."media_cms_status" AS ENUM('not_started', 'processing', 'completed', 'failed', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."media_review_status" AS ENUM('not_submitted', 'pending', 'reviewing', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."media_transcode_status" AS ENUM('not_started', 'processing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."permission_grantee_type" AS ENUM('user', 'role');--> statement-breakpoint
CREATE TYPE "public"."security_level" AS ENUM('public', 'secret', 'private', 'top_secret', 'confidential');--> statement-breakpoint
CREATE TYPE "public"."share_status" AS ENUM('active', 'expired', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."media_asset_type" ADD VALUE 'manuscript';--> statement-breakpoint
CREATE TABLE "article_annotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"quote" text NOT NULL,
	"note" text,
	"color" "annotation_color" DEFAULT 'yellow' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"timecode" numeric,
	"frame_snapshot" text,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"pinned_position" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_ai_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"perspective" "ai_analysis_perspective" NOT NULL,
	"analysis_text" text NOT NULL,
	"sentiment" "ai_sentiment",
	"metadata" jsonb,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_ai_analysis_unique" UNIQUE("article_id","perspective")
);
--> statement-breakpoint
CREATE TABLE "article_chat_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(10) NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_asset_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"asset_ids" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"share_token" text NOT NULL,
	"password" text,
	"expires_at" timestamp with time zone,
	"max_access_count" integer,
	"current_access_count" integer DEFAULT 0 NOT NULL,
	"allow_download" boolean DEFAULT true NOT NULL,
	"status" "share_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_asset_shares_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "category_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"grantee_type" "permission_grantee_type" NOT NULL,
	"grantee_id" text NOT NULL,
	"permission_type" "category_permission_type" NOT NULL,
	"inherited" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intent_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"employee_slug" text NOT NULL,
	"user_message" text NOT NULL,
	"intent_type" text NOT NULL,
	"intent_result" jsonb NOT NULL,
	"user_edited" boolean DEFAULT false NOT NULL,
	"edited_intent" jsonb,
	"execution_success" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "scope" text DEFAULT 'article' NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "workflow_id" uuid;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "video_transcode_group" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "audio_transcode_group" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "catalog_template_id" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "width" integer;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "height" integer;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "tos_object_key" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "tos_bucket" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "library_type" "library_type" DEFAULT 'personal' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "original_category_id" uuid;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "security_level" "security_level" DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "review_status" "media_review_status" DEFAULT 'not_submitted' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "catalog_status" "media_catalog_status" DEFAULT 'uncataloged' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "transcode_status" "media_transcode_status" DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "cdn_status" "media_cdn_status" DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "cms_status" "media_cms_status" DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "version_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "parent_version_id" uuid;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "catalog_data" jsonb;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "web_archive_html" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "web_archive_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "read_progress" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "transcript" jsonb;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "chapters" jsonb;--> statement-breakpoint
ALTER TABLE "article_annotations" ADD CONSTRAINT "article_annotations_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_ai_analysis" ADD CONSTRAINT "article_ai_analysis_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_chat_history" ADD CONSTRAINT "article_chat_history_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_asset_shares" ADD CONSTRAINT "media_asset_shares_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_asset_shares" ADD CONSTRAINT "media_asset_shares_created_by_user_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_permissions" ADD CONSTRAINT "category_permissions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_permissions" ADD CONSTRAINT "category_permissions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_permissions" ADD CONSTRAINT "category_permissions_created_by_user_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intent_logs" ADD CONSTRAINT "intent_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intent_logs" ADD CONSTRAINT "intent_logs_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_category_permission" ON "category_permissions" USING btree ("category_id","grantee_type","grantee_id","permission_type");--> statement-breakpoint
CREATE INDEX "idx_intent_logs_user" ON "intent_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_intent_logs_org" ON "intent_logs" USING btree ("organization_id","created_at");--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_deleted_by_user_profiles_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_parent_version_id_media_assets_id_fk" FOREIGN KEY ("parent_version_id") REFERENCES "public"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hot_topics_org_title_hash_uniq" ON "hot_topics" USING btree ("organization_id","title_hash");