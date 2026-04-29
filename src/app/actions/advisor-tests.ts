"use server";

import { db } from "@/db";
import {
  advisorCompareTests,
  advisorAbTests,
} from "@/db/schema/advisor-tests";
import { channelAdvisors } from "@/db/schema/channel-advisors";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { revalidatePath } from "next/cache";
/**
 * Run comparison test: for each advisor, generate a mock response.
 */
export async function runAdvisorComparison(
  testInput: string,
  advisorIds: string[]
) {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("No organization");

  // Load advisor details
  const advisors = await Promise.all(
    advisorIds.map((id) =>
      db.query.channelAdvisors.findFirst({
        where: eq(channelAdvisors.id, id),
      })
    )
  );

  // Generate mock responses for each advisor
  const results = advisors.map((advisor) => {
    if (!advisor) {
      return {
        advisorId: "unknown",
        advisorName: "未知顾问",
        output: "顾问不存在",
        responseTime: 0,
        tokenCount: 0,
      };
    }

    const mockStyles: Record<string, string> = {
      active: "精炼直接",
      training: "详细深入",
      draft: "初步探索",
    };

    const styleDesc = mockStyles[advisor.status] || "标准";
    const responseTime = Math.floor(Math.random() * 3000) + 500;
    const tokenCount = Math.floor(Math.random() * 400) + 100;

    // Generate style-aware mock output
    const output = `[${advisor.name} - ${styleDesc}风格]\n\n针对"${testInput}"的回复：\n\n${
      advisor.personality
    }视角下的分析：这是一个值得深入探讨的话题。${
      advisor.style
        ? `以${advisor.style}的方式`
        : "以专业的方式"
    }来表达，${
      (advisor.strengths as string[])?.length
        ? `充分发挥${(advisor.strengths as string[])[0]}等核心能力`
        : "结合专业知识"
    }。\n\n${advisor.catchphrase || "让内容更有价值。"}`;

    return {
      advisorId: advisor.id,
      advisorName: advisor.name,
      output,
      responseTime,
      tokenCount,
    };
  });

  const [test] = await db
    .insert(advisorCompareTests)
    .values({
      organizationId: orgId,
      testInput,
      advisorIds,
      results,
    })
    .returning();

  revalidatePath("/channel-advisor/compare");
  return { testId: test.id, results };
}

/**
 * Select a winner for a comparison test.
 */
export async function selectComparisonWinner(
  testId: string,
  winnerId: string
) {
  await requireAuth();
  await db
    .update(advisorCompareTests)
    .set({ selectedWinner: winnerId })
    .where(eq(advisorCompareTests.id, testId));

  revalidatePath("/channel-advisor/compare");
}

/**
 * Create a new A/B test.
 */
export async function createAbTest(
  name: string,
  advisorAId: string,
  advisorBId: string
) {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("No organization");

  // Load both advisors to compute config diff
  const [advisorA, advisorB] = await Promise.all([
    db.query.channelAdvisors.findFirst({
      where: eq(channelAdvisors.id, advisorAId),
    }),
    db.query.channelAdvisors.findFirst({
      where: eq(channelAdvisors.id, advisorBId),
    }),
  ]);

  const configDiff: Record<string, unknown> = {
    personalityA: advisorA?.personality || "",
    personalityB: advisorB?.personality || "",
    styleA: advisorA?.style || "",
    styleB: advisorB?.style || "",
  };

  // Initialize with mock metrics
  const initialMetrics = {
    a: { views: 0, engagement: 0, quality: 0 },
    b: { views: 0, engagement: 0, quality: 0 },
  };

  const [test] = await db
    .insert(advisorAbTests)
    .values({
      organizationId: orgId,
      name,
      advisorAId,
      advisorBId,
      configDiff,
      status: "active",
      metrics: initialMetrics,
      sampleSize: { a: 0, b: 0 },
      confidence: 0,
    })
    .returning();

  revalidatePath("/channel-advisor/ab-test");
  return { testId: test.id };
}

/**
 * Update A/B test metrics (simulated).
 */
export async function updateAbTestMetrics(
  testId: string,
  metrics: {
    a: { views: number; engagement: number; quality: number };
    b: { views: number; engagement: number; quality: number };
  }
) {
  await requireAuth();

  // Calculate simple confidence based on sample divergence
  const totalA = metrics.a.views + metrics.a.engagement + metrics.a.quality;
  const totalB = metrics.b.views + metrics.b.engagement + metrics.b.quality;
  const diff = Math.abs(totalA - totalB);
  const total = totalA + totalB || 1;
  const confidence = Math.min(diff / total, 0.99);

  await db
    .update(advisorAbTests)
    .set({
      metrics,
      confidence: Math.round(confidence * 100) / 100,
    })
    .where(eq(advisorAbTests.id, testId));

  revalidatePath("/channel-advisor/ab-test");
}

/**
 * Complete an A/B test and declare a winner.
 */
export async function completeAbTest(testId: string, winner: "a" | "b") {
  await requireAuth();

  await db
    .update(advisorAbTests)
    .set({
      status: "completed",
      winner,
      endedAt: new Date(),
    })
    .where(eq(advisorAbTests.id, testId));

  revalidatePath("/channel-advisor/ab-test");
}
