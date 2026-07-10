# 新闻 URL 导入闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户在 cowork 对话粘贴一条新闻 URL，系统自动抓取→入库稿件库→AI 结构化分析→（视频稿）下载素材库→通义听悟分析，并把这三块能力抽象成对话里可随时复用的 agent tools。

**Architecture:** 实现放 `src/lib/articles/*` + `src/lib/tingwu/*` 的 **pure lib（单一真相源）**；两路消费——①场景自动化走**事件链式 Inngest**（cowork 短路派事件 → 4 个消费函数，入库后 AI 分析与视频下载并行，听悟在视频落库后触发）；②对话即时复用走 **agent tools**（tool-registry 注册 3 个工具）。进度用 append-only **里程碑卡片**回显。**DB 零迁移**（复用现成字段/jsonb；仅 2 处 TS 类型层小改）。

**Tech Stack:** Next.js 16 server actions、Drizzle ORM、Inngest（事件链 + step.sleep 轮询）、AI SDK v6（`generateObject`/`generateText`）、通义听悟 OpenAPI（`@alicloud/openapi-client` ROA 签名）、Vitest。

**Spec:** `docs/superpowers/specs/2026-06-26-news-url-import-pipeline-design.md`（决策 D1–D9 见 §3，能力抽象见 §16）

---

## 关键既有范式（实现时照抄，勿重造）

| 用途 | 模板文件 | 要点 |
|---|---|---|
| Inngest 函数 + 失败处理 | `src/inngest/functions/channel-link-ingest.ts` | 核心逻辑抽成可单测函数；`createFunction({id,retries},{event},handler)`；失败处理订阅 `inngest/function.failed` 认领 `function_id` |
| 异步轮询（听悟） | `src/inngest/functions/cms-status-poll.ts:20-112` | `POLL_DELAYS_MS` + `for(attempt){ step.sleep; step.run(poll) }`，terminal 提前 return |
| 远程媒体转存 + article_assets | `src/inngest/functions/aigc-video.ts:60-72` | `storeRemoteMediaToTos(url,{organizationId,articleId,title,mediaType})` → `{assetId,publicUrl}`；`db.insert(articleAssets).values({articleId,assetId,usageType:"video"})` |
| 入库去重 | `src/lib/channels/ingest-link-to-article.ts:30-66` | 按 `(organizationId, sourceUrl)` 查重；INSERT `articles`（`sourceType:"repost", status:"draft"`） |
| URL 提取 | `src/lib/channels/link-extract.ts` | `extractUrls(text): string[]` |
| 抓正文 | `src/lib/web-fetch.ts:32` | `fetchViaJinaReader(url): Promise<{title, content}>` |
| 结构化 LLM | （新建，AI SDK v6）| `generateObject({model, schema, prompt})`；`model` 来自 `getLanguageModel({provider,model,temperature,maxTokens})` + `getDefaultModel()` |
| cowork 落消息 | `src/lib/dal/cowork-conversations.ts:133` | `appendMessage(conversationId, {role, content, kind, meta})` → 返回 message（含 id） |

**枚举值（别写串，spec 评审踩过的坑）：**
- `articles.aiAnalysisStatus` / `transcodingStatus` → `articleProcessStatusEnum` = `processing|done|failed`
- `media_assets.understandingStatus` → `assetProcessingStatusEnum` = `queued|processing|completed|failed`（**非 done**）

**测试运行：** `npx vitest run path/to/file.test.ts`；门禁 `npx tsc --noEmit` + `npm run build`。提交禁 `--no-verify`（[[commit-requires-passing-tests]]）。

---

## File Structure（全场景一览）

```
新建：
  src/lib/articles/import.ts              fetchAndClassifyUrl() + ingestArticleFromUrl()（从 channels 迁移解耦）
  src/lib/articles/analyze.ts             analyzeArticleStructured()（generateObject 纯函数，只返回不写库）
  src/lib/articles/video-source.ts        detectVideoSource()（og:video + tikhub 平台解析）
  src/lib/articles/__tests__/*.test.ts
  src/lib/cowork/link-import-dispatch.ts  派事件 + 落乐观「正在导入」卡片
  src/lib/tingwu/config.ts                isTingwuEnabled() / requireTingwuConfig()
  src/lib/tingwu/client.ts                TingwuClient（ROA：createTask/getTaskInfo/fetchResultJson）
  src/lib/tingwu/analyze.ts               parseTranscription/parseSummarization/parseAutoChapters（纯函数）
  src/lib/tingwu/types.ts
  src/lib/tingwu/__tests__/*.test.ts
  src/inngest/functions/cowork-link-import.ts
  src/inngest/functions/article-ai-analyze.ts
  src/inngest/functions/article-video-ingest.ts
  src/inngest/functions/tingwu-analyze.ts
  src/components/cowork/import-card.tsx    里程碑卡片渲染
  skills/video_understanding/SKILL.md      复合能力文档（intent 可路由）

修改：
  src/app/actions/cowork-submit.ts         插 URL 短路（appendMessage 之后、recognizeIntent 之前）
  src/lib/channels/ingest-link-to-article.ts  改薄包装 re-export（IM 不破）
  src/lib/aigc/store-media.ts              storeRemoteMediaToTos 加 opts（source/keyPrefix/duration/thumbnail）
  src/inngest/events.ts                    +4 事件
  src/inngest/functions/index.ts           注册 +4 函数（及失败处理）
  src/lib/dal/cowork-conversations.ts      AppendMessageInput.kind +"import_card"
  src/db/schema/articles.ts                metadata 类型 +aiDigest?/importedFrom?/suggestedCategory?
  src/lib/agent/tool-registry.ts           createToolDefinitions() +3 工具
  src/lib/agent/tool-kinds.ts              READ +video_extract/analyze_article；WRITE +tingwu_analyze
  src/components/cowork/conversation-thread.tsx  渲染 kind==="import_card"
  .env.example                             tingwu keys
```

