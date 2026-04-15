CREATE TYPE "public"."research_media_outlet_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."research_media_tier" AS ENUM('central', 'provincial_municipal', 'industry', 'district_media');--> statement-breakpoint
CREATE TYPE "public"."research_news_source_channel" AS ENUM('tavily', 'whitelist_crawl', 'manual_url');--> statement-breakpoint
CREATE TYPE "public"."research_dedup_level" AS ENUM('keyword', 'district', 'both');--> statement-breakpoint
CREATE TYPE "public"."research_embedding_status" AS ENUM('pending', 'processing', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."research_task_status" AS ENUM('pending', 'crawling', 'analyzing', 'done', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."research_topic_match_type" AS ENUM('keyword', 'semantic', 'both');--> statement-breakpoint
CREATE TABLE "research_cq_districts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_cq_districts_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "research_media_outlet_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"match_pattern" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_media_outlet_crawl_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"list_url_template" text NOT NULL,
	"article_url_pattern" text,
	"schedule_cron" text DEFAULT '0 3 * * *' NOT NULL,
	"last_crawled_at" timestamp with time zone,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_media_outlet_crawl_configs_outlet_id_unique" UNIQUE("outlet_id")
);
--> statement-breakpoint
CREATE TABLE "research_media_outlets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"tier" "research_media_tier" NOT NULL,
	"province" text,
	"district_id" uuid,
	"industry_tag" text,
	"official_url" text,
	"status" "research_media_outlet_status" DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_topic_keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"keyword" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_topic_samples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"sample_text" text NOT NULL,
	"embedding" jsonb,
	"embedding_status" "research_embedding_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_preset" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"time_range_start" timestamp with time zone NOT NULL,
	"time_range_end" timestamp with time zone NOT NULL,
	"topic_ids" jsonb NOT NULL,
	"district_ids" jsonb NOT NULL,
	"media_tiers" jsonb NOT NULL,
	"custom_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"semantic_enabled" boolean DEFAULT true NOT NULL,
	"semantic_threshold" numeric(4, 3) DEFAULT '0.720' NOT NULL,
	"dedup_level" "research_dedup_level" DEFAULT 'district' NOT NULL,
	"status" "research_task_status" DEFAULT 'pending' NOT NULL,
	"progress" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result_summary" jsonb,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "research_news_article_topic_hits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"research_task_id" uuid NOT NULL,
	"match_type" "research_topic_match_type" NOT NULL,
	"matched_keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"matched_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"semantic_score" numeric(5, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_news_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"url_hash" text NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"html_snapshot_path" text,
	"published_at" timestamp with time zone,
	"outlet_id" uuid,
	"outlet_tier_snapshot" "research_media_tier",
	"district_id_snapshot" uuid,
	"source_channel" "research_news_source_channel" NOT NULL,
	"crawled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"embedding" jsonb,
	"embedding_status" "research_embedding_status" DEFAULT 'pending' NOT NULL,
	"raw_metadata" jsonb
);
--> statement-breakpoint
ALTER TABLE "research_media_outlet_aliases" ADD CONSTRAINT "research_media_outlet_aliases_outlet_id_research_media_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."research_media_outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_media_outlet_crawl_configs" ADD CONSTRAINT "research_media_outlet_crawl_configs_outlet_id_research_media_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."research_media_outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_media_outlets" ADD CONSTRAINT "research_media_outlets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_media_outlets" ADD CONSTRAINT "research_media_outlets_district_id_research_cq_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."research_cq_districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_topic_keywords" ADD CONSTRAINT "research_topic_keywords_topic_id_research_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."research_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_topic_samples" ADD CONSTRAINT "research_topic_samples_topic_id_research_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."research_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_topics" ADD CONSTRAINT "research_topics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_tasks" ADD CONSTRAINT "research_tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_news_article_topic_hits" ADD CONSTRAINT "research_news_article_topic_hits_article_id_research_news_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."research_news_articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_news_article_topic_hits" ADD CONSTRAINT "research_news_article_topic_hits_topic_id_research_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."research_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_news_article_topic_hits" ADD CONSTRAINT "research_news_article_topic_hits_research_task_id_research_tasks_id_fk" FOREIGN KEY ("research_task_id") REFERENCES "public"."research_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_news_articles" ADD CONSTRAINT "research_news_articles_outlet_id_research_media_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."research_media_outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_news_articles" ADD CONSTRAINT "research_news_articles_district_id_snapshot_research_cq_districts_id_fk" FOREIGN KEY ("district_id_snapshot") REFERENCES "public"."research_cq_districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "research_media_outlet_aliases_outlet_idx" ON "research_media_outlet_aliases" USING btree ("outlet_id");--> statement-breakpoint
CREATE INDEX "research_media_outlet_aliases_pattern_idx" ON "research_media_outlet_aliases" USING btree ("match_pattern");--> statement-breakpoint
CREATE UNIQUE INDEX "research_media_outlets_org_name_tier_uq" ON "research_media_outlets" USING btree ("organization_id","name","tier");--> statement-breakpoint
CREATE INDEX "research_media_outlets_tier_idx" ON "research_media_outlets" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "research_media_outlets_district_idx" ON "research_media_outlets" USING btree ("district_id");--> statement-breakpoint
CREATE UNIQUE INDEX "research_topic_keywords_topic_kw_uq" ON "research_topic_keywords" USING btree ("topic_id","keyword");--> statement-breakpoint
CREATE INDEX "research_topic_samples_topic_idx" ON "research_topic_samples" USING btree ("topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "research_topics_org_name_uq" ON "research_topics" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "research_tasks_org_user_idx" ON "research_tasks" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "research_tasks_status_idx" ON "research_tasks" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "research_news_article_topic_hits_uq" ON "research_news_article_topic_hits" USING btree ("article_id","topic_id","research_task_id");--> statement-breakpoint
CREATE INDEX "research_news_article_topic_hits_task_topic_idx" ON "research_news_article_topic_hits" USING btree ("research_task_id","topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "research_news_articles_url_hash_uq" ON "research_news_articles" USING btree ("url_hash");--> statement-breakpoint
CREATE INDEX "research_news_articles_outlet_published_idx" ON "research_news_articles" USING btree ("outlet_id","published_at");--> statement-breakpoint
CREATE INDEX "research_news_articles_district_published_idx" ON "research_news_articles" USING btree ("district_id_snapshot","published_at");--> statement-breakpoint
CREATE INDEX "research_news_articles_embedding_status_idx" ON "research_news_articles" USING btree ("embedding_status");