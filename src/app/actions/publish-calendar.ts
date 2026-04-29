"use server";

import { requireAuth } from "@/lib/auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  getPublishCalendar,
  getOptimalPublishTimes,
} from "@/lib/dal/publish-calendar";
import type {
  CalendarPlanItem,
  TimeSlotRecommendation,
  HourlyEngagement,
} from "@/lib/dal/publish-calendar";
// ---------------------------------------------------------------------------
// getCalendarData — 获取发布日历数据 (M3.F06)
// ---------------------------------------------------------------------------

export async function getCalendarData(
  year: number,
  month: number
): Promise<Record<string, CalendarPlanItem[]>> {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("No organization");

  return getPublishCalendar(orgId, year, month);
}

// ---------------------------------------------------------------------------
// getPublishTimeRecommendations — 获取最佳发布时间推荐 (M3.F03)
// ---------------------------------------------------------------------------

export async function getPublishTimeRecommendations(
  channelId?: string
): Promise<{
  recommendations: TimeSlotRecommendation[];
  hourlyData: HourlyEngagement[];
}> {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("No organization");

  return getOptimalPublishTimes(orgId, channelId);
}
