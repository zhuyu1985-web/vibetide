# Phase 1d-CD：文生视频 + 多人对话播客 Design

## Summary

在 1d-B（kie.ai 文生图）的 core 上加两条 AIGC 媒体：**文生视频**（IM「给这篇配个视频」）+ **多人对话播客**（IM「给这篇做个播客」）。两者复用 kie-client（统一 jobs API，换 model 即可）+ TOS 转存 + Inngest 异步 + 回执 + lastArticleId 锚点；差异只在 model/input、生成时长、写回目标。

**已确认 kie.ai 契约（统一 /api/v1/jobs/createTask，复用现有 kie-client）：**
- 视频 `bytedance/seedance-2-fast`：input `{prompt, aspect_ratio, duration(4-15,默认5), resolution(720p), generate_audio}` → mp4。Veo3 是独立端点（不在统一 jobs），故默认 seedance，env 可换。生成要**几分钟**。
- 播客 `elevenlabs/text-to-dialogue-v3`：input `{dialogue:[{text, voice}], stability}` → mp3。多说话人对话（每轮 {text, voiceId}）。

## Scope

In scope：
- 泛化 store：`store-image.ts` → `storeRemoteMediaToTos(url, {organizationId, articleId, title, mediaType})`（image/video/audio：推断扩展名/content-type/media_assets type）。`storeRemoteImageToTos` 保留为薄 wrapper（aigcIllustrate 不动）。
- kie-client 加 `kieGenerateVideo` + `kieGenerateDialogue`（复用 createTask/poll；视频 poll 超时拉长）。
- 视频：Inngest `aigcVideo`（读 article → LLM 产视频 prompt → seedance → 转存 → media_assets(video)+article_assets → 回执）。
- 播客：Inngest `aigcPodcast`（读 article → LLM 产**双主持中文对话脚本** → 映射 2 个 env 音色 → text-to-dialogue-v3 → 转存 → media_assets(audio)+article_assets → 回执）。
- IM 意图：`配视频/做个视频` → aigcVideo；`配播客/做个播客/做成播客` → aigcPodcast。gateway 两个分支（锚 lastArticleId）。
- env 预留：KIE_VIDEO_MODEL / KIE_PODCAST_MODEL / KIE_PODCAST_VOICE_A / KIE_PODCAST_VOICE_B。

Out of scope：
- Veo3 专用端点（/api/v1/veo/，与统一 jobs 不同）——默认 seedance；要 Veo3 后续加专用 client。
- kie webhook 回调替代轮询（视频长轮询 MVP 先用 step 轮询）。
- 音色选择 UI / 多于 2 个主持 / 视频图生视频（first_frame）。

## 写回（视频/音频，区别于图）

视频/音频**不写 coverImageUrl**（article 无视频/音频专用字段）。写回 = `db.insert(mediaAssets){type:"video"|"audio", ...}` + `db.insert(articleAssets){articleId, assetId, usageType:"video"|"audio"}`。资产进库 + 关联到 article，回执给公开 URL。

## 数据流（两条同构）

```
用户「给这篇配视频 / 做个播客」（session.lastArticleId 存在）
  → gateway isVideoIntent / isPodcastIntent → 校验 lastArticleId + getArticleById(org) → 派事件
     aigc/video.requested / aigc/podcast.requested {organizationId, articleId, userHint?, channelCtx{...含 configId}}
     id:`video:${articleId}:${externalMessageId}` / `podcast:...`
  → 即时回"🎬 正在为《标题》生成视频…/🎙️ 正在生成播客…（要几分钟）"

Inngest aigcVideo（retries:0，回执包 try/catch）：
  读 article → LLM 产英文视频 prompt（from title+summary+userHint）
  → kieGenerateVideo({prompt, aspectRatio:"16:9"})（KIE_VIDEO_MODEL，poll 超时 ~8min，interval 15s）
  → storeRemoteMediaToTos(url, {mediaType:"video"}) → db.insert articleAssets(video) → 回执 mp4 URL

Inngest aigcPodcast（retries:0，回执包 try/catch）：
  读 article → LLM 产【双主持中文对话脚本】JSON [{speaker:"A"|"B", text}]（兜底失败→单段）
  → 映射 dialogue=[{text, voice: A→VOICE_A / B→VOICE_B}]
  → kieGenerateDialogue({dialogue, stability:0.5})（KIE_PODCAST_MODEL）
  → storeRemoteMediaToTos(url, {mediaType:"audio"}) → db.insert articleAssets(audio) → 回执 mp3 URL
```

## Components