---

## Phase 0：脚手架（依赖 + 事件 + 类型层）

无行为变化，纯地基。完成后 `tsc` 绿。

### Task 0.1：安装通义听悟 SDK 依赖

**Files:** `package.json`

- [ ] **Step 1:** 安装

```bash
npm i @alicloud/openapi-client @alicloud/tea-util @alicloud/openapi-util
```

- [ ] **Step 2:** `npx tsc --noEmit` 确认无新增报错。

- [ ] **Step 3:** Commit `chore(deps): add aliyun openapi client for tongyi tingwu`

### Task 0.2：`.env.example` 增补

**Files:** `.env.example`

- [ ] **Step 1:** 在 AI/ASR 区块后追加（带中文注释，沿用既有风格）：

```bash
# 通义听悟（视频/音频 AI 分析；阿里云控制台建项目拿 AppKey，endpoint 锁 cn-beijing）
VIDEO_ANALYSIS_PROVIDER=aliyun_tingwu        # 留空/非此值则 isTingwuEnabled()=false，优雅跳过
ALIBABA_CLOUD_ACCESS_KEY_ID=
ALIBABA_CLOUD_ACCESS_KEY_SECRET=
TINGWU_APP_KEY=
```

- [ ] **Step 2:** Commit `chore(env): add tongyi tingwu env keys`

### Task 0.3：Inngest 事件定义（×4）

**Files:** `src/inngest/events.ts`（在 `InngestEvents` 类型末尾、`};` 前追加）

- [ ] **Step 1:** 追加 4 个事件：

```ts
  // ─── 新闻 URL 导入闭环 (2026-06-26) ───
  /** cowork 对话粘贴 URL → 抓取入库 articles → 派下游分析/视频。coworkLinkImport 消费 */
  "cowork/link-import.requested": {
    data: {
      organizationId: string;
      conversationId: string;
      userId: string;
      url: string;
      sourceName: string;
    };
  };
  /** 稿件入库后自动结构化分析（摘要/标签/分类/要点）。articleAiAnalyze 消费 */
  "article/ai-analysis.requested": {
    data: {
      organizationId: string;
      articleId: string;
      conversationId?: string;
    };
  };
  /** 视频稿 → 解析视频源 → 下载素材库。articleVideoIngest 消费 */
  "article/video-ingest.requested": {
    data: {
      organizationId: string;
      articleId: string;
      conversationId?: string;
      url: string;
      videoSourceHint?: string;
    };
  };
  /** 素材入库后 → 通义听悟转写/理解。tingwuAnalyze 消费 */
  "media/tingwu-analyze.requested": {
    data: {
      organizationId: string;
      assetId: string;
      articleId?: string;
      conversationId?: string;
      publicUrl: string;
    };
  };
```

- [ ] **Step 2:** `npx tsc --noEmit` 绿（事件被引用前不会报错）。
- [ ] **Step 3:** Commit `feat(inngest): define news-url-import pipeline events`

### Task 0.4：DAL 消息 kind 增 `import_card`

**Files:** `src/lib/dal/cowork-conversations.ts:25-30`

- [ ] **Step 1:** `AppendMessageInput.kind` 联合追加 `"import_card"`，并把行内注释里的 kind 清单补上「import_card(URL 导入里程碑)」。

```ts
  kind?:
    | "text"
    | "mission_card"
    | "plan_card"
    | "draft_result"
    | "multi_version_card"
    | "import_card";
```

- [ ] **Step 2:** `npx tsc --noEmit` 绿。
- [ ] **Step 3:** Commit `feat(cowork): allow import_card message kind`

### Task 0.5：articles.metadata 类型扩展

**Files:** `src/db/schema/articles.ts:114-129`

- [ ] **Step 1:** `metadata` 的 `$type<{...}>` 追加 3 个可选字段：

```ts
    aiDigest?: {
      summary: string;
      category: string;
      tags: string[];
      keyPoints: string[];
    };
    suggestedCategory?: string;
    importedFrom?: {
      channel: "cowork";
      conversationId: string;
      userId: string;
    };
```

- [ ] **Step 2:** `npx tsc --noEmit` 绿（jsonb，无 DB 迁移）。
- [ ] **Step 3:** Commit `feat(articles): extend metadata type for ai digest & import source`

---

## Phase 1：入库链（cowork 粘 URL → 抓取入库 → 收录卡）

**完成后可独立验证：** cowork 粘一条新闻 URL → 对话出现「⏳ 正在导入」→「✅ 已收录《标题》」卡片，`/articles` 里出现该稿（`sourceType=repost`）。

### Task 1.1：`ingestArticleFromUrl` —— 迁移解耦入库逻辑

**Files:**
- Create: `src/lib/articles/import.ts`
- Test: `src/lib/articles/__tests__/import.test.ts`
- Modify: `src/lib/channels/ingest-link-to-article.ts`（改薄包装）

