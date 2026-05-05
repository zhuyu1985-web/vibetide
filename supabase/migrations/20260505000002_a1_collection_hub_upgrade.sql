CREATE TABLE "media_outlet_dictionary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"outlet_name" text NOT NULL,
	"outlet_tier" text NOT NULL,
	"outlet_region" text,
	"outlet_district" text,
	"industry_tag" text,
	"domains" text[],
	"public_account_names" text[],
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_outlet_dictionary_org_name_unique" UNIQUE("organization_id","outlet_name")
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "media_outlet_dictionary_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "collected_items" ADD COLUMN "content_type" text DEFAULT 'image_text' NOT NULL;--> statement-breakpoint
ALTER TABLE "collected_items" ADD COLUMN "attachments" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "collected_items" ADD COLUMN "outlet_id" uuid;--> statement-breakpoint
ALTER TABLE "collected_items" ADD COLUMN "outlet_tier" text;--> statement-breakpoint
ALTER TABLE "collected_items" ADD COLUMN "outlet_region" text;--> statement-breakpoint
ALTER TABLE "collection_sources" ADD COLUMN "outlet_id" uuid;--> statement-breakpoint
ALTER TABLE "collection_sources" ADD COLUMN "default_outlet_tier" text;--> statement-breakpoint
ALTER TABLE "collection_sources" ADD COLUMN "default_outlet_region" text;--> statement-breakpoint
ALTER TABLE "media_outlet_dictionary" ADD CONSTRAINT "media_outlet_dictionary_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_outlet_dictionary_tier_idx" ON "media_outlet_dictionary" USING btree ("organization_id","outlet_tier","is_active");--> statement-breakpoint
CREATE INDEX "media_outlet_dictionary_region_idx" ON "media_outlet_dictionary" USING btree ("organization_id","outlet_region");--> statement-breakpoint
CREATE INDEX "media_outlet_dictionary_domains_gin" ON "media_outlet_dictionary" USING gin ("domains");--> statement-breakpoint
CREATE INDEX "media_outlet_dictionary_pa_gin" ON "media_outlet_dictionary" USING gin ("public_account_names");--> statement-breakpoint
CREATE INDEX "collected_items_content_type_idx" ON "collected_items" USING btree ("organization_id","content_type");--> statement-breakpoint
CREATE INDEX "collected_items_outlet_tier_idx" ON "collected_items" USING btree ("organization_id","outlet_tier");--> statement-breakpoint
CREATE INDEX "collected_items_outlet_id_idx" ON "collected_items" USING btree ("outlet_id");

-- A1 手工追加：outletId 外键（schema 故意省略 .references() 避免循环依赖）
ALTER TABLE collected_items
  ADD CONSTRAINT collected_items_outlet_id_fk
  FOREIGN KEY (outlet_id) REFERENCES media_outlet_dictionary(id) ON DELETE SET NULL;

ALTER TABLE collection_sources
  ADD CONSTRAINT collection_sources_outlet_id_fk
  FOREIGN KEY (outlet_id) REFERENCES media_outlet_dictionary(id) ON DELETE SET NULL;