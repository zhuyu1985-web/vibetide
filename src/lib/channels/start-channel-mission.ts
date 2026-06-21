/**
 * start-channel-mission — 无登录态 ad-hoc 启动器。
 *
 * 流程：
 *   1. materializeAdHocMission → 物化 mission + task DAG（同步，返回 missionId）
 *   2. executeMissionDirect    → fire-and-forget（void）
 *   3. 回执由 mission/reached-terminal 事件驱动（见 channel-mission-terminal-notify）
 *   4. .catch(sendChannelFailure) — 意外抛出时（Level4 不抛，但其他错误会）发错误通知
 */
import { materializeAdHocMission } from "@/lib/missions/materialize-ad-hoc";
import { executeMissionDirect } from "@/lib/mission-executor";
import {
  sendChannelFailure,
  type ChannelCtx,
} from "./channel-result-notify";
import type { IntentStep } from "@/lib/agent/types";

export interface StartChannelMissionInput {
  /** 用户原话 */
  message: string;
  /** 意图识别产出的步骤 */
  steps: IntentStep[];
  /** 意图摘要（供 mission 展示用） */
  summary: string;
  /** 来源消息 ID，用于 missions_source_dedup_uidx 去重 */
  externalMessageId: string;
  /** 渠道上下文，用于发出站结果 + 复位会话 */
  channelCtx: ChannelCtx;
}

/**
 * 无登录态启动：物化 ad-hoc mission + fire-and-forget 执行 + 完成回执。
 * 返回 missionId（物化完成即返回，不等执行）。
 */
export async function startChannelMission(
  orgId: string,
  input: StartChannelMissionInput
): Promise<{ missionId: string }> {
  const { missionId } = await materializeAdHocMission(orgId, {
    message: input.message,
    steps: input.steps,
    summary: input.summary,
    sourceModule: `channel:${input.channelCtx.platform}`,
    sourceEntityId: input.externalMessageId,
  });

  // 回执改由 mission/reached-terminal 事件驱动（覆盖看门狗杀任务 / worker 重启）。
  // 这里只 fire-and-forget 执行；.catch 兜 executeMissionDirect 在写任何终态前就抛错的极端情况。
  void executeMissionDirect(missionId, orgId).catch((err) =>
    sendChannelFailure(input.channelCtx, missionId, err),
  );

  return { missionId };
}
