import { db } from "@/db";
import {
  missions,
  missionTasks,
  missionMessages,
  aiEmployees,
  workflowTemplates,
} from "@/db/schema";
import { eq, and, desc, asc, inArray, sql, or } from "drizzle-orm";
import type {
  Mission,
  MissionTask,
  MissionMessage,
  MissionWithDetails,
  MissionTaskStatus,
  AIEmployee,
} from "@/lib/types";
import type { WorkflowTemplateRow } from "@/db/types";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import { resolveMissionScenarioLabel } from "@/lib/mission-scenario-label";

function rowToEmployee(row: typeof aiEmployees.$inferSelect): AIEmployee {
  const slug = row.slug as EmployeeId;
  const meta = EMPLOYEE_META[slug];
  return {
    id: slug,
    dbId: row.id,
    name: row.name,
    nickname: row.nickname,
    title: row.title,
    motto: row.motto ?? "",
    status: row.status as AIEmployee["status"],
    currentTask: row.currentTask ?? undefined,
    skills: [],
    stats: {
      tasksCompleted: row.tasksCompleted,
      accuracy: row.accuracy,
      avgResponseTime: row.avgResponseTime,
      satisfaction: row.satisfaction,
    },
  };
}

export async function getMissions(
  organizationId: string
): Promise<Mission[]> {
  const rows = await db
    .select()
    .from(missions)
    .where(eq(missions.organizationId, organizationId))
    .orderBy(desc(missions.createdAt));

  return rows.map((r) => ({
    id: r.id,
    organizationId: r.organizationId,
    title: r.title,
    description: r.description ?? undefined,
    scenario: r.scenario,
    userInstruction: r.userInstruction,
    leaderEmployeeId: r.leaderEmployeeId,
    teamMembers: (r.teamMembers as string[]) ?? [],
    status: r.status,
    phase: r.phase ?? undefined,
    progress: r.progress,
    config: r.config ?? undefined,
    finalOutput: r.finalOutput,
    tokenBudget: r.tokenBudget,
    tokensUsed: r.tokensUsed,
    sourceModule: r.sourceModule ?? null,
    sourceEntityId: r.sourceEntityId ?? null,
    sourceEntityType: r.sourceEntityType ?? null,
    createdAt: r.createdAt.toISOString(),
    startedAt: r.startedAt?.toISOString() ?? null,
    completedAt: r.completedAt?.toISOString() ?? null,
  }));
}

