# 场景一设计：新闻 URL 导入闭环（cowork 粘贴链接 → 全自动产出）

- **状态**：设计已与 owner 确认，待 spec 评审 + writing-plans
- **日期**：2026-06-26
- **范围**：单场景（scenario-by-scenario 修复的第一个）
- **关联**：`docs/adr/`（无冲突）；记忆 [[scenario-by-scenario-fix-method]]、[[cowork-transformation]]、[[im-output-unified-in-article-library]]、[[aigc-provider-kie-ai]]、[[storage-provider-switch]]

---

## 1. 背景与问题

用户在 **cowork 对话中心**粘贴一条新闻稿件 URL 后，期望系统全自动完成：①抓取正文 → ②入库稿件库（articles）→ ③AI 结构化分析提炼（摘要/标签/分类/要点）→ ④若是视频稿件，下载视频到素材库（media_assets）→ ⑤调用阿里云**通义听悟**对视频做 AI 分析（转写/摘要/章节）。

**现状缺口**（来自代码库扫描）：

- URL 导入只在钉钉/企微 IM 链路存在（`gateway → channel/link-ingest.requested → ingestLinkToArticle`），**cowork 对话里没有**。
- `ingestLinkToArticle` 仅"抓正文 + INSERT articles"，**无 AI 分析、无视频检测、无听悟**。
- AI 分析（`/api/ai/analysis`）是详情页**被动点触发 + 自由文本**，无"导入即自动结构化"链路；`articles.aiAnalysisStatus` 字段从未被写过。
- 视频下载只有 AIGC 生成路径（`storeRemoteMediaToTos`），**无从新闻页检测视频源 → 下载**。
- 通义听悟**零集成**。

底座基本齐备（articles/media_assets 表字段全、存储 provider 抽象完整、抓取 + 转存函数已有），缺的是把它们**串成一条 URL 进 → 自动产出的链**，以及通义听悟这块全新集成。

---

## 2. 目标与非目标

### 目标（本场景必须达成）
1. cowork 对话粘贴 URL → 自动识别为"导入稿件"意图（无需 LLM 分类、无需用户确认）。
2. 抓取正文并入库 articles（`sourceType=repost`、`status=draft`、去重）。
3. 入库后自动跑 AI 结构化分析，写回 `summary / tags / keywords / categoryId`，`aiAnalysisStatus` 走 `processing→done/failed` 状态机。
4. 识别视频稿件，**重点平台专用解析**拿视频直链 → 下载到 TOS → 落 media_assets + article_assets 关联。
5. 视频落库后调用**真实通义听悟**（CreateTask + 轮询 + 拉结果），写回转写/章节/关键词，`media_assets.understandingStatus` 走状态机。
6. 对话里以"里程碑卡片"时间线回显进度（收录 → 分析 → 视频 → 听悟）。

### 非目标（YAGNI，本轮明确不做）
- PC 端 `/articles` 的导入按钮、`/api/articles/fetch-from-url` 公开 API（入口只做 cowork）。
- 把能力暴露成 **MCP server**（对外接入层，错层；理由见 §16）。
- 实时勾选的"导入进度卡"（SSE/轮询）——v1 用 append-only 里程碑卡片。
- 把 IM 链路重构到新的共享核心（仅"可平滑迁移"，本轮不迁，IM 现状不动）。
- m3u8/HLS 流媒体下载、需登录态的视频、DRM 视频（标记 + 存源链接 + 提示，不强下）。
- 通义听悟的实时会议（`type=realtime`）、翻译、PPT 抽取等附加能力（只开转写 + 摘要 + 章节）。
- 视频缩略图/时长的 ffprobe 探测（有则用平台返回值，无则留空，下一轮）。

---

## 3. 锁定决策（owner 已确认）

