# 超级个体门户 Phase 3 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 打通钉钉/企业微信双向对话，任务消息同步到外部渠道。

**Architecture:** Channel Gateway（消息标准化层）作为入口，统一接入多个平台。Webhook 路由通过 configId 实现多租户隔离。入站消息走现有 intent-recognition + agent execution；出站消息格式化后推送到对应平台。

**Tech Stack:** Next.js 16 + Drizzle + 现有 agent/mission + crypto（HMAC）+ Inngest（出站队列）

**Spec:** `docs/superpowers/specs/2026-04-17-super-individual-portal-design.md` §6

---

## Task 1: 渠道 Schema

**Files:**
- Create: `src/db/schema/channels.ts`
- Modify: `src/db/schema/enums.ts` — 添加 `channelPlatformEnum`, `channelMessageDirectionEnum`
- Modify: `src/db/schema/index.ts` — 导出

- [ ] **Step 1: 新枚举**

```typescript
export const channelPlatformEnum = pgEnum("channel_platform", [
  "dingtalk", "wechat_work"
]);

export const channelMessageDirectionEnum = pgEnum("channel_message_direction", [
  "inbound", "outbound"
]);
```

- [ ] **Step 2: channel_configs 表**

字段：id, organizationId, platform(channelPlatformEnum), name, appKey, appSecret, robotSecret, corpId, agentId, token, encodingAesKey, isEnabled, createdAt, updatedAt

多租户 + 每个组织可以有多个渠道配置。敏感字段（appSecret/robotSecret 等）按明文存储（建议后期加密，MVP 阶段存明文，因为 Supabase 本身已加密）。

- [ ] **Step 3: channel_messages 表**

字段：id, organizationId, configId(FK), platform, direction(channelMessageDirectionEnum), externalMessageId, userId(外部平台用户ID), chatId(群/会话ID), content(jsonb), missionId(FK, nullable), status("received"|"processed"|"sent"|"failed"), errorMessage, createdAt

- [ ] **Step 4: 类型检查 + 提交**

```bash
git commit -m "feat: add channel_configs and channel_messages schema"
```

---

## Task 2: 签名验证工具

**Files:**
- Create: `src/lib/channels/signature.ts`

- [ ] **Step 1: 钉钉签名验证**

钉钉机器人 outgoing webhook 使用 HMAC-SHA256：
```
timestamp + "\n" + secret → HMAC-SHA256 → base64 → urlencode
```

```typescript
export function verifyDingtalkSignature(
  timestamp: string,
  sign: string,
  secret: string
): boolean {
  const stringToSign = `${timestamp}\n${secret}`;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(stringToSign);
  const computed = encodeURIComponent(hmac.digest("base64"));
  return computed === sign;
}
```

- [ ] **Step 2: 企业微信消息加解密**

企业微信使用 AES-CBC（PKCS7 填充）+ 消息完整性签名：

```typescript
export function verifyWechatSignature(
  token: string,
  timestamp: string,
  nonce: string,
  msgEncrypt: string,
  signature: string
): boolean {
  const arr = [token, timestamp, nonce, msgEncrypt].sort();
  const hash = crypto.createHash("sha1");
  hash.update(arr.join(""));
  return hash.digest("hex") === signature;
}

export function decryptWechatMessage(
  msgEncrypt: string,
  encodingAesKey: string
): string {
  // AES-CBC 解密 + 去除前16字节随机数 + 4字节长度 + 末尾 corpid
}
```

- [ ] **Step 3: 类型检查 + 提交**

---

## Task 3: 渠道 DAL + Actions

**Files:**
- Create: `src/lib/dal/channels.ts` — 查询函数
- Create: `src/app/actions/channels.ts` — CRUD actions

- [ ] **Step 1: DAL**

```typescript
// listChannelConfigs(orgId)
// getChannelConfig(configId) — for webhook lookup
// getChannelConfigByPlatform(orgId, platform)
// listChannelMessages(orgId, filters?)
// getChannelMessage(messageId)
```

- [ ] **Step 2: Actions**

```typescript
// createChannelConfig(input)
// updateChannelConfig(configId, updates)
// deleteChannelConfig(configId)
// toggleChannelConfig(configId, enabled)
// recordInboundMessage(input) — 内部工具，webhook 调用
// recordOutboundMessage(input) — 内部工具，notify 调用
```

- [ ] **Step 3: 类型检查 + 提交**

---

## Task 4: 消息标准化层

**Files:**
- Create: `src/lib/channels/gateway.ts`

- [ ] **Step 1: 标准化消息格式**

```typescript
export interface StandardizedMessage {
  platform: "dingtalk" | "wechat_work";
  configId: string;
  organizationId: string;
  externalUserId: string;
  chatId: string;
  textContent: string;
  attachments?: { type: string; url: string }[];
  rawMessage: unknown;
}
```

- [ ] **Step 2: 入站处理器**

```typescript
export async function handleInboundMessage(msg: StandardizedMessage): Promise<{
  reply: string;
  missionId?: string;
}> {
  // 1. 解析消息，判断是否为快捷指令（#场景名 参数）
  //    - 是 → 启动对应场景
  //    - 否 → 调用意图识别
  // 2. 根据意图分配员工执行
  // 3. 返回回复文本（简短响应 + Mission 链接）
  // 4. 记录到 channel_messages 表
}
```