- [ ] **Step 1（失败测试）：** 写 `import.test.ts`，mock `@/lib/web-fetch` 的 `fetchViaJinaReader` 返回 `{title:"测试标题", content:"正文..."}`，mock `@/db`，断言 `ingestArticleFromUrl` 用 `sourceType:"repost"`、`status:"draft"`、`metadata.importedFrom` 入库并返回 `{articleId, skipped:false}`；再测去重命中返回 `skipped:true`。

- [ ] **Step 2:** `npx vitest run src/lib/articles/__tests__/import.test.ts` → FAIL（模块不存在）。

- [ ] **Step 3（实现）：** 写 `src/lib/articles/import.ts`。把 `ingest-link-to-article.ts` 的去重+INSERT 逻辑迁来并泛化来源（支持 cowork importedFrom，保留 channelContext 兼容）：

```ts
import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { fetchViaJinaReader } from "@/lib/web-fetch";

export type ArticleMediaType = "article" | "video";

export interface ClassifiedContent {
  title: string;
  body: string;
  mediaType: ArticleMediaType;
  coverImageUrl?: string;
  videoSourceHint?: string;
}

export interface IngestArticleInput {
  organizationId: string;
  url: string;
  sourceName: string;
  classified?: ClassifiedContent;          // 已抓取则复用，避免二次抓
  importedFrom?: { channel: "cowork"; conversationId: string; userId: string };
  channelContext?: Record<string, unknown>; // IM 兼容
}

export interface IngestArticleResult { skipped: boolean; articleId?: string; title: string; mediaType: ArticleMediaType; }

/** 抓取 + 轻分类（P1 仅判定 article；视频检测 P3 接入 detectVideoSource）。 */
export async function fetchAndClassifyUrl(url: string): Promise<ClassifiedContent> {
  const { title, content } = await fetchViaJinaReader(url);
  const safeTitle = title?.trim() || new URL(url).hostname;
  // P1：先一律 article；P3 在此处接入 detectVideoSource 升级 mediaType/videoSourceHint/coverImageUrl
  return { title: safeTitle, body: content, mediaType: "article" };
}

/** 入库 articles（按 orgId+sourceUrl 去重）。无 requireAuth，供 Inngest 调用。 */
export async function ingestArticleFromUrl(input: IngestArticleInput): Promise<IngestArticleResult> {
  const existing = await db.query.articles.findFirst({
    where: and(eq(articles.organizationId, input.organizationId), eq(articles.sourceUrl, input.url)),
    columns: { id: true, title: true, mediaType: true },
  });
  if (existing) {
    return { skipped: true, articleId: existing.id, title: existing.title, mediaType: (existing.mediaType as ArticleMediaType) ?? "article" };
  }
  const c = input.classified ?? (await fetchAndClassifyUrl(input.url));
  const [row] = await db.insert(articles).values({
    organizationId: input.organizationId,
    title: c.title,
    body: c.body,
    content: { headline: c.title, body: c.body, imageNotes: [] },
    mediaType: c.mediaType,
    status: "draft",
    sourceType: "repost",
    sourceUrl: input.url,
    sourceName: input.sourceName,
    coverImageUrl: c.coverImageUrl,
    createdBy: null,
    wordCount: c.body.length,
    aiAnalysisStatus: "processing",          // 入库即标记待分析（P2 写回 done）
    metadata: {
      ...(input.importedFrom ? { importedFrom: input.importedFrom } : {}),
      ...(input.channelContext ? { ingestedFromChannel: input.channelContext as never } : {}),
    },
  }).returning({ id: articles.id });
  return { skipped: false, articleId: row.id, title: c.title, mediaType: c.mediaType };
}
```

- [ ] **Step 4:** `npx vitest run src/lib/articles/__tests__/import.test.ts` → PASS。

- [ ] **Step 5（薄包装）：** 把 `src/lib/channels/ingest-link-to-article.ts` 改为委托新函数（保留 `IngestLinkInput`/`IngestLinkResult` 签名，IM 调用方零改动）：

```ts
import "server-only";
import { ingestArticleFromUrl } from "@/lib/articles/import";
// ...保留 IngestLinkInput / IngestLinkResult 类型...
export async function ingestLinkToArticle(input: IngestLinkInput): Promise<IngestLinkResult> {
  const r = await ingestArticleFromUrl({
    organizationId: input.organizationId,
    url: input.url,
    sourceName: input.sourceName,
    channelContext: input.channelContext,
  });
  return { skipped: r.skipped, articleId: r.articleId, title: r.title };
}
```

- [ ] **Step 6:** 跑 IM 既有测试 `npx vitest run src/inngest/functions/__tests__/channel-link-ingest.test.ts` → 仍 PASS（兜底回归）。`npx tsc --noEmit` 绿。
- [ ] **Step 7:** Commit `refactor(articles): extract reusable url ingest into lib/articles/import`

### Task 1.2：cowork 派发器

**Files:**
- Create: `src/lib/cowork/link-import-dispatch.ts`

- [ ] **Step 1（实现）：** 派事件 + 落乐观卡片：