| # | 决策 | 取值 |
|---|---|---|
| D1 | 入口 | **cowork 对话粘贴 URL 识别**（不做 PC/API） |
| D2 | 通义听悟 | **真实集成**（owner 有凭证，可端到端联调） |
| D3 | AI 分析产出 | **结构化**：摘要 + 标签 + 分类 + 要点，generateObject 写回 article 字段 |
| D4 | 视频范围 | **重点平台专用解析**（复用/扩展 tikhub 抖音/小红书 + og:video 通用 + 视频号/B站尽力） |
| D5 | 进度反馈 | v1 **append-only 里程碑卡片**（不做实时进度卡） |
| D6 | 听悟开关 | 包 `isTingwuEnabled()` feature flag，未配置则优雅跳过不报错 |
| D7 | schema 纪律 | 若需加列走 `npm run db:generate`（本地 `127.0.0.1:5433` 用 `db:push`），**不手写 SQL**。经核查本场景**无需任何迁移**（见 §7） |
| D8 | 能力抽象 | 三块能力（视频抽取/AI分析/听悟）做成**可复用 agent tools + 一份「视频理解」SKILL.md**，**不走 MCP**（MCP 是对外接入层，诉求是项目内部对话复用，错层）。实现放 pure lib 单一真相源，被"场景一流水线"和"对话工具"共享。详见 §16 |
| D9 | 工具归属 | 3 个工具全做**通用工具**（`kind:'tool'`，进 `UNIVERSAL_*_TOOL_SLUGS`，任何非 observer 员工对话里可调），**不绑工种**。`video_extract`/`analyze_article` 归 READ，`tingwu_analyze`（触发付费异步任务，有副作用）归 WRITE（受 authority 门控但仍通用） |

---

## 4. 端到端链路（事件链式 Inngest，按阶段 fan-out）

```
用户在 cowork 粘贴 URL
  └─ submitCoworkMessage(src/app/actions/cowork-submit.ts)
       appendMessage(用户消息) 之后、recognizeIntentForOrg() 之前：
       extractUrls(text) 命中 → 短路（不走 LLM 意图分类）
         ├─ appendMessage{kind:"import_card", meta:{stage:"queued", urls}}  「⏳ 正在导入…」
         └─ 每个 url: inngest.send "cowork/link-import.requested"
              {organizationId, conversationId, userId, url, messageId, sourceName}
         return {ok:true, kind:"chat"}   // 短路，不再识别其他意图

[Inngest] coworkLinkImport  ← cowork/link-import.requested   (retries:2)
  step "fetch-classify": fetchAndClassifyUrl(url)
       → {title, body, contentJson, mediaType:"article"|"video", coverImageUrl?, videoSourceHint?}
  step "ingest": ingestArticleFromUrl(...) → {articleId, skipped}
       (按 (orgId, sourceUrl) 去重；sourceType=repost, status=draft, sourceName, metadata.importedFrom)
  step "post-card": appendMessage{kind:"import_card", meta:{stage:"ingested", articleId, title}}  「✅ 已收录《标题》」
  step "fan-out":
       inngest.send "article/ai-analysis.requested" {articleId, organizationId, conversationId}   // 永远派
       if mediaType==="video":
         inngest.send "article/video-ingest.requested" {articleId, organizationId, conversationId, url, videoSourceHint}

[Inngest] articleAiAnalyze  ← article/ai-analysis.requested   (retries:2, concurrency:limit N)
  set articles.aiAnalysisStatus="processing"
  analyzeArticleStructured(articleId) → generateObject {summary, category, tags[], keyPoints[]}
  写回 articles: summary, tags, keywords(=keyPoints), categoryId(解析), metadata.aiDigest, aiAnalysisStatus="done"
  appendMessage{kind:"import_card", meta:{stage:"analyzed", articleId, summary}}  「🧠 分析完成」
  失败：aiAnalysisStatus="failed" + 卡片提示

[Inngest] articleVideoIngest  ← article/video-ingest.requested   (retries:2)
  set articles.transcodingStatus="processing"
  detectVideoSource(url, videoSourceHint) → {videoUrl, kind:"direct"|"platform"|"stream"|"none", durationMs?, thumbnailUrl?}
  if kind==="stream"|"none": 标记 + 卡片提示"未自动下载，已存源链接"；transcodingStatus="failed"/留存；END（不派听悟）
  else: storeImportedVideoToTos(videoUrl,...) → {assetId, publicUrl}
        insert article_assets {articleId, assetId, usageType:"video"}
        articles.transcodingStatus="done"
        appendMessage{kind:"import_card", meta:{stage:"video_stored", assetId}}  「🎬 视频已入素材库」
        if isTingwuEnabled():
          inngest.send "media/tingwu-analyze.requested" {assetId, articleId, organizationId, conversationId, publicUrl}

[Inngest] tingwuAnalyze  ← media/tingwu-analyze.requested   (retries:1, concurrency:limit small)
  set media_assets.understandingStatus="processing"
  step "submit": TingwuClient.createTask(publicUrl) → taskId
       存 media_assets.catalogData.tingwu = {taskId, submittedAt}
  step "poll"(循环，cms-status-poll 范式 30s→指数退避≤5min，≤10 次):
       getTaskInfo(taskId) → status
       COMPLETED → 跳出；FAILED/INVALID → understandingStatus="failed"，END；超次数 → 保持 processing + 卡片"分析较慢，稍后自动完成"
  step "writeback":
       拉 Result.{Transcription,Summarization,AutoChapters} 三个 URL 的 JSON
       insert assetSegments[]（转写分段，带时间戳/说话人）
       insert assetTags[]（关键词）
       update media_assets: understandingStatus="completed", understandingProgress=100, totalTags, processedAt, catalogData.tingwu.completedAt
       update articles: transcript=转写结构, chapters=章节
       appendMessage{kind:"import_card", meta:{stage:"understood", assetId}}  「📝 听悟分析完成」
```

