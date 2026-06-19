# 钉钉机器人入站收链接存稿 Design（OpenClaw-style 反向通道）

## Summary

让钉钉群里 @机器人 + 发链接的消息能"反向"回到 VibeTide：后台识别消息里的 http(s) 链接，用 Jina Reader 抓取网页正文，落成一篇 `articles` 草稿（`status=draft`），并把"已收录《标题》"回执推回钉钉群。

关键判断：**入站管道已存在 ~80%**。`channel_configs` 表、钉钉/企微入站 webhook 路由、验签/加解密、统一网关 `handleInboundMessage`、出站发送、`fetchViaJinaReader`、`articles` 表都是现成的。真正缺的只是把"检测链接 → 抓取 → 存草稿 → 回执"这条分支接上，并改为异步执行。本设计只新增 4 个小文件 + 改 2 处 + 加 1 个 schema 字段。

本期范围只做**钉钉**；企微（WeChat Work）留到 P2。

## Scope

In scope：
- 钉钉群 @企业内部应用机器人、消息含 http(s) 链接时，自动抓取并存为 `articles` 草稿。
- 一条消息含多个链接时逐条入库。
- 入站回调用钉钉企业内部机器人 AppSecret 验签（新增 `inboundSecret` 字段承载）。
- 异步执行（Inngest），webhook 同步秒回 `⏳ 已收到，正在抓取`，抓完用 `sessionWebhook` 推 `✅ 已收录《标题》[查看稿件]`。
- 链接级 + 消息级双层去重。

Out of scope：
- 企微入站收链接（P2，分层已为其留口）。
- 抓取后的二次 AI 加工（洗稿/改写/配图/摘要）——只存原文草稿。
- 非链接自由消息的意图执行——维持现有 MVP 行为（仅返回意图摘要）。
- 把钉钉发送者映射到 VibeTide 用户账号——`createdBy` 留空，发送者信息存 `metadata`。
- 富媒体消息（图片/卡片/语音）入站。

## 平台前提（运营侧一次性配置）

现有"群自定义机器人 Webhook"是**纯出站**的，不会回调群消息。要实现入站，钉钉侧必须改用**企业内部应用机器人**，在机器人「消息接收」配置里把回调地址填成渠道页复制的
`{NEXT_PUBLIC_SITE_URL}/api/channels/dingtalk/webhook/{configId}`。机器人只在被 @ 时回调，天然满足"@机器人才触发"。

验签：企业内部机器人 outgoing 回调用机器人的 **AppSecret** 签名，算法与现有 `verifyDingtalkSignature` 一致（HMAC key = AppSecret，message = `timestamp + "\n" + AppSecret`，再 Base64，请求头带 `timestamp` / `sign`，`timestamp` 与当前相差 >1 小时即非法）。运营在渠道配置里把该 AppSecret 填进新增的 `inboundSecret` 字段。**该算法与"AppSecret 验入站 / SEC 密钥出站"的区分已对照钉钉官方口径核实（见文末「外部平台事实」）。**

## Architecture / Data Flow

同步段（webhook，必须毫秒级返回，钉钉有超时与 3 次重试）：
1. 钉钉 POST → `/api/channels/dingtalk/webhook/[configId]`。
2. 路由用 `inboundSecret` 验签、校验 `timestamp` 时效；从 body 取 `sessionWebhook`。
3. `handleInboundMessage` 在 `#命令` 之后、自由识别之前，先 `extractUrls(text)`。
4. 命中链接 → `inngest.send({ name: "channel/link-ingest.requested", id: externalMessageId, data })`，data 带 `url / configId / organizationId / chatId / externalUserId / externalMessageId / replyWebhook(=sessionWebhook)`；多个链接派多个事件（event id 用 `externalMessageId#index`）。
5. 同步返回 `⏳ 已收到，正在抓取 N 条链接`。

异步段（Inngest `channelLinkIngest`，`retries: 2`）：
6. `fetchViaJinaReader(url)` → `{title, content}`。
7. 去重：`select 1 from articles where organizationId=? and sourceUrl=?`，命中即跳过、回执"该链接已收录过《标题》"。
8. `db.insert(articles)` 直插草稿（见落库映射）。
9. `postToSessionWebhook(replyWebhook, ...)` 推 `✅ 已收录《标题》[查看稿件]`（带 deep link `/articles/{id}`）。
10. 稿件库 `/articles` 出现新草稿，可继续编辑 / 送审 / 发 CMS。