```ts
import "server-only";
import { inngest } from "@/inngest/client";
import { appendMessage } from "@/lib/dal/cowork-conversations";

export async function dispatchCoworkLinkImport(input: {
  organizationId: string; conversationId: string; userId: string; urls: string[]; userName?: string;
}): Promise<void> {
  await appendMessage(input.conversationId, {
    role: "assistant",
    kind: "import_card",
    content: input.urls.length > 1 ? `⏳ 正在抓取 ${input.urls.length} 条稿件…` : "⏳ 正在抓取稿件…",
    meta: { stage: "queued", urls: input.urls },
  });
  await Promise.all(input.urls.map((url, i) =>
    inngest.send({
      // 去重 id：同会话同 url 不重复跑
      id: `cowork-import:${input.conversationId}:${Buffer.from(url).toString("base64url").slice(0, 40)}:${i}`,
      name: "cowork/link-import.requested",
      data: {
        organizationId: input.organizationId,
        conversationId: input.conversationId,
        userId: input.userId,
        url,
        sourceName: `对话导入·${input.userName ?? "用户"}`,
      },
    }),
  ));
}
```

- [ ] **Step 2:** `npx tsc --noEmit` 绿。
- [ ] **Step 3:** Commit `feat(cowork): add link-import dispatcher`

### Task 1.3：cowork-submit 短路

**Files:** `src/app/actions/cowork-submit.ts`（第 57 行 `appendMessage(用户消息)` 之后、第 60 行 `recognizeIntentForOrg` 之前）

- [ ] **Step 1（实现）：** 插入 URL 检测短路：

```ts
  // 1.5 URL 导入意图短路（确定性最高，绕过 LLM 意图分类）
  const { extractUrls } = await import("@/lib/channels/link-extract");
  const urls = extractUrls(text);
  if (urls.length > 0) {
    const { dispatchCoworkLinkImport } = await import("@/lib/cowork/link-import-dispatch");
    await dispatchCoworkLinkImport({
      organizationId: orgId, conversationId, userId: user.id, urls,
      userName: user.displayName ?? undefined,
    });
    revalidatePath(`/cowork/${conversationId}`);
    return { ok: true, kind: "chat", reply: "已开始导入稿件" };
  }
```

> 注：`user` 字段名以 `requireAuth()` 实际返回为准（若无 `displayName` 用可得字段或省略）。

- [ ] **Step 2:** `npx tsc --noEmit` 绿。
- [ ] **Step 3:** Commit `feat(cowork): short-circuit pasted urls into article import`

### Task 1.4：`coworkLinkImport` Inngest 函数（fetch+ingest+收录卡）

**Files:**
- Create: `src/inngest/functions/cowork-link-import.ts`
- Modify: `src/inngest/functions/index.ts`

- [ ] **Step 1（实现）：** 仿 `channel-link-ingest.ts`。P1 只做 抓取+入库+收录卡；fan-out 留 P2/P3 增补：

```ts
import { inngest } from "@/inngest/client";
import type { InngestEvents } from "@/inngest/events";
import { fetchAndClassifyUrl, ingestArticleFromUrl } from "@/lib/articles/import";
import { appendMessage } from "@/lib/dal/cowork-conversations";

type Data = InngestEvents["cowork/link-import.requested"]["data"];

export async function runCoworkLinkImport(data: Data): Promise<void> {
  const classified = await fetchAndClassifyUrl(data.url);
  const r = await ingestArticleFromUrl({
    organizationId: data.organizationId,
    url: data.url,
    sourceName: data.sourceName,
    classified,
    importedFrom: { channel: "cowork", conversationId: data.conversationId, userId: data.userId },
  });
  await appendMessage(data.conversationId, {
    role: "assistant",
    kind: "import_card",
    content: r.skipped ? `该链接已收录过《${r.title}》` : `✅ 已收录《${r.title}》`,
    meta: { stage: "ingested", articleId: r.articleId, title: r.title, mediaType: r.mediaType, sourceUrl: data.url },
  });
  // P2 增补：inngest.send("article/ai-analysis.requested", ...)
  // P3 增补：if mediaType==="video" → inngest.send("article/video-ingest.requested", ...)
}

export const coworkLinkImport = inngest.createFunction(
  { id: "cowork-link-import", retries: 2 },
  { event: "cowork/link-import.requested" },
  async ({ event, step }) => { await step.run("import", () => runCoworkLinkImport(event.data)); return { ok: true }; },
);

export const coworkLinkImportFailureHandler = inngest.createFunction(
  { id: "cowork-link-import-failure-handler", retries: 1 },
  { event: "inngest/function.failed" },
  async ({ event, step }) => {
    const d = event.data as Record<string, unknown>;
    if (d?.function_id !== "cowork-link-import") return;
    const orig = (d?.event as { data?: Data })?.data;
    const msg = ((d?.error as { message?: string })?.message) ?? "未知错误";
    if (!orig) return;
    await step.run("notify", () => appendMessage(orig.conversationId, {
      role: "assistant", kind: "import_card",
      content: `❌ 导入失败：${msg}`, meta: { stage: "failed", sourceUrl: orig.url },
    }));
  },
);
```

- [ ] **Step 2:** `index.ts` import + 加入 `functions` 数组（`coworkLinkImport, coworkLinkImportFailureHandler`）。
- [ ] **Step 3:** `npx tsc --noEmit` 绿。
- [ ] **Step 4:** Commit `feat(inngest): cowork link import (fetch + ingest + card)`

### Task 1.5：`import_card` 渲染

**Files:**
- Create: `src/components/cowork/import-card.tsx`
- Modify: `src/components/cowork/conversation-thread.tsx`

