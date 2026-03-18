"use server";

import { db } from "@/db";
import {
  benchmarkAnalyses,
  missedTopics,
  weeklyReports,
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

export async function createBenchmarkAnalysis(data: {
  organizationId: string;
  topicTitle: string;
  category?: string;
  mediaScores?: {
    media: string;
    isUs: boolean;
    scores: { dimension: string; score: number }[];
    total: number;
    publishTime: string;
  }[];
  radarData?: { dimension: string; us: number; best: number }[];
  improvements?: string[];
}) {
  await requireAuth();

  const [analysis] = await db
    .insert(benchmarkAnalyses)
    .values(data)
    .returning();

  revalidatePath("/benchmarking");
  return analysis;
}

export async function createMissedTopic(data: {
  organizationId: string;
  title: string;
  priority?: "high" | "medium" | "low";
  competitors?: string[];
  heatScore?: number;
  category?: string;
  type?: "breaking" | "trending" | "analysis";
}) {
  await requireAuth();

  const [topic] = await db
    .insert(missedTopics)
    .values(data)
    .returning();

  revalidatePath("/benchmarking");
  return topic;
}

export async function startMissedTopicTracking(topicId: string) {
  await requireAuth();

  await db
    .update(missedTopics)
    .set({ status: "tracking" })
    .where(eq(missedTopics.id, topicId));

  revalidatePath("/benchmarking");
}

export async function resolveMissedTopic(topicId: string) {
  await requireAuth();

  await db
    .update(missedTopics)
    .set({ status: "resolved" })
    .where(eq(missedTopics.id, topicId));

  revalidatePath("/benchmarking");
}

export async function saveWeeklyReport(data: {
  organizationId: string;
  period: string;
  overallScore?: number;
  missedRate?: number;
  responseSpeed?: string;
  coverageRate?: number;
  trends?: { week: string; score: number; missedRate: number }[];
  gapList?: { area: string; gap: string; suggestion: string }[];
}) {
  await requireAuth();

  const [report] = await db
    .insert(weeklyReports)
    .values(data)
    .returning();

  revalidatePath("/benchmarking");
  return report;
}
