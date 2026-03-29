import { inngest } from "../client";
import { db } from "@/db";
import { organizations } from "@/db/schema";

async function getDefaultOrgId(): Promise<string | null> {
  const org = await db.query.organizations.findFirst({ orderBy: (o, { asc }) => [asc(o.createdAt)] });
  return org?.id ?? null;
}

/**
 * Handle review completion events — create revision mission on rejection.
 */
export const onReviewCompleted = inngest.createFunction(
  { id: "on-review-completed", name: "On Review Completed" },
  { event: "publishing/review-completed" },
  async ({ event }) => {
    const { status, articleTitle, articleId, reason } = event.data as {
      status: string; articleTitle?: string; articleId?: string; reason?: string;
    };

    if (status === "rejected" || status === "revision_needed") {
      const orgId = await getDefaultOrgId();
      if (!orgId) return { status: "skipped", reason: "no org" };

      const { startMissionFromModule } = await import("@/app/actions/missions");
      await startMissionFromModule({
        organizationId: orgId,
        title: `内容修订：${articleTitle ?? "待修订稿件"}`,
        scenario: "deep_report",
        userInstruction: `审核未通过，需要修订。${reason ? `原因：${reason}` : ""}请根据审核意见进行修改。`,
        sourceModule: "publishing",
        sourceEntityId: articleId,
        sourceEntityType: "review",
      });
    }

    return { status: "notified" };
  }
);

/**
 * Handle publishing plan status changes — create diagnosis mission on failure.
 */
export const onPlanStatusChanged = inngest.createFunction(
  { id: "on-plan-status-changed", name: "On Plan Status Changed" },
  { event: "publishing/plan-status-changed" },
  async ({ event }) => {
    const { status, planTitle, planId, error } = event.data as {
      status: string; planTitle?: string; planId?: string; error?: string;
    };

    if (status === "failed") {
      const orgId = await getDefaultOrgId();
      if (!orgId) return { status: "skipped" };

      const { startMissionFromModule } = await import("@/app/actions/missions");
      await startMissionFromModule({
        organizationId: orgId,
        title: `发布诊断：${planTitle ?? "发布失败"}`,
        scenario: "multi_platform",
        userInstruction: `发布计划执行失败。${error ? `错误信息：${error}` : ""}请分析失败原因并提出修复方案。`,
        sourceModule: "publishing",
        sourceEntityId: planId,
        sourceEntityType: "publish_plan",
      });
    }

    return { status: "notified" };
  }
);

/**
 * Handle anomaly detected events — create investigation mission for critical anomalies.
 */
export const onAnomalyDetected = inngest.createFunction(
  { id: "on-anomaly-detected", name: "On Anomaly Detected" },
  { event: "analytics/anomaly-detected" },
  async ({ event }) => {
    const { severity, metric, channel, description } = event.data as {
      severity: string; metric?: string; channel?: string; description?: string;
    };

    if (severity === "critical" || severity === "high") {
      const orgId = await getDefaultOrgId();
      if (!orgId) return { status: "skipped" };

      const { startMissionFromModule } = await import("@/app/actions/missions");
      await startMissionFromModule({
        organizationId: orgId,
        title: `数据异常分析：${metric ?? "关键指标"}异常`,
        scenario: "data_journalism",
        userInstruction: `检测到${severity === "critical" ? "严重" : "重要"}数据异常。${channel ? `渠道：${channel}` : ""}${description ? `\n详情：${description}` : ""}\n请分析异常原因并提出应对建议。`,
        sourceModule: "analytics",
        sourceEntityType: "anomaly",
        sourceContext: { severity, metric, channel },
      });
    }

    return { status: "alerted", severity };
  }
);