- [ ] **Step 1（读现状）：** 读 `conversation-thread.tsx` 看 `kind` 分支怎么写（参照 `plan_card`/`mission_card`/`draft_result` 分支），照同款加 `import_card` 分支渲染 `<ImportCard meta={msg.meta} content={msg.content} />`。
- [ ] **Step 2（实现卡片）：** `import-card.tsx` 用 `<GlassCard>`，按 `meta.stage` 渲染一行状态（queued/ingested/analyzed/video_stored/understood/failed 各一个图标 + 文案），ingested 起带「查看稿件 → `/articles/{articleId}`」链接（用 `<Button variant="ghost">` 或 `next/link`，**按钮无边框**）。所有文案中文。遵守设计系统（不手搓样式）。
- [ ] **Step 3:** `npm run build` 绿。
- [ ] **Step 4:** **手动验证**：dev 起（node 22 / `INNGEST_DEV=1`，8288+3000 在，见 [[inngest-dev-mode-cloud-fallback]] [[nodejs-22-for-turbopack]]），cowork 粘一条新闻 URL → 收录卡出现 + `/articles` 有新稿。
- [ ] **Step 5:** Commit `feat(cowork): render import milestone card`

---

## Phase 2：AI 结构化分析（导入即出 摘要/标签/分类/要点）

**完成后可独立验证：** 粘 URL → 收录卡后再出「🧠 分析完成」卡片，稿件详情页 summary/tags/keywords/分类已填，`aiAnalysisStatus=done`。

### Task 2.1：`analyzeArticleStructured` 纯函数

**Files:**
- Create: `src/lib/articles/analyze.ts`
- Test: `src/lib/articles/__tests__/analyze.test.ts`

> **结构化输出用 `generateText({ output: Output.object({ schema }) })`**（项目既定范式，见 `src/lib/agent/skills/topic-classifier.ts:16,172-179`）。`z` 从 `"zod/v4"` 导入；模型配置走 `resolveModelConfig(["content_analysis"], {temperature,maxTokens})` + `getLanguageModel`。注：`ai@6.0.116` 其实仍导出 `generateObject`（所以校验 hook "已移除" 的措辞不准），但团队统一迁向 `Output.object`，照 topic-classifier 抄即可、不要用 generateObject。

- [ ] **Step 1（失败测试）：** 参照 `topic-classifier.ts` 的 `generateText + Output.object` 用法。mock `ai`（`generateText` 返回 `{output:{...}}`、`Output.object` 直通）+ mock `model-router`，断言 `analyzeArticleStructured({title,body,categories})` 返回 `{summary,category,tags,keyPoints}`。
- [ ] **Step 2:** vitest → FAIL。
- [ ] **Step 3（实现）：** 用 AI SDK v6 `generateObject` + zod（`z` 从 `zod`）。**只返回不写库**：

```ts
import "server-only";
import { z } from "zod";
import { generateObject } from "ai";
import { getLanguageModel, getDefaultModel } from "@/lib/agent/model-router";

export interface StructuredDigest { summary: string; category: string; tags: string[]; keyPoints: string[]; }

const DigestSchema = z.object({
  summary: z.string().describe("120–200 字中文摘要"),
  category: z.string().describe("从给定分类名中选一个最贴切的；都不贴切则填最接近的"),
  tags: z.array(z.string()).min(3).max(8),
  keyPoints: z.array(z.string()).min(3).max(6).describe("核心要点，每条一句话"),
});

export async function analyzeArticleStructured(input: {
  title: string; body: string; categories?: string[];
}): Promise<StructuredDigest> {
  const model = getLanguageModel({ provider: "openai", model: getDefaultModel(), temperature: 0.3, maxTokens: 1200 });
  const allowed = input.categories?.length ? `\n可选分类：${input.categories.join("、")}` : "";
  const { object } = await generateObject({
    model, schema: DigestSchema,
    prompt: `对下面这篇稿件做结构化分析，输出摘要、分类、标签、核心要点。${allowed}\n\n标题：${input.title}\n正文：\n${input.body.slice(0, 6000)}`,
  });
  return object;
}
```

> 若 `generateObject` 对 DeepSeek provider 不稳，回退方案：`generateText` + JSON 解析（参考 `src/lib/ai-report.ts`）。实现时先按 generateObject 跑，联调不通再回退并在测试固化。

- [ ] **Step 4:** vitest → PASS。`npx tsc --noEmit` 绿。
- [ ] **Step 5:** Commit `feat(articles): structured analysis via generateObject`

### Task 2.2：`articleAiAnalyze` Inngest 函数（分析 + 写回 + 状态机 + 卡片）

**Files:**
- Create: `src/inngest/functions/article-ai-analyze.ts`
- Modify: `src/inngest/functions/index.ts`、`src/inngest/functions/cowork-link-import.ts`（增补 fan-out）

- [ ] **Step 1（实现）：** load article → 取 org categories（`db.query.categories`，名字列表）→ `analyzeArticleStructured` → 写回 `articles`：`summary`、`tags`、`keywords=keyPoints`、`categoryId`（按 category 名匹配 org categories；无匹配则 `metadata.suggestedCategory`）、`metadata.aiDigest`、`aiAnalysisStatus:"done"`。失败 catch → `aiAnalysisStatus:"failed"` + 失败卡。成功 → 「🧠 分析完成」卡（`meta.stage="analyzed"`，附 summary 预览）。失败处理 handler 仿 1.4。
- [ ] **Step 2:** 在 `runCoworkLinkImport` 末尾增补：`await inngest.send({ name:"article/ai-analysis.requested", data:{ organizationId, articleId:r.articleId!, conversationId } })`（仅当 `r.articleId` 存在）。
- [ ] **Step 3:** `index.ts` 注册。`npx tsc --noEmit` + `npm run build` 绿。
- [ ] **Step 4:** **手动验证**：粘图文 URL → 收录卡 + 分析卡；详情页字段已填。
- [ ] **Step 5:** Commit `feat(inngest): auto structured analysis after import`