export async function getMissionById(
  missionId: string
): Promise<MissionWithDetails | null> {
  // Run ALL 4 queries in parallel — mission + tasks + messages + all org employees
  // This is 1 network round-trip instead of 2-3 sequential ones.
  const [missionRow, taskRows, msgRows, allEmpRows] = await Promise.all([
    // Phase 4A: load linked workflow_template so we can resolve scenarioLabel server-side
    db.query.missions.findFirst({
      where: eq(missions.id, missionId),
      with: { workflowTemplate: true },
    }),
    db.select({
      id: missionTasks.id,
      missionId: missionTasks.missionId,
      title: missionTasks.title,
      description: missionTasks.description,
      expectedOutput: missionTasks.expectedOutput,
      acceptanceCriteria: missionTasks.acceptanceCriteria,
      assignedEmployeeId: missionTasks.assignedEmployeeId,
      assignedRole: missionTasks.assignedRole,
      status: missionTasks.status,
      dependencies: missionTasks.dependencies,
      priority: missionTasks.priority,
      phase: missionTasks.phase,
      progress: missionTasks.progress,
      // Previously skipped for perf ("load on demand"), but the on-demand path
      // was never wired up — TaskDetailSheet just read null. A mission has
      // ~5-10 tasks and jsonb payloads are already compressed; loading them
      // here is cheap and restores step input/output visibility.
      inputContext: missionTasks.inputContext,
      outputData: missionTasks.outputData,
      outputSummary: missionTasks.outputSummary,
      errorMessage: missionTasks.errorMessage,
      errorRecoverable: missionTasks.errorRecoverable,
      retryCount: missionTasks.retryCount,
      claimedAt: missionTasks.claimedAt,
      startedAt: missionTasks.startedAt,
      completedAt: missionTasks.completedAt,
      createdAt: missionTasks.createdAt,
    }).from(missionTasks).where(eq(missionTasks.missionId, missionId)).orderBy(asc(missionTasks.priority)),
    db.select().from(missionMessages).where(eq(missionMessages.missionId, missionId)).orderBy(asc(missionMessages.createdAt)),
    // Load all employees for this mission's org (small table, avoids extra round-trips)
    db.query.missions.findFirst({ where: eq(missions.id, missionId), columns: { organizationId: true } })
      .then((m) => m ? db.select().from(aiEmployees).where(eq(aiEmployees.organizationId, m.organizationId)) : []),
  ]);

  const row = missionRow;
  if (!row) return null;

  const empMap = new Map((allEmpRows as (typeof aiEmployees.$inferSelect)[]).map((e) => [e.id, rowToEmployee(e)]));

  const tasks: MissionTask[] = taskRows.map((t) => ({
    id: t.id,
    missionId: t.missionId,
    title: t.title,
    description: t.description,
    expectedOutput: t.expectedOutput,
    acceptanceCriteria: t.acceptanceCriteria ?? undefined,
    assignedEmployeeId: t.assignedEmployeeId,
    assignedRole: t.assignedRole ?? undefined,
    assignedEmployee: t.assignedEmployeeId
      ? empMap.get(t.assignedEmployeeId)
      : undefined,
    status: t.status,
    dependencies: (t.dependencies as string[]) ?? [],
    priority: t.priority,
    phase: t.phase ?? undefined,
    progress: t.progress,
    inputContext: t.inputContext,
    outputData: t.outputData,
    outputSummary: t.outputSummary ?? undefined,
    errorMessage: t.errorMessage,
    errorRecoverable: !!t.errorRecoverable,
    retryCount: t.retryCount,
    claimedAt: t.claimedAt?.toISOString() ?? null,
    startedAt: t.startedAt?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
  }));

  const messages: MissionMessage[] = msgRows.map((m) => ({
    id: m.id,
    missionId: m.missionId,
    fromEmployeeId: m.fromEmployeeId,
    fromEmployee: empMap.get(m.fromEmployeeId),
    toEmployeeId: m.toEmployeeId,
    messageType: m.messageType,
    content: m.content,
    channel: m.channel,
    structuredData: m.structuredData ?? undefined,
    priority: m.priority,
    replyTo: m.replyTo ?? undefined,
    relatedTaskId: m.relatedTaskId,
    createdAt: m.createdAt.toISOString(),
  }));

  const teamMemberIds = (row.teamMembers as string[]) ?? [];
  const team = teamMemberIds
    .map((id) => empMap.get(id))
    .filter((e): e is AIEmployee => !!e);

  // Phase 4A: resolve scenario display info via template join + helper.
  const template = (row as typeof row & { workflowTemplate?: WorkflowTemplateRow | null })
    .workflowTemplate;
  const scInfo = resolveMissionScenarioLabel(
    { scenario: row.scenario, title: row.title },
    template,
  );

  return {
    id: row.id,
    organizationId: row.organizationId,
    title: row.title,
    description: row.description ?? undefined,
    scenario: row.scenario,
    userInstruction: row.userInstruction,
    leaderEmployeeId: row.leaderEmployeeId,
    teamMembers: teamMemberIds,
    status: row.status,
    phase: row.phase ?? undefined,
    progress: row.progress,
    config: row.config ?? undefined,
    finalOutput: row.finalOutput,
    tokenBudget: row.tokenBudget,
    tokensUsed: row.tokensUsed,
    sourceModule: row.sourceModule ?? null,
    sourceEntityId: row.sourceEntityId ?? null,
    sourceEntityType: row.sourceEntityType ?? null,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    tasks,
    messages,
    artifacts: [],
    leader: empMap.get(row.leaderEmployeeId)!,
    team,
    scenarioLabel: scInfo.label,
    scenarioCategory: scInfo.category ?? null,
    scenarioIcon: scInfo.icon ?? null,
    workflowTemplateId: row.workflowTemplateId ?? null,
  };
}

export async function getMissionTasks(
  missionId: string
): Promise<MissionTask[]> {
  const rows = await db
    .select()
    .from(missionTasks)
    .where(eq(missionTasks.missionId, missionId))
    .orderBy(asc(missionTasks.priority));

  return rows.map((t) => ({
    id: t.id,
    missionId: t.missionId,
    title: t.title,
    description: t.description,
    expectedOutput: t.expectedOutput,
    acceptanceCriteria: t.acceptanceCriteria ?? undefined,
    assignedEmployeeId: t.assignedEmployeeId,
    assignedRole: t.assignedRole ?? undefined,
    status: t.status,
    dependencies: (t.dependencies as string[]) ?? [],
    priority: t.priority,
    phase: t.phase ?? undefined,
    progress: t.progress,
    inputContext: t.inputContext,
    outputData: t.outputData,
    outputSummary: t.outputSummary ?? undefined,
    errorMessage: t.errorMessage,
    errorRecoverable: !!t.errorRecoverable,
    retryCount: t.retryCount,
    claimedAt: t.claimedAt?.toISOString() ?? null,
    startedAt: t.startedAt?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
  }));
}

