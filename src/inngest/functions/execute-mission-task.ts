import { inngest } from "../client";
import { db } from "@/db";
import {
  missions,
  missionTasks,
  missionMessages,
  missionArtifacts,
  aiEmployees,
  employeeSkills,
  workflowTemplates,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { assembleAgent, executeAgent } from "@/lib/agent";
import { createMissionTools } from "@/lib/agent/tool-registry";
import {
  loadDependencyOutputs,
  loadEmployeeMessages,
  checkTokenBudget,
} from "@/lib/mission-core";
import { recordSkillUsageInternal } from "@/app/actions/skills";

/**
 * Execute Mission Task — triggered when a task becomes ready.
 *
 * Loads the task, assembles the assigned employee's agent, feeds it
 * dependency outputs as context, executes, and persists the result.
 */
/**
 * onFailure handler — catches any uncaught error from the main function
 * (e.g. step failures before the try-catch, Inngest infrastructure errors).
 * Ensures the task doesn't stay stuck in "in_progress" forever.
 */
const executeMissionTaskFailureHandler = inngest.createFunction(
  { id: "execute-mission-task-failure-handler", retries: 2 },
  { event: "inngest/function.failed" },
  async ({ event, step }) => {
    // Only handle failures from our specific function
    const fnId = (event.data as Record<string, unknown>)?.function_id;
    if (fnId !== "execute-mission-task") return;

    const originalEvent = (event.data as Record<string, unknown>)?.event as
      | { data?: { missionId?: string; taskId?: string; organizationId?: string } }
      | undefined;
    const missionId = originalEvent?.data?.missionId;
    const taskId = originalEvent?.data?.taskId;
    const organizationId = originalEvent?.data?.organizationId || "";

    if (!taskId || !missionId) return;

    await step.run("recover-stuck-task", async () => {
      const task = await db.query.missionTasks.findFirst({
        where: eq(missionTasks.id, taskId),
      });

      // Only recover tasks that are still in_progress (not already handled)
      if (!task || task.status !== "in_progress") return;

      await db
        .update(missionTasks)
        .set({
          status: "failed",
          errorMessage: "任务执行过程中发生未预期的系统错误",
        })
        .where(eq(missionTasks.id, taskId));

      if (task.assignedEmployeeId) {
        await db
          .update(aiEmployees)
          .set({ status: "idle", currentTask: null })
          .where(eq(aiEmployees.id, task.assignedEmployeeId));
      }
    });

    await step.run("fire-task-failed", async () => {
      await inngest.send({
        name: "mission/task-failed",
        data: {
          missionId,
          taskId,
          employeeId: "",
          error: "任务执行过程中发生未预期的系统错误",
          organizationId,
        },
      });
    });
  }
);

export { executeMissionTaskFailureHandler };

export const executeMissionTask = inngest.createFunction(
  {
    id: "execute-mission-task",
    cancelOn: [
      {
        event: "mission/cancelled",
        match: "data.missionId",
      },
    ],
    retries: 0, // retries handled by handle-task-failure
  },
  { event: "mission/task-ready" },
  async ({ event, step }) => {
    const { missionId, taskId, organizationId } = event.data;

    // 1. Load the task and verify it's ready
    const task = await step.run("load-task", async () => {
      const t = await db.query.missionTasks.findFirst({
        where: eq(missionTasks.id, taskId),
      });
      if (!t) throw new Error(`Task not found: ${taskId}`);
      if (t.status !== "ready") {
        // Prevent duplicate execution
        return null;
      }
      return t;
    });

    if (!task) {
      return { status: "skipped", reason: "task not in ready state" };
    }

    // 2. Load the mission
    const mission = await step.run("load-mission", async () => {
      const m = await db.query.missions.findFirst({
        where: eq(missions.id, missionId),
      });
      if (!m) throw new Error(`Mission not found: ${missionId}`);
      return m;
    });

    // 2.5. Check token budget before execution
    const budgetOk = await step.run("check-token-budget", async () => {
      return checkTokenBudget(mission).allowed;
    });

    if (!budgetOk) {
      await step.run("mark-budget-exceeded", async () => {
        await db
          .update(missionTasks)
          .set({ status: "failed", errorMessage: "Token 预算已耗尽" })
          .where(eq(missionTasks.id, taskId));
      });

      // Fire task-failed so handle-task-failure can cascade-fail downstream
      await step.run("fire-budget-exceeded-failed", async () => {
        await inngest.send({
          name: "mission/task-failed",
          data: {
            missionId,
            taskId,
            employeeId: task.assignedEmployeeId || "",
            error: "Token 预算已耗尽",
            organizationId,
          },
        });
      });

      return { status: "failed", reason: "token_budget_exceeded" };
    }

    // 3. Mark task as in_progress and update employee status
    await step.run("mark-in-progress", async () => {
      await db
        .update(missionTasks)
        .set({
          status: "in_progress",
          startedAt: new Date(),
        })
        .where(eq(missionTasks.id, taskId));

      if (task.assignedEmployeeId) {
        await db
          .update(aiEmployees)
          .set({
            status: "working",
            currentTask: `正在执行「${task.title}」`,
          })
          .where(eq(aiEmployees.id, task.assignedEmployeeId));
      }
    });

    // 4. Load dependency tasks' outputs as context
    const previousSteps = await step.run(
      "load-dependency-outputs",
      async () => {
        const deps = (task.dependencies as string[]) || [];
        return loadDependencyOutputs(deps);
      }
    );

    // 5. Load messages addressed to this employee for this mission
    const employeeMessages = await step.run(
      "load-employee-messages",
      async () => {
        if (!task.assignedEmployeeId) return "";
        return loadEmployeeMessages(missionId, task.assignedEmployeeId);
      }
    );

    // 5.5 Resolve scenario display label: 优先 workflow_template.name，legacy slug 回退。
    const scenarioLabel = mission.workflowTemplateId
      ? await step.run("load-template-name", async () => {
          const tpl = await db.query.workflowTemplates.findFirst({
            where: eq(workflowTemplates.id, mission.workflowTemplateId!),
            columns: { name: true },
          });
          return tpl?.name ?? mission.scenario;
        })
      : mission.scenario;

    // 6. Assemble the agent and execute
    let executionResult: Awaited<ReturnType<typeof executeAgent>>;

    try {
      executionResult = await step.run("execute-agent", async () => {
        if (!task.assignedEmployeeId) {
          throw new Error(`Task ${taskId} has no assigned employee`);
        }

        const agent = await assembleAgent(task.assignedEmployeeId);

        // Create mission collaboration tools
        const mTools = createMissionTools({
          missionId,
          employeeId: task.assignedEmployeeId,
          employeeSlug: agent.slug,
          isLeader: agent.slug === "leader",
        });

        const userInstructions = [
          task.description,
          task.expectedOutput
            ? `\n期望输出：${task.expectedOutput}`
            : "",
          employeeMessages
            ? `\n来自团队的消息：\n${employeeMessages}`
            : "",
        ]
          .filter(Boolean)
          .join("\n");

        const result = await executeAgent(agent, {
          stepKey: task.id,
          stepLabel: task.title,
          scenario: scenarioLabel,
          topicTitle: mission.title,
          previousSteps,
          userInstructions,
        }, undefined, mTools);

        return result;
      });
    } catch (error) {
      // Handle execution failure
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await step.run("handle-execution-error", async () => {
        await db
          .update(missionTasks)
          .set({
            status: "failed",
            errorMessage,
          })
          .where(eq(missionTasks.id, taskId));

        if (task.assignedEmployeeId) {
          await db
            .update(aiEmployees)
            .set({ status: "idle", currentTask: null })
            .where(eq(aiEmployees.id, task.assignedEmployeeId));
        }
      });

      await step.run("fire-task-failed", async () => {
        await inngest.send({
          name: "mission/task-failed",
          data: {
            missionId,
            taskId,
            employeeId: task.assignedEmployeeId || "",
            error: errorMessage,
            organizationId,
          },
        });
      });

      return { status: "failed", error: errorMessage };
    }

    // 7. Save output and mark task completed (only if still in_progress)
    // Guard against race condition: resetStaleEmployees may have already
    // marked this task as "failed" while the agent was still running.
    const saved = await step.run("save-output", async () => {
      const current = await db.query.missionTasks.findFirst({
        where: eq(missionTasks.id, taskId),
        columns: { status: true },
      });

      if (current?.status !== "in_progress") {
        // Task was already marked failed/cancelled by cleanup — do not overwrite
        return false;
      }

      await db
        .update(missionTasks)
        .set({
          status: "completed",
          outputData: executionResult.output,
          progress: 100,
          completedAt: new Date(),
        })
        .where(eq(missionTasks.id, taskId));

      // Persist artifacts
      if (executionResult.output.artifacts?.length) {
        for (const artifact of executionResult.output.artifacts) {
          await db.insert(missionArtifacts).values({
            missionId,
            taskId,
            producedBy: task.assignedEmployeeId!,
            type: artifact.type ?? "text",
            title: artifact.title ?? task.title,
            content: typeof artifact.content === "string" ? artifact.content : JSON.stringify(artifact.content),
          });
        }
      }

      // Update mission progress
      const allTasks = await db.select({ status: missionTasks.status }).from(missionTasks).where(eq(missionTasks.missionId, missionId));
      const pct = allTasks.length > 0 ? Math.round(allTasks.filter(t => t.status === "completed").length / allTasks.length * 100) : 0;
      await db.update(missions).set({ progress: pct }).where(eq(missions.id, missionId));

      return true;
    });

    // If task was already failed by cleanup, skip remaining steps
    if (!saved) {
      // Still record token usage even for late-arriving results
      await step.run("update-token-usage-late", async () => {
        const totalTokens =
          executionResult.tokensUsed.input + executionResult.tokensUsed.output;
        await db
          .update(missions)
          .set({
            tokensUsed: sql`${missions.tokensUsed} + ${totalTokens}`,
          })
          .where(eq(missions.id, missionId));
      });

      return {
        status: "aborted",
        reason: "task_already_failed_by_cleanup",
        taskId,
        durationMs: executionResult.durationMs,
      };
    }

    // 8. Reset employee status
    await step.run("reset-employee-status", async () => {
      if (task.assignedEmployeeId) {
        await db
          .update(aiEmployees)
          .set({
            status: "idle",
            currentTask: null,
            tasksCompleted: sql`${aiEmployees.tasksCompleted} + 1`,
            avgResponseTime: `${Math.round(executionResult.durationMs / 1000)}s`,
            updatedAt: new Date(),
          })
          .where(eq(aiEmployees.id, task.assignedEmployeeId));
      }
    });

    // 9. Post a result message
    await step.run("post-result-message", async () => {
      if (task.assignedEmployeeId) {
        await db.insert(missionMessages).values({
          missionId,
          fromEmployeeId: task.assignedEmployeeId,
          messageType: "result",
          content: `「${task.title}」已完成。\n\n${executionResult.output.summary || ""}`,
          relatedTaskId: taskId,
        });
      }
    });

    // 10. Update mission token usage
    await step.run("update-token-usage", async () => {
      const totalTokens =
        executionResult.tokensUsed.input + executionResult.tokensUsed.output;
      await db
        .update(missions)
        .set({
          tokensUsed: sql`${missions.tokensUsed} + ${totalTokens}`,
        })
        .where(eq(missions.id, missionId));
    });

    // 11. Record skill usage for each skill bound to the employee
    await step.run("record-skill-usage", async () => {
      if (!task.assignedEmployeeId) return;

      const empSkills = await db
        .select({ skillId: employeeSkills.skillId })
        .from(employeeSkills)
        .where(eq(employeeSkills.employeeId, task.assignedEmployeeId));

      const totalTokens =
        executionResult.tokensUsed.input + executionResult.tokensUsed.output;

      await Promise.all(
        empSkills.map((es) =>
          recordSkillUsageInternal({
            skillId: es.skillId,
            employeeId: task.assignedEmployeeId!,
            organizationId,
            missionId,
            missionTaskId: taskId,
            success: true,
            executionTimeMs: executionResult.durationMs,
            tokenUsage: totalTokens,
          })
        )
      );
    });

    // 12. Fire task-completed event
    await step.run("fire-task-completed", async () => {
      await inngest.send({
        name: "mission/task-completed",
        data: {
          missionId,
          taskId,
          employeeId: task.assignedEmployeeId || "",
          organizationId,
        },
      });
    });

    // 13. Audit hook — check if this was a review task (xiaoshen)
    // If so, create audit records and optionally pause for human review.
    // TODO: integrate audit hook here — uncomment when ready for production
    //
    // if (task.assignedEmployeeId) {
    //   const auditResult = await step.run("audit-review-hook", async () => {
    //     const employee = await db.query.aiEmployees.findFirst({
    //       where: eq(aiEmployees.id, task.assignedEmployeeId!),
    //       columns: { slug: true },
    //     });
    //     if (employee?.slug !== "xiaoshen") return null;
    //
    //     const { handleReviewTaskCompletion } = await import("@/lib/audit/mission-integration");
    //     const output = executionResult.output;
    //     return handleReviewTaskCompletion({
    //       missionId,
    //       taskId,
    //       organizationId,
    //       contentOutput: output.summary || JSON.stringify(output),
    //       reviewDimensions: (output.dimensions as Record<string, string>) ?? {},
    //       issues: (output.issues as Array<{ type: string; severity: string; description: string; suggestion?: string }>) ?? [],
    //     });
    //   });
    //
    //   if (auditResult?.needsHumanReview) {
    //     await step.run("pause-for-human-review", async () => {
    //       // Find downstream tasks and set them to "in_review" status
    //       const downstreamTasks = await db.query.missionTasks.findMany({
    //         where: eq(missionTasks.missionId, missionId),
    //       });
    //       for (const dt of downstreamTasks) {
    //         const deps = (dt.dependencies as string[]) || [];
    //         if (deps.includes(taskId) && dt.status === "pending") {
    //           await db.update(missionTasks)
    //             .set({ status: "in_review" })
    //             .where(eq(missionTasks.id, dt.id));
    //         }
    //       }
    //     });
    //   }
    // }

    return {
      status: "completed",
      taskId,
      durationMs: executionResult.durationMs,
    };
  }
);
