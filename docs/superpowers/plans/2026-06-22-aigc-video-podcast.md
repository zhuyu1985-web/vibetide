# Phase 1d-CD：文生视频 + 多人播客 实现计划

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development。Steps 用 `- [ ]`。

**Goal:** IM「配视频/做个播客」→ kie.ai 出片/出音 → 火山 TOS → media_assets+article_assets → 回执。复用 1d-B core。

**Spec:** `docs/superpowers/specs/2026-06-22-aigc-video-podcast-design.md`

**分支：** `claude/aigc-video-podcast`（off main）。

**kie 契约（统一 jobs，复用 kie-client）：** 视频 `bytedance/seedance-2-fast` input `{prompt, aspect_ratio, duration, resolution, generate_audio}`→mp4；播客 `elevenlabs/text-to-dialogue-v3` input `{dialogue:[{text,voice}], stability}`→mp3。

**纪律：** 无 auth 直写 db；retries:0 + 回执包 try/catch（媒体贵+非幂等）；mediaAssetTypeEnum 确有 video/audio；articleAssets.usageType 自由文本。

---

### Task 1dCD-T1: store 泛化 + kie 视频/对话方法 + 意图纯函数

**Files:** `src/lib/aigc/store-media.ts`(新)、`src/lib/aigc/store-image.ts`(改薄 wrapper)、`src/lib/aigc/kie-client.ts`、`src/lib/channels/aigc-intent.ts`(新)；Test: 对应 __tests__。

- [ ] **Step 1: store-media 泛化（TDD）**
  新建 `src/lib/aigc/store-media.ts`：`storeRemoteMediaToTos(url, {organizationId, articleId, title, mediaType}): Promise<{assetId, publicUrl}>`。`mediaType: "image"|"video"|"audio"` → 映射 `{ext, contentType, assetType}`：image=`png`/`image/png`/`image`、video=`mp4`/`video/mp4`/`video`、audio=`mp3`/`audio/mpeg`/`audio`。流程同现 store-image：fetch→Buffer→putObject(`${org}/aigc/${articleId}/${uuid}.${ext}`, buf, contentType)→getPublicUrl→`db.insert(mediaAssets).values({organizationId, tosObjectKey, tosBucket:defaultBucket, fileUrl, type:assetType, title:`${title} ${mediaLabel}`, mimeType:contentType})`（**加 mimeType 字段**，与图资产一致）→ {assetId, publicUrl}。mediaLabel：image=配图/video=配视频/audio=播客。
  把 `store-image.ts` 的 `storeRemoteImageToTos` 改成调 `storeRemoteMediaToTos(url, {...args, mediaType:"image"})`（薄 wrapper，**aigcIllustrate 零改，其测试仍过**）。
  测试 store-media：三种 mediaType → ext/contentType/assetType 正确（mock putObject/getPublicUrl/db）。

- [ ] **Step 2: kie-client 加视频/对话（TDD，mock fetch）**
  `src/lib/aigc/kie-client.ts` 加：
  ```ts
  export async function kieGenerateVideo(args: { prompt: string; aspectRatio?: string; duration?: number }): Promise<string[]> {
    const model = process.env.KIE_VIDEO_MODEL || "bytedance/seedance-2-fast";
    const taskId = await kieCreateTask(model, { prompt: args.prompt, aspect_ratio: args.aspectRatio ?? "16:9", duration: args.duration ?? 5, resolution: "720p" });
    return kiePollTask(taskId, { timeoutMs: 480_000, intervalMs: 15_000 }); // 视频 ~几分钟
  }
  export async function kieGenerateDialogue(args: { dialogue: { text: string; voice: string }[]; stability?: number }): Promise<string[]> {
    const model = process.env.KIE_PODCAST_MODEL || "elevenlabs/text-to-dialogue-v3";
    const taskId = await kieCreateTask(model, { dialogue: args.dialogue, stability: args.stability ?? 0.5 });
    return kiePollTask(taskId, { timeoutMs: 300_000, intervalMs: 10_000 });
  }
  ```
  测试：mock fetch；video/dialogue 各 createTask+poll 成功路径（超时传小参数真跑一条）。

