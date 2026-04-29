import { getChannels, getPublishPlans } from "@/lib/dal/publishing";
import { getReviewResults } from "@/lib/dal/reviews";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  getPublishCalendar,
  getOptimalPublishTimes,
} from "@/lib/dal/publish-calendar";
import PublishingClient from "./publishing-client";

export default async function PublishingPage() {
  const orgId = await getCurrentUserOrg().catch(() => null);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const emptyCalendar = {} as Record<string, Array<{ id: string; title: string; channel: string; status: string; scheduledAt: string }>>;
  const emptyOptimalTimes = {
    recommendations: [] as Array<{ hour: number; label: string; avgEngagement: number; confidence: number }>,
    hourlyData: [] as Array<{ hour: number; label: string; avgEngagement: number; count: number }>,
  };

  const [channels, publishPlans, reviews, calendarData, optimalTimes] =
    await Promise.all([
      getChannels().catch(() => []),
      getPublishPlans().catch(() => []),
      getReviewResults().catch(() => []),
      orgId
        ? getPublishCalendar(orgId, year, month).catch(() => emptyCalendar)
        : Promise.resolve(emptyCalendar),
      orgId
        ? getOptimalPublishTimes(orgId).catch(() => emptyOptimalTimes)
        : Promise.resolve(emptyOptimalTimes),
    ]);

  return (
    <PublishingClient
      channels={channels}
      publishPlans={publishPlans}
      reviews={reviews}
      calendarData={calendarData}
      calendarYear={year}
      calendarMonth={month}
      optimalTimeRecommendations={optimalTimes.recommendations}
      optimalTimeHourlyData={optimalTimes.hourlyData}
    />
  );
}
