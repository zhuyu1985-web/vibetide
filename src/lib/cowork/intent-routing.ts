import "server-only";

/**
 * cowork 意图装配 —— 复用 /api/chat/intent 的"加载员工/技能/历史意图/工作流
 * → recognizeIntent"逻辑,但封装成一个可在 server action 里直接 await 的函数
 * (非 SSE)。供 cowork 单窗口的 submitCoworkMessage 调用。
 *
 * 注:与 intent route 暂有少量重复,P4 统一入口时再 DRY 抽公共 loader。
 */
import { db } from "@/db";
import {
  aiEmployees,
  employeeSkills,
  skills,
  intentLogs,
  workflowTemplates,
} from "@/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  recognizeIntent,
  type IntentResult,
  type IntentMemoryEntry,
  type AvailableWorkflow,
} from "@/lib/agent/intent-recognition";

export async function recognizeIntentForOrg(
  orgId: string,
  userId: string,
  message: string,
  currentEmployeeSlug?: string,
): Promise<IntentResult> {
  const [empRows, recentLogs, workflowRows] = await Promise.all([
    db.query.aiEmployees.findMany({
      where: eq(aiEmployees.organizationId, orgId),
    }),
    db
      .select({
        userMessage: intentLogs.userMessage,
        intentType: intentLogs.intentType,
        intentResult: intentLogs.intentResult,
        userEdited: intentLogs.userEdited,
      })
      .from(intentLogs)
      .where(
        and(
          eq(intentLogs.userId, userId),
          eq(intentLogs.organizationId, orgId),
        ),
      )
      .orderBy(desc(intentLogs.createdAt))
      .limit(10),
    db
      .select({
        id: workflowTemplates.id,
        name: workflowTemplates.name,
        description: workflowTemplates.description,
        triggerType: workflowTemplates.triggerType,
      })
      .from(workflowTemplates)
      .where(eq(workflowTemplates.organizationId, orgId)),
  ]);

  // 按 slug 去重
  const seen = new Set<string>();
  const uniqueEmps = empRows.filter((r) => {
    if (seen.has(r.slug)) return false;
    seen.add(r.slug);
    return true;
  });

  // 批量加载技能
  const empIds = uniqueEmps.map((e) => e.id);
  const allSkillRows =
    empIds.length > 0
      ? await db
          .select({
            employeeId: employeeSkills.employeeId,
            skillName: skills.name,
          })
          .from(employeeSkills)
          .innerJoin(skills, eq(employeeSkills.skillId, skills.id))
          .where(inArray(employeeSkills.employeeId, empIds))
      : [];

  const skillsByEmp = new Map<string, string[]>();
  for (const row of allSkillRows) {
    const list = skillsByEmp.get(row.employeeId) || [];
    list.push(row.skillName);
    skillsByEmp.set(row.employeeId, list);
  }

  const availableEmployees = uniqueEmps.map((e) => ({
    slug: e.slug,
    name: e.name,
    nickname: e.nickname,
    title: e.title,
    skills: skillsByEmp.get(e.id) || [],
  }));

  const userMemories: IntentMemoryEntry[] = recentLogs.map((log) => {
    const result = log.intentResult as IntentResult;
    return {
      userMessage: log.userMessage,
      intentType: log.intentType,
      skills: result?.steps?.flatMap((s) => s.skills) ?? [],
      userEdited: log.userEdited,
    };
  });

  const availableWorkflows: AvailableWorkflow[] = workflowRows.map((w) => ({
    id: w.id,
    name: w.name,
    description: w.description,
    triggerType: w.triggerType ?? "manual",
  }));

  return recognizeIntent(
    message,
    currentEmployeeSlug || uniqueEmps[0]?.slug || "xiaolei",
    availableEmployees,
    userMemories,
    availableWorkflows,
  );
}
