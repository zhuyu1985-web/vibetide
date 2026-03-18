CREATE TABLE "skill_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skill_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"file_type" text NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skill_files_skill_id_file_path_unique" UNIQUE("skill_id","file_path")
);
--> statement-breakpoint
ALTER TABLE "skill_files" ADD CONSTRAINT "skill_files_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_files" ADD CONSTRAINT "skill_files_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;