**设计要点**：4 个事件消费函数，不堆一个巨函数；入库后 AI 分析与视频下载**并行**；听悟在视频落库拿到 `publicUrl` 后才触发（听悟需公网直链）。

---

## 5. 模块结构（新增 / 改动）

每个单元单一职责、可独立测试。

### 5.1 `src/lib/articles/`（稿件导入核心，从 channels 解耦）
- **`import.ts`**（新增）
  - `fetchAndClassifyUrl(url): Promise<ClassifiedContent>` — Jina Reader 抓正文（复用 `web-fetch.ts:fetchViaJinaReader`）+ 增强抽取 og:video/og:image/og:description（cheerio）+ 平台识别 → 判定 `mediaType`、`coverImageUrl`、`videoSourceHint`。
  - `ingestArticleFromUrl(input): Promise<{articleId, skipped}>` — **把 `src/lib/channels/ingest-link-to-article.ts` 的入库逻辑迁来**并泛化（去重、INSERT articles、`sourceType=repost`、`metadata.importedFrom`）。
  - 兼容：`src/lib/channels/ingest-link-to-article.ts` 改为薄包装 re-export，**IM 链路不破**。
- **`analyze.ts`**（新增）
  - `analyzeArticleStructured(articleId): Promise<StructuredDigest>` — 载 article 正文 → `generateObject`（zod schema）→ 返回 `{summary, category, tags, keyPoints}`；不负责写库（写库在 Inngest 函数里，便于测试）。
- **`video-source.ts`**（新增）
  - `detectVideoSource(url, hint?): Promise<VideoSource>` — og:video / `<video src>` / twitter:player 通用解析 + 复用 tikhub 抖音/小红书 adapter 拿 `attachments[].kind==="video"` 的直链；视频号/B站尽力；返回 `{videoUrl, kind, durationMs?, thumbnailUrl?}`。
- **`content-source.ts`**（已存在，未跟踪）：保持，导入来源派生沿用。

### 5.2 `src/lib/aigc/store-media.ts`（扩展，不破坏现有）
- 现有 `storeRemoteMediaToTos(url, {organizationId, articleId, title, mediaType})` objectKey 写死 `/aigc/` 前缀、不填 `source/duration/thumbnail`。
- 新增 `storeImportedVideoToTos(url, {organizationId, articleId, title, durationMs?, thumbnailUrl?, sourceUrl})`（或给原函数加 `opts.keyPrefix/source/extraFields`）：objectKey 用 `/imported/` 前缀，写 `source="article_video"`、`durationSeconds`、`thumbnailUrl`。**优先加 opts 参数复用原函数**，避免重复下载逻辑。

### 5.3 `src/lib/tingwu/`（通义听悟集成，全新）
- **`config.ts`** — 读 env，`isTingwuEnabled(): boolean`（`VIDEO_ANALYSIS_PROVIDER==="aliyun_tingwu"` 且三把 key 齐全）、`requireTingwuConfig()`。
- **`client.ts`** — `TingwuClient`：用 `@alicloud/openapi-client` 通用内核、`style:"ROA"`、endpoint `tingwu.cn-beijing.aliyuncs.com`、version `2023-09-30`。
  - `createTask({fileUrl, sourceLanguage="cn", features}): Promise<{taskId}>` — `PUT /openapi/tingwu/v2/tasks?type=offline`，body `{AppKey, Input:{SourceLanguage, TaskKey, FileUrl}, Parameters:{Transcription:{...}, SummarizationEnabled:true, Summarization:{Types:["Paragraph"]}, AutoChaptersEnabled:true}}`。
  - `getTaskInfo(taskId): Promise<{status:"ONGOING"|"COMPLETED"|"FAILED"|"INVALID", result?, errorMessage?}>` — `GET /openapi/tingwu/v2/tasks/{taskId}`。
  - `fetchResultJson(url): Promise<unknown>` — 二次 GET 拉 30 天有效结果链。
  - 错误类型：`TingwuConfigError` / `TingwuApiError`（仿 `KieError`/`CmsError`）。
