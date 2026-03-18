"use server";

import { db } from "@/db";
import {
  events,
  eventHighlights,
  eventOutputs,
  eventTranscriptions,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function createEvent(data: {
  organizationId: string;
  name: string;
  type: "sport" | "conference" | "festival" | "exhibition";
  status?: "upcoming" | "live" | "finished";
  startTime?: Date;
  endTime?: Date;
  metadata?: Record<string, unknown>;
  stats?: Record<string, unknown>;
}) {
  await requireAuth();

  const [event] = await db.insert(events).values(data).returning();

  revalidatePath("/event-auto");
  return event;
}

export async function addEventHighlight(data: {
  eventId: string;
  time?: string;
  type: "goal" | "slam_dunk" | "save" | "foul" | "highlight" | "speech" | "announcement";
  description?: string;
  autoClipped?: boolean;
}) {
  await requireAuth();

  await db.insert(eventHighlights).values(data);

  revalidatePath("/event-auto");
}

export async function createEventOutput(data: {
  eventId: string;
  title: string;
  type: "clip" | "summary" | "graphic" | "flash" | "quote_card";
  status?: "pending" | "processing" | "done" | "failed";
  duration?: string;
}) {
  await requireAuth();

  const [output] = await db
    .insert(eventOutputs)
    .values(data)
    .returning();

  revalidatePath("/event-auto");
  return output;
}

export async function updateEventOutputStatus(
  outputId: string,
  status: "pending" | "processing" | "done" | "failed",
  progress?: number
) {
  await requireAuth();

  await db
    .update(eventOutputs)
    .set({ status, progress: progress ?? undefined })
    .where(eq(eventOutputs.id, outputId));

  revalidatePath("/event-auto");
}

export async function addTranscription(data: {
  eventId: string;
  speaker?: string;
  content: string;
  goldenQuote?: boolean;
  timestamp?: string;
}) {
  await requireAuth();

  await db.insert(eventTranscriptions).values(data);

  revalidatePath("/event-auto");
}

export async function getSportEvent(eventId: string) {
  await requireAuth();

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    with: {
      highlights: {
        orderBy: (h, { asc }) => [asc(h.createdAt)],
      },
      outputs: {
        orderBy: (o, { asc }) => [asc(o.createdAt)],
      },
      transcriptions: {
        orderBy: (t, { asc }) => [asc(t.createdAt)],
      },
    },
  });

  if (!event) return null;

  return {
    id: event.id,
    name: event.name,
    type: event.type,
    status: event.status,
    startTime: event.startTime?.toISOString(),
    endTime: event.endTime?.toISOString(),
    metadata: event.metadata,
    stats: event.stats,
    highlights: event.highlights.map((h) => ({
      id: h.id,
      time: h.time,
      type: h.type,
      description: h.description,
      autoClipped: h.autoClipped,
    })),
    outputs: event.outputs.map((o) => ({
      id: o.id,
      title: o.title,
      type: o.type,
      status: o.status,
      duration: o.duration,
      progress: o.progress,
    })),
    transcriptions: event.transcriptions.map((t) => ({
      id: t.id,
      speaker: t.speaker,
      content: t.content,
      goldenQuote: t.goldenQuote,
      timestamp: t.timestamp,
    })),
  };
}

export async function updateEventStatus(
  eventId: string,
  status: "upcoming" | "live" | "finished"
) {
  await requireAuth();

  await db
    .update(events)
    .set({ status, updatedAt: new Date() })
    .where(eq(events.id, eventId));

  revalidatePath("/event-auto");
}