---

## Phase 3：视频下载素材库（视频稿 → 解析源 → 下载 TOS → article_assets）

**完成后可独立验证：** 粘一条含视频的新闻 URL → 视频检测命中 → 「🎬 视频已入素材库」卡，`media_assets` + `article_assets` 出现该视频。

### Task 3.1：`detectVideoSource` 纯函数

**Files:**
- Create: `src/lib/articles/video-source.ts`
- Test: `src/lib/articles/__tests__/video-source.test.ts`

- [ ] **Step 1（读现状）：** 读 `src/lib/collection/adapters/tikhub/platforms/{douyin,xiaohongshu,wechat-channels}.ts`，确认能否拿到 `attachments[].kind==="video"` 直链及其调用方式（可能要 tikhub key；拿不到则降级）。读 `web-fetch.ts` 看是否已有 cheerio 工具可复用抽 og 标签。
- [ ] **Step 2（失败测试）：** fixture：①含 `<meta property="og:video" content="https://x/y.mp4">` 的 HTML → `{videoUrl:"...mp4", kind:"direct"}`；②含 `.m3u8` → `{kind:"stream"}`；③无视频 → `{kind:"none"}`。
- [ ] **Step 3:** vitest → FAIL。
- [ ] **Step 4（实现）：** 返回 `{ videoUrl?, kind:"direct"|"platform"|"stream"|"none", durationMs?, thumbnailUrl? }`。通用：cheerio 抽 `og:video`/`og:video:url`/`twitter:player:stream`/`<video src>` + `og:image` 作 thumbnail；`.m3u8`/需登录 → `stream`；命中平台 host → 调 tikhub adapter 取直链（`platform`）；否则 `none`。
- [ ] **Step 5:** vitest → PASS。
- [ ] **Step 6:** Commit `feat(articles): detect downloadable video source from url`

### Task 3.2：升级 `fetchAndClassifyUrl` 接入视频检测

**Files:** `src/lib/articles/import.ts`、`src/lib/articles/__tests__/import.test.ts`

- [ ] **Step 1（测试）：** 加用例：当 `detectVideoSource` 返回 `direct` → `fetchAndClassifyUrl` 的 `mediaType==="video"` 且带 `videoSourceHint`。
- [ ] **Step 2（实现）：** `fetchAndClassifyUrl` 内调 `detectVideoSource(url)`；命中可下载视频 → `mediaType:"video"`、`videoSourceHint=videoUrl`、`coverImageUrl=thumbnailUrl`。
- [ ] **Step 3:** vitest → PASS。
- [ ] **Step 4:** Commit `feat(articles): classify video articles via video-source detection`

### Task 3.3：扩展 `storeRemoteMediaToTos`

**Files:** `src/lib/aigc/store-media.ts`

- [ ] **Step 1（实现）：** 加可选 `opts`，不破坏现有调用：`storeRemoteMediaToTos(url, { organizationId, articleId, title, mediaType }, opts?: { keyPrefix?: string; source?: string; durationSeconds?: number; thumbnailUrl?: string })`。objectKey 前缀用 `opts.keyPrefix ?? "aigc"`；INSERT 时补 `source/durationSeconds/thumbnailUrl`（有则填）。现有 aigc-video 调用不传 opts，行为不变。
- [ ] **Step 2:** `npx tsc --noEmit` 绿（现有调用方未变）。
- [ ] **Step 3:** Commit `feat(storage): parametrize storeRemoteMediaToTos (prefix/source/meta)`

### Task 3.4：`articleVideoIngest` Inngest 函数

**Files:**
- Create: `src/inngest/functions/article-video-ingest.ts`
- Modify: `src/inngest/functions/index.ts`、`cowork-link-import.ts`（增补 fan-out）

- [ ] **Step 1（实现）：** set `articles.transcodingStatus="processing"` → `detectVideoSource(url, hint)`：
  - `kind==="stream"|"none"`：失败/降级卡「未自动下载，已存源链接」+ `transcodingStatus="failed"`，**END**。
  - 否则：大小护栏（HEAD 探 content-length，>500MB 跳过下载，见 spec §14.4）→ `storeImportedVideoToTos`（`keyPrefix:"imported", source:"article_video", durationSeconds, thumbnailUrl`）→ `db.insert(articleAssets){articleId,assetId,usageType:"video"}` → `transcodingStatus="done"` → 「🎬 视频已入素材库」卡 → 派 `media/tingwu-analyze.requested`（仅 `isTingwuEnabled()`，P4 才有消费者）。
- [ ] **Step 2:** `runCoworkLinkImport` 增补：`if (classified.mediaType==="video" && r.articleId) inngest.send("article/video-ingest.requested",{...,url:data.url,videoSourceHint:classified.videoSourceHint})`。
- [ ] **Step 3:** `index.ts` 注册 + 失败处理。`npx tsc --noEmit` + `npm run build` 绿。
- [ ] **Step 4:** **手动验证**（含直链 mp4 的页面）：视频卡 + `media_assets`/`article_assets` 落库。注意存储桶可达（[[storage-provider-switch]]）。
- [ ] **Step 5:** Commit `feat(inngest): download video article into media library`

---