- **`analyze.ts`** — `parseTranscription(json)` / `parseSummarization` / `parseAutoChapters` → 归一成 `assetSegments` / `assetTags` / `chapters` 入库形状。轮询逻辑放 Inngest 函数（用 `step.sleep`），client 只做单次请求。
- **`types.ts`** — 请求/响应/结果类型。

### 5.4 `src/inngest/`
- **`events.ts`** 新增 4 个事件：`cowork/link-import.requested`、`article/ai-analysis.requested`、`article/video-ingest.requested`、`media/tingwu-analyze.requested`（typed data）。
- **`functions/cowork-link-import.ts`**、**`article-ai-analyze.ts`**、**`article-video-ingest.ts`**、**`tingwu-analyze.ts`**（4 个新函数），并在 inngest serve 注册。

### 5.5 `src/app/actions/cowork-submit.ts`（改动）
- 在 `appendMessage(用户消息)` 之后、`recognizeIntentForOrg()` 之前，插 `extractUrls()` 短路 + dispatch（见 §4）。
- 新增 `src/lib/cowork/link-import-dispatch.ts` 封装"派事件 + 落乐观卡片"，保持 action 精简。

### 5.6 cowork 前端（改动）
- `import_card` kind 的渲染：在 cowork 消息渲染处（`conversation-thread.tsx` / 消息卡片组件）新增分支，按 `meta.stage` 渲染对应里程碑（queued/ingested/analyzed/video_stored/understood/failed），含"查看稿件 → `/articles/{articleId}`"、"查看素材"动作。

---

## 6. Inngest 事件与函数细节

| 事件 | data | 消费函数 | 关键行为 |
|---|---|---|---|
| `cowork/link-import.requested` | orgId, conversationId, userId, url, messageId, sourceName | `coworkLinkImport` | 抓取+分类+入库+派下游+卡片 |
| `article/ai-analysis.requested` | articleId, orgId, conversationId | `articleAiAnalyze` | 结构化分析写回 + 状态机 |
| `article/video-ingest.requested` | articleId, orgId, conversationId, url, videoSourceHint | `articleVideoIngest` | 解析视频源 + 下载 + 关联 + 派听悟 |
| `media/tingwu-analyze.requested` | assetId, articleId, orgId, conversationId, publicUrl | `tingwuAnalyze` | 提交 + 轮询 + 拉结果 + 写回 |

**幂等**：
- 入库去重：`(orgId, sourceUrl)` 已有则 `skipped=true` 复用 articleId（沿用现有逻辑）。
- 事件 id：用 `messageId#stage` 形式避免重复派发。
- 听悟：提交前查 `catalogData.tingwu.taskId`，已存在且 `understandingStatus="processing"` 则恢复轮询而非重提交。
- Inngest step memoization 天然保证函数重试不重复副作用。

**轮询退避（tingwuAnalyze）**：`POLL_DELAYS_MS = [30000, 30000, 60000, 60000, 120000, 120000, 300000, 300000, 300000, 300000]`（≤10 次，封顶 5min）。超次数不算失败，保持 `processing` + 提示，可由后续手动/定时重查（v1 不做定时重查）。

---

## 7. 数据模型与回写（经核查：无需任何迁移）

所有目标字段已存在，复用现成 jsonb 列承接结构化数据：

