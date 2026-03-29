-- Add source tracking columns to missions (idempotent)
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "source_module" text;
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "source_entity_id" text;
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "source_entity_type" text;
