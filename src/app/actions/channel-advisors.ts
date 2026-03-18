"use server";

import { db } from "@/db";
import { channelAdvisors, channelDnaProfiles, knowledgeBases, knowledgeSyncLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function createChannelAdvisor(data: {
  organizationId: string;
  name: string;
  channelType: string;
  personality: string;
  avatar?: string;
  style?: string;
  strengths?: string[];
  catchphrase?: string;
  systemPrompt?: string;
  targetAudience?: string;
  channelPositioning?: string;
}) {
  await requireAuth();
  const [advisor] = await db.insert(channelAdvisors).values(data).returning();
  revalidatePath("/channel-advisor");
  return { advisorId: advisor.id };
}

export async function updateAdvisorPersonality(advisorId: string, data: {
  name?: string;
  personality?: string;
  style?: string;
  strengths?: string[];
  catchphrase?: string;
  systemPrompt?: string;
  targetAudience?: string;
  channelPositioning?: string;
}) {
  await requireAuth();
  await db.update(channelAdvisors).set({ ...data, updatedAt: new Date() }).where(eq(channelAdvisors.id, advisorId));
  revalidatePath("/channel-advisor");
}

export async function toggleAdvisorStatus(advisorId: string, status: "active" | "training" | "draft") {
  await requireAuth();
  await db.update(channelAdvisors).set({ status, updatedAt: new Date() }).where(eq(channelAdvisors.id, advisorId));
  revalidatePath("/channel-advisor");
}

export async function uploadKnowledgeDocument(knowledgeBaseId: string, _formData: FormData) {
  await requireAuth();
  // Placeholder: In production, upload to storage, parse document, chunk, embed
  await db.update(knowledgeBases).set({
    documentCount: 1,
    chunkCount: 10,
    vectorizationStatus: "done",
    lastSyncAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(knowledgeBases.id, knowledgeBaseId));

  await db.insert(knowledgeSyncLogs).values({
    knowledgeBaseId,
    action: "文档上传",
    status: "success",
    detail: "文档已解析并向量化",
    documentsProcessed: 1,
    chunksGenerated: 10,
    errorsCount: 0,
  });

  revalidatePath("/channel-knowledge");
  return { documentId: knowledgeBaseId, chunkCount: 10 };
}

export async function addKnowledgeSubscription(knowledgeBaseId: string, config: { url: string; frequency: string }) {
  await requireAuth();
  await db.update(knowledgeBases).set({
    syncConfig: config,
    sourceType: "subscription",
    updatedAt: new Date(),
  }).where(eq(knowledgeBases.id, knowledgeBaseId));
  revalidatePath("/channel-knowledge");
}

export async function syncKnowledgeBase(knowledgeBaseId: string) {
  await requireAuth();
  await db.update(knowledgeBases).set({
    vectorizationStatus: "processing",
    lastSyncAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(knowledgeBases.id, knowledgeBaseId));

  await db.insert(knowledgeSyncLogs).values({
    knowledgeBaseId,
    action: "手动同步",
    status: "success",
    detail: "同步完成",
    documentsProcessed: 0,
    chunksGenerated: 0,
    errorsCount: 0,
  });

  revalidatePath("/channel-knowledge");
}

export async function testAdvisorChat(advisorId: string, message: string) {
  await requireAuth();
  // Placeholder: In production, call LLM with advisor's system prompt
  return { response: `[${advisorId}] 收到消息: "${message}". 这是一个模拟回复。` };
}

export async function analyzeChannelDNA(advisorId: string) {
  await requireAuth();
  // Placeholder: In production, analyze content patterns
  await db.insert(channelDnaProfiles).values({
    advisorId,
    dimensions: [
      { dimension: "专业深度", score: 85 },
      { dimension: "时效性", score: 75 },
      { dimension: "可读性", score: 80 },
      { dimension: "互动性", score: 70 },
      { dimension: "视觉表达", score: 65 },
      { dimension: "情感共鸣", score: 60 },
    ],
    report: "频道风格分析已完成。",
    analyzedAt: new Date(),
  });
  revalidatePath("/channel-knowledge");
  revalidatePath("/channel-advisor");
}
