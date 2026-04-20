import { db } from "@/db";
import { workflowTemplates } from "@/db/schema/workflows";
import { and, eq, asc, type SQL } from "drizzle-orm";
import type { WorkflowTemplateRow } from "@/db/types";
import type { EmployeeId } from "@/lib/constants";

/**
 * Pure selector for the "default" 热点追踪 workflow template.
 *
 * 3-level priority:
 *   1. `ownerEmployeeId === "xiaolei"` AND `legacyScenarioKey === "breaking_news"` AND `isBuiltin`
 *   2. `ownerEmployeeId === "xiaolei"` AND `category === "news"` AND `isBuiltin`
 *   3. `null` (no match — caller should treat as "needs reseed")
 *
 * 当多个候选命中同一优先级时，按 `createdAt` 升序（最早创建）取第一条，
 * 保证各次调用返回结果稳定。
 */
export function pickDefaultHotTopicTemplate(
  candidates: WorkflowTemplateRow[],
): WorkflowTemplateRow | null {
  const byCreatedAtAsc = (a: WorkflowTemplateRow, b: WorkflowTemplateRow) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    return ta - tb;
  };

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
 * Loads all builtin templates for the org and runs the 3-level selector.
 * 若两条规则都无命中，抛错提示需 reseed — 属于配置错误，不应返回 null。
 */
export async function getDefaultHotTopicTemplate(
  orgId: string,
): Promise<WorkflowTemplateRow> {
  const rows = await db
    .select()
    .from(workflowTemplates)
    .where(
      and(
        eq(workflowTemplates.organizationId, orgId),
        eq(workflowTemplates.isBuiltin, true),
      ),
    );
  const picked = pickDefaultHotTopicTemplate(rows as WorkflowTemplateRow[]);
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
export async function listTemplatesForHomepageByEmployee(
  orgId: string,
  employeeId: EmployeeId | null,
): Promise<WorkflowTemplateRow[]> {
  const conds: SQL[] = [
    eq(workflowTemplates.organizationId, orgId),
    eq(workflowTemplates.isPublic, true),
  ];
  if (employeeId) {
    conds.push(eq(workflowTemplates.ownerEmployeeId, employeeId));
  } else {
    conds.push(eq(workflowTemplates.isBuiltin, false));
  }
  const rows = await db
    .select()
    .from(workflowTemplates)
    .where(and(...conds))
    .orderBy(asc(workflowTemplates.createdAt));
  return rows as WorkflowTemplateRow[];
}
