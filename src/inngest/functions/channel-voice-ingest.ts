import { inngest } from "@/inngest/client";
import type { InngestEvents } from "@/inngest/events";
import { handleInboundMessage } from "@/lib/channels/gateway";
import { postToSessionWebhook } from "@/lib/channels/session-webhook";
import { sendChannelMessage } from "@/lib/channels/outbound";
import { downloadChannelAudio, type ChannelMediaRef } from "@/lib/channels/media-download";
import { getChannelConfig } from "@/lib/dal/channels";
import { recordInboundMessage } from "@/app/actions/channels";
import { putObject, getPublicUrl } from "@/lib/storage";
import {
  transcribeAudio,
  getAsrMinConfidence,
  type AudioFormat,
} from "@/lib/asr";

type VoiceIngestData = InngestEvents["channel/voice-ingest.requested"]["data"];

/** 把回执推回用户 IM：钉钉走 sessionWebhook，企微走主动推送。 */
async function replyToChannel(data: VoiceIngestData, content: string): Promise<void> {
  if (data.platform === "dingtalk" && data.replyWebhook) {
    await postToSessionWebhook(data.replyWebhook, { type: "text", content });
    return;
  }
  // 企微（或钉钉无 sessionWebhook）：主动推送
  const config = await getChannelConfig(data.configId);
  if (!config) return;
  await sendChannelMessage({
    config,
    chatId: data.chatId,
    type: "text",
    content,
  });
}

/** 原音转存对象存储，返回公网 URL；失败不阻断主流程。 */
async function archiveAudio(
  data: VoiceIngestData,
  buffer: Buffer,
  format: AudioFormat,
): Promise<{ objectKey: string; url: string } | null> {
  try {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const safeId = (data.externalMessageId || "voice").replace(/[^\w.-]/g, "_");
    const objectKey = `voice/${yyyy}/${mm}/${dd}/${safeId}.${format}`;
    await putObject(objectKey, buffer, `audio/${format}`);
    return { objectKey, url: getPublicUrl(objectKey) };
  } catch (err) {
    console.error("[voice-ingest] archiveAudio failed:", err);
    return null;
  }
}

/** 核心逻辑（可单测）：下载 → ASR → 落库 → 喂 gateway → 回执。 */
export async function runVoiceIngestAndReply(data: VoiceIngestData): Promise<void> {
  // 1. 优先用平台自带转写（钉钉 audio.recognition），命中则免下载+ASR
  const inline = (data.inlineTranscript ?? "").trim();
  let transcript = inline;
  let confidence = inline ? 0.9 : 0;
  let provider = "platform";
  let durationMs = data.media?.durationMs;
  let audioRef: { objectKey: string; url: string } | null = null;
  let audioFormat: AudioFormat | null = null;

  // 2. 无自带转写 → 下载媒体 + 自建 ASR
  if (!transcript) {
    let buffer: Buffer;
    try {
      const config = await getChannelConfig(data.configId);
      if (!config) throw new Error("渠道配置不存在");
      const media: ChannelMediaRef = {
        downloadCode: data.media?.downloadCode || undefined,
        mediaId: data.media?.mediaId || undefined,
        format: (data.media?.format as AudioFormat) ?? "amr",
        durationMs: data.media?.durationMs,
      };
      const dl = await downloadChannelAudio(config, media);
      buffer = dl.buffer;
      audioFormat = dl.format;
    } catch (err) {
      console.error("[voice-ingest] 下载语音失败:", err);
      await replyToChannel(data, "❌ 语音下载失败，请改用文字消息。");
      return;
    }

    audioRef = await archiveAudio(data, buffer, audioFormat);

    try {
      const result = await transcribeAudio(buffer, audioFormat);
      transcript = result.text;
      confidence = result.confidence;
      provider = result.provider;
      durationMs = result.durationMs ?? durationMs;
    } catch (err) {
      console.error("[voice-ingest] ASR 失败:", err);
      await replyToChannel(data, "❌ 语音听写失败，请改用文字消息。");
      return;
    }
  }

  // 3. 落库入站语音消息（原音 URL + 转写文本 + 置信度）
  await recordInboundMessage({
    organizationId: data.organizationId,
    configId: data.configId,
    platform: data.platform,
    externalMessageId: data.externalMessageId || undefined,
    externalUserId: data.externalUserId || undefined,
    chatId: data.chatId || undefined,
    content: {
      type: "voice",
      text: transcript,
      transcript: { confidence, durationMs, provider, inlineUsed: Boolean(inline) },
      audio: audioRef
        ? { objectKey: audioRef.objectKey, url: audioRef.url, format: audioFormat }
        : undefined,
    },
  }).catch((err) => console.error("[voice-ingest] recordInboundMessage failed:", err));

  // 4. 质检转写
  if (!transcript || transcript.length < 2) {
    await replyToChannel(data, "🤔 没听清，请重说一遍，或直接发文字消息。");
    return;
  }
  if (confidence < getAsrMinConfidence()) {
    // 低置信：回显识别结果让用户确认，不直接执行（避免同音字误触发布等危险动作）
    await replyToChannel(
      data,
      `🤔 我大概听到的是：「${transcript}」。是这个意思就把这句话用文字发我，或重说一遍。`,
    );
    return;
  }

  // 5. 转写文本当文字输入喂 gateway（与文字消息同一路径）
  const { reply } = await handleInboundMessage({
    platform: data.platform,
    configId: data.configId,
    organizationId: data.organizationId,
    externalMessageId: data.externalMessageId,
    externalUserId: data.externalUserId,
    chatId: data.chatId,
    textContent: transcript,
    rawMessage: { source: "voice", transcript, confidence, media: data.media },
    replyWebhook: data.replyWebhook || undefined,
    source: "voice",
    transcript: { confidence, durationMs },
    skipRecord: true, // 已在第 3 步落库，避免重复
  });

  // 6. 回执
  if (reply) await replyToChannel(data, reply);
}

export const channelVoiceIngest = inngest.createFunction(
  {
    id: "channel-voice-ingest",
    retries: 2,
    // 同一会话（configId+chatId+externalUserId）的语音严格串行，避免连发乱序污染 session
    concurrency: {
      limit: 1,
      key: "event.data.configId + '/' + event.data.chatId + '/' + event.data.externalUserId",
    },
  },
  { event: "channel/voice-ingest.requested" },
  async ({ event, step }) => {
    await step.run("ingest-voice-and-reply", () => runVoiceIngestAndReply(event.data));
    return { ok: true };
  },
);

/** 终态失败处理 —— 订阅 inngest/function.failed，仅认领本函数失败，回执用户。 */
export const channelVoiceIngestFailureHandler = inngest.createFunction(
  { id: "channel-voice-ingest-failure-handler", retries: 1 },
  { event: "inngest/function.failed" },
  async ({ event, step }) => {
    const fnId = (event.data as Record<string, unknown>)?.function_id;
    if (fnId !== "channel-voice-ingest") return;
    const originalEvent = (event.data as Record<string, unknown>)?.event as
      | { data?: VoiceIngestData }
      | undefined;
    const data = originalEvent?.data;
    if (!data) return;
    await step.run("notify-failure", () =>
      replyToChannel(data, "❌ 语音处理失败，请改用文字消息。"),
    );
  },
);
