import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { researchTasks } from "@/db/schema/research/research-tasks";
import { eq } from "drizzle-orm";

// A3 Phase 5: 重写 task-start — 移除自采 fan-out（tavily/whitelist/manual）。
// 研究任务提交后：标记状态 → 触发 backfill-annotate（历史采集项自动打标注）。
// 实际采集已由 Collection Hub Adapter 架构承担（tavily / list_scraper / jina_url Adapter）。

export const researchTaskStart = inngest.createFunction(
  { id: "research-task-start", concurrency: { limit: 5 } },
  { event: "research/task.submitted" },
  async ({ event, step }) => {
    const { taskId } = event.data as { taskId: string };

    // 1. Load task
    const [task] = await db
      .select({ id: researchTasks.id, organizationId: researchTasks.organizationId })
      .from(researchTasks)
      .where(eq(researchTasks.id, taskId));
    if (!task) return { skipped: true };

    // 2. Mark as analyzing (no crawling phase — Collection Hub handles acquisition)
    await step.run("mark-analyzing", async () => {
      await db
        .update(researchTasks)
        .set({ status: "analyzing", updatedAt: new Date() })
        .where(eq(researchTasks.id, taskId));
    });

    // 3. Trigger backfill-annotate for the org so historical collected_items get topic/district labels
    await step.sendEvent("trigger-backfill-annotate", {
      name: "research/backfill-annotate.requested",
      data: { organizationId: task.organizationId },
    });

    return { taskId, triggeredBackfill: true };
  },
);