/**
 * Get tasks whose dependencies are all completed and status is "ready".
 */
export async function getReadyTasks(
  missionId: string
): Promise<MissionTask[]> {
  const rows = await db
    .select()
    .from(missionTasks)
    .where(
      and(
        eq(missionTasks.missionId, missionId),
        eq(missionTasks.status, "ready")
      )
    )
    .orderBy(desc(missionTasks.priority));

  return rows.map((t) => ({
    id: t.id,
    missionId: t.missionId,
    title: t.title,
    description: t.description,
    expectedOutput: t.expectedOutput,
    acceptanceCriteria: t.acceptanceCriteria ?? undefined,
    assignedEmployeeId: t.assignedEmployeeId,
    assignedRole: t.assignedRole ?? undefined,
    status: t.status,
    dependencies: (t.dependencies as string[]) ?? [],
    priority: t.priority,
    phase: t.phase ?? undefined,
    progress: t.progress,
    inputContext: t.inputContext,
    outputData: t.outputData,
    outputSummary: t.outputSummary ?? undefined,
    errorMessage: t.errorMessage,
    errorRecoverable: !!t.errorRecoverable,
    retryCount: t.retryCount,
    claimedAt: t.claimedAt?.toISOString() ?? null,
    startedAt: t.startedAt?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
  }));
}

