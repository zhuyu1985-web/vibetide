import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  getBatchTopics,
  getBatchStats,
  getConversionTasks,
  getDigitalHumans,
  getChannelAdaptations,
} from "@/lib/dal/batch";
import { VideoBatchClient } from "./video-batch-client";

export default async function VideoBatchPage() {
  let batchTopics: Awaited<ReturnType<typeof getBatchTopics>> = [];
  let batchStats: Awaited<ReturnType<typeof getBatchStats>> = { todayOutput: 0, inProgress: 0, published: 0, pendingReview: 0 };
  let conversionTasks: Awaited<ReturnType<typeof getConversionTasks>> = [];

  try {
    const orgId = await getCurrentUserOrg();
    if (orgId) {
      [batchTopics, batchStats, conversionTasks] = await Promise.all([
        getBatchTopics(orgId),
        getBatchStats(orgId),
        getConversionTasks(orgId),
      ]);
    }
  } catch {
    // Gracefully degrade when DB is unavailable
  }

  const digitalHumans = getDigitalHumans();
  const channelAdaptations = getChannelAdaptations();

  return (
    <VideoBatchClient
      batchTopics={batchTopics}
      batchStats={batchStats}
      conversionTasks={conversionTasks}
      digitalHumans={digitalHumans}
      channelAdaptations={channelAdaptations}
    />
  );
}
