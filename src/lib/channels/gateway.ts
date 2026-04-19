/**
 * Channel Gateway — Standardized message handling layer.
 *
 * Responsibilities:
 * 1. Accept inbound messages from any platform in a unified format
 * 2. Route to quick-command parser or intent recognition
 * 3. Return a text reply string
 * 4. Format outbound payloads for each platform
 */

import { ADVANCED_SCENARIO_CONFIG } from "@/lib/constants";
import { recognizeIntent } from "@/lib/agent/intent-recognition";
import { EMPLOYEE_META } from "@/lib/constants";
import { recordInboundMessage, recordOutboundMessage } from "@/app/actions/channels";

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
}

// ---------------------------------------------------------------------------
// Quick command parser
// ---------------------------------------------------------------------------

interface ParsedCommand {
  scenarioKey: string;
  params: Record<string, string>;
}

/**
 * Parse a quick command in the form "#场景名 key:value key:value ..."
 * Returns null if the text does not match any known scenario label or key.
 */
function parseQuickCommand(text: string): ParsedCommand | null {
  const trimmed = text.trim();

  // Must start with "#"
  const match = trimmed.match(/^#(\S+)\s*([\s\S]*)$/);
  if (!match) return null;

  const tag = match[1].trim();
  const rest = (match[2] ?? "").trim();

  // Try to find a matching scenario by label or key
  let matchedKey: string | null = null;
  for (const [key, cfg] of Object.entries(ADVANCED_SCENARIO_CONFIG)) {
    if (cfg.label === tag || key === tag) {
      matchedKey = key;
      break;
    }
  }

  if (!matchedKey) return null;

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

  return { scenarioKey: matchedKey, params };
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

  // 3. Free-form message → intent recognition
  return handleFreeFormMessage(text, msg);
}

// ---------------------------------------------------------------------------
// Quick command handler (scenario launch)
// ---------------------------------------------------------------------------

async function handleQuickCommand(
  command: ParsedCommand,
  msg: StandardizedMessage
): Promise<{ reply: string; missionId?: string }> {
  const cfg = ADVANCED_SCENARIO_CONFIG[command.scenarioKey as keyof typeof ADVANCED_SCENARIO_CONFIG];
  if (!cfg) {
    return { reply: `未找到场景：${command.scenarioKey}` };
  }

  try {
    // Use startMissionFromModule so we can pass an idempotency key from the
    // IM platform. IM webhooks are at-least-once delivery (DingTalk retries
    // 3x, WeCom 5x) — without this every retry created a duplicate mission.
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
      title: cfg.label,
      scenario: command.scenarioKey,
      userInstruction,
      sourceModule: `channel:${msg.platform}`,
      sourceEntityId: msg.externalMessageId,
      sourceEntityType: "channel_message",
      sourceContext: {
        configId: msg.configId,
        externalUserId: msg.externalUserId,
        chatId: msg.chatId,
      },
    });

    // Persist outbound acknowledgement (fire-and-forget)
    recordOutboundMessage({
      organizationId: msg.organizationId,
      configId: msg.configId,
      platform: msg.platform,
      externalUserId: msg.externalUserId || undefined,
      chatId: msg.chatId || undefined,
      content: { text: `已启动 ${cfg.label}，任务ID: ${mission.id}` },
      missionId: mission.id,
      status: "sent",
    }).catch((err) =>
      console.error("[gateway] recordOutboundMessage failed:", err)
    );

    return {
      reply: `已启动 ${cfg.label}，任务ID: ${mission.id}`,
      missionId: mission.id,
    };
  } catch (err) {
    console.error("[gateway] startMission failed:", err);
    return {
      reply: `启动场景「${cfg.label}」失败，请稍后重试。`,
    };
  }
}

// ---------------------------------------------------------------------------
// Free-form message handler (intent recognition)
// ---------------------------------------------------------------------------