| 数据 | 落点 | 说明 |
|---|---|---|
| 摘要 | `articles.summary` (text) | AI 分析产出 |
| 标签 | `articles.tags` (jsonb string[]) | AI 分析产出 |
| 关键要点 | `articles.keywords` (jsonb string[]) | keyPoints 复用 keywords 列 |
| 完整结构化摘要 | `articles.metadata.aiDigest` | **扩 metadata TS 类型**加 `aiDigest?`（jsonb，免迁移） |
| 分类 | `articles.categoryId` (uuid→categories) | 按名解析 org 现有分类；无匹配则 `metadata.suggestedCategory` + categoryId 留空 |
| 媒体类型 | `articles.mediaType` (text) | `"article"` / `"video"` |
| AI 分析状态 | `articles.aiAnalysisStatus` (`articleProcessStatusEnum` = processing/done/failed) | 状态机首次启用；文章级 `done` 合法 |
| 转码/下载状态 | `articles.transcodingStatus` (enum) | 视频下载阶段状态 |
| 来源 | `articles.sourceType=repost` / `sourceName` / `sourceUrl` / `coverImageUrl` | 已有字段 |
| 导入溯源 | `articles.metadata.importedFrom = {channel:"cowork", conversationId, userId}` | **扩 metadata 类型**（免迁移） |
| 视频素材 | `media_assets`（fileUrl/tosObjectKey/tosBucket/type=video/durationSeconds/thumbnailUrl/source="article_video"） | 已有字段 |
| 稿件↔素材关联 | `article_assets {articleId, assetId, usageType:"video"}` | 已有表 |
| 听悟任务追踪 | `media_assets.catalogData.tingwu = {taskId, submittedAt, completedAt?, resultUrls?}` | **复用现成 catalogData jsonb，零迁移** |
| 听悟理解状态 | `media_assets.understandingStatus` (`assetProcessingStatusEnum` = queued/processing/**completed**/failed，**注意非 done**) + `understandingProgress` + `totalTags` + `processedAt` | 已有字段，首次启用；与文章级 `aiAnalysisStatus` 是两个不同枚举，别写串 |
| 转写分段 | `asset_segments`（transcript + 时间戳 + speaker） | `asset-intelligence.ts` 已有表；落库字段名实现时按 schema 对齐 |
| 关键词标签 | `asset_tags`（label/category/confidence/source="tingwu"） | 已有表 |
| 视频转写全文 | `articles.transcript` (jsonb) | 已有字段 |
| 视频章节 | `articles.chapters` (jsonb) | 已有字段（承接 AutoChapters） |
| 导入卡片 | `conversation_messages {kind:"import_card", meta:{stage,...}}` | DB 列 kind 是自由 text、meta 自由 jsonb，**DB 零迁移**；但 DAL 的 `AppendMessageInput.kind` 是受约束联合（`src/lib/dal/cowork-conversations.ts:25-30`，现为 `text\|mission_card\|plan_card\|draft_result\|multi_version_card`），**需在该联合 + 行内注释加 `import_card`**（一行类型改动，非迁移） |

> **本场景对 DB 结构零迁移**。需要的"schema 触碰"只有 TS 类型层：①扩 `articles.metadata` jsonb 类型加 `aiDigest?/importedFrom?/suggestedCategory?`；②`AppendMessageInput.kind` 联合加 `import_card`。两者都不改 DB、无 migration。若实现中发现 `asset_segments`/`asset_tags` 字段不够，再走 `db:generate` 标准流程并提前告知 owner。
>
> **枚举别写串**（评审抓到的真坑）：文章级 `articles.aiAnalysisStatus`/`transcodingStatus` 用 `articleProcessStatusEnum`（`processing/done/failed`，写 `done`）；素材级 `media_assets.understandingStatus` 用 `assetProcessingStatusEnum`（`queued/processing/completed/failed`，写 `completed` **不是 done**）。

---

## 8. 通义听悟集成规格（真实）

- **服务现役**，version `2023-09-30`，endpoint `tingwu.cn-beijing.aliyuncs.com`（仅 cn-beijing），**ROA 签名**（非 RPC V3）。
- **无官方 Node SDK** → 用 `@alicloud/openapi-client` + `@alicloud/tea-util` + `@alicloud/openapi-util`，`OpenApi.callApi(params{style:"ROA"}, request, runtime)`。
- **接入前提**：听悟控制台建"项目"拿 `AppKey`；AccessKey ID/Secret 与 AppKey 同账号。
- **输入**：`Input.FileUrl` 接受任意**公网可访问 http/https 直链**（域名形式，不能 IP/空格）→ **TOS/COS publicUrl 直接喂，无需中转 OSS**。落库后先校验 publicUrl 可达（HEAD）再提交，降低最高频失败点。
- **CreateTask**：`PUT /openapi/tingwu/v2/tasks?type=offline`，body `{AppKey, Input:{SourceLanguage:"cn", TaskKey, FileUrl}, Parameters:{Transcription:{DiarizationEnabled:true}, SummarizationEnabled:true, Summarization:{Types:["Paragraph"]}, AutoChaptersEnabled:true}}` → `Data.TaskId`。语言代码 **`cn` 不是 `zh`**。
- **GetTaskInfo**：`GET /openapi/tingwu/v2/tasks/{TaskId}` → `Data.TaskStatus ∈ {ONGOING, COMPLETED, FAILED, INVALID}`；完成后 `Data.Result.{Transcription, Summarization, AutoChapters}` 是**结果文件下载 URL（30 天有效）**，需二次 GET 拉 JSON。
- **转写结果结构**：`Transcription.Paragraphs[].Words[]{Text, Start, End(ms), SentenceId}`，句子按 `SentenceId` 聚合，段落 + `SpeakerId`。摘要/章节字段结构**联调时打印核实**（spec 不臆造字段名）。
- **格式/上限**：视频 mp4/mov/flv/mkv/webm/avi…；≤6GB、音频时长≤6h。
- **计费**：转写按时长 + 大模型能力各自计费；有 90 天试用。
- **未确认项（实现时核实，不臆造）**：听悟 npm 专用包（按"无"处理）、关键词独立开关字段名（随摘要/章节产出）、Summarization/AutoChapters 精确字段、PutAppInfo 是否前置必需（新链路文档未要求）。
- **官方文档**：CreateTask `https://help.aliyun.com/zh/tingwu/api-tingwu-2023-09-30-createtask`；OpenAPI 使用 `https://help.aliyun.com/zh/tingwu/tingwu-api`；离线转写教程 `https://help.aliyun.com/zh/tingwu/offline-transcribe-of-audio-and-video-files`；转写结果结构 `https://help.aliyun.com/zh/tingwu/voice-transcription`。

