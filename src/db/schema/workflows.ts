import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { organizations } from "./users";
import { aiEmployees } from "./ai-employees";
import { missions } from "./missions";
import { domains } from "./domains";
import {
  artifactTypeEnum,
  workflowCategoryEnum,
  workflowTriggerTypeEnum,
} from "./enums";
import type { InputFieldDef } from "@/lib/types";

// ─── Workflow Step Definition ───

export interface WorkflowStepDef {
  id: string;
  order: number;
  dependsOn: string[];
  name: string;
  type: "skill" | "output";
  config: {
    skillSlug?: string;
    skillName?: string;
    skillCategory?: string;
    /**
     * 四层重构 (2026-06):步骤声明"需要哪个技能",派单据此按 skill.compatibleRoles
     * 解析出工种并确定性匹配员工实例(取代 employeeSlug 指定人)。语义等同 skillSlug,
     * 优先读 requiredSkill,回退 skillSlug。
     */
    requiredSkill?: string;
    /**
     * 当某技能被多个工种共享时,显式指定派给哪个工种(craft slug,见 CRAFT_META)。
     * 留空则由派单逻辑按默认班子/熟练度/领域 tie-break。
     */
    requiredCraft?: string;
    /**
     * 领域一等维度（P2）：节点级领域覆盖。空 = 继承场景默认 defaultDomainId。
     * 解析（节点>场景>空）见 resolveStepDomainId；pickEmployeeForStep 据此缩领域。
     */
    domainId?: string | null;
    outputAction?: string;
    parameters: Record<string, any>;
    description?: string;
    /** @deprecated kept for backward compat with old data */
    employeeSlug?: string;
    toolId?: string;
  };
  // Backward compat with old seed format
  key?: string;
  label?: string;
  /** @deprecated use config.skillSlug */
  employeeSlug?: string;
}

// ─── Workflow Templates (kept for leader reference during task decomposition) ───

export const workflowTemplates = pgTable("workflow_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id),

  name: text("name").notNull(),
  description: text("description"),
  steps: jsonb("steps").$type<WorkflowStepDef[]>().notNull(),

  category: workflowCategoryEnum("category").default("custom"),
  triggerType: workflowTriggerTypeEnum("trigger_type").default("manual"),
  /**
   * @deprecated 2026-05-29 — scheduled trigger 已迁到 scheduled_jobs 表
   * (kind='workflow_template', 一个模板可挂 0..N 条独立 schedule)。
   * 新代码不要读写此字段;UI 也不暴露编辑。列保留仅为向后兼容,后续单独 change 清理。
   */
  triggerConfig: jsonb("trigger_config").$type<{
    cron?: string;
    timezone?: string;
  } | null>(),
  isBuiltin: boolean("is_builtin").notNull().default(false),
  isEnabled: boolean("is_enabled").notNull().default(false),
  createdBy: uuid("created_by"),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  runCount: integer("run_count").notNull().default(0),

  // B.1 Unified Scenario Workflow extensions
  icon: text("icon"),
  inputFields: jsonb("input_fields").$type<InputFieldDef[]>().default([]),
  defaultTeam: jsonb("default_team").$type<string[]>().default([]),
  systemInstruction: text("system_instruction"),
  legacyScenarioKey: text("legacy_scenario_key"),

  // 领域一等维度（P2）：场景默认领域。节点未覆盖时继承此值（resolveStepDomainId）。
  defaultDomainId: uuid("default_domain_id").references(() => domains.id),

  // Scenario spec document (Markdown, baoyu-standard).
  // Mirrors `skills.content` for the workflow side. Loaded from
  // `workflows/<slug>/SKILL.md` by `sync-workflows-from-md.ts`; editable
  // via `/workflows/[id]`. Runtime consumers (leader-plan / scenario
  // dispatchers) read from here or the file, whichever is newer.
  content: text("content").default(""),

  // 2026-04-20 realignment
  isPublic: boolean("is_public").notNull().default(true),
  ownerEmployeeId: text("owner_employee_id"),
  promptTemplate: text("prompt_template"),
  // 2026-04-20 homepage scenario tabs — "主流场景" tab 过滤字段
  isFeatured: boolean("is_featured").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => ({
  // 2026-04-20 把 raw SQL migration 里的 partial indexes 上行到 schema，
  // 防止 `drizzle-kit push` 因 schema 与 DB 不对齐而把它们丢掉。
  //
  // (org_id, legacy_scenario_key) 唯一 —— 仅当 slug 非 null 时生效。
  // 供 seedBuiltinTemplatesForOrg 的 onConflictDoUpdate 使用。
  legacyKeyUidx: uniqueIndex("workflow_templates_org_legacy_key_uidx")
    .on(table.organizationId, table.legacyScenarioKey)
    .where(sql`${table.legacyScenarioKey} IS NOT NULL`),
  // (org_id, name) 唯一 —— 仅 builtin 无 slug 的遗留行生效（避免撞旧 seed）。
  builtinNameUidx: uniqueIndex("workflow_templates_org_builtin_name_uidx")
    .on(table.organizationId, table.name)
    .where(sql`${table.isBuiltin} = true AND ${table.legacyScenarioKey} IS NULL`),
  // 主流场景 tab 查询热路径。
  featuredIdx: index("idx_workflow_templates_featured")
    .on(table.organizationId, table.isFeatured)
    .where(sql`${table.isFeatured} = true AND ${table.isPublic} = true`),
  // (org_id, owner_employee_id) —— 仅 owner 非 null 时生效。
  // 原仅存于手工 migration 20260420000001，上行到 schema 防 push 丢索引。
  ownerEmployeeIdx: index("idx_workflow_templates_owner_employee")
    .on(table.organizationId, table.ownerEmployeeId)
    .where(sql`${table.ownerEmployeeId} IS NOT NULL`),
}));