async function handleFreeFormMessage(
  text: string,
  msg: StandardizedMessage
): Promise<{ reply: string; missionId?: string }> {
  try {
    // Build a minimal employee catalog using xiaolei as the default leader
    const defaultSlug = "xiaolei";
    const meta = EMPLOYEE_META[defaultSlug];
    const availableEmployees = [
      {
        slug: defaultSlug,
        name: meta.name,
        nickname: meta.nickname,
        title: meta.title,
        skills: [],
      },
    ];

    const result = await recognizeIntent(
      text,
      defaultSlug,
      availableEmployees,
      [],
      []
    );

    // For MVP, do not execute — just acknowledge with intent summary
    const reply = `已识别意图: ${result.summary}`;

    // Persist outbound acknowledgement (fire-and-forget)
    recordOutboundMessage({
      organizationId: msg.organizationId,
      configId: msg.configId,
      platform: msg.platform,
      externalUserId: msg.externalUserId || undefined,
      chatId: msg.chatId || undefined,
      content: { text: reply },
      status: "sent",
    }).catch((err) =>
      console.error("[gateway] recordOutboundMessage failed:", err)
    );

    return { reply };
  } catch (err) {
    console.error("[gateway] intent recognition failed:", err);
    return { reply: "收到您的消息，正在处理中" };
  }
}

// ---------------------------------------------------------------------------
// Outbound formatters
// ---------------------------------------------------------------------------

type OutboundPayload = {
  type: "text" | "markdown" | "card";
  title?: string;
  content: string;
  actions?: { label: string; url: string }[];
};

/**
 * Format a standardized reply payload for a specific platform.
 * Returns the platform-native message object ready to be JSON-serialised.
 */
export function formatForPlatform(
  platform: "dingtalk" | "wechat_work",
  payload: OutboundPayload
): unknown {
  if (platform === "dingtalk") {
    return formatForDingTalk(payload);
  }
  return formatForWechatWork(payload);
}

// --- DingTalk ---
// Ref: https://open.dingtalk.com/document/orgapp/message-types-and-data-format

function formatForDingTalk(payload: OutboundPayload): unknown {
  switch (payload.type) {
    case "text":
      return {
        msgtype: "text",
        text: { content: payload.content },
      };

    case "markdown":
      return {
        msgtype: "markdown",
        markdown: {
          title: payload.title ?? "通知",
          text: payload.content,
        },
      };

    case "card": {
      const btns = (payload.actions ?? []).map((a) => ({
        title: a.label,
        actionURL: a.url,
      }));
      return {
        msgtype: "actionCard",
        actionCard: {
          title: payload.title ?? "操作卡片",
          text: payload.content,
          hideAvatar: "0",
          btnOrientation: "0",
          btns: btns.length > 0 ? btns : undefined,
        },
      };
    }
  }
}

// --- WeChat Work ---
// Ref: https://developer.work.weixin.qq.com/document/path/90236

function formatForWechatWork(payload: OutboundPayload): unknown {
  switch (payload.type) {
    case "text":
      return {
        msgtype: "text",
        text: { content: payload.content },
      };

    case "markdown":
      return {
        msgtype: "markdown",
        markdown: { content: payload.content },
      };

    case "card": {
      // WeChat Work template_card (text_notice type)
      const card: Record<string, unknown> = {
        card_type: "text_notice",
        source: payload.title
          ? { desc: payload.title, desc_color: 0 }
          : undefined,
        main_title: { title: payload.title ?? "操作卡片", desc: "" },
        sub_title_text: payload.content,
      };

      if (payload.actions && payload.actions.length > 0) {
        card.card_action = {
          type: 1,
          url: payload.actions[0].url,
        };
        if (payload.actions.length > 1) {
          card.jump_list = payload.actions.slice(1).map((a) => ({
            type: 1,
            title: a.label,
            url: a.url,
          }));
        }
      }

      return {
        msgtype: "template_card",
        template_card: card,
      };
    }
  }
}
