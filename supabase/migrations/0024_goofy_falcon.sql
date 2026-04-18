DROP INDEX "collected_items_url_hash_idx";--> statement-breakpoint
CREATE INDEX "collection_sources_cron_idx" ON "collection_sources" USING btree ("schedule_cron") WHERE enabled = true;--> statement-breakpoint
CREATE INDEX "collected_items_url_hash_idx" ON "collected_items" USING btree ("canonical_url_hash") WHERE canonical_url_hash IS NOT NULL;