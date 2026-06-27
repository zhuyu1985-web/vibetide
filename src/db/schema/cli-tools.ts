import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "./users";

// ---------------------------------------------------------------------------
// cli_tools — 外部 CLI 工具配置（按 org 隔离）
// ---------------------------------------------------------------------------

export const cliTools = pgTable("cli_tools", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description").notNull(),
  command: text("command").notNull(),                  // ∈ CLI_ALLOWED_BINARIES
  argsSchema: jsonb("args_schema").notNull(),           // { field: {type,enum?,min?,max?,regex?,required?} }
  argvTemplate: jsonb("argv_template").notNull(),        // token[]：string | {param} | {output}
  executionMode: text("execution_mode").notNull().default("async"), // 'sync'|'async'
  syncTimeoutMs: integer("sync_timeout_ms").notNull().default(20000),
  outputKind: text("output_kind").notNull().default("media_asset"), // 'media_asset'|'text'
  toolClass: text("tool_class").notNull().default("write"),
  enabled: integer("enabled").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (t) => [
  uniqueIndex("cli_tools_org_slug_uidx").on(t.organizationId, t.slug),
]);

// ---------------------------------------------------------------------------
// cli_tool_runs — CLI 工具执行记录
// ---------------------------------------------------------------------------

export const cliToolRuns = pgTable("cli_tool_runs", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  cliToolId: uuid("cli_tool_id")
    .notNull()
    .references(() => cliTools.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("queued"),  // queued|processing|done|failed
  inputAssetId: uuid("input_asset_id"),
  outputAssetId: uuid("output_asset_id"),
  argvResolved: jsonb("argv_resolved"),
  exitCode: integer("exit_code"),
  errorMessage: text("error_message"),
  stderrTail: text("stderr_tail"),
  missionId: uuid("mission_id"),
  taskId: uuid("task_id"),
  conversationId: uuid("conversation_id"),
  jobId: text("job_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
}, (t) => [
  index("cli_tool_runs_org_tool_idx").on(t.organizationId, t.cliToolId),
  index("cli_tool_runs_job_idx").on(t.jobId),
]);
