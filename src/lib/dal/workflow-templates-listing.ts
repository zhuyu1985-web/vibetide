import { db } from "@/db";
import {
  workflowTemplates,
  workflowTemplateTabOrder,
} from "@/db/schema/workflows";
import { organizations } from "@/db/schema/users";
import { and, eq, asc, or, ilike, sql, type SQL } from "drizzle-orm";
import type { WorkflowTemplateRow } from "@/db/types";
import type { EmployeeId } from "@/lib/constants";

/**
 * Pure selector for the "default" 热点追踪 workflow template.
 *
 * Priority (with `pinnedTemplateId` from org settings):
 *   0. 若提供 pinnedTemplateId 且能在 candidates 中找到匹配模板（任意 owner /
 *      builtin 状态都接受 — 允许 ops 选自定义模板），优先返回它
 *   1. `ownerEmployeeId === "xiaolei"` AND `legacyScenarioKey === "breaking_news"` AND `isBuiltin`
 *   2. `ownerEmployeeId === "xiaolei"` AND `category === "news"` AND `isBuiltin`
 *   3. `null` (no match — caller should treat as "needs reseed")
 *
 * 当多个候选命中同一优先级时，按 `createdAt` 升序（最早创建）取第一条，
 * 保证各次调用返回结果稳定。
 */
export function pickDefaultHotTopicTemplate(
  candidates: WorkflowTemplateRow[],
  pinnedTemplateId?: string | null,
): WorkflowTemplateRow | null {
  const byCreatedAtAsc = (a: WorkflowTemplateRow, b: WorkflowTemplateRow) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    return ta - tb;
  };

  // P0：org 设置了 settings.defaultTemplates.hotTopic — 优先用它
  if (pinnedTemplateId) {
    const pinned = candidates.find((t) => t.id === pinnedTemplateId);
    if (pinned) return pinned;
    // pinned id 不在候选里（被删 / 跨 org / 拼写错）→ 落到下面的 fallback
  }

  const p1 = candidates
    .filter(
      (t) =>
        t.ownerEmployeeId === "xiaolei" &&
        t.legacyScenarioKey === "breaking_news" &&
        t.isBuiltin,
    )
    .sort(byCreatedAtAsc);
  if (p1.length > 0) return p1[0];

  const p2 = candidates
    .filter(
      (t) =>
        t.ownerEmployeeId === "xiaolei" &&
        t.category === "news" &&
        t.isBuiltin,
    )
    .sort(byCreatedAtAsc);
  if (p2.length > 0) return p2[0];

  return null;
}

/**
 * DB wrapper around `pickDefaultHotTopicTemplate`.
 *
 * Loads org settings + all candidate templates for the org, then runs the
 * 4-level selector (P0 pinned → P1 breaking_news → P2 news fallback → null).
 *
 * P0 候选放宽到所有 org 模板（包括自定义 / 非 isBuiltin），让 ops 能 pin 任何
 * 自己创建的模板。后两级 fallback 仍只看 isBuiltin 模板。
 *
 * 若都无命中，抛错提示需 reseed — 属于配置错误，不应返回 null。
 */
