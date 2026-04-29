import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  getSportEvent,
  getConferenceEvent,
  getFestivalEvent,
  getExhibitionEvent,
} from "@/lib/dal/events";
import { EventAutoClient } from "./event-auto-client";

export default async function EventAutoPage() {
  let sportEvent: Awaited<ReturnType<typeof getSportEvent>> | null = null;
  let conferenceEvent: Awaited<ReturnType<typeof getConferenceEvent>> | null = null;
  let festivalEvent: Awaited<ReturnType<typeof getFestivalEvent>> | null = null;
  let exhibitionEvent: Awaited<ReturnType<typeof getExhibitionEvent>> | null = null;

  try {
    const orgId = await getCurrentUserOrg();
    if (orgId) {
      [sportEvent, conferenceEvent, festivalEvent, exhibitionEvent] =
        await Promise.all([
          getSportEvent(orgId),
          getConferenceEvent(orgId),
          getFestivalEvent(orgId),
          getExhibitionEvent(orgId),
        ]);
    }
  } catch {
    // Gracefully degrade when DB is unavailable
  }

  return (
    <EventAutoClient
      sportEvent={sportEvent}
      conferenceEvent={conferenceEvent}
      festivalEvent={festivalEvent}
      exhibitionEvent={exhibitionEvent}
    />
  );
}