回执机制说明：因抓取是异步、webhook 已返回，"已收录"必须主动推送。优先用钉钉回调 payload 自带的 `sessionWebhook`（有效期约 5 分钟 / 20 条，足够覆盖一次 Jina 抓取），不需要第二个机器人、不需要 access_token。`sessionWebhook` 过期时回退到现有 `sendChannelMessage`（走 `config.appKey` 自定义机器人 webhook，前提同群也加了它）。

## Components

新建（小而专，独立单测）：
- `src/lib/channels/link-extract.ts` — `extractUrls(text): string[]`：正则提取 http(s)、去重、过滤钉钉自身域名。无副作用。
- `src/lib/channels/ingest-link-to-article.ts` — `ingestLinkToArticle(input): Promise<{ articleId?, title, skipped }>`：server-only，**不带 `requireAuth`**，封装去重 + `fetchViaJinaReader` + `db.insert(articles)`。供 Inngest 调用，也是单测主对象。
- `src/inngest/functions/channel-link-ingest.ts` — 订阅 `channel/link-ingest.requested`，调 `ingestLinkToArticle` + 回执。注册进 `src/inngest/functions/index.ts`。
- `src/lib/channels/session-webhook.ts` — `postToSessionWebhook(url, payload)`：对 `sessionWebhook` 做一次 POST，复用 `formatForPlatform`。

改动（最小侵入）：
- `src/inngest/events.ts` — 加事件类型 `channel/link-ingest.requested`。
- `src/lib/channels/gateway.ts` — `handleInboundMessage` 加链接分支；`StandardizedMessage` 加可选 `replyWebhook`。自由识别分支不动。
- `src/app/api/channels/dingtalk/webhook/[configId]/route.ts` — 验签改读 `inboundSecret`（回退 `robotSecret` 兼容旧配置）；从 body 取 `sessionWebhook` 传入 `StandardizedMessage.replyWebhook`。
- `src/db/schema/articles.ts` — `metadata` 的 `$type` **必须**加可选 `ingestedFromChannel?: { platform, configId, chatId, externalUserId, externalMessageId }`。这不是注脚而是 must-fix：strict 模式下不改 `$type` 直接写该键会让 `tsc --noEmit` 失败。
- `inbound_secret` 字段是一组级联改动，缺一处 `tsc` 不过：
  - `src/db/schema/channels.ts` — `channel_configs` 加 `inbound_secret text`。
  - `src/lib/dal/channels.ts` — `ChannelConfigRow` 加 `inboundSecret: string | null`。
  - `src/app/actions/channels.ts` — `createChannelConfig` / `updateChannelConfig` 参数类型加 `inboundSecret`。
  - `src/app/(dashboard)/settings/channels/channels-client.tsx` — `ChannelFormState`、`defaultForm()`、`openEdit()` 回填、`handleSubmit()` 提交，以及钉钉表单 UI 加一栏「入站验签密钥（企业内部机器人 AppSecret）」。**UI 用 `<Input>`（`@/components/ui/input`），不要裸 `<input>`，按钮不带边框（CLAUDE.md 设计系统硬规则）。**

## Schema 变更

```
channel_configs.inbound_secret  text  NULL   -- 钉钉企业内部机器人 AppSecret，入站回调验签用
```

迁移流程分环境（不要混）：**本地** `127.0.0.1:5433`（journal 空）改 `src/db/schema/channels.ts` 后直接 `npm run db:push`，无需 `db:generate`；**生产** 改 schema → `npm run db:generate` → `npm run db:migrate`。同理 `articles.metadata` 的 `$type` 扩字段是纯类型变更、不动 DDL，无需迁移。

## 落库映射

| articles 字段 | 值 |
|---|---|
| `organizationId` | 由 `configId` 反查 `channel_configs` |
| `title` | 抓取 `title`（空则用域名兜底） |
| `body` / `content.body` | 抓取 `content` |
| `content.headline` | = `title` |
| `status` | `draft` |
| `sourceType` | `repost` |
| `sourceUrl` | 原链接 |
| `sourceName` | `钉钉收稿·@{senderNick 或 externalUserId}` |
| `createdBy` | `null`（系统收稿，字段可空已确认） |
| `mediaType` | `article` |
| `wordCount` | `content.length` |
| `metadata.ingestedFromChannel` | `{ platform, configId, chatId, externalUserId, externalMessageId }` |

> 写 `metadata.ingestedFromChannel` 前必须先扩 `articles.metadata` 的 `$type`（见 Components 改动清单，must-fix）。