export async function getDefaultHotTopicTemplate(
  orgId: string,
): Promise<WorkflowTemplateRow> {
  const [orgRow, rows] = await Promise.all([
    db
      .select({ settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select()
      .from(workflowTemplates)
      .where(eq(workflowTemplates.organizationId, orgId)),
  ]);

  const pinnedTemplateId =
    orgRow?.settings?.defaultTemplates?.hotTopic ?? null;

  const picked = pickDefaultHotTopicTemplate(
    rows as WorkflowTemplateRow[],
    pinnedTemplateId,
  );
  if (!picked) {
    throw new Error(
      `default hot topic template missing for org ${orgId}; please reseed builtin templates`,
    );
  }
  return picked;
}

/**
 * List workflow templates for the homepage "9-tab" employee grid.
 *
 * - `employeeId !== null`：过滤出 `isPublic=true` 且 `ownerEmployeeId=<id>` 的模板
 *   （员工的专属场景）。
 * - `employeeId === null`：返回组织内所有 custom（`isBuiltin=false`）
 *   且 `isPublic=true` 的模板（「全部自定义」tab）。
 *
 * 按 `createdAt` 升序排，和 `listWorkflowTemplatesByOrg` 一致，保证 UI 稳定。
 */
/**
 * Phase 4B — keyword lookup for channel gateway quick-commands.
 *
 * 替代 `ADVANCED_SCENARIO_CONFIG[key]` 常量查找。IM 渠道（DingTalk / WeCom）
 * 的 `#场景名 ...` 指令会把 `#` 后面的 tag 传给本函数，我们在组织内按模板
 * 中文名或 `legacyScenarioKey` 做模糊匹配，取第一条命中。
 *
 * 返回 `null` 由调用方反馈给用户「未找到场景 xxx」。
 */
export async function findTemplateByNameOrSlug(
  orgId: string,
  keyword: string,
): Promise<WorkflowTemplateRow | null> {
  const trimmed = keyword?.trim() ?? "";
  if (trimmed.length === 0) return null;
  const pattern = `%${trimmed}%`;
  const rows = await db
    .select()
    .from(workflowTemplates)
    .where(
      and(
        eq(workflowTemplates.organizationId, orgId),
        or(
          ilike(workflowTemplates.name, pattern),
          ilike(workflowTemplates.legacyScenarioKey, pattern),
        ),
      ),
    )
    .limit(1);
  return (rows[0] as WorkflowTemplateRow | undefined) ?? null;
}

/**
 * Homepage "10-tab" grid tab key union.
 *
 * - `"featured"` —— 主流场景 tab（新增，is_featured=true 过滤）
 * - `EmployeeId` —— 8 员工职能 tab（xiaolei / xiaoce / ... / xiaoshu）
 * - `"custom"` —— 我的工作流 tab（is_builtin=false）
 */
export type HomepageTabKey = "featured" | EmployeeId | "custom";

/**
 * Unified homepage-grid query. 替代原 `listTemplatesForHomepageByEmployee`。
 *
 * - `"featured"`：`is_featured=true AND is_public=true`
 * - `"custom"`：`is_builtin=false AND created_by=userId`（= /workflows 页 "我的工作流" 语义）
 * - EmployeeId：`owner_employee_id=<id> AND is_public=true`
 *
 * `"custom"` 分支需要 `opts.userId`；若未提供则返回 []（未登录不显示"我的"）。
 * 所有分支附加 `organization_id=orgId` + `orderBy(asc(createdAt))`。
 */
export async function listTemplatesForHomepageByTab(
  orgId: string,
  tab: HomepageTabKey,
  opts?: { userId?: string },
): Promise<(WorkflowTemplateRow & { __homepagePinnedAt?: Date | null })[]> {
  if (tab === "custom" && !opts?.userId) {
    return [];
  }

  const conds: SQL[] = [eq(workflowTemplates.organizationId, orgId)];

  // 排除"视觉上空"的模板（steps 为空 OR 所有 step 都没有效 skill）——
  // 含遗留 ADVANCED_SCENARIO / 坏 seed。「我的自定义」tab 保留所有，允许用户
  // 看到自己草稿。
  if (tab !== "custom") {
    conds.push(sql`${workflowTemplates.steps} IS NOT NULL
      AND jsonb_typeof(${workflowTemplates.steps}) = 'array'
      AND jsonb_array_length(${workflowTemplates.steps}) > 0
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(${workflowTemplates.steps}) AS s
        WHERE coalesce(s->'config'->>'skillSlug', '') <> ''
           OR coalesce(s->'config'->>'skillName', '') <> ''
      )`);
  }

  if (tab === "featured") {
    conds.push(eq(workflowTemplates.isPublic, true));
    conds.push(eq(workflowTemplates.isFeatured, true));
  } else if (tab === "custom") {
    // 与 /workflows 页 getMyWorkflows 语义一致：isBuiltin=false AND createdBy=userId
    conds.push(eq(workflowTemplates.isBuiltin, false));
    conds.push(eq(workflowTemplates.createdBy, opts!.userId!));
  } else {
    // tab 是 EmployeeId
    conds.push(eq(workflowTemplates.isPublic, true));
    conds.push(eq(workflowTemplates.ownerEmployeeId, tab));
  }

  if (tab === "custom") {
    const rows = await db
      .select()
      .from(workflowTemplates)
      .where(and(...conds))
      .orderBy(asc(workflowTemplates.createdAt));
    return rows as WorkflowTemplateRow[];
  }

  // 9 个共享 tab：LEFT JOIN 顺序表 + 应用层排序
  const joinedRows = await db
    .select({
      tpl: workflowTemplates,
      orderPinnedAt: workflowTemplateTabOrder.pinnedAt,
      orderSortOrder: workflowTemplateTabOrder.sortOrder,
    })
    .from(workflowTemplates)
    .leftJoin(
      workflowTemplateTabOrder,
      and(
        eq(workflowTemplateTabOrder.templateId, workflowTemplates.id),
        eq(workflowTemplateTabOrder.organizationId, orgId),
        eq(workflowTemplateTabOrder.tabKey, tab),
      ),
    )
    .where(and(...conds));

  const withOrder: TemplateWithOrder[] = joinedRows.map((r) => ({
    tpl: r.tpl as WorkflowTemplateRow,
    order:
      r.orderPinnedAt == null && r.orderSortOrder == null
        ? null
        : {
            pinnedAt: r.orderPinnedAt,
            sortOrder: r.orderSortOrder ?? 0,
          },
  }));

  // Task 4 — 把非持久 `__homepagePinnedAt` 字段挂到每行，供客户端区分置顶卡。
  // 只在 9 个共享 tab 分支做，custom tab 不参与置顶/排序。
  return sortTemplatesForHomepageTab(withOrder).map((r) => ({
    ...r.tpl,
    __homepagePinnedAt: r.order?.pinnedAt ?? null,
  })) as (WorkflowTemplateRow & { __homepagePinnedAt?: Date | null })[];
}

/**
 * @deprecated 2026-04-20 首页 tab 重构 —— 请改用 `listTemplatesForHomepageByTab`。
 * 保留别名是为了不破坏现有调用点；custom 分支需要 userId 才返回结果。
 */
export async function listTemplatesForHomepageByEmployee(
  orgId: string,
  employeeId: EmployeeId | null,
  opts?: { userId?: string },
): Promise<WorkflowTemplateRow[]> {
  return listTemplatesForHomepageByTab(orgId, employeeId ?? "custom", opts);
}

export type TemplateWithOrder = {
  tpl: WorkflowTemplateRow;
  order: {
    pinnedAt: Date | null;
    sortOrder: number;
  } | null;
};

/**
 * 纯排序函数 —— 输入带 order 元数据的模板行，按首页 tab 排序规则排好序输出。
 *
 * 规则：
 *   1. 置顶区（order.pinnedAt 非 null）优先
 *   2. 置顶区内：pinnedAt DESC（最近置顶的在顶）
 *   3. 非置顶区：sortOrder ASC
 *   4. 未入 order 表（order === null）视为 sortOrder = +∞，落到非置顶区末尾
 *   5. 所有前序相同 → createdAt ASC 兜底
 */
export function sortTemplatesForHomepageTab(
  rows: TemplateWithOrder[],
): TemplateWithOrder[] {
  const isPinned = (r: TemplateWithOrder) => r.order?.pinnedAt != null;
  const SENTINEL = Number.POSITIVE_INFINITY;
  const effectiveSort = (r: TemplateWithOrder) =>
    r.order?.pinnedAt != null
      ? -Number.MAX_SAFE_INTEGER
      : r.order?.sortOrder ?? SENTINEL;

  return [...rows].sort((a, b) => {
    const ap = isPinned(a);
    const bp = isPinned(b);
    if (ap !== bp) return ap ? -1 : 1;
    if (ap && bp) {
      const at = a.order!.pinnedAt!.getTime();
      const bt = b.order!.pinnedAt!.getTime();
      if (at !== bt) return bt - at;
    } else {
      const av = effectiveSort(a);
      const bv = effectiveSort(b);
      if (av !== bv) return av - bv;
    }
    return (
      new Date(a.tpl.createdAt).getTime() -
      new Date(b.tpl.createdAt).getTime()
    );
  });
}
