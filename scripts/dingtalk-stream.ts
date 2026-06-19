/**
 * 钉钉 Stream 模式接收端 —— 无需公网回调地址，进程主动连钉钉建长连接收 @机器人 消息。
 *
 * 适用场景：本地开发 / 无公网 IP 的环境（HTTP 模式收不到时用它）。
 *
 * 运行：
 *   npx tsx --env-file=.env.local scripts/dingtalk-stream.ts
 *   （或 pnpm run dingtalk:stream）
 *
 * 需要的环境变量（.env.local）：
 *   DINGTALK_STREAM_CLIENT_ID      钉钉企业内部应用 Client ID（原 AppKey）
 *   DINGTALK_STREAM_CLIENT_SECRET  钉钉企业内部应用 Client Secret（原 AppSecret）
 *   DINGTALK_STREAM_CONFIG_ID      VibeTide 中对应的钉钉渠道配置 id（/settings/channels 的 Webhook URL 末段）
 *
 * 收到的消息会走与 HTTP 模式同一套 gateway（命令 / 链接收稿 / 自由识别），
 * 回执（⏳ 和 ✅）都经消息自带的 sessionWebhook 发回原会话。
 */
import {
  DWClient,
  TOPIC_ROBOT,
  EventAck,
  type DWClientDownStream,
} from "dingtalk-stream-sdk-nodejs";
import { getChannelConfig } from "@/lib/dal/channels";
import {
  handleStreamRobotMessage,
  type IncomingRobotMessage,
} from "@/lib/channels/dingtalk-stream-handler";

async function main() {
  const clientId = process.env.DINGTALK_STREAM_CLIENT_ID;
  const clientSecret = process.env.DINGTALK_STREAM_CLIENT_SECRET;
  const configId = process.env.DINGTALK_STREAM_CONFIG_ID;

  if (!clientId || !clientSecret || !configId) {
    console.error(
      "缺少环境变量：DINGTALK_STREAM_CLIENT_ID / DINGTALK_STREAM_CLIENT_SECRET / DINGTALK_STREAM_CONFIG_ID",
    );
    process.exit(1);
  }

  const config = await getChannelConfig(configId);
  if (!config || config.platform !== "dingtalk") {
    console.error(
      `渠道配置 ${configId} 不存在或不是钉钉渠道，请在 /settings/channels 确认 configId`,
    );
    process.exit(1);
  }

  const ctx = { organizationId: config.organizationId, configId: config.id };
  const client = new DWClient({ clientId, clientSecret });

  client.registerCallbackListener(TOPIC_ROBOT, (res: DWClientDownStream) => {
    const { messageId } = res.headers;
    // 回调签名是同步返回 void；异步处理放进 IIFE，处理完在 finally 里 ack。
    void (async () => {
      try {
        const msg = JSON.parse(res.data) as IncomingRobotMessage;
        console.log("[dingtalk-stream] 收到消息", {
          msgtype: msg.msgtype,
          sender: msg.senderStaffId ?? msg.senderNick,
          textPreview: msg.text?.content?.slice(0, 80),
          hasSessionWebhook: !!msg.sessionWebhook,
        });
        await handleStreamRobotMessage(msg, ctx);
      } catch (err) {
        console.error("[dingtalk-stream] 处理消息失败：", err);
      } finally {
        client.send(messageId, { status: EventAck.SUCCESS, message: "OK" });
      }
    })();
  });

  await client.connect();
  console.log(
    `[dingtalk-stream] 已连接钉钉 Stream（org=${ctx.organizationId}, config=${ctx.configId}）。群里 @机器人 发带链接的消息试试。`,
  );
}

main().catch((err) => {
  console.error("[dingtalk-stream] 启动失败：", err);
  process.exit(1);
});
