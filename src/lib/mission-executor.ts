/**
 * Mission Executor — direct execution engine for mission planning and task execution.
 *
 * Provides the same logic as the Inngest functions but can be called directly
 * from server actions without requiring a running Inngest dev server.
 *
 * Flow:
 * 1. leaderPlanDirect() — decomposes mission into tasks (same as leader-plan.ts)
 * 2. executeReadyTasksDirect() — executes all ready tasks sequentially
 * 3. leaderConsolidateDirect() — consolidates all outputs into final result
 */

import { db } from "@/db";
import {
  missions,
  missionTasks,
  missionMessages,
  missionArtifacts,
  aiEmployees,
  employeeSkills,
} from "@/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { verify } from "@/lib/cognitive/verify-learner";
import { updateSkillStats } from "@/lib/cognitive/skill-manager";
import { assembleAgent, executeAgent } from "@/lib/agent";
import { createMissionTools } from "@/lib/agent/tool-registry";
import {
  loadAvailableEmployees,
  buildLeaderDecomposePrompt,
  parseLeaderOutput,
  validateDAG,
  loadDependencyOutputs,
  loadEmployeeMessages,
  buildConsolidatePrompt,
  mapTaskOutputsToStepOutputs,
  checkTokenBudget,
} from "@/lib/mission-core";

// ---------------------------------------------------------------------------
// 1. Leader Planning — decompose mission into tasks
// ---------------------------------------------------------------------------

export async function leaderPlanDirect(
  missionId: string,
  organizationId: string
) {
  // Load the mission
  const mission = await db.query.missions.findFirst({
    where: eq(missions.id, missionId),
  });
  if (!mission) throw new Error(`Mission not found: ${missionId}`);

  // Load available employees
  const employeesWithSkills = await loadAvailableEmployees(organizationId);

  // Assemble leader agent and decompose
  const agent = await assembleAgent(mission.leaderEmployeeId);

  const prompt = buildLeaderDecomposePrompt(mission, employeesWithSkills);

  const planResult = await executeAgent(agent, {
    stepKey: "leader-plan",
    stepLabel: "任务分解与分配",
    scenario: mission.scenario,
    topicTitle: mission.title,
    previousSteps: [],
    userInstructions: prompt,
  });

  // Parse tasks from output — use full artifact content (not summary which truncates to first line)
  const outputText = planResult.output.artifacts?.[0]?.content || planResult.output.summary || "";
  const parsed = parseLeaderOutput(outputText, {
    title: mission.title,
    instruction: mission.userInstruction,
    defaultSlug: employeesWithSkills[0]?.slug || "xiaolei",
  });

  // Validate DAG before inserting
  const dagResult = validateDAG(parsed.tasks);
  if (!dagResult.valid) {
    throw new Error(`任务 DAG 校验失败: ${dagResult.error}`);
  }

  // Create task records
  const taskIds: string[] = [];
  const selectedEmployeeIds = new Set<string>();

  for (let i = 0; i < parsed.tasks.length; i++) {
    const taskDef = parsed.tasks[i];
    const employee = employeesWithSkills.find(
      (e) => e.slug === taskDef.assignedEmployeeSlug
    );
    const employeeId = employee?.id || employeesWithSkills[0]?.id || null;
    if (employeeId) selectedEmployeeIds.add(employeeId);

    const depTaskIds = (taskDef.dependsOn || [])
      .filter((idx) => idx >= 0 && idx < taskIds.length)
      .map((idx) => taskIds[idx]);

    const [created] = await db
      .insert(missionTasks)
      .values({
        missionId,
        title: taskDef.title,
        description: taskDef.description,
        expectedOutput: taskDef.expectedOutput || null,
        assignedEmployeeId: employeeId,
        dependencies: depTaskIds,
        priority: taskDef.priority ?? 0,
        status: "pending",
      })
      .returning({ id: missionTasks.id });

    taskIds.push(created.id);
  }

  // Update mission
  await db
    .update(missions)
    .set({
      teamMembers: [...selectedEmployeeIds],
      status: "executing",
      tokensUsed:
        (mission.tokensUsed || 0) +
        planResult.tokensUsed.input +
        planResult.tokensUsed.output,
    })
    .where(eq(missions.id, missionId));

  // Post coordination message
  await db.insert(missionMessages).values({
    missionId,
    fromEmployeeId: mission.leaderEmployeeId,
    messageType: "coordination",
    content: `任务分解完成，共创建 ${taskIds.length} 个子任务，已分配给 ${selectedEmployeeIds.size} 名团队成员。`,
  });

  // Mark zero-dependency tasks as ready
  const allTasks = await db
    .select()
    .from(missionTasks)
    .where(eq(missionTasks.missionId, missionId));

  for (const task of allTasks) {
    const deps = (task.dependencies as string[]) || [];
    if (deps.length === 0) {
      await db
        .update(missionTasks)
        .set({ status: "ready" })
        .where(eq(missionTasks.id, task.id));
    }
  }

  return { taskCount: taskIds.length, teamSize: selectedEmployeeIds.size };
}