- [ ] **Step 3: 出站格式化**

```typescript
export function formatForPlatform(
  platform: "dingtalk" | "wechat_work",
  payload: { type: "text" | "card" | "progress"; content: string; actions?: unknown }
): unknown {
  // 钉钉：返回 ActionCard / Markdown 格式
  // 企业微信：返回 text/markdown/template_card 格式
}
```

- [ ] **Step 4: 类型检查 + 提交**

---

## Task 5: 钉钉 Webhook 路由

**Files:**
- Create: `src/app/api/channels/dingtalk/webhook/[configId]/route.ts`

- [ ] **Step 1: POST handler**

```typescript
export async function POST(
  req: Request,
  { params }: { params: Promise<{ configId: string }> }
) {
  const { configId } = await params;

  // 1. 加载 channel_configs by configId
  // 2. 读取 headers: timestamp, sign
  // 3. verifyDingtalkSignature — 失败返回 401
  // 4. 解析 body: { msgtype, text: {content}, senderStaffId, conversationId }
  // 5. 构建 StandardizedMessage
  // 6. handleInboundMessage → 获取回复
  // 7. 回复钉钉（同步响应 or 调用 webhookUrl）
  // 8. 记录 channel_messages
}
```

- [ ] **Step 2: 类型检查 + 提交**

---

## Task 6: 企业微信 Webhook 路由

**Files:**
- Create: `src/app/api/channels/wechat/webhook/[configId]/route.ts`

- [ ] **Step 1: GET handler — URL 验证**

企业微信首次配置时会 GET 请求做 URL 验证，需要返回解密后的 echostr：
```typescript
export async function GET(req, { params }) {
  // verify signature + decrypt echostr → return plaintext
}
```

- [ ] **Step 2: POST handler — 接收消息**

```typescript
export async function POST(req, { params }) {
  // 1. 读取 query: msg_signature, timestamp, nonce
  // 2. 读取 body (XML): <Encrypt>...</Encrypt>
  // 3. verifyWechatSignature
  // 4. decryptWechatMessage → 明文 XML
  // 5. 解析 XML: FromUserName, Content, MsgType
  // 6. 构建 StandardizedMessage + handleInboundMessage
  // 7. 加密回复（企业微信要求同步返回加密 XML）
}
```

- [ ] **Step 3: 类型检查 + 提交**

---

## Task 7: 统一出站推送

**Files:**
- Create: `src/app/api/channels/notify/route.ts`
- Create: `src/lib/channels/outbound.ts` — 平台 API 客户端

- [ ] **Step 1: 钉钉发送 API**

```typescript
// 通过 access_token API 发送消息到指定会话
export async function sendDingtalkMessage(
  config: ChannelConfig,
  chatId: string,
  payload: unknown
): Promise<void> {
  // 1. Get access_token (cache 2h)
  // 2. POST to https://oapi.dingtalk.com/chat/send
  // 3. 记录 channel_messages (outbound)
}
```

- [ ] **Step 2: 企业微信发送 API**

```typescript
export async function sendWechatMessage(
  config: ChannelConfig,
  toUser: string,
  payload: unknown
): Promise<void> {
  // 1. Get access_token (cache 2h)
  // 2. POST to https://qyapi.weixin.qq.com/cgi-bin/message/send
}
```

- [ ] **Step 3: notify route**

```typescript
// POST /api/channels/notify
// body: { organizationId, platform, target, payload }
// 根据 platform 调用对应 send 函数
// 支持限流（Inngest 队列）
```

- [ ] **Step 4: 类型检查 + 提交**

---

## Task 8: Mission 推送集成

**Files:**
- Modify: `src/inngest/functions/execute-mission-task.ts`（或新建 hook）

- [ ] **Step 1: Mission 状态变更推送**

当 Mission 进入 `completed` 或 `failed` 时，查询该 Mission 是否来自外部渠道（channel_messages 表 missionId 关联），是则调用 `/api/channels/notify` 推送结果。

- [ ] **Step 2: 审核节点提醒**

审核 task 进入 `in_review` 时，推送通知到相关人员的钉钉/企业微信。

- [ ] **Step 3: 类型检查 + 提交**

---

## Task 9: 渠道管理页

**Files:**
- Create: `src/app/(dashboard)/settings/channels/page.tsx`
- Create: `src/app/(dashboard)/settings/channels/channels-client.tsx`

- [ ] **Step 1: 渠道列表 + 配置**

列表显示已配置的渠道（钉钉/企业微信），每行显示平台、名称、状态、Webhook URL。

添加渠道向导：
- 选择平台（钉钉/企业微信）
- 填写 App Key/Secret 等凭证
- 生成 Webhook URL（含 configId）
- 复制给平台方配置

- [ ] **Step 2: 消息日志**

显示最近的入站/出站消息记录，支持按平台/方向筛选。

- [ ] **Step 3: 类型检查 + 提交**

---

## Task 10: 侧边栏入口 + 最终验证

- [ ] **Step 1: 侧边栏添加"渠道集成"**

设置分组下添加"渠道集成"条目，链接到 `/settings/channels`。

- [ ] **Step 2: 完整验证**

```bash
npx tsc --noEmit && npm run build
```

- [ ] **Step 3: 环境变量文档**

更新 `.env.example` 说明钉钉和企业微信的凭证格式。

- [ ] **Step 4: 最终提交**
