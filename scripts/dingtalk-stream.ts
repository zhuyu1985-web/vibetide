/**
 * 钉钉 Stream 模式接收端 —— 无需公网回调地址，进程主动连钉钉建长连接收 @机器人 消息。
 *
 * 适用场景：本地开发 / 无公网 IP 的环境（HTTP 模式收不到时用它）。
 *
 * 凭证全部读自渠道配置（/settings/channels）——给钉钉渠道填上「Client ID」+「入站验签密钥(AppSecret)」
 * 并保持启用即可，无需任何环境变量。本进程会连上所有"已配 Stream 凭证且启用中"的钉钉渠道。
 *
 * 运行：
 *   pnpm run dingtalk:stream
 *   （= npx tsx --env-file=.env.local scripts/dingtalk-stream.ts，仅为加载 DATABASE_URL）
 *
 * 收到的消息走与 HTTP 模式同一套 gateway（命令 / 链接收稿 / 自由识别），
 * 回执（⏳ 和 ✅）都经消息自带的 sessionWebhook 发回原会话。
 */
import {
  DWClient,
  TOPIC_ROBOT,
  EventAck,
  type DWClientDownStream,
} from "dingtalk-stream-sdk-nodejs";
import { listDingtalkStreamConfigs } from "@/lib/dal/channels";
import {
  handleStreamRobotMessage,
  type IncomingRobotMessage,
} from "@/lib/channels/dingtalk-stream-handler";

async function main() {
  const configs = await listDingtalkStreamConfigs();
  if (configs.length === 0) {
    console.error(
      "没有可用的钉钉 Stream 渠道。请到 /settings/channels 编辑钉钉渠道，填写「Client ID」" +
        "+「入站验签密钥(AppSecret)」并保持启用后重试。",
    );
    process.exit(1);
  }

  for (const config of configs) {
    const clientId = config.clientId;
    const clientSecret = config.inboundSecret;
    // listDingtalkStreamConfigs 已过滤非空，这里再做一次防御，TS 也得到收窄。
    if (!clientId || !clientSecret) continue;

    const ctx = { organizationId: config.organizationId, configId: config.id };
    const client = new DWClient({ clientId, clientSecret });

    client.registerCallbackListener(TOPIC_ROBOT, (res: DWClientDownStream) => {
      const { messageId } = res.headers;
      // 回调签名是同步返回 void；异步处理放进 IIFE，处理完在 finally 里 ack。
      void (async () => {
        try {
          const msg = JSON.parse(res.data) as IncomingRobotMessage;
          console.log(`[dingtalk-stream] 收到消息（${config.name}）`, {
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
      `[dingtalk-stream] 已连接「${config.name}」(org=${ctx.organizationId}, config=${ctx.configId})`,
    );
  }

  console.log(
    `[dingtalk-stream] 共 ${configs.length} 个钉钉 Stream 渠道在监听。群里 @机器人 发带链接的消息试试。`,
  );
}

main().catch((err) => {
  console.error("[dingtalk-stream] 启动失败：", err);
  process.exit(1);
});
