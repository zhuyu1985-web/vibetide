DO $$ BEGIN CREATE TYPE "public"."calendar_event_type" AS ENUM('festival', 'competition', 'conference', 'exhibition', 'launch', 'memorial'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."calendar_recurrence" AS ENUM('once', 'yearly', 'custom'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."calendar_source" AS ENUM('builtin', 'manual', 'ai_discovered'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."calendar_status" AS ENUM('confirmed', 'pending_review'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"event_type" "calendar_event_type" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"is_all_day" boolean DEFAULT true NOT NULL,
	"recurrence" "calendar_recurrence" DEFAULT 'once' NOT NULL,
	"source" "calendar_source" NOT NULL,
	"status" "calendar_status" DEFAULT 'confirmed' NOT NULL,
	"ai_angles" jsonb DEFAULT '[]'::jsonb,
	"reminder_days_before" integer DEFAULT 3 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_topic_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"subscribed_categories" jsonb DEFAULT '[]'::jsonb,
	"subscribed_event_types" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_topic_subscriptions_user_id_organization_id_unique" UNIQUE("user_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_topic_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"last_viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_topic_ids" jsonb DEFAULT '[]'::jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_topic_reads_user_id_organization_id_unique" UNIQUE("user_id","organization_id")
);
--> statement-breakpoint
ALTER TABLE "hot_topics" ADD COLUMN IF NOT EXISTS "enriched_outlines" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "hot_topics" ADD COLUMN IF NOT EXISTS "related_materials" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_created_by_user_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "user_topic_subscriptions" ADD CONSTRAINT "user_topic_subscriptions_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "user_topic_subscriptions" ADD CONSTRAINT "user_topic_subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "user_topic_reads" ADD CONSTRAINT "user_topic_reads_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "user_topic_reads" ADD CONSTRAINT "user_topic_reads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
