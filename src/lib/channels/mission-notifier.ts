/**
 * Mission Notifier — pushes mission status updates back to the originating
 * external channel (DingTalk / WeChat Work) when a mission completes, fails,
 * or enters a review stage.
 *
 * Pure utility; errors are swallowed so notification failures never break the
 * mission execution pipeline.
 */

import { db } from "@/db";
import { channelMessages } from "@/db/schema/channels";
import { missions } from "@/db/schema/missions";
import { eq, and } from "drizzle-orm";
import { getChannelConfig } from "@/lib/dal/channels";
import { sendChannelMessage } from "./outbound";

// ---------------------------------------------------------------------------
// getMissionOriginChannel
// ---------------------------------------------------------------------------

/**
 * Check if a mission originated from an external channel.
 * Returns the originating inbound message metadata if found.
 */
export async function getMissionOriginChannel(missionId: string): Promise<{
  configId: string;
  platform: "dingtalk" | "wechat_work";
  organizationId: string;
  chatId: string;
  externalUserId: string;
} | null> {
  const [row] = await db
    .select({
      configId: channelMessages.configId,
      platform: channelMessages.platform,
      organizationId: channelMessages.organizationId,
      chatId: channelMessages.chatId,
      externalUserId: channelMessages.externalUserId,
    })
    .from(channelMessages)
    .where(
      and(
        eq(channelMessages.missionId, missionId),
        eq(channelMessages.direction, "inbound")
      )
    )
    .limit(1);

  if (!row || !row.chatId || !row.externalUserId) return null;

  return {
    configId: row.configId,
    platform: row.platform as "dingtalk" | "wechat_work",
    organizationId: row.organizationId,
    chatId: row.chatId,
    externalUserId: row.externalUserId,
  };
}

// ---------------------------------------------------------------------------
// notifyMissionStatus
// ---------------------------------------------------------------------------

/**
 * Push a mission status update to the originating channel (if any).
 *
 * @param missionId  - UUID of the mission
 * @param status     - New status to report
 * @param summary    - Human-readable summary of the outcome / next steps
 */
export async function notifyMissionStatus(
  missionId: string,
  status: "completed" | "failed" | "in_review",
  summary: string
): Promise<void> {
  try {
    const origin = await getMissionOriginChannel(missionId);
    if (!origin) return; // mission did not come from an external channel

    const config = await getChannelConfig(origin.configId);
    if (!config || !config.isEnabled) return;

    // Load mission title for context
    const [missionRow] = await db
      .select({ title: missions.title })
      .from(missions)
      .where(eq(missions.id, missionId))
      .limit(1);

    const statusLabel: Record<string, string> = {
      completed: "任务已完成",
      failed: "任务执行失败",
      in_review: "任务等待审核",
    };

    const icon: Record<string, string> = {
      completed: "✅",
      failed: "❌",
      in_review: "⏸️",
    };

    const title = `${icon[status]} ${statusLabel[status]}`;
    const missionTitle = missionRow?.title ?? "任务";
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const missionUrl = siteUrl ? `${siteUrl}/missions/${missionId}` : "";
    const content = missionUrl
      ? `**${missionTitle}**\n\n${summary}\n\n[查看详情](${missionUrl})`
      : `**${missionTitle}**\n\n${summary}`;

    // WeChat Work uses externalUserId as the touser; DingTalk uses chatId
    const chatId =
      origin.platform === "wechat_work"
        ? origin.externalUserId
        : origin.chatId;

    await sendChannelMessage({
      config,
      chatId,
      type: "markdown",
      title,
      content,
      missionId,
    });
  } catch (err) {
    // Swallow errors — notification failure must not break mission pipeline
    console.error("[mission-notifier] Failed to notify channel:", err);
  }
}

// ---------------------------------------------------------------------------
// notifyAuditRequired
// ---------------------------------------------------------------------------

/**
 * Convenience wrapper that notifies the originating channel when a mission
 * enters a human-review stage.
 *
 * @param missionId     - UUID of the mission
 * @param _auditRecordId - Reserved for future use (e.g. deep-link to audit record)
 * @param stage         - Which review stage is waiting
 */
export async function notifyAuditRequired(
  missionId: string,
  _auditRecordId: string,
  stage: "review_1" | "review_2" | "review_3"
): Promise<void> {
  const stageLabel: Record<string, string> = {
    review_1: "初审",
    review_2: "复审",
    review_3: "终审",
  };

  await notifyMissionStatus(
    missionId,
    "in_review",
    `${stageLabel[stage]}需要人工审核，请前往审核中心处理。`
  );
}
