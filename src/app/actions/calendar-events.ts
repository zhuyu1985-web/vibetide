"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  createCalendarEvent,
  updateCalendarEventStatus,
} from "@/lib/dal/calendar-events";
import { revalidatePath } from "next/cache";
export async function createCalendarEventAction(data: {
  name: string;
  category: string;
  eventType: "festival" | "competition" | "conference" | "exhibition" | "launch" | "memorial";
  startDate: string;
  endDate: string;
  isAllDay?: boolean;
  recurrence?: "once" | "yearly" | "custom";
  reminderDaysBefore?: number;
}) {
  const user = await requireAuth();
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile?.organizationId) throw new Error("No organization");

  const eventId = await createCalendarEvent({
    ...data,
    organizationId: profile.organizationId,
    source: "manual",
    status: "confirmed",
    createdBy: user.id,
  });
  revalidatePath("/inspiration");
  return eventId;
}

export async function confirmCalendarEventAction(eventId: string) {
  await requireAuth();
  await updateCalendarEventStatus(eventId, "confirmed");
  revalidatePath("/inspiration");
}

export async function rejectCalendarEventAction(eventId: string) {
  await requireAuth();
  // Mark as confirmed to prevent AI from re-discovering
  await updateCalendarEventStatus(eventId, "confirmed");
  revalidatePath("/inspiration");
}
