CREATE TABLE "article_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"version_no" integer NOT NULL,
	"language" text DEFAULT 'zh' NOT NULL,
	"title" text,
	"body" text,
	"summary" text,
	"word_count" integer DEFAULT 0,
	"change_kind" text NOT NULL,
	"change_instruction" text,
	"review_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_results" ALTER COLUMN "reviewer_employee_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "translated_from_article_id" uuid;--> statement-breakpoint
ALTER TABLE "review_results" ADD COLUMN "assignee_user_id" uuid;--> statement-breakpoint
ALTER TABLE "review_results" ADD COLUMN "author_user_id" uuid;--> statement-breakpoint
ALTER TABLE "review_results" ADD COLUMN "im_thread" jsonb;--> statement-breakpoint
ALTER TABLE "review_results" ADD COLUMN "decision" text;--> statement-breakpoint
ALTER TABLE "review_results" ADD COLUMN "decision_reason" text;--> statement-breakpoint
ALTER TABLE "review_results" ADD COLUMN "decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "review_results" ADD COLUMN "decision_turns" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "channel_sessions" ADD COLUMN "pending_plan" jsonb;--> statement-breakpoint
ALTER TABLE "channel_sessions" ADD COLUMN "last_article_id" uuid;--> statement-breakpoint
ALTER TABLE "channel_sessions" ADD COLUMN "pending_publish" jsonb;--> statement-breakpoint
ALTER TABLE "channel_sessions" ADD COLUMN "scenario_phase" text DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE "channel_sessions" ADD COLUMN "active_topic_id" uuid;--> statement-breakpoint
ALTER TABLE "channel_sessions" ADD COLUMN "loop_context" jsonb;--> statement-breakpoint
ALTER TABLE "article_versions" ADD CONSTRAINT "article_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_versions" ADD CONSTRAINT "article_versions_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_versions" ADD CONSTRAINT "article_versions_created_by_user_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_article_versions_article" ON "article_versions" USING btree ("article_id","version_no");--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_translated_from_article_id_articles_id_fk" FOREIGN KEY ("translated_from_article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_results" ADD CONSTRAINT "review_results_assignee_user_id_user_profiles_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_results" ADD CONSTRAINT "review_results_author_user_id_user_profiles_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_sessions" ADD CONSTRAINT "channel_sessions_last_article_id_articles_id_fk" FOREIGN KEY ("last_article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_sessions" ADD CONSTRAINT "channel_sessions_active_topic_id_hot_topics_id_fk" FOREIGN KEY ("active_topic_id") REFERENCES "public"."hot_topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_articles_mission_id" ON "articles" USING btree ("mission_id");