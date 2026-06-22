# Phase 1d-B（core + 文生图）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development。Steps 用 `- [ ]`。

**Goal:** kie.ai 出图 → 火山 TOS 转存 → 写回 article 配图；IM「加配图」异步任务 + 回执。

**Spec:** `docs/superpowers/specs/2026-06-22-aigc-kie-image-design.md`

**分支：** `claude/aigc-kie-image`（off main）。

**kie.ai 实测契约（照用）：**
- `POST https://api.kie.ai/api/v1/jobs/createTask` `{model, input:{prompt, aspect_ratio?}}` → `{code:200, data:{taskId}}`（code!=200 抛）
- `GET /api/v1/jobs/recordInfo?taskId=` → `{code:200, data:{state, resultJson, failMsg}}`；state `success` 时 `resultJson` 是 **JSON 字符串** parse 后 `{resultUrls:[url]}`；`fail` 看 failMsg
- 鉴权 `Authorization: Bearer ${KIE_API_KEY}`；图是 tempfile 临时链 → 必须转存 TOS

**纪律：** 无 auth（Inngest 任务）一律直接 `db.insert/db.update`，不用 createAsset/updateArticle（带 requireAuth）。env：KIE_API_KEY 真值已在 .env.local。

---

### Task 1dB-T1: 基建 — TOS putObject + kie 客户端 + 转存

**Files:** `src/lib/volc-tos.ts`、`src/lib/aigc/kie-client.ts`(新)、`src/lib/aigc/store-image.ts`(新)；Test: 对应 __tests__。

- [ ] **Step 1: volc-tos putObject**
  `src/lib/volc-tos.ts` 加：
  ```ts
  export async function putObject(objectKey: string, body: Buffer | Uint8Array, contentType: string): Promise<void> {
    const client = getClient();
    await client.putObject({ bucket, key: objectKey, body: Buffer.from(body), contentType });
  }
  ```
  （核对 @volcengine/tos-sdk putObject input 字段名；若 contentType 字段叫 `contentType` 之外的名按 SDK 类型来。）

- [ ] **Step 2: kie-client（TDD，mock global fetch）**
  `src/lib/aigc/kie-client.ts`：
  - `KieConfigError`/`KieError extends Error`。
  - `kieCreateTask(model, input): Promise<string>`：POST createTask（无 KIE_API_KEY→KieConfigError；code!=200→KieError）→ data.taskId。
  - `kiePollTask(taskId, {timeoutMs=180000, intervalMs=5000}): Promise<string[]>`：循环 GET recordInfo；state success→`JSON.parse(data.resultJson).resultUrls`；fail→KieError(failMsg)；超时→KieError。
  - `kieGenerateImage({prompt, aspectRatio="1:1"}): Promise<string[]>`：用 `process.env.KIE_IMAGE_MODEL || "nano-banana-pro"` 调 createTask + poll。
  - base：`process.env.KIE_BASE_URL || "https://api.kie.ai"`。
  测试：mock fetch 返回 createTask/recordInfo 各形态；断言解析/错误/超时（vi.useFakeTimers）。

- [ ] **Step 3: store-image（TDD，mock fetch + putObject + db）**
  `src/lib/aigc/store-image.ts`：`storeRemoteImageToTos(url, {organizationId, articleId, title}): Promise<{assetId:string; publicUrl:string}>`：
  - `fetch(url)` → arrayBuffer → Buffer。
  - `objectKey = ${organizationId}/aigc/${articleId}/${crypto.randomUUID()}.png`。
  - `putObject(objectKey, buf, "image/png")` → `publicUrl = getPublicUrl(objectKey)`。
  - 直接 `db.insert(mediaAssets).values({organizationId, tosObjectKey:objectKey, tosBucket:defaultBucket, fileUrl:publicUrl, type:"image", title:`${title} 配图`, ...必填}).returning({id})` → assetId。
  - 返回 {assetId, publicUrl}。
  > ⚠️ 先 Read `src/db/schema/media-assets.ts` 确认 mediaAssets 必填列（type enum 值、有无 status/uploadedBy 等 notNull 无默认列），按真实列填；缺啥补啥。
  测试：mock fetch（返回 arrayBuffer）、`@/lib/volc-tos`（putObject/getPublicUrl/defaultBucket）、`@/db`（insert 链）；断言 putObject 被调 + 返回 publicUrl + insert values 含 type:"image"。

- [ ] **Step 4: tsc + 测试**；**Step 5: commit** `feat(aigc): kie.ai 客户端 + 火山 TOS putObject + 出图转存管线`

---

### Task 1dB-T2: aigcIllustrate Inngest 任务 + 意图纯函数

**Files:** `src/inngest/events.ts`、`src/inngest/functions/aigc-illustrate.ts`(新)、`src/inngest/functions/index.ts`、`src/lib/channels/illustrate-intent.ts`(新)；Test: 对应 __tests__。

- [ ] **Step 1: event 类型**
  `src/inngest/events.ts` 加：
  ```ts
  "aigc/illustrate.requested": {
    data: { organizationId: string; articleId: string; userHint?: string;
      channelCtx: { organizationId: string; configId: string; platform: "dingtalk"|"wechat_work"; chatId: string; externalUserId: string } };
  };
  ```

- [ ] **Step 2: illustrate-intent 纯函数（TDD）**
  `src/lib/channels/illustrate-intent.ts`：`isIllustrateIntent(text): boolean`（命中"加配图/配图/配个图/加个图/来张图/配张图"，不命中写稿/发布/检索/取消）。+ 测试。

