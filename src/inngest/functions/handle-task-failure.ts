import { inngest } from "../client";
import { db } from "@/db";
import { missions, missionTasks, missionMessages } from "@/db/schema";
import { eq } from "drizzle-orm";

const MAX_RETRIES = 2;

/**
 * Handle Task Failure — triggered when a task execution fails.
 *
 * Retries the task up to MAX_RETRIES times, then marks the mission as
 * failed if the failure blocks critical downstream tasks.
 */
export const handleTaskFailure = inngest.createFunction(
  { id: "handle-task-failure", retries: 1 },
  { event: "mission/task-failed" },
  async ({ event, step }) => {
    const { missionId, taskId, employeeId, error, organizationId } =
      event.data;

    // 1. Load the failed task
    const task = await step.run("load-failed-task", async () => {
      const t = await db.query.missionTasks.findFirst({
        where: eq(missionTasks.id, taskId),
      });
      if (!t) throw new Error(`Task not found: ${taskId}`);
      return t;
    });

    // 2. Check retry count
    if (task.retryCount < MAX_RETRIES) {
      // Retry: increment count, reset to ready, fire task-ready
      await step.run("setup-retry", async () => {
        await db
          .update(missionTasks)
          .set({
            status: "ready",
            retryCount: task.retryCount + 1,
            errorMessage: null,
          })
          .where(eq(missionTasks.id, taskId));
      });

      await step.run("post-retry-message", async () => {
        // Load the mission to get the leader ID
        const mission = await db.query.missions.findFirst({
          where: eq(missions.id, missionId),
        });
        if (!mission) return;

        await db.insert(missionMessages).values({
          missionId,
          fromEmployeeId: mission.leaderEmployeeId,
          messageType: "coordination",
          content: `任务「${task.title}」执行失败（第 ${task.retryCount + 1} 次），正在重试...\n错误信息：${error}`,
          relatedTaskId: taskId,
        });
      });

      await step.run("fire-retry", async () => {
        await inngest.send({
          name: "mission/task-ready",
          data: {
            missionId,
            taskId,
            organizationId,
          },
        });
      });

      return { status: "retrying", retryCount: task.retryCount + 1 };
    }

    // 3. Permanent failure — notify leader
    await step.run("post-failure-message", async () => {
      const mission = await db.query.missions.findFirst({
        where: eq(missions.id, missionId),
      });
      if (!mission) return;

      await db.insert(missionMessages).values({
        missionId,
        fromEmployeeId: mission.leaderEmployeeId,
        messageType: "status_update",
        content: `任务「${task.title}」在 ${MAX_RETRIES} 次重试后仍然失败。\n错误信息：${error}\n该任务已被标记为永久失败。`,
        relatedTaskId: taskId,
      });
    });

    // 4. Cascade-fail all downstream pending/ready tasks that depend on this one
    const cascadeResult = await step.run(
      "cascade-fail-downstream",
      async () => {
        const allTasks = await db
          .select()
          .from(missionTasks)
          .where(eq(missionTasks.missionId, missionId));

        // BFS: find all tasks transitively blocked by this failure
        const failedIds = new Set<string>([taskId]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const t of allTasks) {
            if (failedIds.has(t.id)) continue;
            if (t.status !== "pending" && t.status !== "ready") continue;
            const deps = (t.dependencies as string[]) || [];
            if (deps.some((d) => failedIds.has(d))) {
              failedIds.add(t.id);
              changed = true;
            }
          }
        }

        // Exclude the original failed task itself
        failedIds.delete(taskId);

        // Mark all transitively blocked tasks as failed
        for (const blockedId of failedIds) {
          await db
            .update(missionTasks)
            .set({
              status: "failed",
              errorMessage: "上游依赖任务失败，该任务已自动取消",
            })
            .where(eq(missionTasks.id, blockedId));
        }

        return { cascadeCount: failedIds.size };
      }
    );

    // 5. Check if the mission can still complete (any tasks still running or ready?)
    const missionStatus = await step.run("check-mission-status", async () => {
      const freshTasks = await db
        .select({ status: missionTasks.status })
        .from(missionTasks)
        .where(eq(missionTasks.missionId, missionId));

      const hasActiveWork = freshTasks.some(
        (t) =>
          t.status === "pending" ||
          t.status === "ready" ||
          t.status === "in_progress"
      );

      return { hasActiveWork, total: freshTasks.length };
    });

    // If no more active work, fire all-tasks-done to trigger consolidation
    // (which handles degradation levels based on completion rate)
    if (!missionStatus.hasActiveWork) {
      await step.run("fire-all-tasks-done", async () => {
        await inngest.send({
          name: "mission/all-tasks-done",
          data: { missionId, organizationId },
        });
      });
    }

    return {
      status: "permanently_failed",
      taskId,
      cascadeCount: cascadeResult.cascadeCount,
      missionSettled: !missionStatus.hasActiveWork,
    };
  }
);
