CREATE TABLE "mcp_servers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"url" text NOT NULL,
	"encrypted_headers" text,
	"default_tool_class" text DEFAULT 'write' NOT NULL,
	"connect_timeout_ms" integer DEFAULT 8000 NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"last_connected_at" timestamp with time zone,
	"last_error" text,
	"tool_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_servers_org_name_uidx" ON "mcp_servers" USING btree ("organization_id","slug");