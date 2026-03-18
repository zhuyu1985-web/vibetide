import { db } from "@/db";
import { events, eventHighlights, eventOutputs, eventTranscriptions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type {
  SportEvent,
  ConferenceEvent,
  FestivalEvent,
  ExhibitionEvent,
} from "@/lib/types";

async function getEventByType(orgId: string, type: string) {
  return db.query.events.findFirst({
    where: and(
      eq(events.organizationId, orgId),
      eq(events.type, type as "sport" | "conference" | "festival" | "exhibition")
    ),
    with: {
      highlights: true,
      outputs: true,
      transcriptions: true,
    },
  });
}

export async function getSportEvent(
  orgId: string
): Promise<SportEvent | null> {
  const row = await getEventByType(orgId, "sport");
  if (!row) return null;

  const meta = row.metadata as Record<string, unknown>;
  const stats = row.stats as Record<string, number>;

  return {
    id: row.id,
    name: row.name,
    teams: (meta?.teams as SportEvent["teams"]) || [],
    status: row.status,
    time: (meta?.time as string) || "",
    period: (meta?.period as string) || "",
    highlights: row.highlights.map((h) => ({
      time: h.time || "",
      type: h.type as SportEvent["highlights"][number]["type"],
      description: h.description || "",
      autoClipped: h.autoClipped || false,
    })),
    autoOutputs: row.outputs.map((o) => ({
      id: o.id,
      title: o.title,
      type: o.type as "clip" | "summary" | "graphic",
      status: o.status === "done"
        ? ("done" as const)
        : o.status === "processing"
          ? ("processing" as const)
          : ("pending" as const),
      progress: o.progress || 0,
      duration: o.duration || undefined,
    })),
    stats: {
      produced: stats?.produced || 0,
      published: stats?.published || 0,
      totalViews: stats?.totalViews || 0,
    },
  };
}

export async function getConferenceEvent(
  orgId: string
): Promise<ConferenceEvent | null> {
  const row = await getEventByType(orgId, "conference");
  if (!row) return null;

  const meta = row.metadata as Record<string, unknown>;
  const stats = row.stats as Record<string, number>;

  return {
    id: row.id,
    name: row.name,
    speaker: (meta?.speaker as string) || "",
    speakerTitle: (meta?.speakerTitle as string) || "",
    status: row.status,
    time: (meta?.time as string) || "",
    transcription: row.transcriptions
      .filter((t) => !t.goldenQuote)
      .map((t) => t.content),
    goldenQuotes: row.transcriptions
      .filter((t) => t.goldenQuote)
      .map((t) => t.content),
    outputs: row.outputs.map((o) => ({
      id: o.id,
      title: o.title,
      type: o.type as "flash" | "summary" | "quote_card",
      status: o.status === "done" ? ("done" as const) : ("processing" as const),
    })),
    stats: {
      transcribedWords: stats?.transcribedWords || 0,
      quotesExtracted: stats?.quotesExtracted || 0,
      outputsGenerated: stats?.outputsGenerated || 0,
    },
  };
}

export async function getFestivalEvent(
  orgId: string
): Promise<FestivalEvent | null> {
  const row = await getEventByType(orgId, "festival");
  if (!row) return null;

  const meta = row.metadata as Record<string, unknown>;

  return {
    id: row.id,
    name: row.name,
    date: row.startTime?.toISOString().slice(0, 10) || "",
    phases: (meta?.phases as FestivalEvent["phases"]) || [],
  };
}

export async function getExhibitionEvent(
  orgId: string
): Promise<ExhibitionEvent | null> {
  const row = await getEventByType(orgId, "exhibition");
  if (!row) return null;

  const meta = row.metadata as Record<string, unknown>;

  return {
    id: row.id,
    name: row.name,
    date: (meta?.date as string) || "",
    location: (meta?.location as string) || "",
    booths: (meta?.booths as ExhibitionEvent["booths"]) || [],
    autoProducts: (meta?.autoProducts as ExhibitionEvent["autoProducts"]) || [],
  };
}
