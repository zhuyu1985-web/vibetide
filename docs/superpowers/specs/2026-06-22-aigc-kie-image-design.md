# Phase 1d-B（core + 文生图）：kie.ai 配图 follow-up Design

## Summary

接入 [kie.ai](https://kie.ai) 聚合 API，给 VibeTide 第一个**真实文生图**能力，并落地 IM「给这篇加配图」follow-up：用户在 mission 出结果后回"加配图"→ 后台用 kie.ai 出图 → 转存火山 TOS → 写回 article 封面 → 群里回执图链。

本期是 1d-B 的 **core + 图**：搭好 kie.ai 客户端 + TOS 转存管线（视频/播客后续只换 model + 写回目标，[[aigc-provider-kie-ai]]）。

**已实测 kie.ai 契约（2026-06-22，真 key 跑通）：**
- 鉴权 `Authorization: Bearer ${KIE_API_KEY}`，base `https://api.kie.ai`
- `POST /api/v1/jobs/createTask` body `{model, input:{prompt, aspect_ratio?, ...}}` → `{code:200, data:{taskId, recordId}}`
- `GET /api/v1/jobs/recordInfo?taskId=` → `{code:200, data:{state, resultJson, failMsg, ...}}`；`state ∈ waiting|queuing|generating|success|fail`
- **`resultJson` 是 JSON 字符串**，parse 后 `{resultUrls:[url]}`；图是 `tempfile.aiquickdraw.com` **临时图床 → 必须转存 TOS**
- nano-banana-pro 一张 ~18 credits（偏贵；模型 env 可配）

## Scope

In scope（core + 文生图）：
- kie.ai 客户端（createTask + 轮询 + 错误归类）。
- 火山 TOS 服务端 `putObject` + 转存 helper（kie 临时 URL → TOS → media_assets + public URL）。
- Inngest 异步任务 `aigcIllustrate`：出图 → 转存 → 写回 `article.coverImageUrl` + media_assets → 频道回执。
- IM「加配图」意图分支（gateway，锚 lastArticleId）→ 派事件 → 即时回"生成中"。
- env 预留：`KIE_API_KEY` / `KIE_BASE_URL` / `KIE_IMAGE_MODEL`。

Out of scope（后续）：
- 文生视频 / 文生播客（reuse 客户端 + 转存，换 model + 写回；独立 spec）。
- 正文内嵌多图 / 配图风格选择 UI / kie webhook 回调（本期用轮询）。
- 前端 AIGC 面板实接（本期只做 IM + 服务端能力）。

## 数据流

```
用户「给这篇加配图」（session.lastArticleId 存在）
  → gateway isIllustrateIntent → handleIllustrateIntent
     ├─ 无 lastArticleId → "没有可配图的稿件，请先生成或发链接收稿"
     └─ getArticleById + org 校验 → inngest.send("aigc/illustrate.requested",
          {organizationId, articleId, channelCtx, userHint?}, id:`illustrate:${articleId}:${externalMessageId}`)
        → 即时回"🎨 正在为《标题》生成配图，稍后回结果。"

Inngest aigcIllustrate（异步）：
  1. 读 article（title/summary/body 摘要）→ 小 LLM 调用产英文 image prompt（含 userHint）
  2. kieGenerateImage(prompt) → createTask(KIE_IMAGE_MODEL) → 轮询 recordInfo → resultUrls[0]（临时图床 URL）
  3. fetch 临时 URL → buffer → putObject(火山TOS, key=`${orgId}/aigc/${articleId}/${uuid}.png`) → getPublicUrl
  4. createAsset(media_assets: tosObjectKey/fileUrl/type=image/...) → assetId
  5. 写回：db.update(articles).set({coverImageUrl: publicUrl})（无 auth，org 限定）；insert article_assets(articleId, assetId, usageType:"cover")
  6. 频道回执：sendChannelMessage(config.appKey, "✅ 配图已加到《标题》：<publicUrl>")
  失败任一步 → 频道回执"配图失败：<msg>，可重试"
```

> 异步 + 回执复用 Phase 0 模式；但这是**独立 Inngest 任务**（非 mission/task DAG）——配图不需要规划，单步出图。回执直接在任务末尾 sendChannelMessage（不经 mission/reached-terminal，因为没有 mission）。

## Components

新建：
- `src/lib/aigc/kie-client.ts`：
  - `kieCreateTask(model, input): Promise<string>`（taskId）
  - `kiePollTask(taskId, {timeoutMs=180000, intervalMs=5000}): Promise<string[]>`（resultUrls；fail/timeout 抛 `KieError`）
  - `kieGenerateImage({prompt, aspectRatio?}): Promise<string[]>`（用 `KIE_IMAGE_MODEL`）
  - `KieConfigError`（无 KIE_API_KEY）/ `KieError`（生成失败/超时）
- `src/lib/aigc/store-image.ts`：`storeRemoteImageToTos(url, {organizationId, articleId}): Promise<{assetId, publicUrl}>`（fetch → putObject → createAsset）
- `src/inngest/functions/aigc-illustrate.ts`：`aigcIllustrate`（订阅 `aigc/illustrate.requested`）
- `src/lib/channels/illustrate-intent.ts`：`isIllustrateIntent(text)`（配图/加图/配个图/来张图）纯函数

改动：
- `src/lib/volc-tos.ts`：加 `putObject(objectKey, body, contentType): Promise<void>`（TosClient.putObject 服务端上传）。
- `src/inngest/events.ts`：加 `aigc/illustrate.requested` 事件类型。
- `src/inngest/functions/index.ts`：注册 `aigcIllustrate`。
- `src/lib/channels/gateway.ts`：handleFreeFormMessage 加「加配图」意图分支（发布分支旁）+ `handleIllustrateIntent`。
- `.env.example`：预留 `KIE_API_KEY` / `KIE_BASE_URL`(默认 https://api.kie.ai) / `KIE_IMAGE_MODEL`(默认 nano-banana-pro)。

复用：`getArticleById`（org 校验）、`createAsset`（或直接 db.insert media_assets，无 auth）、`getPublicUrl`、`sendChannelMessage`、`getLanguageModel`/`getDefaultModel`（产 image prompt）。

## Error Handling

- 无 `KIE_API_KEY` → `KieConfigError` → 回执"配图功能未配置"。
- kie.ai 生成 fail/超时（180s）→ `KieError` → 回执"配图失败：<failMsg>，可重试"。
- lastArticleId 空 / article 跨 org → 不派事件，回"没有可配图的稿件"。
- 转存/写回 DB 失败 → 回执"配图失败，可重试"，不留半截（assetId 已建但没写回 article 可接受——asset 仍在库里）。
- Inngest event `id:illustrate:${articleId}:${externalMessageId}` 去重（钉钉重投）。
- 信用额度耗尽（kie 返回非 200 / 特定 failCode）→ 归类回执"配图额度不足"。

## Verification

- 单测 `isIllustrateIntent`（命中加配图类，不命中写稿/发布/检索）。
- 单测 `kie-client`（mock fetch）：createTask 解析 taskId；poll success 解析 resultJson→resultUrls；poll fail 抛 KieError；超时抛；无 key 抛 KieConfigError。
- 单测 `store-image`（mock fetch + putObject + createAsset）：流程 + 返回 publicUrl。
- 单测 `aigcIllustrate`（mock 各步）：成功→写回 coverImageUrl + 回执含 URL；失败→回执含"失败"。
- 单测 gateway：加配图意图 + lastArticleId → 派事件 + 回"生成中"，不派则回"没有可配图"。
- **端到端真测（有 key）**：钉钉起稿 → "加配图" → 收"生成中" → ~40s 后收图链；TOS 有对象、article.coverImageUrl 已写、media_assets 有行。
- `tsc --noEmit` + `build` + `npm test` 全过。

## Rollout

1. volc-tos `putObject` + kie-client + store-image（TDD，mock）。
2. event 类型 + aigcIllustrate Inngest 任务 + 注册。
3. gateway 加配图意图分支 + illustrate-intent 纯函数。
4. .env.example 预留（KIE_API_KEY 真值已在 .env.local，不入库）。
5. 全量验证 + 终审。
6. 端到端真测（真 key 出真图）。
7. 合并 main。

## Future

- 文生视频（KIE_VIDEO_MODEL，veo3 等）/ 文生播客（音频模型，需定多人对话 vs 单声 TTS）——reuse kie-client + store helper，换 model + 写回目标。
- kie webhook 回调替代轮询（省 Inngest step 时长）。
- 正文内嵌多图、配图风格/比例选择、复用 thumbnail_generate 的 aiPrompt 产更专业的出图 prompt。
- nano-banana-pro 偏贵 → 评估更便宜的默认图模型。
