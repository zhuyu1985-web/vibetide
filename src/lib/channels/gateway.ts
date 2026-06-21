/**
 * Channel Gateway — Standardized message handling layer.
 *
 * Responsibilities:
 * 1. Accept inbound messages from any platform in a unified format
 * 2. Route to quick-command parser or intent recognition
 * 3. Return a text reply string
 * 4. Format outbound payloads for each platform
 */

import { recordInboundMessage, recordOutboundMessage } from "@/app/actions/channels";
import { findTemplateByNameOrSlug } from "@/lib/dal/workflow-templates-listing";
import { inngest } from "@/inngest/client";
import { extractUrls } from "./link-extract";
import { getOrCreateSession, updateSession, resetSession } from "@/lib/dal/channel-sessions";
import type { ChannelSessionRow } from "@/lib/dal/channel-sessions";
import { clarifyOrPlan } from "./clarify-or-plan";
import { startChannelMission } from "./start-channel-mission";
import { cancelChannelMission } from "./cancel-channel-mission";
import { formatPlanCard } from "./format-plan-card";
import { isConfirm, isCancel } from "./confirm-keywords";
import type { IntentStep } from "@/lib/agent/types";

export { formatForPlatform, type OutboundPayload } from "./format";

// ---------------------------------------------------------------------------
// Standardized inbound message
// ---------------------------------------------------------------------------

export interface StandardizedMessage {
  platform: "dingtalk" | "wechat_work";
  configId: string;
  organizationId: string;
  externalMessageId: string; // unique ID from platform
  externalUserId: string;    // sender ID
  chatId: string;            // conversation/group ID
  textContent: string;       // plain text content
  rawMessage: unknown;       // original platform payload for debugging
  replyWebhook?: string;     // 钉钉 sessionWebhook（异步回执用）
}

// ---------------------------------------------------------------------------
// Quick command parser
// ---------------------------------------------------------------------------

interface ParsedCommand {
  /** #tag 后面的场景关键词（模板名或 legacyScenarioKey 的模糊匹配 key） */
  scenarioKeyword: string;
  params: Record<string, string>;
}

/**
 * Parse a quick command in the form "#场景名 key:value key:value ..."
 * 只做语法解析，不在此处做 DB/常量查找——匹配交给 handleQuickCommand
 * 调用 `findTemplateByNameOrSlug` 完成（Phase 4B：从 ADVANCED_SCENARIO_CONFIG
 * 常量迁移到 workflow_templates DB 查）。
 */
