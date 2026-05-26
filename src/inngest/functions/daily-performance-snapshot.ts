import { inngest } from "../client";
import { snapshotAllPerformance } from "@/lib/dal/performance";

export const dailyPerformanceSnapshot = inngest.createFunction(
  {
    id: "daily-performance-snapshot",
  },
  // 触发时机由 scheduled_jobs.daily-performance-snapshot 表配置(默认 SH 00:05)
  { event: "scheduled-jobs/daily-performance-snapshot.run" },
  async ({ step }) => {
    const count = await step.run("snapshot-all", async () => {
      return await snapshotAllPerformance();
    });

    return { snapshotCount: count };
  }
);
