import { inngest } from "../client";
import { postTeamMessage } from "@/lib/dal/team-messages";

/**
 * F4.X.12: Handle review completion events from Module 3.
 * Posts a notification to the team when a content review is completed.
 */
export const onReviewCompleted = inngest.createFunction(
  { id: "on-review-completed", name: "On Review Completed" },
  { event: "publishing/review-completed" },
  async ({ event, step }) => {
    const { status, score, reviewerEmployeeId, contentId } = event.data;

    const statusLabels: Record<string, string> = {
      approved: "通过",
      rejected: "未通过",
      escalated: "已升级",
    };

    await step.run("notify-team", async () => {
      await postTeamMessage({
        senderSlug: "xiaoshen",
        type: status === "approved" ? "work_output" : "alert",
        content: `内容审核${statusLabels[status]}${score !== null ? `，评分 ${score}/100` : ""}。内容ID：${contentId}`,
      });
    });

    return { status: "notified" };
  }
);

/**
 * F4.X.12: Handle publishing plan status changes.
 */
export const onPlanStatusChanged = inngest.createFunction(
  { id: "on-plan-status-changed", name: "On Plan Status Changed" },
  { event: "publishing/plan-status-changed" },
  async ({ event, step }) => {
    const { title, channelName, status } = event.data;

    await step.run("notify-team", async () => {
      await postTeamMessage({
        senderSlug: "xiaofa",
        type: status === "published" ? "work_output" : "alert",
        content:
          status === "published"
            ? `「${title}」已成功发布到「${channelName}」渠道。`
            : `「${title}」发布到「${channelName}」失败，请检查。`,
      });
    });

    return { status: "notified" };
  }
);

/**
 * Handle anomaly detected events from analytics module.
 */
export const onAnomalyDetected = inngest.createFunction(
  { id: "on-anomaly-detected", name: "On Anomaly Detected" },
  { event: "analytics/anomaly-detected" },
  async ({ event, step }) => {
    const { channel, metric, severity, message, changePercent } = event.data;

    await step.run("notify-team", async () => {
      await postTeamMessage({
        senderSlug: "xiaoshu",
        type: "alert",
        content: `${severity === "critical" ? "严重" : ""}数据异常：${message}`,
        attachments: [
          {
            type: "chart" as const,
            title: `${channel} ${metric}异常`,
            description: `变化幅度：${changePercent > 0 ? "+" : ""}${changePercent}%`,
          },
        ],
      });
    });

    return { status: "alerted", severity };
  }
);