function parseQuickCommand(text: string): ParsedCommand | null {
  const trimmed = text.trim();

  // Must start with "#"
  const match = trimmed.match(/^#(\S+)\s*([\s\S]*)$/);
  if (!match) return null;

  const tag = match[1].trim();
  const rest = (match[2] ?? "").trim();
  if (tag.length === 0) return null;

  // Parse "key:value" pairs from the rest of the text
  const params: Record<string, string> = {};
  const pairPattern = /(\S+?)[:：]([^\s:：]+(?:\s+(?!\S+[:：])\S+)*)/g;
  let m: RegExpExecArray | null;
  while ((m = pairPattern.exec(rest)) !== null) {
    params[m[1].trim()] = m[2].trim();
  }

  // If no key:value pairs but there is free text, treat it as a "topic" param
  if (Object.keys(params).length === 0 && rest.length > 0) {
    params["topic"] = rest;
  }

  return { scenarioKeyword: tag, params };
}

// ---------------------------------------------------------------------------
// Inbound handler
// ---------------------------------------------------------------------------

/**
 * Handle an inbound message from an external platform.
 * Routes to quick-command parsing or intent recognition.
 * Returns a text reply to send back to the platform.
 */
export async function handleInboundMessage(msg: StandardizedMessage): Promise<{
  reply: string;
  missionId?: string;
}> {
  // 1. Persist the inbound message (fire-and-forget, do not block reply)
  recordInboundMessage({
    organizationId: msg.organizationId,
    configId: msg.configId,
    platform: msg.platform,
    externalMessageId: msg.externalMessageId || undefined,
    externalUserId: msg.externalUserId || undefined,
    chatId: msg.chatId || undefined,
    content: {
      text: msg.textContent,
      raw: msg.rawMessage,
    },
  }).catch((err) =>
    console.error("[gateway] recordInboundMessage failed:", err)
  );

  const text = msg.textContent.trim();
  if (!text) {
    return { reply: "收到空消息，请发送文字内容。" };
  }

  // 2. Quick command: "#场景名 参数..."
  const command = parseQuickCommand(text);
  if (command) {
    return handleQuickCommand(command, msg);
  }

  // 3. 含链接 → 异步抓取存稿
  const urls = extractUrls(text);
  if (urls.length > 0) {
    return handleLinkIngest(urls, msg);
  }

  // 4. Free-form message → intent recognition
  return handleFreeFormMessage(text, msg);
}

// ---------------------------------------------------------------------------
// Link ingest handler
// ---------------------------------------------------------------------------

async function handleLinkIngest(
  urls: string[],
  msg: StandardizedMessage
): Promise<{ reply: string; missionId?: string }> {
  const sourceName = `钉钉收稿·@${msg.externalUserId || "未知"}`;
  await Promise.all(
    urls.map((url, i) =>
      inngest.send({
        id: `${msg.externalMessageId}#${i}`,
        name: "channel/link-ingest.requested",
        data: {
          organizationId: msg.organizationId,
          configId: msg.configId,
          platform: msg.platform,
          url,
          sourceName,
          chatId: msg.chatId,
          externalUserId: msg.externalUserId,
          externalMessageId: msg.externalMessageId,
          replyWebhook: msg.replyWebhook ?? "",
        },
      })
    )
  );
  return {
    reply:
      urls.length === 1
        ? "⏳ 已收到链接，正在抓取，稍后回执。"
        : `⏳ 已收到 ${urls.length} 条链接，正在抓取，稍后回执。`,
  };
}

// ---------------------------------------------------------------------------
// Quick command handler (scenario launch)
// ---------------------------------------------------------------------------

async function handleQuickCommand(
  command: ParsedCommand,
  msg: StandardizedMessage
): Promise<{ reply: string; missionId?: string }> {
  // Phase 4B: 用 `findTemplateByNameOrSlug` 替代 ADVANCED_SCENARIO_CONFIG
  // 常量查找。支持用模板中文名或 legacyScenarioKey 模糊匹配（组织级隔离）。
  const template = await findTemplateByNameOrSlug(
    msg.organizationId,
    command.scenarioKeyword,
  );
  if (!template) {
    return { reply: `未找到场景：${command.scenarioKeyword}` };
  }

  try {
    // Use startMissionFromModule so we can pass an idempotency key from the
    // IM platform. IM webhooks are at-least-once delivery (DingTalk retries
    // 3x, WeCom 5x) — without this every retry created a duplicate mission.
    // 走 startMissionFromModule 而非 startMissionFromTemplate，是因为 webhook
    // 上下文没有 user auth，而 startMissionFromTemplate 要求 requireAuth。
    const { startMissionFromModule } = await import("@/app/actions/missions");

    // Build a human-readable instruction from params
    const paramLines = Object.entries(command.params)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    const userInstruction = paramLines
      ? `来自渠道消息的任务请求。\n${paramLines}`
      : "来自渠道消息的任务请求。";

    const mission = await startMissionFromModule({
      organizationId: msg.organizationId,
      title: template.name,
      // `scenario` 继续写入 legacyScenarioKey（或 name 兜底）作为 denormalized
      // label cache，下游 mission-executor / leader-plan 仍按 slug 分发，直到
      // B.2 全部迁到 workflowTemplateId。
      scenario: template.legacyScenarioKey ?? template.name,
      userInstruction,
      sourceModule: `channel:${msg.platform}`,
      sourceEntityId: msg.externalMessageId,
      sourceEntityType: "channel_message",
      sourceContext: {
        configId: msg.configId,
        externalUserId: msg.externalUserId,
        chatId: msg.chatId,
      },
      workflowTemplateId: template.id,
    });

    // Persist outbound acknowledgement (fire-and-forget)
    recordOutboundMessage({
      organizationId: msg.organizationId,
      configId: msg.configId,
      platform: msg.platform,
      externalUserId: msg.externalUserId || undefined,
      chatId: msg.chatId || undefined,
      content: { text: `已启动 ${template.name}，任务ID: ${mission.id}` },
      missionId: mission.id,
      status: "sent",
    }).catch((err) =>
      console.error("[gateway] recordOutboundMessage failed:", err)
    );

    return {
      reply: `已启动 ${template.name}，任务ID: ${mission.id}`,
      missionId: mission.id,
    };
  } catch (err) {
    console.error("[gateway] startMission failed:", err);
    return {
      reply: `启动场景「${template.name}」失败，请稍后重试。`,
    };
  }
}

// ---------------------------------------------------------------------------
// Free-form message handler (session-aware clarification loop)
// ---------------------------------------------------------------------------

const MAX_CLARIFY_ROUNDS = 5;
const SESSION_TTL_MS = 30 * 60 * 1000;

async function handleFreeFormMessage(
  text: string,
  msg: StandardizedMessage
): Promise<{ reply: string; missionId?: string }> {
  const channelCtx = {
    organizationId: msg.organizationId,
    configId: msg.configId,
    platform: msg.platform,
    chatId: msg.chatId,
    externalUserId: msg.externalUserId,
  };
  const session = await getOrCreateSession(channelCtx);

  if (session.status === "running") {
    return handleRunningMessage(text, msg, session, channelCtx);
  }

  if (session.status === "confirming") {
    return handleConfirmingMessage(text, msg, session, channelCtx);
  }

  let result;
  try {
    result = await clarifyOrPlan(msg.organizationId, session, text);
  } catch (err) {
    console.error("[gateway] clarifyOrPlan failed:", err);
    return { reply: "系统忙，请稍后再试。" };
  }

  const turns = [...(session.contextTurns ?? []), { role: "user", content: text }];

  if (result.action === "clarify") {
    const rounds = session.clarifyRounds + 1;
    if (rounds > MAX_CLARIFY_ROUNDS) {
      await updateSession(session.id, { status: "idle", clarifyRounds: 0, contextTurns: [], expiresAt: null });
      return { reply: "没太理解你的需求，请换个说法，或用 #场景名 直接发起任务。" };
    }
    await updateSession(session.id, {
      status: "clarifying",
      clarifyRounds: rounds,
      contextTurns: [...turns, { role: "assistant", content: result.question }],
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });
    return { reply: result.question };
  }

  return enterConfirming(session.id, turns, result.summary, result.steps);
}

// ---------------------------------------------------------------------------
// Running state handler
// ---------------------------------------------------------------------------

async function handleRunningMessage(
  text: string,
  msg: StandardizedMessage,
  session: ChannelSessionRow,
  channelCtx: { organizationId: string; configId: string; platform: "dingtalk" | "wechat_work"; chatId: string; externalUserId: string },
): Promise<{ reply: string; missionId?: string }> {
  if (!isCancel(text)) {
    return { reply: "⏳ 上一个请求还在处理中，完成后会在群里回结果。回复\"取消\"可中止。" };
  }
  if (!session.activeMissionId) {
    await resetSession(channelCtx);
    return { reply: "任务已结束，无需取消。" };
  }
  let ok = false;
  try {
    ok = await cancelChannelMission(session.activeMissionId, msg.organizationId);
  } catch (err) {
    console.error("[gateway] cancelChannelMission failed:", err);
    return { reply: "系统忙，请稍后再试。" };
  }
  await resetSession(channelCtx);
  return { reply: ok ? "🛑 已取消任务，可重新发起。" : "任务已结束，无需取消。" };
}

// ---------------------------------------------------------------------------
// Confirming state helpers
// ---------------------------------------------------------------------------

async function enterConfirming(
  sessionId: string,
  turns: { role: string; content: string }[],
  summary: string,
  steps: IntentStep[],
): Promise<{ reply: string }> {
  const card = formatPlanCard(summary, steps);
  await updateSession(sessionId, {
    status: "confirming",
    pendingPlan: { summary, steps },
    contextTurns: [...turns, { role: "assistant", content: card }],
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  return { reply: card };
}

async function handleConfirmingMessage(
  text: string,
  msg: StandardizedMessage,
  session: ChannelSessionRow,
  channelCtx: { organizationId: string; configId: string; platform: "dingtalk" | "wechat_work"; chatId: string; externalUserId: string },
): Promise<{ reply: string; missionId?: string }> {
  const plan = session.pendingPlan as { summary: string; steps: IntentStep[] } | null;
  if (!plan) {
    await updateSession(session.id, { status: "idle", pendingPlan: null, contextTurns: [], clarifyRounds: 0, expiresAt: null });
    return { reply: "请重新说一下你的需求。" };
  }
  if (isCancel(text)) {
    await updateSession(session.id, { status: "idle", pendingPlan: null, clarifyRounds: 0, contextTurns: [], expiresAt: null });
    return { reply: "已取消，可重新发起。" };
  }
  if (isConfirm(text)) {
    const { missionId } = await startChannelMission(msg.organizationId, {
      message: plan.summary,
      summary: plan.summary,
      steps: plan.steps,
      externalMessageId: msg.externalMessageId,
      channelCtx,
    });
    await updateSession(session.id, {
      status: "running",
      activeMissionId: missionId,
      pendingPlan: null,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });
    return { reply: `✅ 收到，正在处理：${plan.summary}。完成后在群里回结果。`, missionId };
  }
  let result;
  try {
    result = await clarifyOrPlan(msg.organizationId, session, text);
  } catch (err) {
    console.error("[gateway] clarifyOrPlan failed:", err);
    return { reply: "系统忙，请稍后再试。" };
  }
  const turns = [...(session.contextTurns ?? []), { role: "user", content: text }];
  if (result.action === "clarify") {
    const rounds = session.clarifyRounds + 1;
    if (rounds > MAX_CLARIFY_ROUNDS) {
      await updateSession(session.id, { status: "idle", clarifyRounds: 0, contextTurns: [], pendingPlan: null, expiresAt: null });
      return { reply: "没太理解你的需求，请换个说法，或用 #场景名 直接发起任务。" };
    }
    await updateSession(session.id, {
      status: "clarifying",
      clarifyRounds: rounds,
      contextTurns: [...turns, { role: "assistant", content: result.question }],
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });
    return { reply: result.question };
  }
  return enterConfirming(session.id, turns, result.summary, result.steps);
}

// Outbound formatters are in ./format.ts (re-exported above)