## Phase 4：通义听悟（视频 → 转写/摘要/章节 → 写回）

**完成后可独立验证：** 视频稿走完 → 「📝 听悟分析完成」卡；`asset_segments`（转写）、`asset_tags`（关键词）、`articles.transcript`/`chapters` 已填，`media_assets.understandingStatus="completed"`。

### Task 4.1：tingwu config + 类型

**Files:** `src/lib/tingwu/config.ts`、`src/lib/tingwu/types.ts`、`src/lib/tingwu/__tests__/config.test.ts`

- [ ] **Step 1（测试）：** env 缺任一 key 或 `VIDEO_ANALYSIS_PROVIDER!=="aliyun_tingwu"` → `isTingwuEnabled()===false`；齐全 → true。
- [ ] **Step 2:** vitest → FAIL。
- [ ] **Step 3（实现）：** `isTingwuEnabled()`（读 `VIDEO_ANALYSIS_PROVIDER` + 三 key）；`requireTingwuConfig()`（缺则 throw `TingwuConfigError`）。`types.ts` 定义 CreateTask/GetTaskInfo 请求响应 + 结果 JSON 形状（按 spec §8）。
- [ ] **Step 4:** vitest → PASS。
- [ ] **Step 5:** Commit `feat(tingwu): config + feature flag + types`

### Task 4.2：`TingwuClient`（ROA）

**Files:** `src/lib/tingwu/client.ts`

- [ ] **Step 1（实现）：** 用 `@alicloud/openapi-client`，`style:"ROA"`，endpoint `tingwu.cn-beijing.aliyuncs.com`，version `2023-09-30`（spec §8 骨架）：
  - `createTask({fileUrl, sourceLanguage="cn"}): Promise<{taskId:string}>` → `PUT /openapi/tingwu/v2/tasks?type=offline`，body `{AppKey, Input:{SourceLanguage, TaskKey, FileUrl}, Parameters:{Transcription:{DiarizationEnabled:true}, SummarizationEnabled:true, Summarization:{Types:["Paragraph"]}, AutoChaptersEnabled:true}}`。
  - `getTaskInfo(taskId): Promise<{status:"ONGOING"|"COMPLETED"|"FAILED"|"INVALID"; result?: Record<string,string>; errorMessage?:string}>` → `GET /openapi/tingwu/v2/tasks/{taskId}`。
  - `fetchResultJson(url): Promise<unknown>`（二次 GET 拉 30 天结果链）。
  - 错误：`TingwuApiError`。
- [ ] **Step 2:** `npx tsc --noEmit` 绿（client 难纯单测，留集成验证；可对 `fetchResultJson` 做 mock fetch 单测）。
- [ ] **Step 3:** Commit `feat(tingwu): ROA openapi client (createTask/getTaskInfo)`

### Task 4.3：结果解析纯函数

**Files:** `src/lib/tingwu/analyze.ts`、`src/lib/tingwu/__tests__/analyze.test.ts`

- [ ] **Step 1（读现状/固化 fixture）：** 联调首跑后把真实 Transcription/Summarization/AutoChapters JSON 存成 fixture（spec 不臆造字段）。先按 spec §8 已知结构（`Transcription.Paragraphs[].Words[]{Text,Start,End,SentenceId}`）写解析。
- [ ] **Step 2（失败测试）：** fixture → `parseTranscription` 产出 `asset_segments` 入库形状数组（`transcript`、`startTimeSeconds=Start/1000`、`endTimeSeconds=End/1000`、`segmentOrder`）；`parseKeywords` → `asset_tags`（`label`、`category:"topic"`（`assetTagCategoryEnum` 里 `topic` 最贴近关键词/主题词；实现前 grep `enums.ts` 确认 `topic` 在枚举内）、`source:"ai_auto"`、`confidence`）；`parseAutoChapters` → `articles.chapters` 形状。
- [ ] **Step 3:** vitest → FAIL → 实现 → PASS。
- [ ] **Step 4:** Commit `feat(tingwu): parse transcription/keywords/chapters`

### Task 4.4：`tingwuAnalyze` Inngest 函数（提交 + 轮询 + 写回）

**Files:** `src/inngest/functions/tingwu-analyze.ts`、`src/inngest/functions/index.ts`

- [ ] **Step 1（实现）：** 仿 `cms-status-poll.ts`：
  - guard `isTingwuEnabled()` 否则 `understandingStatus` 不动并 END。
  - set `media_assets.understandingStatus="processing"`。
  - `step.run("submit")`：`createTask(publicUrl)` → 存 `catalogData.tingwu={taskId,submittedAt}`。
  - 轮询 `POLL_DELAYS_MS=[30000,30000,60000,60000,120000,120000,300000,300000]`：`step.sleep` + `step.run("poll-N")` 调 `getTaskInfo`；`COMPLETED`→跳出；`FAILED|INVALID`→`understandingStatus="failed"` END；超次数→保持 processing + 「分析较慢，稍后自动完成」卡。
  - `step.run("writeback")`：`fetchResultJson` 三结果 → `parse*` → `db.insert(assetSegments)`、`db.insert(assetTags)`、update `media_assets`（`understandingStatus:"completed", understandingProgress:100, totalTags, processedAt:new Date()`，`catalogData` 用**读-改-写合并** `{...existing, tingwu:{...taskId, completedAt}}` 不覆盖其他字段）、update `articles`（`transcript`、`chapters`）→ 「📝 听悟分析完成」卡。
  - 失败处理 handler 仿 1.4。