- [ ] **Step 3: aigc-intent 纯函数（TDD）**
  `src/lib/channels/aigc-intent.ts`：`isVideoIntent(text)`（配视频/做个视频/做条视频/生成视频）、`isPodcastIntent(text)`（配播客/做个播客/做成播客/生成播客）。互斥、不命中写稿/发布/配图。测试三类（视频/播客/都不命中）。

- [ ] **Step 4: tsc + 测试 + 全量**；**Step 5: commit** `feat(aigc): store-media 泛化 + kie 视频/对话方法 + 视频/播客意图纯函数`

---

### Task 1dCD-T2: aigcVideo Inngest 任务

**Files:** `src/inngest/events.ts`、`src/inngest/functions/aigc-video.ts`(新)、`src/inngest/functions/index.ts`；Test: `__tests__/aigc-video.test.ts`。

- [ ] **Step 1:** events.ts 加 `aigc/video.requested`（data 同 illustrate：{organizationId, articleId, userHint?, channelCtx{...含 configId}}）。
- [ ] **Step 2: aigcVideo + runVideo（TDD，仿 aigc-illustrate.ts）**
  `runVideo(data)`：读 article（db.query by id+org，无→回执 return）→ LLM 产英文视频 prompt（from title+summary+userHint，失败兜底 title）→ `kieGenerateVideo({prompt})` → `storeRemoteMediaToTos(url, {organizationId, articleId, title, mediaType:"video"})` → `db.insert(articleAssets){articleId, assetId, usageType:"video"}` → 回执`✅ 视频已生成：${publicUrl}`。retries:0 + reply 包 try/catch + KieConfigError/其它错误归类回执（全仿 runIllustrate）。
  `createFunction({id:"aigc-video", retries:0}, {event:"aigc/video.requested"}, ...)`，**加注释**：`// 视频 poll ~8min，需部署环境函数超时 ≥8min（Docker standalone 无上限；Vercel 需配 maxDuration:800）`。
  注册进 index.ts。
  测试仿 aigc-illustrate.test：成功→articleAssets(video)+回执含 URL；article 不存在→回执；kie 失败→回执"失败"。
- [ ] **Step 3:** tsc + 测试 + 全量；**Step 4: commit** `feat(aigc): aigcVideo Inngest 任务（seedance 文生视频→转存→关联→回执）`

---

### Task 1dCD-T3: aigcPodcast Inngest 任务（多人对话）

**Files:** `src/inngest/events.ts`、`src/inngest/functions/aigc-podcast.ts`(新)、`src/inngest/functions/index.ts`；Test: `__tests__/aigc-podcast.test.ts`。

