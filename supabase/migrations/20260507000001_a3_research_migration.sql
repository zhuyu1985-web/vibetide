-- A3 Phase 1: DROP research_news_articles + research_news_article_topic_hits
-- CREATE research_collected_item_topics + research_collected_item_districts
-- DROP research_news_source_channel enum

-- Step 1: Drop dependent table first (FK from topic_hits → news_articles)
DROP TABLE IF EXISTS "research_news_article_topic_hits" CASCADE;

-- Step 2: Drop main table
DROP TABLE IF EXISTS "research_news_articles" CASCADE;

-- Step 3: Drop the enum (no longer referenced after table drop)
DROP TYPE IF EXISTS "research_news_source_channel" CASCADE;

-- Step 4: Create annotation table — collected_items ↔ research topics
CREATE TABLE "research_collected_item_topics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "collected_item_id" uuid NOT NULL REFERENCES "collected_items"("id") ON DELETE CASCADE,
  "topic_id" uuid NOT NULL REFERENCES "research_topics"("id") ON DELETE CASCADE,
  "match_type" "research_topic_match_type" NOT NULL,
  "matched_keyword" text,
  "match_score" numeric(5, 4),
  "annotated_by" text NOT NULL DEFAULT 'system',
  "annotated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "research_cit_unique" ON "research_collected_item_topics" ("collected_item_id", "topic_id", "match_type");
CREATE INDEX "research_cit_item_idx" ON "research_collected_item_topics" ("collected_item_id");
CREATE INDEX "research_cit_topic_idx" ON "research_collected_item_topics" ("topic_id");

-- Step 5: Create annotation table — collected_items ↔ cq districts
CREATE TABLE "research_collected_item_districts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "collected_item_id" uuid NOT NULL REFERENCES "collected_items"("id") ON DELETE CASCADE,
  "district_id" uuid NOT NULL REFERENCES "research_cq_districts"("id") ON DELETE CASCADE,
  "match_type" "research_topic_match_type" NOT NULL,
  "matched_keyword" text,
  "annotated_by" text NOT NULL DEFAULT 'system',
  "annotated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "research_cid_unique" ON "research_collected_item_districts" ("collected_item_id", "district_id");
CREATE INDEX "research_cid_item_idx" ON "research_collected_item_districts" ("collected_item_id");
CREATE INDEX "research_cid_district_idx" ON "research_collected_item_districts" ("district_id");
