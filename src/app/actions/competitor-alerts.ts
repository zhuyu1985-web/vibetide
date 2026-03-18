"use server";

import { db } from "@/db";
import { competitors } from "@/db/schema/benchmarking";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { postTeamMessage } from "@/lib/dal/team-messages";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

interface CompetitorAnomaly {
  competitorName: string;
  type: "follower_spike" | "posting_frequency" | "engagement_spike";
  description: string;
  severity: "high" | "medium" | "low";
}

/**
 * Check for competitor anomalies and send team message alerts.
 *
 * Detects:
 * - Sudden follower spike (>20%)
 * - Unusual posting frequency changes
 * - Engagement anomalies
 *
 * In production, this would compare current data against historical baselines.
 * For now, we use a simplified heuristic based on stored competitor data.
 */
export async function checkCompetitorAnomalies() {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("No organization");

  const competitorRows = await db
    .select()
    .from(competitors)
    .where(eq(competitors.organizationId, orgId));

  if (competitorRows.length === 0) {
    return { anomalies: [], alertsSent: 0 };
  }

  const anomalies: CompetitorAnomaly[] = [];

  // Analyze each competitor for anomalies
  for (const comp of competitorRows) {
    const followers = comp.followers || 0;
    const avgViews = comp.avgViews || 0;

    // Simulate anomaly detection with heuristic checks
    // In production, compare against historical data stored over time

    // Check for high follower count (potentially spiked)
    if (followers > 100000) {
      // Check if followers seem anomalously high relative to views
      const viewToFollowerRatio = avgViews / Math.max(1, followers);
      if (viewToFollowerRatio < 0.01) {
        anomalies.push({
          competitorName: comp.name,
          type: "follower_spike",
          description: `${comp.name} 粉丝数(${followers.toLocaleString()})与平均阅读量(${avgViews.toLocaleString()})比例异常，可能存在粉丝异常增长`,
          severity: "medium",
        });
      }
    }

    // Check for unusually high engagement
    if (avgViews > 50000 && followers > 0) {
      const engagementRatio = avgViews / followers;
      if (engagementRatio > 2) {
        anomalies.push({
          competitorName: comp.name,
          type: "engagement_spike",
          description: `${comp.name} 平均阅读量(${avgViews.toLocaleString()})远超粉丝基数(${followers.toLocaleString()})，可能有爆款内容或异常传播`,
          severity: "high",
        });
      }
    }

    // Check for potential posting frequency anomalies based on publishFreq
    if (comp.publishFreq) {
      const freq = comp.publishFreq.toLowerCase();
      if (freq.includes("高频") || freq.includes("密集")) {
        anomalies.push({
          competitorName: comp.name,
          type: "posting_frequency",
          description: `${comp.name} 近期发布频率为"${comp.publishFreq}"，高于正常水平，需关注其内容策略变化`,
          severity: "low",
        });
      }
    }
  }

  // Send team message alerts for detected anomalies
  let alertsSent = 0;

  if (anomalies.length > 0) {
    // Group by severity
    const criticalAnomalies = anomalies.filter((a) => a.severity === "high");
    const otherAnomalies = anomalies.filter((a) => a.severity !== "high");

    // Send high-severity alerts immediately
    for (const anomaly of criticalAnomalies) {
      await postTeamMessage({
        senderSlug: "xiaolei",
        type: "alert",
        content: `[竞品预警] ${anomaly.description}`,
        attachments: [
          {
            type: "chart",
            title: `${anomaly.competitorName} 异常指标`,
            description: anomaly.type === "follower_spike"
              ? "粉丝增长异常"
              : anomaly.type === "engagement_spike"
              ? "互动数据异常"
              : "发布频率异常",
          },
        ],
      });
      alertsSent++;
    }

    // Send a summary for other anomalies
    if (otherAnomalies.length > 0) {
      const summaryList = otherAnomalies
        .map((a) => `- ${a.competitorName}: ${a.description}`)
        .join("\n");

      await postTeamMessage({
        senderSlug: "xiaolei",
        type: "status_update",
        content: `[竞品动态] 检测到 ${otherAnomalies.length} 项竞品异常：\n${summaryList}`,
      });
      alertsSent++;
    }
  }

  revalidatePath("/benchmarking");
  revalidatePath("/team-hub");

  return { anomalies, alertsSent };
}
