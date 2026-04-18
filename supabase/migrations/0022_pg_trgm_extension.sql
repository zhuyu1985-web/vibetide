-- Enable pg_trgm extension for trigram GIN indexes used by Collection Hub FTS.
-- Must run before any migration that creates trigram indexes on collected_items.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
