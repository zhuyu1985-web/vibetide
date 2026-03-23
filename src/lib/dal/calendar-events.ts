import { db } from "@/db";
import { calendarEvents } from "@/db/schema";
import { eq, and, gte, lte, or } from "drizzle-orm";
import type { CalendarEvent } from "@/lib/types";

export async function getCalendarEvents(
  organizationId: string,
  startRange: Date,
  endRange: Date
): Promise<CalendarEvent[]> {
  const startStr = startRange.toISOString().split("T")[0];
  const endStr = endRange.toISOString().split("T")[0];

  const results = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.organizationId, organizationId),
        or(
          and(gte(calendarEvents.startDate, startStr), lte(calendarEvents.startDate, endStr)),
          and(lte(calendarEvents.startDate, endStr), gte(calendarEvents.endDate, startStr))
        ),
        or(
          eq(calendarEvents.status, "confirmed"),
          eq(calendarEvents.status, "pending_review")
        )
      )
    )
    .orderBy(calendarEvents.startDate);

  return results.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    eventType: row.eventType,
    startDate: row.startDate,
    endDate: row.endDate,
    isAllDay: row.isAllDay,
    recurrence: row.recurrence,
    source: row.source,
    status: row.status,
    aiAngles: (row.aiAngles as string[]) || [],
    reminderDaysBefore: row.reminderDaysBefore,
  }));
}

export async function createCalendarEvent(
  data: {
    organizationId: string;
    name: string;
    category: string;
    eventType: "festival" | "competition" | "conference" | "exhibition" | "launch" | "memorial";
    startDate: string;
    endDate: string;
    isAllDay?: boolean;
    recurrence?: "once" | "yearly" | "custom";
    source: "builtin" | "manual" | "ai_discovered";
    status?: "confirmed" | "pending_review";
    aiAngles?: string[];
    reminderDaysBefore?: number;
    createdBy?: string;
  }
): Promise<string> {
  const result = await db
    .insert(calendarEvents)
    .values({
      organizationId: data.organizationId,
      name: data.name,
      category: data.category,
      eventType: data.eventType,
      startDate: data.startDate,
      endDate: data.endDate,
      isAllDay: data.isAllDay ?? true,
      recurrence: data.recurrence ?? "once",
      source: data.source,
      status: data.status ?? "confirmed",
      aiAngles: data.aiAngles ?? [],
      reminderDaysBefore: data.reminderDaysBefore ?? 3,
      createdBy: data.createdBy,
    })
    .returning({ id: calendarEvents.id });

  return result[0].id;
}

export async function updateCalendarEventStatus(
  eventId: string,
  status: "confirmed" | "pending_review"
): Promise<void> {
  await db
    .update(calendarEvents)
    .set({ status, updatedAt: new Date() })
    .where(eq(calendarEvents.id, eventId));
}
