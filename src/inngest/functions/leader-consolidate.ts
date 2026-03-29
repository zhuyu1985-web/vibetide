import { inngest } from "../client";
import { db } from "@/db";
import {
  missions,
  missionTasks,
  missionMessages,
  aiEmployees,
} from "@/db/schema";
import { eq, sql, and, notInArray } from "drizzle-orm";
import { assembleAgent, executeAgent } from "@/lib/agent";
import {
  buildConsolidatePrompt,
  mapTaskOutputsToStepOutputs,
} from "@/lib/mission-core";

/**
 * Leader Consolidate — triggered when all tasks in a mission are done.
 *
 * The leader agent reviews all task outputs, consolidates them into a
 * coherent final deliverable, and marks the mission as completed.
 */
export const leaderConsolidate = inngest.createFunction(
  { id: "leader-consolidate", retries: 1 },
  { event: "mission/all-tasks-done" },
  async ({ event, step }) => {
    const { missionId, organizationId } = event.data;

    // 1. Update mission status to consolidating
    const mission = await step.run("start-consolidation", async () => {
      const [updated] = await db
        .update(missions)
        .set({ status: "consolidating" })
        .where(eq(missions.id, missionId))
        .returning();
      if (!updated) throw new Error(`Mission not found: ${missionId}`);
      return updated;
    });

    // 2. Load all tasks and check completion rate for degradation strategy
    const allTaskRows = await step.run("load-all-tasks", async () => {
      return db
        .select({
          id: missionTasks.id,
          title: missionTasks.title,
          description: missionTasks.description,
          status: missionTasks.status,
          outputData: missionTasks.outputData,
          assignedEmployeeId: missionTasks.assignedEmployeeId,
        })
        .from(missionTasks)
        .where(eq(missionTasks.missionId, missionId));
    });

    const completedTasks = allTaskRows.filter((t) => t.status === "completed");
    const totalCount = allTaskRows.length;
    const completionRate = totalCount > 0 ? completedTasks.length / totalCount : 0;

    // Degradation: if < 30% completed, mark mission as failed
    if (completionRate < 0.3 && totalCount > 0) {
      await step.run("mark-failed", async () => {
        await db.update(missions).set({
          status: "failed",
          config: sql`jsonb_set(COALESCE(${missions.config}, '{}'::jsonb), '{degradation_level}', '4')`,
        }).where(eq(missions.id, missionId));
      });
      await step.run("cancel-remaining-tasks-on-fail", async () => {
        await db.update(missionTasks).set({ status: "cancelled" }).where(
          and(
            eq(missionTasks.missionId, missionId),
            notInArray(missionTasks.status, ["completed", "failed", "cancelled"])
          )
        );
      });
      return { status: "failed", reason: "completion_rate_below_30", completionRate };
    }

    // 3. Load all mission messages
    const messages = await step.run("load-messages", async () => {
      return db
        .select({
          content: missionMessages.content,
          messageType: missionMessages.messageType,
        })
        .from(missionMessages)
        .where(eq(missionMessages.missionId, missionId));
    });

    // 4. Assemble leader agent and run consolidation
    const consolidationResult = await step.run(
      "consolidate",
      async () => {
        const agent = await assembleAgent(mission.leaderEmployeeId);

        // Build messages summary
        const messagesText = messages
          .map((m) => `[${m.messageType}] ${m.content}`)
          .join("\n");

        const prompt = buildConsolidatePrompt(
          mission,
          completedTasks,
          { messagesText: messagesText || undefined }
        );

        const previousSteps = mapTaskOutputsToStepOutputs(completedTasks);

        const result = await executeAgent(agent, {
          stepKey: "leader-consolidate",
          stepLabel: "成果汇总与交付",
          scenario: mission.scenario,
          topicTitle: mission.title,
          previousSteps,
          userInstructions: prompt,
        });

        return result;
      }
    );

    // 5. Save final output and mark mission completed
    await step.run("complete-mission", async () => {
      await db
        .update(missions)
        .set({
          status: "completed",
          finalOutput: consolidationResult.output,
          completedAt: new Date(),
          tokensUsed: sql`${missions.tokensUsed} + ${
            consolidationResult.tokensUsed.input +
            consolidationResult.tokensUsed.output
          }`,
        })
        .where(eq(missions.id, missionId));
    });

    // 6. Cancel remaining non-completed tasks
    await step.run("cancel-remaining-tasks", async () => {
      await db.update(missionTasks).set({ status: "cancelled" }).where(
        and(
          eq(missionTasks.missionId, missionId),
          notInArray(missionTasks.status, ["completed", "failed", "cancelled"])
        )
      );
    });

    // 7. Post completion message
    await step.run("post-completion-message", async () => {
      await db.insert(missionMessages).values({
        missionId,
        fromEmployeeId: mission.leaderEmployeeId,
        messageType: "result",
        content: `任务「${mission.title}」已全部完成！共完成 ${completedTasks.length} 个子任务。\n\n${consolidationResult.output.summary || ""}`,
      });
    });

    // 8. Reset all team members to idle
    await step.run("reset-team-status", async () => {
      const teamMemberIds = (mission.teamMembers as string[]) || [];
      const allEmployeeIds = [
        ...new Set([mission.leaderEmployeeId, ...teamMemberIds]),
      ];

      for (const empId of allEmployeeIds) {
        await db
          .update(aiEmployees)
          .set({ status: "idle", currentTask: null })
          .where(eq(aiEmployees.id, empId));
      }
    });

    // 9. Trigger learning for involved employees
    await step.run("trigger-learning", async () => {
      const teamMemberIds = (mission.teamMembers as string[]) || [];
      const allEmployeeIds = [
        ...new Set([mission.leaderEmployeeId, ...teamMemberIds]),
      ];

      for (const empId of allEmployeeIds) {
        await inngest.send({
          name: "employee/learn",
          data: {
            employeeId: empId,
            organizationId,
            trigger: "workflow_completion" as const,
          },
        });
      }
    });

    return {
      status: "completed",
      taskCount: completedTasks.length,
      durationMs: consolidationResult.durationMs,
    };
  }
);
