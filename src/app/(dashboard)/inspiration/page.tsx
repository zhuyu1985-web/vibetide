export const dynamic = "force-dynamic";

import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  getInspirationTopics,
  getPlatformMonitors,
  getEditorialMeeting,
} from "@/lib/dal/hot-topics";
import { InspirationClient } from "./inspiration-client";

export default async function InspirationPage() {
  let topics: Awaited<ReturnType<typeof getInspirationTopics>> = [];

  try {
    const orgId = await getCurrentUserOrg();
    if (orgId) {
      topics = await getInspirationTopics(orgId);
    }
  } catch {
    // Gracefully degrade when DB is unavailable
  }

  const monitors = getPlatformMonitors();
  const meeting = getEditorialMeeting(topics);

  return (
    <InspirationClient
      topics={topics}
      monitors={monitors}
      meeting={meeting}
    />
  );
}