- [ ] **Step 1:** events.ts 加 `aigc/podcast.requested`（data 同上）。
- [ ] **Step 2: buildDialogueScript + runPodcast（TDD）**
  `src/inngest/functions/aigc-podcast.ts`：
  - `export async function buildDialogueScript(article, userHint?): Promise<{ speaker: "A"|"B"; text: string }[]>`：LLM（generateText）把文章改写成**两位主持人 A/B 的中文播客对话**，要求只输出 JSON 数组 `[{"speaker":"A"|"B","text":"..."}]`（自然口语、有来有回、6-12 轮）。解析：strip ```fence + JSON.parse；解析失败/空 → 兜底 `[{speaker:"A", text: article.summary ?? article.title}]`。
  - `runPodcast(data)`：读 article → `buildDialogueScript` → 映射 `dialogue = script.map(s => ({ text: s.text, voice: s.speaker === "A" ? (process.env.KIE_PODCAST_VOICE_A || "EkK5I93UQWFDigLMpZcX") : (process.env.KIE_PODCAST_VOICE_B || "Z3R5wn05IrDiVCyEkUrK") }))` → `kieGenerateDialogue({dialogue})` → `storeRemoteMediaToTos(url,{mediaType:"audio"})` → `db.insert(articleAssets){usageType:"audio"}` → 回执`🎙️ 播客已生成：${publicUrl}`。retries:0 + reply try/catch + 错误归类（仿 runIllustrate）。
  注册 index.ts。
  测试：`buildDialogueScript` JSON parse + 兜底（mock generateText 返回合法 JSON / 乱码）；`runPodcast` 成功→articleAssets(audio)+回执；kie 失败→回执。
- [ ] **Step 3:** tsc + 测试 + 全量；**Step 4: commit** `feat(aigc): aigcPodcast Inngest 任务（LLM 双主持脚本→elevenlabs 对话合成→转存→回执）`

---

### Task 1dCD-T4: gateway 视频/播客分支 + 验证 + 终审 + 合并

**Files:** `src/lib/channels/gateway.ts`、`.env.example`；Test: `gateway-clarify-loop.test.ts`。

- [ ] **Step 1: gateway（TDD）**
  import `isVideoIntent`/`isPodcastIntent`（"./aigc-intent"）。handleFreeFormMessage 分支顺序：发布 → **视频 → 播客** → 配图 → clarifyOrPlan（更具体的先判，防御）：
  ```ts
  if (isVideoIntent(text)) { if (!session.lastArticleId) return {reply:"没有可配视频的稿件，请先生成或发链接收稿。"}; return handleAigcIntent(msg, session, text, "aigc/video.requested", "🎬 正在为《%s》生成视频，要几分钟，稍后回结果。"); }
  if (isPodcastIntent(text)) { if (!session.lastArticleId) return {reply:"没有可做播客的稿件，请先生成或发链接收稿。"}; return handleAigcIntent(msg, session, text, "aigc/podcast.requested", "🎙️ 正在为《%s》生成播客，要几分钟，稍后回结果。"); }
  ```
  抽一个通用 `handleAigcIntent(msg, session, text, eventName, replyTpl)`（getArticleById+org 校验 → inngest.send({name:eventName, id:`${eventName.split("/")[1].split(".")[0]}:${lastArticleId}:${externalMessageId}`, data:{organizationId, articleId, userHint:text, channelCtx}}) → 回 replyTpl 填标题）。**也可让现有 handleIllustrateIntent 复用它**（DRY，可选）。
  测试：视频意图+lastArticleId→派 aigc/video.requested+回"视频"；播客意图→派 aigc/podcast.requested+回"播客"；无 lastArticleId→回提示不派。
- [ ] **Step 2: .env.example** 补：
  ```
  # KIE_VIDEO_MODEL=bytedance/seedance-2-fast
  # KIE_PODCAST_MODEL=elevenlabs/text-to-dialogue-v3
  # KIE_PODCAST_VOICE_A=EkK5I93UQWFDigLMpZcX   # ElevenLabs 音色（主持A）
  # KIE_PODCAST_VOICE_B=Z3R5wn05IrDiVCyEkUrK   # ElevenLabs 音色（主持B）
  ```
- [ ] **Step 3: 全量验证** tsc + build + vitest 全过。
- [ ] **Step 4: 终审** code-reviewer 审全 diff（store 泛化不破 illustrate、kie 两方法、两 Inngest 任务无 auth 直写+retries:0、buildDialogueScript 兜底、gateway 三意图分支顺序）。修真实问题。
- [ ] **Step 5: 端到端真测**（待 TOS 桶 + credits；本期可只跑单测，真测留给用户）。
- [ ] **Step 6:** finishing-a-development-branch ff-merge → main。

---

## Remember
- store-media 泛化后 aigcIllustrate 必须零改、其测试仍过（薄 wrapper）。
- 无 auth：runVideo/runPodcast 直写 db.insert(mediaAssets/articleAssets)。
- retries:0 + 回执 try/catch（媒体贵+非幂等）。
- 视频/播客不写 coverImageUrl，只 media_assets+article_assets 关联。
- gateway 分支：视频/播客先于配图判（关键词虽不重叠，防御）。
- 真测需先建 TOS 桶 vibetide + public-read + 充 kie credits。
