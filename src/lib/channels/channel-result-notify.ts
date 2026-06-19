/**
 * channel-result-notify — mission 执行结束后经渠道出站发回结果，并复位会话。
 *
 * 四形态 finalOutput 兼容：
 *   Level1 满额  → { summary, ... }  取 .summary
 *   Level2/3 降级 → { message, ... } 取 .message
 *   Level4 失败  → { error: true, message } + mission.status === 'failed'（不抛，靠判 status）
 */
import { db } from "@/db";
import { missions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getChannelConfig } from "@/lib/dal/channels";
import { sendChannelMessage } from "@/lib/channels/outbound";
import { resetSession } from "@/lib/dal/channel-sessions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChannelCtx {
  organizationId: string;
  configId: string;
  platform: "dingtalk" | "wechat_work";
  chatId: string;
  externalUserId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "";
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/**
 * 查询 mission 最终状态，组装消息内容，经渠道出站发回，最后复位会话。
 * 由 startChannelMission 的 .then() 回调调用——此时 mission 已执行完毕。
 */
export async function sendChannelResult(
  ctx: ChannelCtx,
  missionId: string
): Promise<void> {
  const [mission, config] = await Promise.all([
    db.query.missions.findFirst({ where: eq(missions.id, missionId) }),
    getChannelConfig(ctx.configId),
  ]);

  const reset = () =>
    resetSession({
      configId: ctx.configId,
      chatId: ctx.chatId,
      externalUserId: ctx.externalUserId,
    });

  // config 或 mission 缺失：静默复位，不抛
  if (!mission || !config) {
    await reset();
    return;
  }

  const fo = (mission.finalOutput ?? {}) as {
    summary?: string;
    message?: string;
    error?: boolean;
  };

  const link = `${siteUrl()}/missions/${missionId}`;

  let content: string;
  if (mission.status === "failed") {
    content = `❌ 任务失败：${fo.message ?? fo.summary ?? "执行未完成"}\n详情：${link}`;
  } else {
    const summary = fo.summary ?? fo.message ?? "已完成";
    content = `✅ 已完成：${summary}\n在系统查看：${link}`;
  }

  await sendChannelMessage({
    config,
    chatId: ctx.chatId,
    type: "markdown",
    title: mission.title ?? "任务结果",
    content,
    missionId,
  });

  await reset();
}

/**
 * executeMissionDirect 抛出时（Level4 不抛，但其他意外错误会抛）发错误通知并复位。
 */
export async function sendChannelFailure(
  ctx: ChannelCtx,
  missionId: string,
  err: unknown
): Promise<void> {
  const config = await getChannelConfig(ctx.configId);
  await resetSession({
    configId: ctx.configId,
    chatId: ctx.chatId,
    externalUserId: ctx.externalUserId,
  });
  if (!config) return;
  const msg = err instanceof Error ? err.message : String(err);
  await sendChannelMessage({
    config,
    chatId: ctx.chatId,
    type: "text",
    content: `❌ 处理出错：${msg}，可稍后重试或换个说法。`,
    missionId,
  });
}
