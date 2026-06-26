/**
 * 稿件「内容来源」派生（稿件库统一管理：来源徽章 + 来源筛选）。
 *
 * 所有产出（IM 对话/收稿、工作流 mission、手动新建）都落同一张 articles 表，
 * 此前无法区分。本函数从已有字段纯派生来源，**不需要 schema 迁移**：
 *  - channel  ：metadata.ingestedFromChannel 存在（钉钉/企微 IM 对话或链接收稿）
 *  - workflow ：有 missionId（多步 AI 团队 mission 产出）
 *  - manual   ：以上都没有（编辑手动新建 / seed）
 *
 * 渠道优先于工作流：运营最常问的是「我在钉钉产出的那篇在哪」，且 IM 稿一般无 missionId，
 * 两者极少同时出现；万一同时存在（渠道收稿后又被 mission 加工），按用户心智归「渠道」。
 */
export type ContentSource = "channel" | "workflow" | "manual";

export interface ContentSourceInput {
  missionId?: string | null;
  metadata?: {
    ingestedFromChannel?: { platform?: string } | null;
  } | null;
}

export function deriveContentSource(row: ContentSourceInput): ContentSource {
  if (row.metadata?.ingestedFromChannel) return "channel";
  if (row.missionId) return "workflow";
  return "manual";
}

/** 来源筛选/徽章的中文标签（channel 的平台细分在 UI 层按 channelPlatform 再分）。 */
export const CONTENT_SOURCE_LABEL: Record<ContentSource, string> = {
  channel: "钉钉/企微",
  workflow: "工作流",
  manual: "手动",
};
