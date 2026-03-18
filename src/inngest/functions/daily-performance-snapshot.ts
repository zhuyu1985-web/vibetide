import { inngest } from "../client";
import { snapshotAllPerformance } from "@/lib/dal/performance";

export const dailyPerformanceSnapshot = inngest.createFunction(
  {
    id: "daily-performance-snapshot",
  },
  { cron: "TZ=Asia/Shanghai 5 0 * * *" }, // 00:05 Asia/Shanghai daily
  async ({ step }) => {
    const count = await step.run("snapshot-all", async () => {
      return await snapshotAllPerformance();
    });

    return { snapshotCount: count };
  }
);
