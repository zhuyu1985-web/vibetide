import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "./users";

// ---------------------------------------------------------------------------
// mcp_servers — 外部 MCP-http 服务器配置（按 org 隔离）
// ---------------------------------------------------------------------------

export const mcpServers = pgTable("mcp_servers", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  url: text("url").notNull(),
  encryptedHeaders: text("encrypted_headers"),
  defaultToolClass: text("default_tool_class").notNull().default("write"), // 'read' | 'write'
  connectTimeoutMs: integer("connect_timeout_ms").notNull().default(8000),
  enabled: integer("enabled").notNull().default(1),
  lastConnectedAt: timestamp("last_connected_at", { withTimezone: true }),
  lastError: text("last_error"),
  toolCount: integer("tool_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (t) => [
  uniqueIndex("mcp_servers_org_name_uidx").on(t.organizationId, t.slug),
]);
