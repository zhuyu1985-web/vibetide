ALTER TABLE "research_media_outlet_aliases" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "research_media_outlet_crawl_configs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "research_media_outlets" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "research_media_outlet_aliases" CASCADE;--> statement-breakpoint
DROP TABLE "research_media_outlet_crawl_configs" CASCADE;--> statement-breakpoint
DROP TABLE "research_media_outlets" CASCADE;--> statement-breakpoint
ALTER TABLE "research_news_articles" DROP CONSTRAINT "research_news_articles_outlet_id_research_media_outlets_id_fk";
--> statement-breakpoint
DROP INDEX "research_news_articles_outlet_published_idx";--> statement-breakpoint
ALTER TABLE "research_news_articles" DROP COLUMN "outlet_id";--> statement-breakpoint
ALTER TABLE "research_news_articles" DROP COLUMN "outlet_tier_snapshot";--> statement-breakpoint
DROP TYPE "public"."research_media_outlet_status";--> statement-breakpoint
DROP TYPE "public"."research_media_tier";