// ─── Homepage Template Tab Order (per-tab drag / pin state for /home) ───

export const workflowTemplateTabOrder = pgTable(
  "workflow_template_tab_order",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // tab_key: "featured" | EmployeeId (xiaolei|xiaoce|xiaozi|xiaowen|xiaojian|xiaoshen|xiaofa|xiaoshu)
    // 不用 enum：保持字符串 + 应用层 guard，避免 enum 迁移扰动。
    tabKey: text("tab_key").notNull(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => workflowTemplates.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    pinnedAt: timestamp("pinned_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    orgTabTemplateUidx: uniqueIndex(
      "workflow_template_tab_order_org_tab_template_uidx",
    ).on(table.organizationId, table.tabKey, table.templateId),
    orgTabOrderIdx: index("idx_homepage_order_org_tab").on(
      table.organizationId,
      table.tabKey,
    ),
  }),
);

// ─── Workflow Artifacts (now linked to missions instead of workflow_instances) ───

export const workflowArtifacts = pgTable("workflow_artifacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  missionId: uuid("mission_id")
    .references(() => missions.id, { onDelete: "cascade" })
    .notNull(),

  artifactType: artifactTypeEnum("artifact_type").notNull(),
  title: text("title").notNull(),
  content: jsonb("content"),
  textContent: text("text_content"),

  producerEmployeeId: uuid("producer_employee_id").references(
    () => aiEmployees.id
  ),
  producerTaskId: uuid("producer_task_id"), // references mission_tasks, kept as plain uuid to avoid circular
  version: integer("version").notNull().default(1),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Relations ───

export const workflowTemplatesRelations = relations(
  workflowTemplates,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [workflowTemplates.organizationId],
      references: [organizations.id],
    }),
  })
);

export const workflowArtifactsRelations = relations(
  workflowArtifacts,
  ({ one }) => ({
    mission: one(missions, {
      fields: [workflowArtifacts.missionId],
      references: [missions.id],
    }),
    producerEmployee: one(aiEmployees, {
      fields: [workflowArtifacts.producerEmployeeId],
      references: [aiEmployees.id],
    }),
  })
);
