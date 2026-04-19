/**
 * Chat Notifier — pushes chat conversations from the in-app chat center and
 * employee dialogs to externally configured channels (DingTalk / WeChat Work).
 *
 * Fires asynchronously after a chat completes. Errors are swallowed so a
 * channel failure never breaks the chat response stream.
 */

import { listChannelConfigs } from "@/lib/dal/channels";
import { sendChannelMessage } from "./outbound";

interface ChatNotification {
  organizationId: string;
  userId: string;
  employeeSlug: string;
  employeeName: string;
  userMessage: string;
  assistantMessage: string;
  /** Optional scenario label to include in the title */
  scenarioName?: string;
  /** Optional skills used during the response (for richer context) */
  skillsUsed?: string[];
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "…";
}

/**
 * Push a chat Q&A to every enabled channel for the given organization.
 * Non-blocking: caller may `void` the returned promise.
 */
export async function notifyChatMessage(n: ChatNotification): Promise<void> {
  try {
    const configs = await listChannelConfigs(n.organizationId);
    const enabled = configs.filter((c) => c.isEnabled);
    if (enabled.length === 0) return;

    const scenarioTag = n.scenarioName ? ` · ${n.scenarioName}` : "";
    const title = `💬 ${n.employeeName}${scenarioTag}`;
    const skillsLine =
      n.skillsUsed && n.skillsUsed.length > 0
        ? `\n\n> 技能：${n.skillsUsed.join("、")}`
        : "";

    const content =
      `**👤 用户提问**\n${truncate(n.userMessage, 600)}\n\n` +
      `**🤖 ${n.employeeName}回复**\n${truncate(n.assistantMessage, 2000)}` +
      skillsLine;

    // chatId is just a tracking identifier for recordOutboundMessage.
    // DingTalk robot webhooks do not actually target a specific chat —
    // the webhook posts to its own bound group.
    const chatId = `chat:${n.employeeSlug}:${n.userId}`;

    await Promise.all(
      enabled.map(async (config) => {
        try {
          await sendChannelMessage({
            config,
            chatId,
            type: "markdown",
            title,
            content,
          });
        } catch (err) {
          console.error(
            `[chat-notifier] send failed (config=${config.id}):`,
            err
          );
        }
      })
    );
  } catch (err) {
    console.error("[chat-notifier] notifyChatMessage failed:", err);
  }
}
