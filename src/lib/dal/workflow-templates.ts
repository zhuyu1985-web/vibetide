import { db } from "@/db";
import { workflowTemplates } from "@/db/schema";
import { eq, and, desc, asc, sql, type SQL } from "drizzle-orm";
import { getCurrentUserOrg } from "./auth";
import { BUILTIN_TEMPLATES } from "@/lib/workflow-templates";
import type { WorkflowTemplateRow } from "@/db/types";

/**
 * Deterministic slug for builtin template fallback IDs.
 * Uses name-based hash so the same template always gets the same ID across renders.
 */
function slugifyTemplateName(name: string): string {
  // Simple deterministic hash of the Chinese name -> base36 string.
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Build a stable virtual ID for a builtin template (used when it hasn't been
 * persisted to the DB yet). Prefix `builtin-` lets downstream actions detect
 * and resolve these from the static constant.
 */
export function buildBuiltinTemplateId(name: string): string {
  return `builtin-${slugifyTemplateName(name)}`;
}

/**
 * Get all workflow templates (builtin + custom) for the current org.
 * Ordered: builtin first, then by createdAt descending.
 */
export async function getWorkflowTemplates() {
  const orgId = await getCurrentUserOrg();

  const rows = await db.query.workflowTemplates.findMany({
    ...(orgId
      ? { where: eq(workflowTemplates.organizationId, orgId) }
      : {}),
    orderBy: [
      desc(workflowTemplates.isBuiltin),
      desc(workflowTemplates.createdAt),
    ],
  });

  return rows;
}

/**
 * Get only user-created (non-builtin) workflows for a specific user.
 */
export async function getMyWorkflows(userId: string) {
  const orgId = await getCurrentUserOrg();

  const rows = await db.query.workflowTemplates.findMany({
    where: orgId
      ? and(
          eq(workflowTemplates.organizationId, orgId),
          eq(workflowTemplates.isBuiltin, false),
          eq(workflowTemplates.createdBy, userId)
        )
      : and(
          eq(workflowTemplates.isBuiltin, false),
          eq(workflowTemplates.createdBy, userId)
        ),
    orderBy: [desc(workflowTemplates.createdAt)],
  });

  return rows;
}

/**
 * Get only builtin templates for the current org.
 *
 * Merges DB builtin rows with any templates from the static BUILTIN_TEMPLATES
 * constant that are not yet present in the DB (matched by name). Virtual rows
 * are synthesized to conform to WorkflowTemplateRow so callers can treat them
 * uniformly. Their IDs are prefixed with `builtin-` so mutation actions can
 * detect and resolve them against the static constant.
 */
export async function getBuiltinTemplates(): Promise<WorkflowTemplateRow[]> {
  const orgId = await getCurrentUserOrg();

  // 过滤掉"视觉上空"的 builtin 行：
  //  A) steps 为空 / 非数组 / 长度 0
  //  B) 有 step 但所有 step 的 config.skillSlug+skillName 都无效
  // 清理脚本：`npm run db:cleanup-empty-workflows`
  const hasSteps = sql`${workflowTemplates.steps} IS NOT NULL
    AND jsonb_typeof(${workflowTemplates.steps}) = 'array'
    AND jsonb_array_length(${workflowTemplates.steps}) > 0
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(${workflowTemplates.steps}) AS s
      WHERE coalesce(s->'config'->>'skillSlug', '') <> ''
         OR coalesce(s->'config'->>'skillName', '') <> ''
    )`;

  const rows = await db.query.workflowTemplates.findMany({
    where: orgId
      ? and(
          eq(workflowTemplates.organizationId, orgId),
          eq(workflowTemplates.isBuiltin, true),
          hasSteps
        )
      : and(eq(workflowTemplates.isBuiltin, true), hasSteps),
    orderBy: [asc(workflowTemplates.createdAt)],
  });

  const existingNames = new Set(rows.map((r) => r.name));
  const epoch = new Date(0);

  const virtualRows: WorkflowTemplateRow[] = BUILTIN_TEMPLATES.filter(
    (t) => !existingNames.has(t.name)
  ).map((t) => ({
    id: buildBuiltinTemplateId(t.name),
    organizationId: orgId ?? null,
    name: t.name,
    description: t.description,
    steps: t.steps,
    category: t.category,
    triggerType: t.triggerType,
    triggerConfig: t.triggerConfig ?? null,
    isBuiltin: true,
    isEnabled: true,
    createdBy: null,
    lastRunAt: null,
    runCount: 0,
    createdAt: epoch,
    updatedAt: epoch,
    // B.1 Unified Scenario Workflow fields — null/empty defaults for virtual rows
    icon: null,
    inputFields: [],
    defaultTeam: [],
    systemInstruction: null,
    legacyScenarioKey: null,
    // 2026-04-20 规格文档（baoyu SKILL.md body）— virtual rows 暂时空串
    content: "",
    // 2026-04-20 realignment — virtual rows 默认值
    isPublic: true,
    ownerEmployeeId: null,
    launchMode: "form",
    promptTemplate: null,
    isFeatured: false,
  }));

  return [...rows, ...virtualRows];
}

/**
 * Get a single workflow template by ID.
 */
export async function getWorkflowTemplate(id: string) {
  const row = await db.query.workflowTemplates.findFirst({
    where: eq(workflowTemplates.id, id),
  });

  return row ?? null;
}

// ─── B.1 Unified Scenario Workflow — listWorkflowTemplatesByOrg ───

export type WorkflowTemplateCategory =
  | "news"
  | "video"
  | "analytics"
  | "distribution"
  | "deep"
  | "social"
  | "advanced"
  | "livelihood"
  | "podcast"
  | "drama"
  | "daily_brief"
  | "custom";

export interface ListFilter {
  category?: WorkflowTemplateCategory;
  isBuiltin?: boolean;
  isEnabled?: boolean; // default true
  employeeSlug?: string; // defaultTeam @> [employeeSlug]
}

export interface ListOptions {
  limit?: number;
  offset?: number;
}

/**
 * List workflow templates for a given organization with rich filtering.
 *
 * Filter semantics:
 * - `isEnabled` defaults to `true` (scenarios hidden until explicitly enabled).
 * - `employeeSlug` uses jsonb containment (`default_team @> '["slug"]'`).
 * - All other filters are equality.
 *
 * Ordered by `createdAt` ascending for stable UI rendering.
 */
export async function listWorkflowTemplatesByOrg(
  organizationId: string,
  filter: ListFilter = {},
  options: ListOptions = {},
) {
  const conds: SQL[] = [eq(workflowTemplates.organizationId, organizationId)];

  conds.push(eq(workflowTemplates.isEnabled, filter.isEnabled ?? true));

  // 排除"视觉上空"的模板（steps 为空 OR 所有 step 都没有效 skill）—— 防止
  // 首页/场景网格显示不可用卡片。
  conds.push(
    sql`${workflowTemplates.steps} IS NOT NULL
      AND jsonb_typeof(${workflowTemplates.steps}) = 'array'
      AND jsonb_array_length(${workflowTemplates.steps}) > 0
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(${workflowTemplates.steps}) AS s
        WHERE coalesce(s->'config'->>'skillSlug', '') <> ''
           OR coalesce(s->'config'->>'skillName', '') <> ''
      )`,
  );

  if (filter.category !== undefined) {
    conds.push(eq(workflowTemplates.category, filter.category));
  }
  if (filter.isBuiltin !== undefined) {
    conds.push(eq(workflowTemplates.isBuiltin, filter.isBuiltin));
  }
  if (filter.employeeSlug !== undefined) {
    // jsonb contains check: default_team @> '["<slug>"]'
    conds.push(
      sql`${workflowTemplates.defaultTeam} @> ${JSON.stringify([filter.employeeSlug])}::jsonb`,
    );
  }

  let query = db
    .select()
    .from(workflowTemplates)
    .where(and(...conds))
    .orderBy(asc(workflowTemplates.createdAt));

  if (options.limit !== undefined) query = query.limit(options.limit) as typeof query;
  if (options.offset !== undefined) query = query.offset(options.offset) as typeof query;

  return await query;
}

/**
 * Look up a workflow template by (organizationId, legacy_scenario_key).
 *
 * 使用：startMission 时，若调用方未传 workflowTemplateId 但传了 scenario slug，
 * 自动通过此函数从 legacyScenarioKey 反查 template.id 补上。
 */
export async function getWorkflowTemplateByLegacyKey(
  organizationId: string,
  legacyKey: string,
) {
  const [row] = await db
    .select()
    .from(workflowTemplates)
    .where(and(
      eq(workflowTemplates.organizationId, organizationId),
      eq(workflowTemplates.legacyScenarioKey, legacyKey),
    ))
    .limit(1);
  return row ?? null;
}

// ─── B.1 Unified Scenario Workflow — mutations ───

export interface CreateWorkflowTemplateInput {
  name: string;
  description?: string | null;
  category: WorkflowTemplateCategory;
  steps: unknown[];   // WorkflowStepDef[]
  isBuiltin?: boolean;        // default false
  icon?: string | null;
  inputFields?: unknown[];
  defaultTeam?: string[];
  systemInstruction?: string | null;
  legacyScenarioKey?: string | null;
  triggerType?: "manual" | "scheduled";
  triggerConfig?: Record<string, unknown>;
  createdBy?: string;
}

export async function createWorkflowTemplate(
  organizationId: string,
  input: CreateWorkflowTemplateInput,
) {
  const [row] = await db
    .insert(workflowTemplates)
    .values({
      organizationId,
      name: input.name,
      description: input.description ?? null,
      category: input.category,
      steps: input.steps as never,
      isBuiltin: input.isBuiltin ?? false,
      isEnabled: true,
      icon: input.icon ?? null,
      inputFields: (input.inputFields ?? []) as never,
      defaultTeam: (input.defaultTeam ?? []) as never,
      systemInstruction: input.systemInstruction ?? null,
      legacyScenarioKey: input.legacyScenarioKey ?? null,
      triggerType: input.triggerType ?? "manual",
      triggerConfig: (input.triggerConfig ?? {}) as never,
      createdBy: input.createdBy ?? null,
    })
    .returning();
  return row;
}

export interface UpdateWorkflowTemplateInput {
  name?: string;
  description?: string | null;
  category?: WorkflowTemplateCategory;
  icon?: string | null;
  inputFields?: unknown[];
  defaultTeam?: string[];
  systemInstruction?: string | null;
  isEnabled?: boolean;
  steps?: unknown[];
}

export async function updateWorkflowTemplate(
  id: string,
  patch: UpdateWorkflowTemplateInput,
) {
  await db
    .update(workflowTemplates)
    .set({
      ...patch,
      updatedAt: new Date(),
    } as never)
    .where(eq(workflowTemplates.id, id));
}

export async function softDisableWorkflowTemplate(id: string) {
  await updateWorkflowTemplate(id, { isEnabled: false });
}

// ─── B.1 Unified Scenario Workflow — idempotent seed ───

export interface BuiltinSeedInput {
  name: string;
  description?: string | null;
  category: WorkflowTemplateCategory;
  icon?: string | null;
  inputFields?: unknown[];
  defaultTeam?: string[];
  systemInstruction?: string | null;
  legacyScenarioKey: string | null;
  steps: unknown[];
  triggerType?: "manual" | "scheduled";
  triggerConfig?: Record<string, unknown>;
  // 2026-04-20 realignment — 新 4 列
  /** 全组织可见，默认 true；org admin 手动关闭后不会被重置 */
  isPublic?: boolean;
  /** 员工专属归属；null = 公共场景 */
  ownerEmployeeId?: string | null;
  /** form = 需填表；direct = 一键启动 */
  launchMode?: "form" | "direct";
  /** Mustache 风格 prompt 模板 */
  promptTemplate?: string | null;
  /** 主流场景 tab 标记；默认 false。仅内置预设会设为 true。 */
  isFeatured?: boolean;
}

/**
 * 幂等 upsert builtin workflow templates.
 *
 * 分两路 onConflictDoUpdate：
 *  - 有 legacyScenarioKey：以 (org_id, legacy_scenario_key) partial unique index 为冲突目标
 *  - 无 legacyScenarioKey：以 (org_id, name) WHERE is_builtin AND legacy_scenario_key IS NULL 为冲突目标
 */
export async function seedBuiltinTemplatesForOrg(
  organizationId: string,
  seeds: BuiltinSeedInput[],
): Promise<void> {
  for (const seed of seeds) {
    const baseValues = {
      organizationId,
      name: seed.name,
      description: seed.description ?? null,
      category: seed.category,
      isBuiltin: true,
      isEnabled: true,
      icon: seed.icon ?? null,
      inputFields: (seed.inputFields ?? []) as never,
      defaultTeam: (seed.defaultTeam ?? []) as never,
      systemInstruction: seed.systemInstruction ?? null,
      legacyScenarioKey: seed.legacyScenarioKey,
      steps: seed.steps as never,
      triggerType: seed.triggerType ?? "manual",
      triggerConfig: (seed.triggerConfig ?? {}) as never,
      // 2026-04-20 realignment — 新 4 列
      isPublic: seed.isPublic ?? true,
      ownerEmployeeId: seed.ownerEmployeeId ?? null,
      launchMode: seed.launchMode ?? "form",
      promptTemplate: seed.promptTemplate ?? null,
      // 2026-04-20 homepage — "主流场景" tab 标识
      isFeatured: seed.isFeatured ?? false,
    };

    // onConflictDoUpdate 规则（2026-04-20 修订）：
    // - 重置（seed 即真相）：description / category / icon / input_fields / default_team
    //   / system_instruction / steps / trigger_type / trigger_config
    //   / launch_mode / prompt_template / owner_employee_id / updated_at
    //   (ownerEmployeeId 从"保留"移到"重置"，支持垂类归属重分配)
    // - 不覆盖（保留 org admin 手动设置）：is_public / is_enabled
    const setOnConflict = {
      description: baseValues.description,
      category: baseValues.category,
      icon: baseValues.icon,
      inputFields: baseValues.inputFields,
      defaultTeam: baseValues.defaultTeam,
      systemInstruction: baseValues.systemInstruction,
      steps: baseValues.steps,
      triggerType: baseValues.triggerType,
      triggerConfig: baseValues.triggerConfig,
      launchMode: baseValues.launchMode,
      promptTemplate: baseValues.promptTemplate,
      ownerEmployeeId: baseValues.ownerEmployeeId,
      isFeatured: baseValues.isFeatured,
      updatedAt: new Date(),
    };

    if (seed.legacyScenarioKey) {
      try {
        await db
          .insert(workflowTemplates)
          .values(baseValues)
          .onConflictDoUpdate({
            target: [workflowTemplates.organizationId, workflowTemplates.legacyScenarioKey],
            targetWhere: sql`${workflowTemplates.legacyScenarioKey} IS NOT NULL`,
            set: setOnConflict,
          });
      } catch (err) {
        // 2026-04-20 realignment — Phase 1 Chunk C：若 DB 中存在 legacy builtin 行
        // 占用了同 name（但 legacy_scenario_key 不同或为 NULL），onConflictDoUpdate
        // 走不到那一行，insert 会因 name unique index 失败。这属于已知的遗留数据，
        // Phase 3 会通过迁移清理。此处仅 warn，不 delete，继续处理后续 seed。
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("workflow_templates_org_builtin_name_uidx")) {
          console.warn(
            `[seedBuiltinTemplatesForOrg] name collision with legacy row — skipping seed "${seed.legacyScenarioKey}" (${seed.name}). Phase 3 migration will resolve. Detail: ${msg.split("\n")[0]}`,
          );
        } else {
          throw err;
        }
      }
    } else {
      await db
        .insert(workflowTemplates)
        .values(baseValues)
        .onConflictDoUpdate({
          target: [workflowTemplates.organizationId, workflowTemplates.name],
          targetWhere: sql`${workflowTemplates.isBuiltin} = true AND ${workflowTemplates.legacyScenarioKey} IS NULL`,
          set: setOnConflict,
        });
    }
  }
}