---

## 9. AI 结构化分析规格

- **调用**：`model-router.ts:getLanguageModel()` + AI SDK v6 `generateObject`（项目内首次用 generateObject，建立范式）。新增 skill category `article_analysis`（温度低、maxOutputTokens 适中）或复用 `deep_analysis` 配置。
- **zod schema**：
  ```ts
  z.object({
    summary: z.string().describe("120–200 字中文摘要"),
    category: z.string().describe("从给定分类名中选一个最贴切的"),
    tags: z.array(z.string()).min(3).max(8),
    keyPoints: z.array(z.string()).min(3).max(6).describe("核心要点，每条一句话"),
  })
  ```
- **分类解析**：载 org 现有 `categories`，把分类名作为允许值传给模型；返回值按名匹配 → `categoryId`；无匹配则 `categoryId=null` + `metadata.suggestedCategory`。
- **写回**：`summary→summary`、`tags→tags`、`keyPoints→keywords`、完整对象 `→metadata.aiDigest`、`aiAnalysisStatus` processing→done/failed。

---

## 10. 视频源检测与范围（D4）

- **通用**：cheerio 抽 `og:video`/`og:video:url`/`twitter:player:stream`/`<video src>`，直链 mp4 可下。
- **平台专用**：复用 `src/lib/collection/adapters/tikhub/platforms/` 已有 adapter——目录含 `douyin.ts / xiaohongshu.ts / weibo.ts / zhihu.ts / wechat-channels.ts`（**视频号 `wechat-channels.ts` 已在，对 D4"视频号尽力"是利好**）。取 `attachments[].kind==="video"` 直链。实现时先确认这些 adapter 是否真返回可下载视频直链（tikhub 端点未全实测，见 §14 风险 3 / [[collection-source-excel-import]]），拿不到则降级为"标记 + 源链接"。
- **流媒体/需登录**：`kind==="stream"` 或 `none` → 不强下，标记 + 存源链接 + 卡片提示，`transcodingStatus` 不置 done。
- **判定 mediaType=video**：检出可下载视频源即为视频稿件；否则 article。

---

## 11. 错误处理与可观测

- 每个 Inngest 函数：`try/catch` → 写对应状态字段 `failed` + 往对话追加失败卡片（中文、可操作），不静默吞错。
- 抓取失败（Jina 超时/正文空）：`coworkLinkImport` 直接回失败卡片，不入库空稿。
- 视频下载失败：`transcodingStatus=failed`，不派听悟。
- 听悟失败/超时：`understandingStatus=failed`/保持 processing，卡片区分"失败"与"较慢稍后完成"。
- 关键节点 `step.run` 包裹 + logger，便于审计。

---

## 12. 测试与验证

### 单元测试（Vitest）
- `fetchAndClassifyUrl`：mock web-fetch + cheerio，验证 og:video 检出、mediaType 判定。
- `detectVideoSource`：抖音/小红书 fixture → 直链；og:video 页 → direct；m3u8 页 → stream。
- `analyzeArticleStructured`：mock 模型，验证 schema 约束与分类解析。
- tingwu `parseTranscription/parseAutoChapters`：用真实结果 JSON fixture（联调首次抓取后固化），验证归一映射。
- `isTingwuEnabled`：env 缺失时 false（不报错跳过）。

