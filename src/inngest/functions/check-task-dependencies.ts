import { inngest } from "../client";
import { db } from "@/db";
import { missionTasks } from "@/db/schema";
import { eq } from "drizzle-orm";

const TERMINAL_STATUSES = new Set(["failed", "blocked", "cancelled"]);

/**
 * Check Task Dependencies — triggered when a task completes.
 *
 * Looks for downstream tasks whose dependencies are now fully satisfied,
 * marks them as ready, and fires task-ready events.
 *
 * Also cascade-fails any pending tasks whose dependencies have permanently
 * failed (failed/blocked/cancelled), preventing them from being stuck forever.
 *
 * Finally checks if the mission can be considered done.
 */
export const checkTaskDependencies = inngest.createFunction(
  { id: "check-task-dependencies", retries: 2 },
  { event: "mission/task-completed" },
  async ({ event, step }) => {
    const { missionId, taskId, organizationId } = event.data;

    // 1. Load all tasks for this mission
    const allTasks = await step.run("load-all-tasks", async () => {
      return db
        .select()
        .from(missionTasks)
        .where(eq(missionTasks.missionId, missionId));
    });

    // Build lookup sets
    const completedTaskIds = new Set(
      allTasks.filter((t) => t.status === "completed").map((t) => t.id)
    );
    const terminalTaskIds = new Set(
      allTasks.filter((t) => TERMINAL_STATUSES.has(t.status)).map((t) => t.id)
    );

    // 2. Promote tasks whose dependencies are all completed
    const newlyReadyTasks = allTasks.filter((t) => {
      if (t.status !== "pending") return false;
      const deps = (t.dependencies as string[]) || [];
      if (deps.length === 0) return false;
      if (!deps.includes(taskId)) return false;
      return deps.every((depId) => completedTaskIds.has(depId));
    });

    let readyCount = 0;
    for (const readyTask of newlyReadyTasks) {
      await step.run(`mark-ready-${readyTask.id}`, async () => {
        const deps = (readyTask.dependencies as string[]) || [];
        const depOutputs = allTasks
          .filter((t) => deps.includes(t.id) && t.outputData)
          .map((t) => ({
            taskId: t.id,
            taskTitle: t.title,
            output: t.outputData,
          }));

        await db
          .update(missionTasks)
          .set({
            status: "ready",
            inputContext: depOutputs.length > 0 ? depOutputs : null,
          })
          .where(eq(missionTasks.id, readyTask.id));

        await inngest.send({
          name: "mission/task-ready",
          data: {
            missionId,
            taskId: readyTask.id,
            organizationId,
          },
        });

        readyCount++;
      });
    }

    // 3. Cascade-fail: pending tasks that have ANY terminal dependency
    const blockedByFailure = allTasks.filter((t) => {
      if (t.status !== "pending") return false;
      const deps = (t.dependencies as string[]) || [];
      return deps.some((depId) => terminalTaskIds.has(depId));
    });

    let cascadeFailedCount = 0;
    for (const blocked of blockedByFailure) {
      await step.run(`cascade-fail-${blocked.id}`, async () => {
        await db
          .update(missionTasks)
          .set({
            status: "failed",
            errorMessage: "上游依赖任务失败，该任务已自动取消",
          })
          .where(eq(missionTasks.id, blocked.id));

        cascadeFailedCount++;
      });
    }

    // 4. Check if mission is done (all tasks in a terminal or completed state)
    const allSettled = await step.run("check-all-settled", async () => {
      const freshTasks = await db
        .select({ status: missionTasks.status })
        .from(missionTasks)
        .where(eq(missionTasks.missionId, missionId));

      const settled = freshTasks.every(
        (t) => t.status === "completed" || TERMINAL_STATUSES.has(t.status)
      );
      const allCompleted = freshTasks.every((t) => t.status === "completed");

      return { settled, allCompleted };
    });

    if (allSettled.settled) {
      await step.run("fire-all-tasks-done", async () => {
        await inngest.send({
          name: "mission/all-tasks-done",
          data: {
            missionId,
            organizationId,
          },
        });
      });
    }

    return {
      readyCount,
      cascadeFailedCount,
      allCompleted: allSettled.allCompleted,
      allSettled: allSettled.settled,
    };
  }
);
