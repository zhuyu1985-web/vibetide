import { inngest } from "../client";
import { db } from "@/db";
import { aiEmployees, missionTasks } from "@/db/schema";
import { eq, and, lt, inArray } from "drizzle-orm";

/**
 * 员工状态守护 — 每30分钟检查并重置卡在 working 状态的员工，
 * 同时将对应的 in_progress 任务标记为 failed 并触发失败处理。
 */
export const employeeStatusGuard = inngest.createFunction(
  { id: "employee-status-guard" },
  { cron: "*/30 * * * *" },
  async ({ step }) => {
    const staleThreshold = new Date(Date.now() - 30 * 60 * 1000);

    const staleEmployees = await step.run("find-stale-workers", async () => {
      return db
        .select({ id: aiEmployees.id, slug: aiEmployees.slug })
        .from(aiEmployees)
        .where(
          and(
            eq(aiEmployees.status, "working"),
            lt(aiEmployees.updatedAt, staleThreshold)
          )
        );
    });

    if (staleEmployees.length === 0) {
      return { status: "ok", resetCount: 0, staleTaskCount: 0 };
    }

    // Find in_progress tasks assigned to stale employees
    const staleEmpIds = staleEmployees.map((e) => e.id);
    const staleTasks = await step.run("find-stale-tasks", async () => {
      return db
        .select({
          id: missionTasks.id,
          missionId: missionTasks.missionId,
          assignedEmployeeId: missionTasks.assignedEmployeeId,
          title: missionTasks.title,
        })
        .from(missionTasks)
        .where(
          and(
            inArray(missionTasks.assignedEmployeeId, staleEmpIds),
            eq(missionTasks.status, "in_progress")
          )
        );
    });

    // Reset employees + fail their stale tasks
    await step.run("reset-stale-workers", async () => {
      for (const emp of staleEmployees) {
        await db
          .update(aiEmployees)
          .set({ status: "idle", currentTask: null, updatedAt: new Date() })
          .where(eq(aiEmployees.id, emp.id));
        console.log(`[status-guard] Reset stale worker ${emp.slug} to idle`);
      }

      for (const task of staleTasks) {
        await db
          .update(missionTasks)
          .set({
            status: "failed",
            errorMessage: "任务执行超时（超过 30 分钟），已被系统自动终止",
          })
          .where(eq(missionTasks.id, task.id));
        console.log(`[status-guard] Failed stale task ${task.id} (${task.title})`);
      }
    });

    // Fire task-failed events so handle-task-failure can cascade
    for (const task of staleTasks) {
      await step.run(`fire-task-failed-${task.id}`, async () => {
        await inngest.send({
          name: "mission/task-failed",
          data: {
            missionId: task.missionId,
            taskId: task.id,
            employeeId: task.assignedEmployeeId || "",
            error: "任务执行超时（超过 30 分钟），已被系统自动终止",
            organizationId: "", // guard is cross-org, handler will load from mission
          },
        });
      });
    }

    return {
      status: "reset",
      resetCount: staleEmployees.length,
      staleTaskCount: staleTasks.length,
    };
  }
);