### 端到端真实联调（owner 有凭证）
1. 一条**纯图文新闻 URL** → 验证 抓取→入库→结构化分析（summary/tags/categoryId/keyPoints 正确写回，详情页可见）。
2. 一条**视频新闻 URL** → 验证 视频下载到素材库（media_assets + article_assets）→ 通义听悟转写/摘要/章节写回（asset_segments/asset_tags/articles.transcript/chapters）。
3. cowork 对话里里程碑卡片时间线正确推进。

### 守门
- `npx tsc --noEmit` + `npm run build` 通过。
- 测试全绿（[[commit-requires-passing-tests]]，禁 `--no-verify`）。
- Inngest dev 注意 [[inngest-dev-mode-cloud-fallback]]（确认 8288+3000 在、`INNGEST_DEV=1`）。

---

## 13. 依赖

- **env（owner 提供，`.env.local`）**：`ALIBABA_CLOUD_ACCESS_KEY_ID`、`ALIBABA_CLOUD_ACCESS_KEY_SECRET`、`TINGWU_APP_KEY`、`VIDEO_ANALYSIS_PROVIDER=aliyun_tingwu`。同步进 `.env.example`。
- **npm**：`@alicloud/openapi-client`、`@alicloud/tea-util`、`@alicloud/openapi-util`（Node 22 无已知不兼容）。
- **存储**：TOS/COS publicUrl 需公网可读（[[storage-provider-switch]]：火山桶 vibetide 可能不存在，联调前确认桶或切 COS）。

---

## 14. 风险与开放问题

1. **TOS/COS 直链公网可达性**：听悟拉不到文件是最高频失败点；若默认桶非公读，需公读对象或带签名直链。联调前确认（依赖 [[storage-provider-switch]]）。
2. **听悟结果字段结构**：摘要/章节精确字段联调首跑时打印固化为 fixture，再写解析（spec 不臆造）。
3. **平台视频解析脆弱性**：tikhub 端点未全实测（[[collection-source-excel-import]]）；视频号/B站可能拿不到直链 → 降级为"标记 + 源链接"。
4. **大文件下载到 TOS**：新闻视频可能较大，`fetch→Buffer→putObject` 全量进内存；本轮限直链 mp4 且设大小上限（如 >500MB 跳过下载，仅提交听悟用源直链或标记）。
5. **听悟处理时长**：分钟级，里程碑卡片需表达"分析中"，避免用户以为卡住。

---

## 15. 实施阶段划分（交 writing-plans 细化）

- **P1 入库链**：cowork URL 短路 + dispatch + `lib/articles/import.ts`（迁移解耦）+ `coworkLinkImport` + import_card 渲染（收录卡）。可独立验证"粘 URL → 收录稿件"。
- **P2 AI 结构化分析**：`analyze.ts` + `articleAiAnalyze` + generateObject + 写回 + aiAnalysisStatus 状态机 + 分析卡。
- **P3 视频下载素材库**：`video-source.ts` + `store-media.ts` 扩展 + `articleVideoIngest` + article_assets + 视频卡。
- **P4 通义听悟**：`lib/tingwu/*` + `tingwuAnalyze`（提交+轮询+拉结果+写回）+ flag + 听悟卡。
- **P5 可复用能力暴露**（详见 §16）：注册 3 个 agent tools（`video_extract`/`analyze_article`/`tingwu_analyze`）+ tool-kinds 分类 + 「视频理解」SKILL.md。让对话里随时可复用。
- **P6 端到端真实联调 + 单测 + 文档/记忆沉淀**。

每个 commit 独立 `tsc`/`build` 绿；P1–P5 各自可单独验证一段链/能力。

> **依赖顺序**：P5 的工具是 P2/P3/P4 lib 函数的"薄暴露层"，必须在 lib 实现稳定后做（P2–P4 → P5）。但 lib 实现从 P1 起就按 pure-function 写（不绑 Inngest/对话上下文），P5 才能零改动复用。

---

## 16. 可复用能力抽象（D8/D9：agent tools + SKILL.md，不走 MCP）

### 16.1 为什么不是 MCP
MCP 是**对外接入层**（把能力暴露给 Claude Code / 其他进程 / 跨实例 client）。owner 的诉求是"**项目自己的 cowork 对话**下次还能复用"——同进程内能力复用。用 MCP 等于把同步函数调用改成跨进程 RPC，徒增 transport 选型/部署/序列化/容错成本。项目既有第三方能力（kie.ai / Jina / 博查 / 阿里云 ASR）**全是直接 lib 封装、零 MCP**，这是既定范式。MCP 仅在"需对外暴露给外部 client / 跨实例共享 / 独立扩缩容"时才考虑——非本诉求。

