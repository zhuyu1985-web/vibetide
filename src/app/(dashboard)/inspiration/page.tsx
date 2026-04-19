export const dynamic = "force-dynamic";

import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import {
  getInspirationTopics,
  getPlatformMonitors,
  getEditorialMeeting,
} from "@/lib/dal/hot-topics";
import { getUserSubscriptions } from "@/lib/dal/topic-subscriptions";
import { getTopicReadState } from "@/lib/dal/topic-reads";
import { getCalendarEvents } from "@/lib/dal/calendar-events";
import { updateLastViewedAt } from "@/lib/dal/topic-reads";
import { listWorkflowTemplatesByOrg } from "@/lib/dal/workflow-templates";
import { InspirationClient } from "./inspiration-client";

export default async function InspirationPage() {
  // Initialize with empty defaults
  let topics: Awaited<ReturnType<typeof getInspirationTopics>> = [];
  let monitors: Awaited<ReturnType<typeof getPlatformMonitors>> = [];
  let subscriptions: Awaited<ReturnType<typeof getUserSubscriptions>> = null;
  let calendarEventsData: Awaited<ReturnType<typeof getCalendarEvents>> = [];
  let workflows: Awaited<ReturnType<typeof listWorkflowTemplatesByOrg>> = [];
  let lastViewedAt = new Date().toISOString();

  try {
    const auth = await getCurrentUserAndOrg();
    if (auth) {
      const readState = await getTopicReadState(auth.userId, auth.organizationId);
      lastViewedAt = readState.lastViewedAt;

      [topics, monitors, subscriptions, calendarEventsData, workflows] = await Promise.all([
        getInspirationTopics(auth.organizationId, auth.userId),
        getPlatformMonitors(auth.organizationId),
        getUserSubscriptions(auth.userId, auth.organizationId),
        getCalendarEvents(
          auth.organizationId,
          new Date(),
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        ),
        listWorkflowTemplatesByOrg(auth.organizationId, {
          isBuiltin: true,
          isEnabled: true,
        }),
      ]);

      // Update lastViewedAt (fire and forget — don't await)
      updateLastViewedAt(auth.userId, auth.organizationId);
    }
  } catch {
    // Gracefully degrade when DB is unavailable
  }

  const meeting = getEditorialMeeting(topics, monitors, lastViewedAt);

  return (
    <InspirationClient
      topics={topics}
      monitors={monitors}
      meeting={meeting}
      subscriptions={subscriptions}
      calendarEvents={calendarEventsData}
      lastViewedAt={lastViewedAt}
      workflows={workflows}
    />
  );
}