export async function getMissionMessages(
  missionId: string,
  employeeId?: string
): Promise<MissionMessage[]> {
  const conditions = [eq(missionMessages.missionId, missionId)];
  if (employeeId) {
    conditions.push(eq(missionMessages.toEmployeeId, employeeId));
  }

  const rows = await db
    .select()
    .from(missionMessages)
    .where(and(...conditions))
    .orderBy(asc(missionMessages.createdAt));

  return rows.map((m) => ({
    id: m.id,
    missionId: m.missionId,
    fromEmployeeId: m.fromEmployeeId,
    toEmployeeId: m.toEmployeeId,
    messageType: m.messageType,
    content: m.content,
    channel: m.channel,
    structuredData: m.structuredData ?? undefined,
    priority: m.priority,
    replyTo: m.replyTo ?? undefined,
    relatedTaskId: m.relatedTaskId,
    createdAt: m.createdAt.toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Enriched queries for Mission Center redesign
// ---------------------------------------------------------------------------

export interface MissionSummary extends Mission {
  activeTaskTitle: string | null;
  activeEmployeeSlug: string | null;
  completedTaskCount: number;
  inProgressTaskCount: number;
  totalTaskCount: number;
  messageCount: number;
  teamSlugs: string[];
  latestActivityFromSlug: string | null;
  latestActivityText: string | null;
  latestActivityTime: string | null;
  /**
   * Phase 4A: server-side resolved scenario display info (from
   * mission.workflowTemplateId → workflow_templates join). UI reads these
   * instead of SCENARIO_CONFIG / ADVANCED_SCENARIO_CONFIG.
   * - `scenarioLabel`    — display name (template.name or scenario slug fallback)
   * - `scenarioCategory` — category (for filtering)
   * - `scenarioIcon`     — lucide icon name (string)
   * - `workflowTemplateId` — template uuid when mission was linked (may be null
   *   for pre-B.1 legacy missions)
   */
  scenarioLabel: string;
  scenarioCategory: string | null;
  scenarioIcon: string | null;
  workflowTemplateId: string | null;
}

export async function getMissionsWithActiveTasks(
  organizationId: string
): Promise<MissionSummary[]> {
  // Run ALL queries in parallel — 1 network round-trip instead of 4 sequential.
  // Uses org-level employee query (small table) to avoid dependency on mission results.
  const [missionRows, taskRows, msgRows, empRows, workflowRows] = await Promise.all([
    db.select().from(missions).where(eq(missions.organizationId, organizationId)).orderBy(desc(missions.createdAt)),
    db.select({
      missionId: missionTasks.missionId,
      status: missionTasks.status,
      title: missionTasks.title,
      assignedEmployeeId: missionTasks.assignedEmployeeId,
    }).from(missionTasks)
      .innerJoin(missions, eq(missionTasks.missionId, missions.id))
      .where(eq(missions.organizationId, organizationId)),
    db.select({
      missionId: missionMessages.missionId,
      content: missionMessages.content,
      fromEmployeeId: missionMessages.fromEmployeeId,
      createdAt: missionMessages.createdAt,
    }).from(missionMessages)
      .innerJoin(missions, eq(missionMessages.missionId, missions.id))
      .where(eq(missions.organizationId, organizationId))
      .orderBy(desc(missionMessages.createdAt)),
    db.select({ id: aiEmployees.id, slug: aiEmployees.slug }).from(aiEmployees)
      .where(eq(aiEmployees.organizationId, organizationId)),
    // Phase 4A: preload org's workflow templates so we can resolve
    // `scenarioLabel` server-side (replaces SCENARIO_CONFIG lookup in client).
    db.select().from(workflowTemplates)
      .where(eq(workflowTemplates.organizationId, organizationId)),
  ]);

  if (missionRows.length === 0) return [];

  const tplById = new Map<string, WorkflowTemplateRow>(
    (workflowRows as WorkflowTemplateRow[]).map((t) => [t.id, t]),
  );

  const empSlugMap = new Map(empRows.map((e) => [e.id, e.slug]));

  // Build per-mission task summaries
  const taskSummaryMap = new Map<
    string,
    {
      total: number;
      completed: number;
      inProgress: number;
      activeTitle: string | null;
      activeSlug: string | null;
    }
  >();

  for (const t of taskRows) {
    const s = taskSummaryMap.get(t.missionId) ?? {
      total: 0,
      completed: 0,
      inProgress: 0,
      activeTitle: null,
      activeSlug: null,
    };
    s.total++;
    if (t.status === "completed") s.completed++;
    if (t.status === "in_progress" || t.status === "claimed") {
      s.inProgress++;
      if (!s.activeTitle) {
        s.activeTitle = t.title;
        s.activeSlug = t.assignedEmployeeId
          ? empSlugMap.get(t.assignedEmployeeId) ?? null
          : null;
      }
    }
    taskSummaryMap.set(t.missionId, s);
  }

  // Build per-mission message summaries
  const msgCountMap = new Map<string, number>();
  const latestMsgMap = new Map<
    string,
    { content: string; fromSlug: string | null; time: string }
  >();
  for (const msg of msgRows) {
    msgCountMap.set(msg.missionId, (msgCountMap.get(msg.missionId) ?? 0) + 1);
    if (!latestMsgMap.has(msg.missionId)) {
      latestMsgMap.set(msg.missionId, {
        content: msg.content,
        fromSlug: empSlugMap.get(msg.fromEmployeeId) ?? null,
        time: msg.createdAt.toISOString(),
      });
    }
  }

  return missionRows.map((r) => {
    const ts = taskSummaryMap.get(r.id);
    const teamMemberIds = (r.teamMembers as string[]) ?? [];
    const teamSlugs = teamMemberIds
      .map((id) => empSlugMap.get(id))
      .filter((s): s is string => !!s);
    const latestMsg = latestMsgMap.get(r.id);

    // Phase 4A: resolve scenario display info via template join + helper.
    const template = r.workflowTemplateId ? tplById.get(r.workflowTemplateId) : undefined;
    const scInfo = resolveMissionScenarioLabel(
      { scenario: r.scenario, title: r.title },
      template,
    );

    return {
      id: r.id,
      organizationId: r.organizationId,
      title: r.title,
      description: r.description ?? undefined,
      scenario: r.scenario,
      userInstruction: r.userInstruction,
      leaderEmployeeId: r.leaderEmployeeId,
      teamMembers: teamMemberIds,
      status: r.status,
      phase: r.phase ?? undefined,
      progress: r.progress,
      config: r.config ?? undefined,
      finalOutput: r.finalOutput,
      tokenBudget: r.tokenBudget,
      tokensUsed: r.tokensUsed,
      sourceModule: r.sourceModule ?? null,
      sourceEntityId: r.sourceEntityId ?? null,
      sourceEntityType: r.sourceEntityType ?? null,
      createdAt: r.createdAt.toISOString(),
      startedAt: r.startedAt?.toISOString() ?? null,
      completedAt: r.completedAt?.toISOString() ?? null,
      activeTaskTitle: ts?.activeTitle ?? null,
      activeEmployeeSlug: ts?.activeSlug ?? null,
      completedTaskCount: ts?.completed ?? 0,
      inProgressTaskCount: ts?.inProgress ?? 0,
      totalTaskCount: ts?.total ?? 0,
      messageCount: msgCountMap.get(r.id) ?? 0,
      teamSlugs,
      latestActivityFromSlug: latestMsg?.fromSlug ?? null,
      latestActivityText: latestMsg?.content ?? null,
      latestActivityTime: latestMsg?.time ?? null,
      scenarioLabel: scInfo.label,
      scenarioCategory: scInfo.category ?? null,
      scenarioIcon: scInfo.icon ?? null,
      workflowTemplateId: r.workflowTemplateId ?? null,
    };
  });
}

export interface EmployeeLoad {
  slug: string;
  taskCount: number;
}

export async function getEmployeeTaskLoad(
  organizationId: string
): Promise<EmployeeLoad[]> {
  const rows = await db
    .select({
      empId: missionTasks.assignedEmployeeId,
      count: sql<number>`cast(count(${missionTasks.id}) as int)`,
    })
    .from(missionTasks)
    .innerJoin(missions, eq(missionTasks.missionId, missions.id))
    .where(
      and(
        eq(missions.organizationId, organizationId),
        inArray(missions.status, ["queued", "planning", "executing", "consolidating"])
      )
    )
    .groupBy(missionTasks.assignedEmployeeId);

  // Resolve slugs
  const empIds = rows
    .map((r) => r.empId)
    .filter((id): id is string => !!id);
  if (empIds.length === 0) return [];

  const empRows = await db
    .select({ id: aiEmployees.id, slug: aiEmployees.slug })
    .from(aiEmployees)
    .where(inArray(aiEmployees.id, empIds));
  const idToSlug = new Map(empRows.map((e) => [e.id, e.slug]));

  return rows
    .filter((r) => r.empId && idToSlug.has(r.empId))
    .map((r) => ({
      slug: idToSlug.get(r.empId!)!,
      taskCount: r.count,
    }));
}

export interface EmployeeActivity {
  employee: AIEmployee;
  currentTask: {
    title: string;
    missionTitle: string;
    status: MissionTaskStatus;
  } | null;
}

export async function getEmployeeActivitySummary(
  organizationId: string
): Promise<EmployeeActivity[]> {
  // Get all employees for this org
  const empRows = await db
    .select()
    .from(aiEmployees)
    .where(eq(aiEmployees.organizationId, organizationId));

  if (empRows.length === 0) return [];

  // Find active tasks (in_progress or claimed)
  const empIds = empRows.map((e) => e.id);
  const activeTaskRows = await db
    .select({
      assignedEmployeeId: missionTasks.assignedEmployeeId,
      taskTitle: missionTasks.title,
      taskStatus: missionTasks.status,
      missionId: missionTasks.missionId,
    })
    .from(missionTasks)
    .where(
      and(
        inArray(missionTasks.assignedEmployeeId, empIds),
        or(
          eq(missionTasks.status, "in_progress"),
          eq(missionTasks.status, "claimed")
        )
      )
    );

  // Load mission titles for active tasks
  const activeMissionIds = [
    ...new Set(activeTaskRows.map((t) => t.missionId)),
  ];
  const missionTitleMap = new Map<string, string>();
  if (activeMissionIds.length > 0) {
    const mRows = await db
      .select({ id: missions.id, title: missions.title })
      .from(missions)
      .where(inArray(missions.id, activeMissionIds));
    for (const m of mRows) missionTitleMap.set(m.id, m.title);
  }

  // Build active task map (employee ID -> task info)
  const activeTaskMap = new Map<
    string,
    { title: string; missionTitle: string; status: MissionTaskStatus }
  >();
  for (const t of activeTaskRows) {
    if (t.assignedEmployeeId && !activeTaskMap.has(t.assignedEmployeeId)) {
      activeTaskMap.set(t.assignedEmployeeId, {
        title: t.taskTitle,
        missionTitle: missionTitleMap.get(t.missionId) ?? "",
        status: t.taskStatus as MissionTaskStatus,
      });
    }
  }

  // Build result, active employees first
  const result: EmployeeActivity[] = empRows.map((row) => ({
    employee: rowToEmployee(row),
    currentTask: activeTaskMap.get(row.id) ?? null,
  }));

  result.sort((a, b) => {
    if (a.currentTask && !b.currentTask) return -1;
    if (!a.currentTask && b.currentTask) return 1;
    return 0;
  });

  return result;
}
