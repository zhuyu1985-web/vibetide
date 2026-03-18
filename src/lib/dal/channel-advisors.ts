import { db } from "@/db";
import {
  channelAdvisors, channelDnaProfiles,
  knowledgeBases, knowledgeItems, knowledgeSyncLogs,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentUserOrg } from "./auth";
import type {
  ChannelAdvisor, ChannelAdvisorDetail, ChannelDNA,
  KnowledgeSource, KnowledgeItem, KnowledgeSyncLog,
} from "@/lib/types";

export async function getChannelAdvisors(): Promise<ChannelAdvisor[]> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return [];

  const rows = await db.query.channelAdvisors.findMany({
    where: eq(channelAdvisors.organizationId, orgId),
    orderBy: [channelAdvisors.createdAt],
  });

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    personality: r.personality,
    channelType: r.channelType,
    avatar: r.avatar || "",
    style: r.style || "",
    strengths: (r.strengths as string[]) || [],
    catchphrase: r.catchphrase || "",
    status: r.status,
  }));
}

export async function getChannelAdvisorDetail(advisorId: string): Promise<ChannelAdvisorDetail | undefined> {
  const row = await db.query.channelAdvisors.findFirst({
    where: eq(channelAdvisors.id, advisorId),
  });

  if (!row) return undefined;

  return {
    id: row.id,
    name: row.name,
    personality: row.personality,
    channelType: row.channelType,
    avatar: row.avatar || "",
    style: row.style || "",
    strengths: (row.strengths as string[]) || [],
    catchphrase: row.catchphrase || "",
    status: row.status,
    systemPrompt: row.systemPrompt || undefined,
    aiEmployeeId: row.aiEmployeeId || undefined,
    knowledgeBaseIds: [],
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getKnowledgeSources(): Promise<{
  upload: KnowledgeSource[];
  cms: KnowledgeSource[];
  subscription: KnowledgeSource[];
  stats: { totalDocuments: number; totalChunks: number; lastSync: string };
}> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { upload: [], cms: [], subscription: [], stats: { totalDocuments: 0, totalChunks: 0, lastSync: "" } };

  const rows = await db.query.knowledgeBases.findMany({
    where: eq(knowledgeBases.organizationId, orgId),
  });

  const toSource = (r: typeof rows[number]): KnowledgeSource => ({
    id: r.id,
    name: r.name,
    type: r.sourceType,
    status: r.vectorizationStatus === "done" ? "active" : r.vectorizationStatus === "processing" ? "syncing" : r.vectorizationStatus === "failed" ? "error" : "pending",
    documentCount: r.documentCount || 0,
    chunkCount: r.chunkCount || 0,
    lastSyncAt: r.lastSyncAt?.toISOString() || "",
    format: r.type,
    sizeDisplay: "",
  });

  const upload = rows.filter((r) => r.sourceType === "upload").map(toSource);
  const cms = rows.filter((r) => r.sourceType === "cms").map(toSource);
  const subscription = rows.filter((r) => r.sourceType === "subscription").map(toSource);

  let totalDocuments = 0, totalChunks = 0;
  let lastSync = "";
  for (const r of rows) {
    totalDocuments += r.documentCount || 0;
    totalChunks += r.chunkCount || 0;
    const syncDate = r.lastSyncAt?.toISOString() || "";
    if (syncDate > lastSync) lastSync = syncDate;
  }

  return { upload, cms, subscription, stats: { totalDocuments, totalChunks, lastSync } };
}

export async function getKnowledgeItems(): Promise<KnowledgeItem[]> {
  const rows = await db.query.knowledgeItems.findMany({
    orderBy: [desc(knowledgeItems.createdAt)],
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title || "",
    source: r.sourceDocument || "",
    sourceType: r.sourceType,
    snippet: r.snippet || "",
    tags: (r.tags as string[]) || [],
    relevanceScore: r.relevanceScore || 0,
    createdAt: r.createdAt.toISOString(),
    chunkIndex: r.chunkIndex || 0,
  }));
}

export async function getChannelDNA(advisorId?: string): Promise<{ dimensions: ChannelDNA[]; report: string }> {
  let dna;
  if (advisorId) {
    dna = await db.query.channelDnaProfiles.findFirst({
      where: eq(channelDnaProfiles.advisorId, advisorId),
      orderBy: [desc(channelDnaProfiles.analyzedAt)],
    });
  } else {
    dna = await db.query.channelDnaProfiles.findFirst({
      orderBy: [desc(channelDnaProfiles.analyzedAt)],
    });
  }

  if (!dna) return { dimensions: [], report: "" };

  return {
    dimensions: (dna.dimensions as { dimension: string; score: number }[]) || [],
    report: dna.report || "",
  };
}

export async function getSyncLogs(): Promise<KnowledgeSyncLog[]> {
  const rows = await db.query.knowledgeSyncLogs.findMany({
    orderBy: [desc(knowledgeSyncLogs.createdAt)],
  });

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    timestamp: r.createdAt.toISOString(),
    status: r.status,
    detail: r.detail || "",
  }));
}
