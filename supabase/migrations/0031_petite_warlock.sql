ALTER TYPE "public"."research_media_tier" ADD VALUE IF NOT EXISTS 'self_media';--> statement-breakpoint
ALTER TYPE "public"."research_news_source_channel" ADD VALUE IF NOT EXISTS 'hot_topic_crawler';--> statement-breakpoint
ALTER TABLE "research_news_articles" ADD COLUMN IF NOT EXISTS "content_fetch_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
-- Already-fetched rows (Tavily/whitelist/manual) mark as done so content-fetch 异步链路跳过它们
UPDATE "research_news_articles" SET "content_fetch_status" = 'done' WHERE "content" IS NOT NULL AND "content_fetch_status" = 'pending';--> statement-breakpoint
ALTER TABLE "collection_sources" ADD COLUMN IF NOT EXISTS "research_bridge_enabled" boolean DEFAULT false NOT NULL;