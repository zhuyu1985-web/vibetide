CREATE TYPE "public"."missed_topic_source_type" AS ENUM('social_hot', 'sentiment_event', 'benchmark_media');--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "publish_channels" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "spread_data" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "benchmark_analyses" ADD COLUMN "ai_summary" jsonb;--> statement-breakpoint
ALTER TABLE "benchmark_analyses" ADD COLUMN "source_article_id" uuid;--> statement-breakpoint
ALTER TABLE "missed_topics" ADD COLUMN "source_type" "missed_topic_source_type" DEFAULT 'social_hot';--> statement-breakpoint
ALTER TABLE "missed_topics" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "missed_topics" ADD COLUMN "source_platform" text;--> statement-breakpoint
ALTER TABLE "missed_topics" ADD COLUMN "matched_article_id" uuid;--> statement-breakpoint
ALTER TABLE "missed_topics" ADD COLUMN "ai_summary" jsonb;--> statement-breakpoint
ALTER TABLE "missed_topics" ADD COLUMN "pushed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "missed_topics" ADD COLUMN "pushed_to_system" text;--> statement-breakpoint
ALTER TABLE "platform_content" ADD COLUMN "ai_interpretation" text;--> statement-breakpoint
ALTER TABLE "benchmark_analyses" ADD CONSTRAINT "benchmark_analyses_source_article_id_articles_id_fk" FOREIGN KEY ("source_article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missed_topics" ADD CONSTRAINT "missed_topics_matched_article_id_articles_id_fk" FOREIGN KEY ("matched_article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;