新建：
- `src/lib/aigc/store-media.ts`：`storeRemoteMediaToTos(url, {organizationId, articleId, title, mediaType})`（mediaType→{ext, contentType, assetType}：image=png/image/png、video=mp4/video/mp4、audio=mp3/audio/mpeg）。`store-image.ts` 的 `storeRemoteImageToTos` 改为调它（薄 wrapper，aigcIllustrate 零改）。
- `src/inngest/functions/aigc-video.ts`：`aigcVideo` + 可测的 `runVideo(data)`。
- `src/inngest/functions/aigc-podcast.ts`：`aigcPodcast` + 可测的 `runPodcast(data)` + `buildDialogueScript(article, userHint)`（LLM 产脚本，可单测其 parse/兜底）。
- `src/lib/channels/aigc-intent.ts`：`isVideoIntent` / `isPodcastIntent`（纯函数；与 isIllustrateIntent 区分——配图≠配视频≠配播客）。

改动：
- `src/lib/aigc/kie-client.ts`：加 `kieGenerateVideo({prompt, aspectRatio?, duration?})`（model KIE_VIDEO_MODEL||"bytedance/seedance-2-fast"，poll {timeoutMs:480000, intervalMs:15000}）+ `kieGenerateDialogue({dialogue, stability?})`（model KIE_PODCAST_MODEL||"elevenlabs/text-to-dialogue-v3"）。
- `src/inngest/events.ts`：加 `aigc/video.requested` + `aigc/podcast.requested`（data 同 illustrate 形态）。
- `src/inngest/functions/index.ts`：注册 aigcVideo + aigcPodcast。
- `src/lib/channels/gateway.ts`：加配图分支旁加 视频/播客 两分支 + handleVideoIntent/handlePodcastIntent（仿 handleIllustrateIntent）。
- `.env.example`：补 KIE_VIDEO_MODEL / KIE_PODCAST_MODEL / KIE_PODCAST_VOICE_A / KIE_PODCAST_VOICE_B。

复用：kie-client createTask/poll、putObject、getChannelConfig+sendChannelMessage、getArticleById、getLanguageModel/getDefaultModel、media_assets/article_assets 直写（无 auth）。

## Error Handling

- 同 1d-B：无 KIE_API_KEY→KieConfigError 回"未配置"；kie fail/超时→KieError 回"失败可重试"；lastArticleId 空/跨 org→回"没有可配的稿件"；回执包 try/catch；retries:0（媒体贵+非幂等）。
- 视频超时：seedance-fast 通常 1-3min，poll 上限 8min；超 8min→KieError"生成超时"。
- 播客脚本：LLM 产脚本失败/JSON 不合法→兜底用 article.summary 单段（speaker A）合成，不崩。
- 意图区分：isIllustrateIntent/isVideoIntent/isPodcastIntent 关键词互斥（图/视频/播客），gateway 分支顺序判，先判更具体的（视频/播客）再图。

## Verification

- 单测 `aigc-intent`（图/视频/播客三类命中互斥 + 不命中写稿/发布）。
- 单测 kie-client 加的两函数（mock fetch；视频长超时传小参数真跑）。
- 单测 store-media（mediaType→ext/contentType/assetType 正确；mock putObject/db）。
- 单测 runVideo / runPodcast（mock kie/store/db/channel/LLM）：成功→media_assets+article_assets+回执含 URL；article 不存在/kie 失败→对应回执。播客额外测 buildDialogueScript 的 JSON parse + 兜底。
- 单测 gateway 视频/播客分支（有/无 lastArticleId）。
- `tsc` + `build` + 全量测试全过。
- 端到端真测（**需先建 TOS 桶 + 充足 credits**）：钉钉「配视频」「做个播客」→ 收"生成中" → 几分钟后收 mp4/mp3 链；media_assets/article_assets 有行。

## Rollout

1. store-media 泛化 + kie-client 两函数（TDD）。
2. aigc-intent 纯函数 + events 两类型。
3. aigcVideo + aigcPodcast Inngest 任务（+ buildDialogueScript）+ 注册（TDD）。
4. gateway 两分支 + .env.example。
5. 全量验证 + 终审。
6. 端到端真测（待 TOS 桶 + credits）。
7. 合并 main。

## ⚠️ 共享前提（与 1d-B 同）
- **TOS 桶 `vibetide` 必须存在 + public-read**——否则任何 AIGC 媒体转存都失败（1d-B 已卡在此）。
- **kie credits**：视频/播客比图贵，余额（~44）可能不够测视频，需充值。

## Future
- Veo3 专用端点；kie webhook 回调；音色/主持数可配 UI；图生视频（首帧）；视频/音频也能在前端 AIGC 面板触发。
