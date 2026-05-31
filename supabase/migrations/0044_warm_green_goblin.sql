CREATE TABLE "help_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doc_path" text NOT NULL,
	"helpful" boolean NOT NULL,
	"comment" text,
	"user_agent" text,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_help_feedback_doc" ON "help_feedback" USING btree ("doc_path");--> statement-breakpoint
CREATE INDEX "idx_help_feedback_created" ON "help_feedback" USING btree ("created_at");