### 16.2 三层抽象（实现单一真相源 + 两个消费者）
```
实现层（pure lib，单一真相源，无 IO/上下文绑定）
  lib/articles/video-source.ts : detectVideoSource()
  lib/articles/analyze.ts      : analyzeArticleStructured()
  lib/tingwu/*                 : TingwuClient + parse*
        │
        ├── 消费者 A：场景一 Inngest 流水线（§4，URL 导入自动化）
        │     coworkLinkImport / articleAiAnalyze / articleVideoIngest / tingwuAnalyze
        │
        └── 消费者 B：cowork 对话 agent tools（按需复用，本节）
              tool-registry.ts 注册 3 个 tool() → LLM 在对话里自主调
```
**核心**：URL 导入只是这些能力的**第一个消费者**；同一份 lib 既被流水线用，也被对话工具用，**绝不复制实现**。

### 16.3 三个 agent tools（`src/lib/agent/tool-registry.ts` 的 `createToolDefinitions()`）

| tool | kind/归属 | 同步性 | execute 行为 |
|---|---|---|---|
| `video_extract` | `UNIVERSAL_READ_TOOL_SLUGS`（通用读） | 同步秒级 | 调 `detectVideoSource(url)` → 返回 `{videoUrl, kind, durationMs?, thumbnailUrl?}` |
| `analyze_article` | `UNIVERSAL_READ_TOOL_SLUGS`（通用读） | 同步秒级 | 调 `analyzeArticleStructured({title,body})` → 返回 `{summary,category,tags,keyPoints}`（**只返回不写库**，写库由调用方决定） |
| `tingwu_analyze` | `UNIVERSAL_WRITE_TOOL_SLUGS`（通用写，authority 门控） | **异步触发，不阻塞** | 校验/确保 publicUrl → `inngest.send("media/tingwu-analyze.requested")` → 立即返回 `{jobId/assetId, status:"submitted"}`；**复用 §4 同一个 `tingwuAnalyze` Inngest 函数**轮询回填，绝不在对话里同步等分钟级 |

实现要点：
- 三个 tool 的 `execute` 都是**薄包装**：解析参数 → 调 lib / 派事件 → 返回结构化结果（含 `success/error`）。`organizationId`/`operatorId` 由 `wrapToolExecuteWithContext()` 自动注入，不用 LLM 传。
- 在 `tool-kinds.ts` 的 `UNIVERSAL_READ_TOOL_SLUGS` 加 `video_extract`/`analyze_article`，`UNIVERSAL_WRITE_TOOL_SLUGS` 加 `tingwu_analyze`；**不进 `SKILL_OWNER`（不绑工种）**。
- **长耗时铁律**：`tingwu_analyze` 对话里只触发不等待（避免占满 SSE/LLM 上下文窗）；mission step 里若需阻塞拿结果可另设 `waitForResult` 走 mission 后台路径——但本场景对话侧一律 async。

### 16.4 「视频理解」SKILL.md（`skills/video_understanding/SKILL.md`）
- 文档化**复合能力**：抽视频源 → 下载素材库 → 通义听悟转写/摘要/章节。让 `intent-recognition` 能识别"帮我分析/理解这个视频"并路由，且可被 `workflow_template` step 以 `skillSlug` 引用。
- frontmatter：`name: video_understanding` / `displayName: 视频理解` / `category`（感知或分析）/ `kind`（按 catalog 规范）/ `metadata.implementation.scriptPath` 指向编排入口（即触发 `tingwu_analyze` 工具链 / `article/video-ingest.requested`）/ `testPath`。
- Body 按项目 Skill MD 标准（CLAUDE.md「Skill MD 标准」10–12 章）。具体 frontmatter 字段 + scriptPath 接线在 writing-plans 阶段定（skills↔tools↔workflow 接线较细）。
- 只写这一份 SKILL.md（`video_extract`/`analyze_article` 作为通用 tool 已被 LLM 直接可见，无须各自 SKILL.md）。

### 16.5 对 §5 模块结构的增量
- `src/lib/agent/tool-registry.ts`：`createToolDefinitions()` 加 3 个 `tool()`（薄包装）。
- `src/lib/agent/tool-kinds.ts`：`UNIVERSAL_READ_TOOL_SLUGS` +2、`UNIVERSAL_WRITE_TOOL_SLUGS` +1。
- `skills/video_understanding/SKILL.md`：新增（+ 可选 `metadata.implementation` 指向的编排 stub）。
- 单测：3 个 tool 的 execute（mock lib/事件），验证返回结构与错误分支。