## 去重与幂等

- **链接级（主保障）**：插库前查 `org + sourceUrl` 是否已存在，命中跳过并回"已收录过"。这一层独立兜住钉钉的 at-least-once 重试——重试事件抓回同一 URL，查重即跳过。
- **消息级（加固，非强依赖）**：`inngest.send` 若带 `id`（`externalMessageId` 派生）可让 Inngest 直接去重同一 @消息。但项目现有 `inngest.send` 调用均无 `id` 先例，实现前先在 `package.json` 确认 `inngest` 版本的 `send()` 是否支持 `id` 幂等；不支持就去掉，仅靠链接级查重（极小概率并发 race 的双插，留待 P2 用 `articles(organizationId, sourceUrl)` 部分唯一索引加固，本期不引入以免与存量 repost 同 URL 冲突）。

## Error Handling

- Jina 抓取失败（付费墙/反爬/超时）：Inngest `retries: 2`，终败回执 `❌ 抓取失败：<原因>，可手动在系统添加`，并记一条 failed 日志（`recordOutboundMessage`，`organizationId` / `configId` 由事件 data 显式带入——Inngest 函数内无 session）。
- `sessionWebhook` 过期（对照 payload 的 `sessionWebhookExpiredTime`；正常抓取 ~10-30s 远小于其有效期，几乎不触发）：best-effort 回退——若该 config 的 `appKey` 仍配着同群自定义机器人 webhook，用 `sendChannelMessage`（`chatId` 传 `conversationId`，仅用于日志）；否则仅记 failed 日志，不阻断已入库的草稿。`appKey`（出站自定义机器人）与企业内部机器人（入站）是两个并存的机器人，迁移后 `appKey` 可留可空。
- 验签失败 / config 禁用：维持现有 401 / 404。
- `extractUrls` 无命中：不进收稿分支，走原有自由识别行为。

## Verification

- 单测 `extractUrls`：多链接、中英文混排、无链接、钉钉域名过滤、去重。
- 单测 `ingestLinkToArticle`：mock `fetchViaJinaReader` + 内存/stub db，断言字段映射、去重跳过、空标题兜底。
- 单测 gateway 链接分支：断言"含链接 → 派事件 + 返回 ⏳"，"无链接 → 不派事件"。
- 单测 `channelLinkIngest` Inngest 函数：mock step，断言成功/失败/去重三路回执。
- `npx tsc --noEmit` + `npm run build` 通过。

## Rollout

1. Schema 加字段 + 迁移。
2. 后端链路（extract / ingest / event / function / gateway / route）。
3. 渠道配置 UI 加 `inboundSecret` 栏。
4. 运营把钉钉机器人换成企业内部应用机器人、配回调地址、填 AppSecret。
5. 群里 @机器人 发一条测试链接验证端到端。

## 外部平台事实（已核实）

钉钉企业内部应用机器人 outgoing 回调（被 @ 时 POST 到回调地址），两条本设计依赖的事实已对照官方口径核实：

1. **回调体带 `sessionWebhook` + `sessionWebhookExpiredTime`**：用于临时回话，有效期是 payload 里的 `sessionWebhookExpiredTime` 时间戳（临时凭证，非永久）。这是异步回执的主路径。
2. **接收回调验签用 AppSecret**：HTTP header 带 `timestamp` / `sign`；`sign = Base64(HmacSHA256(timestamp + "\n" + AppSecret))`，HMAC key = AppSecret；`timestamp` 与当前相差 >1 小时即非法。官方明确区分：**AppSecret 验入站回调，自定义机器人 SEC 加签密钥用于出站** —— 故 `inboundSecret`（存 AppSecret）与现有 `robotSecret`（SEC 密钥）必须分开。

> 来源：钉钉开发者文档「机器人接收消息 / 回复消息」（open.dingtalk.com）与开发者百科（open-dingtalk.github.io）。落地时以机器人实际回调样例为准二次确认字段名。

## Future（P2，分层已留口）

- 企微入站收链接：在企微 webhook route 加同样链接分支；主动回执走企微 access_token（`sendWechatMessage` 已具备），无 `sessionWebhook` 等价物，改为 `sendChannelMessage` 推送。
- 收稿后可选触发洗稿/改写 workflow（复用 `startMissionFromModule`）。
- 发送者 → VibeTide 用户映射，填充 `createdBy`。
- `sourceIconUrl` 自动匹配来源站点图标。
