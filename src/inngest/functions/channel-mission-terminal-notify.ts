import { inngest } from "@/inngest/client";
import { getSessionByActiveMissionId } from "@/lib/dal/channel-sessions";
import { sendChannelResult } from "@/lib/channels/channel-result-notify";

/** 核心逻辑（可单测）：mission 终态 → 反查渠道 session → 回执（sendChannelResult 内部复位）。 */
export async function runTerminalNotify(missionId: string): Promise<void> {
  const session = await getSessionByActiveMissionId(missionId);
  if (!session) return; // 非渠道 mission，或已复位（去重）
  await sendChannelResult(
    {
      organizationId: session.organizationId,
      configId: session.configId,
      platform: session.platform as "dingtalk" | "wechat_work",
      chatId: session.chatId,
      externalUserId: session.externalUserId,
    },
    missionId,
  );
}

export const channelMissionTerminalNotify = inngest.createFunction(
  { id: "channel-mission-terminal-notify", retries: 2 },
  { event: "mission/reached-terminal" },
  async ({ event, step }) => {
    await step.run("notify", () => runTerminalNotify(event.data.missionId));
    return { ok: true };
  },
);