// ---------------------------------------------------------------------------
// 2. Execute a single ready task
// ---------------------------------------------------------------------------

async function executeTaskDirect(
  taskId: string,
  missionId: string,
  /** Pre-loaded mission to avoid redundant queries in parallel execution */
  cachedMission?: { id: string; scenario: string; title: string; tokenBudget: number; tokensUsed: number; leaderEmployeeId: string },
) {
  // Batch pre-execution reads: task + mission (if not cached) + deps + messages
  const task = await db.query.missionTasks.findFirst({ where: eq(missionTasks.id, taskId) });
  if (!task || task.status !== "ready") return null;

  const mission = cachedMission ?? await db.query.missions.findFirst({ where: eq(missions.id, missionId) });
  if (!mission) throw new Error(`Mission not found: ${missionId}`);

  // Token budget check
  const budget = checkTokenBudget(mission as Parameters<typeof checkTokenBudget>[0]);
  if (!budget.allowed) {
    await db.update(missionTasks).set({ status: "failed", errorMessage: "Token 预算已耗尽" }).where(eq(missionTasks.id, taskId));
    return { status: "failed" as const, taskId, error: "Token budget exceeded" };
  }

  // Batch: mark in_progress + update employee + load deps + load messages in parallel
  const deps = (task.dependencies as string[]) || [];
  const [, , previousSteps, employeeMessages] = await Promise.all([
    db.update(missionTasks).set({ status: "in_progress", startedAt: new Date() }).where(eq(missionTasks.id, taskId)),
    task.assignedEmployeeId
      ? db.update(aiEmployees).set({ status: "working", currentTask: `正在执行「${task.title}」` }).where(eq(aiEmployees.id, task.assignedEmployeeId))
      : Promise.resolve(),
    loadDependencyOutputs(deps),
    task.assignedEmployeeId ? loadEmployeeMessages(missionId, task.assignedEmployeeId) : Promise.resolve(""),
  ]);

  try {
    if (!task.assignedEmployeeId) {
      throw new Error(`Task ${taskId} has no assigned employee`);
    }

    const agent = await assembleAgent(task.assignedEmployeeId);

    // Create mission collaboration tools for this agent
    const missionTools = createMissionTools({
      missionId,
      employeeId: task.assignedEmployeeId,
      employeeSlug: agent.slug,
      isLeader: agent.slug === "leader",
    });

    const userInstructions = [
      task.description,
      task.expectedOutput ? `\n期望输出：${task.expectedOutput}` : "",
      employeeMessages ? `\n来自团队的消息：\n${employeeMessages}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const result = await executeAgent(agent, {
      stepKey: task.id,
      stepLabel: task.title,
      scenario: mission.scenario,
      topicTitle: mission.title,
      previousSteps,
      userInstructions,
    }, undefined, missionTools);

    // Batch all post-execution DB writes (queued by max:1 pool, but no await gaps)
    const totalTokens = result.tokensUsed.input + result.tokensUsed.output;
    await Promise.all([
      // Save output
      db.update(missionTasks)
        .set({ status: "completed", outputData: result.output, progress: 100, completedAt: new Date() })
        .where(eq(missionTasks.id, taskId)),
      // Reset employee + post message
      task.assignedEmployeeId
        ? db.update(aiEmployees)
            .set({
              status: "idle", currentTask: null,
              tasksCompleted: sql`${aiEmployees.tasksCompleted} + 1`,
              avgResponseTime: `${Math.round(result.durationMs / 1000)}s`,
              updatedAt: new Date(),
            })
            .where(eq(aiEmployees.id, task.assignedEmployeeId))
        : Promise.resolve(),
      task.assignedEmployeeId
        ? db.insert(missionMessages).values({
            missionId,
            fromEmployeeId: task.assignedEmployeeId,
            messageType: "result",
            content: `「${task.title}」已完成。\n\n${result.output.summary || ""}`,
            relatedTaskId: taskId,
          })
        : Promise.resolve(),
      // Update token usage
      db.update(missions).set({ tokensUsed: sql`${missions.tokensUsed} + ${totalTokens}` }).where(eq(missions.id, missionId)),
    ]);

    // Persist artifacts (sequential — variable count)
    if (result.output.artifacts?.length) {
      for (const artifact of result.output.artifacts) {
        await db.insert(missionArtifacts).values({
          missionId, taskId, producedBy: task.assignedEmployeeId!,
          type: artifact.type ?? "text",
          title: artifact.title ?? task.title,
          content: typeof artifact.content === "string" ? artifact.content : JSON.stringify(artifact.content),
        });
      }
    }

    // --- Cognitive Engine: verify + learn (fire-and-forget, don't block) ---
    const verifyAndLearn = async () => {
      try {
        const outputText = result.output.summary || result.output.artifacts?.[0]?.content || "";
        if (!outputText || !task.assignedEmployeeId) return;

        const missionRow = await db
          .select({ orgId: missions.organizationId })
          .from(missions).where(eq(missions.id, missionId)).limit(1);
        const orgId = missionRow[0]?.orgId;
        if (!orgId) return;

        const verification = await verify({
          output: outputText,
          taskTitle: task.title,
          taskDescription: task.description,
          expectedOutput: task.expectedOutput ?? undefined,
          employeeId: task.assignedEmployeeId,
          employeeSlug: "",
          missionId,
          taskId,
          organizationId: orgId,
          intentType: mission.scenario,
        });

        const empSkillRows = await db
          .select({ skillId: employeeSkills.skillId })
          .from(employeeSkills)
          .where(eq(employeeSkills.employeeId, task.assignedEmployeeId));

        if (empSkillRows.length > 0) {
          await updateSkillStats({
            employeeId: task.assignedEmployeeId,
            skillIds: empSkillRows.map((r) => r.skillId),
            qualityScore: verification.qualityScore,
            passed: verification.passed,
            taskId,
            organizationId: orgId,
          });
        }
      } catch (err) {
        console.error("[mission-executor] Verify+learn failed (non-blocking):", err);
      }
    };
    verifyAndLearn(); // fire-and-forget

    return { status: "completed" as const, taskId, durationMs: result.durationMs };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await db
      .update(missionTasks)
      .set({ status: "failed", errorMessage })
      .where(eq(missionTasks.id, taskId));

    if (task.assignedEmployeeId) {
      await db
        .update(aiEmployees)
        .set({ status: "idle", currentTask: null })
        .where(eq(aiEmployees.id, task.assignedEmployeeId));
    }

    return { status: "failed" as const, taskId, error: errorMessage };
  }
}

// ---------------------------------------------------------------------------
// 3. Execute all ready tasks, then check dependencies, repeat until done
// ---------------------------------------------------------------------------

export async function executeAllTasksDirect(missionId: string) {
  // Pre-load mission ONCE (shared across all task executions)
  const mission = await db.query.missions.findFirst({ where: eq(missions.id, missionId) });
  if (!mission) throw new Error(`Mission not found: ${missionId}`);
  const cachedMission = {
    id: mission.id, scenario: mission.scenario, title: mission.title,
    tokenBudget: mission.tokenBudget, tokensUsed: mission.tokensUsed,
    leaderEmployeeId: mission.leaderEmployeeId,
  };

  let rounds = 0;
  const maxRounds = 20;

  while (rounds < maxRounds) {
    rounds++;

    // Cancellation + budget checkpoint (re-read actual values from DB each round)
    const check = await db
      .select({ status: missions.status, tokensUsed: missions.tokensUsed, tokenBudget: missions.tokenBudget })
      .from(missions).where(eq(missions.id, missionId)).limit(1);
    if (check[0]?.status === "cancelled") {
      await db.update(missionTasks)
        .set({ status: "failed", errorMessage: "任务已取消" })
        .where(and(
          eq(missionTasks.missionId, missionId),
          inArray(missionTasks.status, ["pending", "ready"]),
        ));
      break;
    }
    if (check[0] && check[0].tokensUsed >= check[0].tokenBudget) {
      console.warn(`[mission-executor] Token budget exceeded (${check[0].tokensUsed}/${check[0].tokenBudget}), stopping execution`);
      await db.update(missionTasks)
        .set({ status: "failed", errorMessage: `Token 预算已耗尽（${check[0].tokensUsed}/${check[0].tokenBudget}）` })
        .where(and(
          eq(missionTasks.missionId, missionId),
          inArray(missionTasks.status, ["pending", "ready"]),
        ));
      break;
    }

    // Find ready tasks
    const readyTasks = await db.select().from(missionTasks)
      .where(and(eq(missionTasks.missionId, missionId), eq(missionTasks.status, "ready")));

    if (readyTasks.length === 0) {
      // Mark any remaining pending tasks as failed — they're stuck due to broken dependency chains
      await db.update(missionTasks)
        .set({ status: "failed", errorMessage: "依赖链中断，无法继续执行" })
        .where(and(
          eq(missionTasks.missionId, missionId),
          eq(missionTasks.status, "pending"),
        ));
      break;
    }

    // Group by employee for conflict-free parallelism
    const employeeGroups = new Map<string, typeof readyTasks>();
    for (const task of readyTasks) {
      const key = task.assignedEmployeeId ?? task.id;
      const group = employeeGroups.get(key) ?? [];
      group.push(task);
      employeeGroups.set(key, group);
    }

    // Execute groups in parallel — pass cached mission to avoid redundant queries
    await Promise.allSettled(
      [...employeeGroups.values()].map(async (group) => {
        for (const task of group) {
          await executeTaskDirect(task.id, missionId, cachedMission);
        }
      })
    );

    // Lightweight round-end: only load status + deps (NOT outputData which is huge)
    const taskStatuses = await db.select({
      id: missionTasks.id,
      status: missionTasks.status,
      dependencies: missionTasks.dependencies,
    }).from(missionTasks).where(eq(missionTasks.missionId, missionId));

    // Update progress
    const completedCount = taskStatuses.filter((t) => t.status === "completed").length;
    const progressPct = taskStatuses.length > 0 ? Math.round(completedCount / taskStatuses.length * 100) : 0;
    await db.update(missions).set({ progress: progressPct }).where(eq(missions.id, missionId));

    // Build lookup sets
    const completedIds = new Set(taskStatuses.filter((t) => t.status === "completed").map((t) => t.id));
    const terminalStatuses = new Set(["failed", "blocked", "cancelled"]);
    const terminalIds = new Set(taskStatuses.filter((t) => terminalStatuses.has(t.status)).map((t) => t.id));

    // Cascade-fail: pending tasks with any terminal dependency
    const blockedByFailure = taskStatuses.filter((t) => {
      if (t.status !== "pending") return false;
      const deps = (t.dependencies as string[]) || [];
      return deps.some((d) => terminalIds.has(d));
    });

    for (const t of blockedByFailure) {
      await db.update(missionTasks)
        .set({ status: "failed", errorMessage: "上游依赖任务失败，该任务已自动取消" })
        .where(eq(missionTasks.id, t.id));
    }

    // Promote: pending tasks whose deps are all completed
    const pendingWithDeps = taskStatuses.filter((t) => {
      if (t.status !== "pending") return false;
      // Skip tasks we just cascade-failed
      if (blockedByFailure.some((b) => b.id === t.id)) return false;
      const deps = (t.dependencies as string[]) || [];
      return deps.length > 0 && deps.every((d) => completedIds.has(d));
    });

    if (pendingWithDeps.length > 0) {
      const neededDepIds = new Set<string>();
      for (const t of pendingWithDeps) {
        for (const d of (t.dependencies as string[]) || []) neededDepIds.add(d);
      }
      const depOutputRows = neededDepIds.size > 0
        ? await db.select({ id: missionTasks.id, title: missionTasks.title, outputData: missionTasks.outputData })
            .from(missionTasks).where(inArray(missionTasks.id, [...neededDepIds]))
        : [];
      const depOutputMap = new Map(depOutputRows.map((d) => [d.id, d]));

      for (const t of pendingWithDeps) {
        const deps = (t.dependencies as string[]) || [];
        const depOutputs = deps
          .map((id) => depOutputMap.get(id))
          .filter((d): d is NonNullable<typeof d> => !!d && d.outputData !== null)
          .map((d) => ({ taskId: d.id, taskTitle: d.title, output: d.outputData }));

        await db.update(missionTasks)
          .set({ status: "ready", inputContext: depOutputs.length > 0 ? depOutputs : null })
          .where(eq(missionTasks.id, t.id));
      }
    }
  }

  // Post-loop: fail any remaining stuck tasks (safety net for max rounds exceeded)
  if (rounds >= maxRounds) {
    const remainingTasks = await db.select({ id: missionTasks.id, status: missionTasks.status })
      .from(missionTasks).where(eq(missionTasks.missionId, missionId));

    const stuckTasks = remainingTasks.filter(
      (t) => t.status === "pending" || t.status === "ready" || t.status === "in_progress"
    );

    for (const t of stuckTasks) {
      await db.update(missionTasks)
        .set({ status: "failed", errorMessage: "执行轮次已达上限，任务被强制终止" })
        .where(eq(missionTasks.id, t.id));
    }

    if (stuckTasks.length > 0) {
      console.warn(`[mission-executor] Force-failed ${stuckTasks.length} stuck tasks after ${maxRounds} rounds`);
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Leader consolidation
// ---------------------------------------------------------------------------

export async function leaderConsolidateDirect(
  missionId: string,
  organizationId: string
) {
  // Update status
  const [mission] = await db
    .update(missions)
    .set({ status: "consolidating" })
    .where(eq(missions.id, missionId))
    .returning();
  if (!mission) throw new Error(`Mission not found: ${missionId}`);

  // Load completed tasks
  const completedTasks = await db
    .select({
      id: missionTasks.id,
      title: missionTasks.title,
      description: missionTasks.description,
      outputData: missionTasks.outputData,
    })
    .from(missionTasks)
    .where(eq(missionTasks.missionId, missionId));

  // Assemble leader agent
  const agent = await assembleAgent(mission.leaderEmployeeId);

  const prompt = buildConsolidatePrompt(mission, completedTasks);

  const previousSteps = mapTaskOutputsToStepOutputs(completedTasks);

  const result = await executeAgent(agent, {
    stepKey: "leader-consolidate",
    stepLabel: "成果汇总与交付",
    scenario: mission.scenario,
    topicTitle: mission.title,
    previousSteps,
    userInstructions: prompt,
  });

  // Save final output
  await db
    .update(missions)
    .set({
      status: "completed",
      finalOutput: result.output,
      completedAt: new Date(),
      tokensUsed: sql`${missions.tokensUsed} + ${result.tokensUsed.input + result.tokensUsed.output}`,
    })
    .where(eq(missions.id, missionId));

  // Post completion message
  await db.insert(missionMessages).values({
    missionId,
    fromEmployeeId: mission.leaderEmployeeId,
    messageType: "result",
    content: `任务「${mission.title}」已全部完成！共完成 ${completedTasks.length} 个子任务。\n\n${result.output.summary || ""}`,
  });

  // Reset team status
  const teamMemberIds = (mission.teamMembers as string[]) || [];
  const allEmployeeIds = [...new Set([mission.leaderEmployeeId, ...teamMemberIds])];
  for (const empId of allEmployeeIds) {
    await db
      .update(aiEmployees)
      .set({ status: "idle", currentTask: null })
      .where(eq(aiEmployees.id, empId));
  }

  return { status: "completed", taskCount: completedTasks.length };
}

// ---------------------------------------------------------------------------
// 5. Full pipeline — plan + execute + consolidate
// ---------------------------------------------------------------------------

export async function executeMissionDirect(
  missionId: string,
  organizationId: string
) {
  // Transition from queued → planning (signals execution has started)
  await db
    .update(missions)
    .set({ status: "planning", startedAt: new Date() })
    .where(eq(missions.id, missionId));

  // Phase 1: Leader planning
  const plan = await leaderPlanDirect(missionId, organizationId);

  // Phase 2: Execute all tasks
  await executeAllTasksDirect(missionId);

  // Phase 3: 4-level degradation strategy
  const allTasks = await db
    .select({ id: missionTasks.id, status: missionTasks.status })
    .from(missionTasks)
    .where(eq(missionTasks.missionId, missionId));

  const totalCount = allTasks.length;
  const completedCount = allTasks.filter((t) => t.status === "completed").length;
  const failedCount = allTasks.filter((t) => t.status === "failed").length;
  const completionRate = totalCount > 0 ? completedCount / totalCount : 0;

  if (completionRate === 1) {
    // Level 1: 全部完成，正常汇总
    await leaderConsolidateDirect(missionId, organizationId);
    return { status: "completed", taskCount: plan.taskCount };
  } else if (completionRate >= 0.7) {
    // Level 2: 70%+ 完成，降级汇总（仅用已完成任务的输出）
    await leaderConsolidateDirect(missionId, organizationId);
    await db
      .update(missions)
      .set({
        config: sql`jsonb_set(COALESCE(${missions.config}, '{}'::jsonb), '{degradation_level}', '2')`,
      })
      .where(eq(missions.id, missionId));
    return { status: "completed", taskCount: plan.taskCount, degradationLevel: 2, failedCount };
  } else if (completionRate >= 0.3) {
    // Level 3: 30%+ 完成，降级汇总（仅用已完成任务的输出）+ 标注部分交付
    try {
      await leaderConsolidateDirect(missionId, organizationId);
    } catch (err) {
      // Consolidation failed — fall back to a summary message instead of raw IDs
      const completedTaskTitles = await db
        .select({ title: missionTasks.title })
        .from(missionTasks)
        .where(and(eq(missionTasks.missionId, missionId), eq(missionTasks.status, "completed")));
      await db
        .update(missions)
        .set({
          status: "completed",
          completedAt: new Date(),
          finalOutput: {
            degradation_level: 3,
            message: `${completedCount}/${totalCount} 个子任务完成，部分交付（汇总失败：${err instanceof Error ? err.message : String(err)}）`,
            completedTasks: completedTaskTitles.map((t) => t.title),
          },
        })
        .where(eq(missions.id, missionId));
    }
    await db
      .update(missions)
      .set({
        config: sql`jsonb_set(COALESCE(${missions.config}, '{}'::jsonb), '{degradation_level}', '3')`,
      })
      .where(eq(missions.id, missionId));
    return { status: "completed", taskCount: plan.taskCount, degradationLevel: 3, failedCount };
  } else {
    // Level 4: <30% 完成，标记失败
    // Collect failure reasons for diagnosis
    const failedTasks = await db
      .select({ title: missionTasks.title, errorMessage: missionTasks.errorMessage })
      .from(missionTasks)
      .where(and(eq(missionTasks.missionId, missionId), eq(missionTasks.status, "failed")));

    const failureReasons = failedTasks
      .filter((t) => t.errorMessage)
      .map((t) => `${t.title}: ${t.errorMessage}`)
      .slice(0, 5);

    await db
      .update(missions)
      .set({
        status: "failed",
        completedAt: new Date(),
        finalOutput: {
          error: true,
          message: `任务完成率过低（${completedCount}/${totalCount}），${failedCount} 个子任务失败`,
          degradation_level: 4,
          failedAt: new Date().toISOString(),
          failureReasons,
        },
      })
      .where(eq(missions.id, missionId));
    return { status: "failed", taskCount: plan.taskCount, failedCount };
  }
}