- [ ] **Step 2:** `index.ts` 注册。`npx tsc --noEmit` + `npm run build` 绿。
- [ ] **Step 3:** **真实联调**（owner 凭证 + 公网可读直链，[[storage-provider-switch]]）：视频稿跑完，听悟卡 + 转写/章节写回。首跑固化结果 fixture 回填 4.3 测试。
- [ ] **Step 4:** Commit `feat(inngest): tongyi tingwu video analysis (submit/poll/writeback)`

---

## Phase 5：暴露为可复用 agent tools + SKILL.md（D8/D9）

**完成后可独立验证：** cowork 对话里直接说「分析这篇文章」「这个视频帮我转写理解」，LLM 自主调用对应工具。

### Task 5.1：注册 3 个 agent tools

**Files:** `src/lib/agent/tool-registry.ts`（`createToolDefinitions()` 的 return 对象内）

- [ ] **Step 1（读现状）：** 读 `createToolDefinitions()` 现有 tool（如 `kb_search`/`media_search`）的写法 + context 注入（`wrapToolExecuteWithContext` 提供 `organizationId`/`operatorId`）。
- [ ] **Step 2（实现）：** 加 3 个薄包装 tool（复用 lib，不重写逻辑）：
  - `video_extract`：`inputSchema {url}` → `detectVideoSource(url)` → 返回 `{success, ...source}`。
  - `analyze_article`：`inputSchema {title, body, categories?}` → `analyzeArticleStructured(...)` → 返回 digest（**只返回不写库**）。
  - `tingwu_analyze`：`inputSchema {assetId 或 publicUrl}` → 若给 publicUrl 直接 `inngest.send("media/tingwu-analyze.requested")`；**不阻塞**，返回 `{success, status:"submitted", assetId}`。
- [ ] **Step 3:** 若需要单测，mock lib/inngest 验证 execute 返回结构与错误分支。`npx tsc --noEmit` 绿。
- [ ] **Step 4:** Commit `feat(tools): video_extract / analyze_article / tingwu_analyze`

### Task 5.2：tool-kinds 分类

**Files:** `src/lib/agent/tool-kinds.ts`

- [ ] **Step 1（实现）：** `UNIVERSAL_READ_TOOL_SLUGS` 追加 `"video_extract","analyze_article"`；`UNIVERSAL_WRITE_TOOL_SLUGS` 追加 `"tingwu_analyze"`。**不进 `SKILL_OWNER`**（不绑工种）。
- [ ] **Step 2:** `npx tsc --noEmit` 绿。**手动验证**：cowork 对话「帮我分析这篇文章：<贴正文>」→ LLM 调 `analyze_article` 返回 digest。
- [ ] **Step 3:** Commit `feat(tools): register media tools as universal`

### Task 5.3：「视频理解」SKILL.md

**Files:** `skills/video_understanding/SKILL.md`

- [ ] **Step 1（读规范）：** 读任一现有 `skills/*/SKILL.md` + CLAUDE.md「Skill MD 标准」对齐 frontmatter（name/displayName/description/category/version/metadata）与 10–12 章 body。
- [ ] **Step 2（实现）：** 写 `video_understanding`：文档化「抽视频源→下载素材库→听悟转写/摘要/章节」复合能力。`metadata.implementation.scriptPath` 指向**真实存在的文件**（用 `src/inngest/functions/tingwu-analyze.ts`，**勿指向不存在的编排文件**，否则 `skill-consistency-check` 会报找不到文件）。让 intent-recognition 能路由「分析/理解这个视频」。
- [ ] **Step 3:** 若有 skill 一致性校验（`skill-consistency-check`）跑一遍。`npm run build` 绿。
- [ ] **Step 4:** Commit `docs(skill): add video_understanding capability`

---

## Phase 6：端到端真实联调 + 沉淀

### Task 6.1：双链路真实联调

- [ ] **Step 1:** 一条**纯图文新闻 URL**：收录卡 → 分析卡；详情页 summary/tags/keywords/分类正确。
- [ ] **Step 2:** 一条**视频新闻 URL**：收录 → 视频入素材库 → 听悟转写/章节写回；卡片时间线完整推进。
- [ ] **Step 3:** 对话里直接复用 `analyze_article` / `tingwu_analyze` 验证可复用。
- [ ] **Step 4:** 全量 `npx vitest run` 绿、`npx tsc --noEmit`、`npm run build` 绿。

### Task 6.2：沉淀

- [ ] **Step 1:** 写场景记忆 `scenario-news-url-import-learnings`（架构决策/踩坑/联调方法），更新 `MEMORY.md` 索引，关联 [[scenario-by-scenario-fix-method]]。
- [ ] **Step 2:** spec/plan 状态更新为"已实现"。
- [ ] **Step 3:** Commit `docs: scenario-1 news url import learnings`

---

## 跨阶段纪律

- 每个 commit 独立 `tsc --noEmit` + 相关 vitest 绿；阶段末 `npm run build`。
- DB 零迁移；若临时发现要加列，停下走 `db:generate`（本地 `db:push`，[[local-db-push-prod-migrate]]）并告知 owner。
- Inngest dev：node 22 + `INNGEST_DEV=1` + 8288/3000（[[inngest-dev-mode-cloud-fallback]] [[nodejs-22-for-turbopack]]）。
- 按钮无边框；UI 文案全中文；用共享 primitives（不手搓样式）。
- 长耗时（听悟）做 tool 时只触发不阻塞。
