import { getEmployeeFullProfile } from "@/lib/dal/employees";
import { getSkillsNotBoundToEmployee, getSkillRecommendations } from "@/lib/dal/skills";
import { getKnowledgeBasesNotBoundToEmployee } from "@/lib/dal/knowledge-bases";
import { getPerformanceTrend } from "@/lib/dal/performance";
import { getUserFeedbackStats, getLearnedPatterns, getEvolutionCurve, getEffectAttributions } from "@/lib/dal/evolution";
import { getConfigVersions, getSkillCombos } from "@/lib/dal/employee-advanced";
import { getRecentMemories, getUnprocessedFeedbackCount } from "@/lib/dal/learning";
import { listTemplatesForHomepageByTab } from "@/lib/dal/workflow-templates-listing";
import type { EmployeeId } from "@/lib/constants";
import { getCurrentUserOrg, getCurrentUserProfile } from "@/lib/dal/auth";
import { PERMISSIONS } from "@/lib/rbac-constants";
import { notFound } from "next/navigation";
import { EmployeeProfileClient } from "./employee-profile-client";

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 15000): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const employee = await withTimeout(getEmployeeFullProfile(id), undefined);

  if (!employee) {
    notFound();
  }

  let orgId = "";
  let canManageScenarios = false;
  let canManage = false;
  try {
    const [org, profile] = await Promise.all([
      getCurrentUserOrg(),
      getCurrentUserProfile(),
    ]);
    orgId = org || "";
    canManageScenarios = Boolean(
      profile?.permissions.includes(PERMISSIONS.AI_MANAGE),
    );
    if (profile) {
      canManage =
        profile.isSuperAdmin ||
        profile.role === "admin" ||
        profile.role === "owner";
    }
  } catch {
    // fallback
  }

  const [
    availableSkills,
    availableKBs,
    recommendations,
    performanceTrend,
    feedbackStats,
    patterns,
    evolutionData,
    attributions,
    configVersions,
    skillCombos,
  ] = await Promise.all([
    getSkillsNotBoundToEmployee(employee.dbId).catch(() => []),
    getKnowledgeBasesNotBoundToEmployee(employee.dbId).catch(() => []),
    getSkillRecommendations(employee.dbId, employee.roleType).catch(() => []),
    getPerformanceTrend(employee.dbId, 30).catch(() => []),
    getUserFeedbackStats(employee.dbId, orgId).catch(() => ({ accepts: 0, rejects: 0, edits: 0, rate: 0 })),
    getLearnedPatterns(employee.dbId).catch(() => []),
    getEvolutionCurve(employee.dbId, 30).catch(() => []),
    getEffectAttributions(employee.dbId, orgId, 10).catch(() => []),
    getConfigVersions(employee.dbId, 10).catch(() => []),
    getSkillCombos(orgId).catch(() => []),
  ]);

  const [recentMemories, unprocessedFeedbackCount, employeeWorkflows] =
    await Promise.all([
      getRecentMemories(employee.dbId, 20).catch(() => []),
      getUnprocessedFeedbackCount(employee.dbId, orgId).catch(() => 0),
      // 2026-04-20 realignment — "日常工作流" 严格按 ownerEmployeeId 垂类归属
      // 过滤（之前用 defaultTeam 包含匹配，会把"协作成员"身份的场景也算进来，
      // 导致质量审核官显示"深度报道""系列策划"等无关场景）。
      orgId
        ? listTemplatesForHomepageByTab(orgId, employee.id as EmployeeId).catch(() => [])
        : Promise.resolve([]),
    ]);

  return (
    <EmployeeProfileClient
      employee={employee}
      availableSkills={availableSkills}
      availableKBs={availableKBs}
      recommendations={recommendations}
      performanceTrend={performanceTrend}
      feedbackStats={feedbackStats}
      patterns={patterns}
      evolutionData={evolutionData}
      attributions={attributions}
      configVersions={configVersions}
      skillCombos={skillCombos}
      recentMemories={recentMemories}
      unprocessedFeedbackCount={unprocessedFeedbackCount}
      employeeWorkflows={employeeWorkflows}
      canManageScenarios={canManageScenarios}
      canManage={canManage}
    />
  );
}