- [ ] **Step 3: aigcIllustrate Inngest 任务（TDD，mock 各步）**
  `src/inngest/functions/aigc-illustrate.ts`：`inngest.createFunction({id:"aigc-illustrate"}, {event:"aigc/illustrate.requested"}, async ({event}) => {...})`：
  1. 读 article（`db.query.articles.findFirst` by id+org）→ 无/跨 org → 回执"找不到稿件" return。
  2. image prompt：小 LLM 调用（`generateText` + `getLanguageModel({provider:"openai", model:getDefaultModel(), ...})`）把 title+summary(+userHint) 转成一句英文出图 prompt（失败兜底用 title）。
  3. `kieGenerateImage({prompt})` → urls[0]。
  4. `storeRemoteImageToTos(urls[0], {organizationId, articleId, title})` → {assetId, publicUrl}。
  5. `db.update(articles).set({coverImageUrl:publicUrl}).where(and(eq(id),eq(org)))`；`db.insert(articleAssets).values({articleId, assetId, usageType:"cover"})`。
  6. 回执：`const config = await getChannelConfig(channelCtx.configId); if(config) await sendChannelMessage({config, chatId:channelCtx.chatId, type:"markdown", title:"配图完成", content:`✅ 配图已加到《${title}》：${publicUrl}`})`。
  - try/catch 整体：KieConfigError→"配图功能未配置"；其它→"配图失败：<msg>，可重试"；都经 sendChannelMessage 回执。
  > 参考现有 `src/inngest/functions/*`（如 channel-link-ingest）的 createFunction 写法 + 错误回执范式。
  注册进 `src/inngest/functions/index.ts`。
  测试：mock `@/lib/aigc/kie-client`、`@/lib/aigc/store-image`、`@/db`、`@/lib/dal/channels`(getChannelConfig)、`@/lib/channels/outbound`(sendChannelMessage)、`ai`(generateText)、`@/lib/agent/model-router`。断言成功→写 coverImageUrl + 回执含 publicUrl；kie 失败→回执含"失败"。

- [ ] **Step 4: tsc + 测试**；**Step 5: commit** `feat(aigc): aigcIllustrate Inngest 任务（出图→转存→写回→回执）+ 加配图意图纯函数`

---

### Task 1dB-T3: gateway 加配图分支 + 验证 + 真测 + 合并

**Files:** `src/lib/channels/gateway.ts`、`.env.example`；Test: `gateway-clarify-loop.test.ts`。

- [ ] **Step 1: gateway（TDD）**
  - import `isIllustrateIntent`（./illustrate-intent）、`getArticleById`（已 import）、`inngest`（已 import）。
  - handleFreeFormMessage：发布意图分支**之后**、clarifyOrPlan 之前插：
    ```ts
    if (isIllustrateIntent(text)) {
      if (!session.lastArticleId) return { reply: "没有可配图的稿件，请先生成或发链接收稿。" };
      return handleIllustrateIntent(msg, session, text);
    }
    ```
  - `handleIllustrateIntent(msg, session, text)`：`getArticleById(session.lastArticleId)` + org 校验（≠org→回"没有可配图的稿件"）→ `inngest.send({name:"aigc/illustrate.requested", id:`illustrate:${session.lastArticleId}:${msg.externalMessageId}`, data:{organizationId:msg.organizationId, articleId:session.lastArticleId, userHint:text, channelCtx}})` → 回 `🎨 正在为《${article.title}》生成配图，稍后回结果。`
  - 测试：有 lastArticleId+加配图意图 → inngest.send 调 + 回"生成中"；无 lastArticleId → 回"没有可配图"，不 send。
  > 注意发布意图与加配图意图的先后：发布（含"发布/发到"）与配图（含"配图/加图"）关键词不重叠，顺序无所谓；放发布分支后即可。

- [ ] **Step 2: .env.example 预留**
  AI Services 段后加：
  ```
  # AIGC (kie.ai 聚合 API：文生图/视频/播客)
  # KIE_API_KEY=
  # KIE_BASE_URL=https://api.kie.ai
  # KIE_IMAGE_MODEL=nano-banana-pro   # 一张约 18 credits，偏贵；可换更便宜图模型
  ```

- [ ] **Step 3: 全量验证** `npx tsc --noEmit && npm run build && npx vitest run` 全过。

- [ ] **Step 4: 终审** code-reviewer 审全 diff，按 spec 核对：无 auth 直写 db、sendChannelMessage 取 config、resultJson 二次 parse、轮询超时、去重 id、org 校验、错误回执归类。修真实问题。

- [ ] **Step 5: 端到端真测（真 key，会消耗 ~18 credits）**
  写临时脚本或直接钉钉：起稿出 article → "给这篇加配图" → 收"生成中" → ~40s 后收图链；验 TOS 有对象、`articles.coverImageUrl` 已写、`media_assets`/`article_assets` 有行。（也可写 `scripts/_aigc-e2e.ts` 直接调 aigcIllustrate 的内部逻辑，跑完删。）

- [ ] **Step 6:** finishing-a-development-branch ff-merge → main。

---

## Remember
- 无 auth：Inngest 任务直接 db.insert(mediaAssets)/db.update(articles)/db.insert(articleAssets)，不用带 requireAuth 的 createAsset/updateArticle。
- resultJson 是 **JSON 字符串**，要 `JSON.parse` 再取 resultUrls。
- 图是临时链 → 必须 putObject 转存 TOS 再 getPublicUrl 写回。
- 回执用 getChannelConfig(configId) + sendChannelMessage({config,...})，不是裸 appKey。
- 异步任务，不是 mission——回执直接在任务末尾 sendChannelMessage（无 mission/reached-terminal）。
