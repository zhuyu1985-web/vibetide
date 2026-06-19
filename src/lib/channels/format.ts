/**
 * 平台消息格式化工具 — 将统一 payload 转换为各平台原生消息体。
 * 此文件无外部依赖，可被 gateway.ts / session-webhook.ts 等安全复用。
 */

export type OutboundPayload = {
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
