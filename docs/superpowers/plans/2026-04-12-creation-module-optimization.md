# 创作模块优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize the Inspiration Pool and Benchmarking modules with 15 feature points covering page polish, user-input inspiration, SSE refresh progress, topic comparison with AI summaries, and missed topic detection with multi-source clues.

**Architecture:** Phase 1 handles schema migration and shared infrastructure (SSE helpers, AI report generation). Phase 2 implements Inspiration Pool improvements (independent UI module). Phase 3 builds out Benchmarking enhancements (topic comparison + missed topic detection). Each phase produces working, testable software.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle ORM (PostgreSQL/Supabase), AI SDK v6 (DeepSeek), Tavily search, SSE via ReadableStream.

**Spec:** `docs/superpowers/specs/2026-04-12-creation-module-optimization-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/app/api/inspiration/crawl/route.ts` | SSE endpoint: per-platform crawl progress |
| `src/app/api/inspiration/organize/route.ts` | SSE endpoint: AI inspiration organization |
| `src/app/api/benchmarking/report/route.ts` | SSE endpoint: AI topic report generation |
| `src/app/api/benchmarking/interpret/route.ts` | POST endpoint: AI content interpretation |
| `src/app/(dashboard)/benchmarking/topic-report-panel.tsx` | AI structured summary panel (4-section) |
| `src/app/(dashboard)/benchmarking/missed-topic-detail.tsx` | Missed topic detail panel with actions |
| `src/app/(dashboard)/benchmarking/article-compare-view.tsx` | Side-by-side our article vs competitor |
| `src/lib/ai-report.ts` | Shared AI report generation logic (Tavily + LLM summary) |
| `src/app/api/benchmarking/search-articles/route.ts` | GET endpoint: article search for missed topic linking |

### Modified Files

| File | Changes |
|------|---------|
| `src/db/schema/enums.ts` | Add `missedTopicSourceTypeEnum` |
| `src/db/schema/benchmarking.ts` | Add fields to `missedTopics`, `platformContent`, `benchmarkAnalyses` |
| `src/db/schema/articles.ts` | Add `publishChannels`, `spreadData` fields |
| `src/lib/types.ts` | Update `MissedTopic`, `PlatformContentUI`, `BenchmarkTopic` types; add `BenchmarkArticleUI`, `BenchmarkAISummary` |
| `src/lib/dal/benchmarking.ts` | New DAL functions for articles, enhanced missed topics, article search |
| `src/app/actions/benchmarking.ts` | New actions: interpret, link article, push external, generate report |
| `src/app/actions/hot-topics.ts` | Extract `crawlSinglePlatform()` from `triggerHotTopicCrawl()` |
| `src/app/(dashboard)/inspiration/inspiration-client.tsx` | PageHeader, tracked indicator, SSE refresh, inspiration input panel |
| `src/app/(dashboard)/benchmarking/benchmarking-client.tsx` | Rework compare tab, enhance missed tab, add auto-crawl |
| `src/app/(dashboard)/benchmarking/crawl-feed-list.tsx` | Add AI interpret button + expandable row |
| `src/app/(dashboard)/benchmarking/platform-status-tree.tsx` | Media level badges |
| `src/app/(dashboard)/benchmarking/platform-config-sheet.tsx` | Add "crawl now" button per platform |

---

## Phase 1: Schema & Shared Infrastructure

### Task 1: Schema Migration — Enums & missedTopics Fields

**Files:**
- Modify: `src/db/schema/enums.ts`
- Modify: `src/db/schema/benchmarking.ts`

- [ ] **Step 1: Add new enum to enums.ts**

In `src/db/schema/enums.ts`, add after the existing `missedTopicStatusEnum`:

```typescript
export const missedTopicSourceTypeEnum = pgEnum("missed_topic_source_type", [
  "social_hot",
  "sentiment_event",
  "benchmark_media",
]);
```

- [ ] **Step 2: Add new fields to missedTopics in benchmarking.ts**

In `src/db/schema/benchmarking.ts`, import the new enum and add fields to the `missedTopics` table:

```typescript
import { missedTopicSourceTypeEnum } from "./enums";
// ... inside missedTopics pgTable definition, add after `status`:
sourceType: missedTopicSourceTypeEnum("source_type").default("social_hot"),
sourceUrl: text("source_url"),
sourcePlatform: text("source_platform"),
matchedArticleId: uuid("matched_article_id").references(() => articles.id),
aiSummary: jsonb("ai_summary"),
pushedAt: timestamp("pushed_at", { withTimezone: true }),
pushedToSystem: text("pushed_to_system"),
```

Also add `import { articles } from "./articles";` at top.

- [ ] **Step 3: Add new fields to platformContent**

In same file, add to `platformContent` table after `gapAnalysis`:

```typescript
aiInterpretation: text("ai_interpretation"),
```

- [ ] **Step 4: Add new fields to benchmarkAnalyses**

In same file, add to `benchmarkAnalyses` table after `improvements`:

```typescript
aiSummary: jsonb("ai_summary"),
sourceArticleId: uuid("source_article_id").references(() => articles.id),
```

Add `articles` import if not already present.

- [ ] **Step 5: Push schema to database**

Run: `npm run db:push`
Expected: Schema changes applied without errors.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema/enums.ts src/db/schema/benchmarking.ts
git commit -m "feat(schema): add missed topic source types, AI summary, push fields"
```

### Task 2: Schema Migration — Articles Fields

**Files:**
- Modify: `src/db/schema/articles.ts`

- [ ] **Step 1: Add publishChannels and spreadData to articles table**

In `src/db/schema/articles.ts`, add after `missionId`:

```typescript
publishChannels: jsonb("publish_channels").$type<string[]>().default([]),
spreadData: jsonb("spread_data").$type<{
  views?: number;
  likes?: number;
  shares?: number;
  comments?: number;
  lastSyncedAt?: string;
  source?: "manual" | "api_sync";
}>().default({}),
```

- [ ] **Step 2: Push schema**

Run: `npm run db:push`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/db/schema/articles.ts
git commit -m "feat(schema): add publish channels and spread data to articles"
```

### Task 3: Update TypeScript Types

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Update MissedTopic interface**

Find the existing `MissedTopic` interface and update:

```typescript
export interface MissedTopic {
  id: string;
  title: string;
  priority: "high" | "medium" | "low";
  discoveredAt: string;
  competitors: string[];
  heatScore: number;
  category: string;
  type: "breaking" | "trending" | "analysis";
  status: "missed" | "tracking" | "resolved";
  sourceType?: "social_hot" | "sentiment_event" | "benchmark_media";
  sourceUrl?: string;
  sourcePlatform?: string;
  matchedArticleId?: string;
  matchedArticleTitle?: string;
  aiSummary?: BenchmarkAISummary;
  pushedAt?: string;
  pushedToSystem?: string;
}
```

- [ ] **Step 2: Add BenchmarkAISummary and BenchmarkArticleUI types**

Add after the existing benchmarking types:

```typescript
export interface BenchmarkAISummary {
  centralMediaReport: string;
  otherMediaReport: string;
  highlights: string;
  overallSummary: string;
  sourceArticles: {
    title: string;
    url: string;
    platform: string;
    mediaLevel: "central" | "provincial" | "municipal" | "industry" | "unknown";
    publishedAt?: string;
    excerpt?: string;
  }[];
  generatedAt: string;
}

export interface BenchmarkArticleUI {
  id: string;
  title: string;
  summary?: string;
  status: string;
  publishedAt?: string;
  publishChannels: string[];
  spreadData: {
    views?: number;
    likes?: number;
    shares?: number;
    comments?: number;
  };
  categoryName?: string;
}
```

- [ ] **Step 3: Update PlatformContentUI — add aiInterpretation**

Find `PlatformContentUI` and add field:

```typescript
aiInterpretation?: string;
```

- [ ] **Step 4: Update BenchmarkTopic — add aiSummary and sourceArticleId**

Find `BenchmarkTopic` and add:

```typescript
aiSummary?: BenchmarkAISummary;
sourceArticleId?: string;
```

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: PASS (or only pre-existing errors)

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): add benchmark AI summary, article UI, missed topic source types"
```

### Task 4: Shared AI Report Generation

**Files:**
- Create: `src/lib/ai-report.ts`

- [ ] **Step 1: Create AI report generation module**

This module is shared between topic comparison (2.2) and missed topic AI summary (3.3).

```typescript
import { searchViaTavily } from "@/lib/web-fetch";
import { generateText } from "ai";
import { resolveModelConfig, getLanguageModel } from "@/lib/agent/model-router";
import type { BenchmarkAISummary } from "@/lib/types";

/**
 * Generate a structured AI report for a given topic by:
 * 1. Searching Tavily for internet-wide coverage
 * 2. Asking LLM to summarize into 4 structured sections
 */
export async function generateTopicAIReport(
  topicTitle: string,
  options?: { maxResults?: number }
): Promise<BenchmarkAISummary> {
  const { items } = await searchViaTavily(topicTitle, {
    maxResults: options?.maxResults ?? 15,
    topic: "news",
  });

  if (items.length === 0) {
    return {
      centralMediaReport: "暂未找到相关官媒报道。",
      otherMediaReport: "暂未找到相关媒体报道。",
      highlights: "暂无数据。",
      overallSummary: "该话题暂未在主流媒体中发现相关报道。",
      sourceArticles: [],
      generatedAt: new Date().toISOString(),
    };
  }

  // Build source articles list
  const sourceArticles = items.map((item) => ({
    title: item.title,
    url: item.url,
    platform: item.source || new URL(item.url).hostname,
    mediaLevel: "unknown" as const,
    publishedAt: item.publishedAt,
    excerpt: item.snippet?.slice(0, 200),
  }));

  // Build context for LLM
  const articlesContext = items
    .map(
      (item, i) =>
        `[${i + 1}] 标题: ${item.title}\n来源: ${item.source || "未知"}\n摘要: ${item.snippet?.slice(0, 300) ?? "无"}\nURL: ${item.url}`
    )
    .join("\n\n");

  const config = resolveModelConfig(["analysis"]);
  const model = getLanguageModel(config);
  const { text } = await generateText({
    model,
    maxOutputTokens: 2000,
    messages: [
      {
        role: "system",
        content: `你是一位资深媒体分析师。请根据以下搜索结果，对「${topicTitle}」的全网报道情况进行结构化总结。

请严格按以下 JSON 格式输出，不要输出其他内容：
{
  "centralMediaReport": "官媒及央媒的报道情况总结（如人民网、新华网、央视等）",
  "otherMediaReport": "其他媒体的报道情况总结",
  "highlights": "报道的亮点和创新点",
  "overallSummary": "整体报道总结",
  "mediaLevels": [{"index": 0, "level": "central|provincial|municipal|industry|unknown"}, ...]
}

其中 mediaLevels 数组为每条来源文章的媒体级别判断。`,
      },
      {
        role: "user",
        content: `以下是关于「${topicTitle}」的 ${items.length} 篇报道：\n\n${articlesContext}`,
      },
    ],
  });

  // Parse LLM response
  try {
    const parsed = JSON.parse(text);

    // Apply media level classifications
    if (parsed.mediaLevels && Array.isArray(parsed.mediaLevels)) {
      for (const ml of parsed.mediaLevels) {
        if (sourceArticles[ml.index]) {
          sourceArticles[ml.index].mediaLevel = ml.level;
        }
      }
    }

    return {
      centralMediaReport: parsed.centralMediaReport || "",
      otherMediaReport: parsed.otherMediaReport || "",
      highlights: parsed.highlights || "",
      overallSummary: parsed.overallSummary || "",
      sourceArticles,
      generatedAt: new Date().toISOString(),
    };
  } catch {
    // Fallback: use raw text as overall summary
    return {
      centralMediaReport: "",
      otherMediaReport: "",
      highlights: "",
      overallSummary: text,
      sourceArticles,
      generatedAt: new Date().toISOString(),
    };
  }
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai-report.ts
git commit -m "feat: add shared AI topic report generation (Tavily + LLM)"
```

---

## Phase 2: Inspiration Pool (Tasks 6-9)

### Task 6: PageHeader + Tracked Indicator

**Files:**
- Modify: `src/app/(dashboard)/inspiration/inspiration-client.tsx`

- [ ] **Step 1: Add PageHeader import and render**

At top of file, add import:
```typescript
import { PageHeader } from "@/components/shared/page-header";
```

In `InspirationClient` return, wrap the existing `<div className="flex flex-col h-full overflow-hidden">` with PageHeader above the three-column layout:

```typescript
return (
  <div className="flex flex-col h-full overflow-hidden">
    <PageHeader
      title="灵感池"
      description="全网热点聚合 · AI 选题建议"
      actions={
        <Button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="text-xs border-0"
          variant="ghost"
        >
          <RefreshCw size={14} className={cn(isRefreshing && "animate-spin", "mr-1")} />
          {isRefreshing ? "抓取中..." : "刷新数据"}
        </Button>
      }
    />
    {/* Three-column layout */}
    <div className="flex flex-1 min-h-0">
      {/* ... existing 3 columns ... */}
    </div>
    {/* ... existing dialogs ... */}
  </div>
);
```

- [ ] **Step 2: Enhance tracked topic indicator in TopicList**

In the TopicList component, find the `<div>` with `key={topic.id}` (the topic row). Replace the outer div's className to add tracked indicator:

```typescript
<div
  key={topic.id}
  className={cn(
    "py-4 px-3 transition-all duration-150 relative",
    "hover:bg-blue-100/80 dark:hover:bg-blue-900/30",
    isTracked && "bg-blue-50/40 dark:bg-blue-950/20 border-l-4 border-l-blue-500",
    !isTracked && "border-l-4 border-l-transparent",
    index < topics.length - 1 && "border-b border-gray-200/80 dark:border-white/[0.06]"
  )}
  onMouseEnter={() => onMarkRead(topic.id)}
>
```

Replace the existing "已追踪" span (around line 1052-1056) with a more prominent badge:

```typescript
{isTracked ? (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
    <Radar size={10} className="animate-pulse" />
    追踪中
  </span>
) : (
  <button
    onClick={() => onStartMission(topic.id)}
    disabled={isMissionPending}
    className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-0.5 transition-colors"
  >
    <Rocket size={10} />
    {isMissionPending ? "创建中..." : "启动追踪"}
  </button>
)}
```

Add `Radar` to the lucide-react imports at the top (it's already imported).

- [ ] **Step 3: Remove duplicate refresh button from sidebar**

In the platform sidebar (Column 1), remove the "刷新数据" button block (around lines 565-582) since refresh is now in the PageHeader.

- [ ] **Step 4: Verify visually**

Run: `npm run dev` and navigate to `/inspiration`
Expected: PageHeader visible with title; tracked topics have blue left border + "追踪中" animated badge.

- [ ] **Step 5: Type check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/inspiration/inspiration-client.tsx
git commit -m "feat(inspiration): add PageHeader title, enhance tracked topic indicator"
```

### Task 7: SSE Crawl Progress

**Files:**
- Create: `src/app/api/inspiration/crawl/route.ts`
- Modify: `src/app/actions/hot-topics.ts`
- Modify: `src/app/(dashboard)/inspiration/inspiration-client.tsx`

- [ ] **Step 1: Extract crawlSinglePlatform from hot-topics.ts**

In `src/app/actions/hot-topics.ts`, add a new exported function before `triggerHotTopicCrawl`:

```typescript
/**
 * Crawl a single platform and return its items.
 * Extracted for use by both the batch action and SSE route.
 */
export async function crawlSinglePlatform(
  platformName: string
): Promise<{ name: string; items: TrendingItem[]; error?: string }> {
  try {
    const items = await fetchTrendingFromApi("platforms", {
      platforms: [platformName],
      limit: 30,
    });
    return { name: platformName, items };
  } catch (err) {
    return {
      name: platformName,
      items: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
```

- [ ] **Step 2: Create SSE crawl route**

Create `src/app/api/inspiration/crawl/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { userProfiles, hotTopics, hotTopicCrawlLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { crawlSinglePlatform } from "@/app/actions/hot-topics";
import {
  buildCrossPlatformTopics,
  normalizeHeatScore,
  normalizeTitleKey,
  TOPHUB_DEFAULT_NODES,
  type TrendingItem,
} from "@/lib/trending-api";
import crypto from "crypto";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export async function POST() {
  // Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile?.organizationId) {
    return new Response("No organization", { status: 400 });
  }
  const organizationId = profile.organizationId;

  const encoder = new TextEncoder();
  const platformNames = Object.keys(TOPHUB_DEFAULT_NODES);
  const total = platformNames.length;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        const allItems: TrendingItem[] = [];
        const crawlLogValues: (typeof hotTopicCrawlLogs.$inferInsert)[] = [];

        for (let i = 0; i < platformNames.length; i++) {
          const name = platformNames[i];
          const nodeId = TOPHUB_DEFAULT_NODES[name as keyof typeof TOPHUB_DEFAULT_NODES];

          const result = await crawlSinglePlatform(name);

          if (result.error) {
            crawlLogValues.push({ organizationId, platformName: name, platformNodeId: nodeId, status: "error", topicsFound: 0, errorMessage: result.error });
          } else {
            allItems.push(...result.items);
            crawlLogValues.push({ organizationId, platformName: name, platformNodeId: nodeId, status: "success", topicsFound: result.items.length });
          }

          send("progress", {
            platform: name,
            status: result.error ? "error" : "done",
            current: i + 1,
            total,
            found: result.items.length,
          });
        }

        // Write crawl logs
        if (crawlLogValues.length > 0) {
          await db.insert(hotTopicCrawlLogs).values(crawlLogValues);
        }

        // Dedup and persist (reuse logic from triggerHotTopicCrawl)
        if (allItems.length > 0) {
          const crossPlatform = buildCrossPlatformTopics(allItems);
          const topicAgg = new Map<string, {
            title: string; titleHash: string; platforms: Set<string>;
            maxHeat: number; url: string; category?: string;
          }>();

          for (const cp of crossPlatform) {
            const key = normalizeTitleKey(cp.title);
            const titleHash = crypto.createHash("md5").update(key).digest("hex");
            topicAgg.set(key, { title: cp.title, titleHash, platforms: new Set(cp.platforms), maxHeat: cp.totalHeat, url: "", category: undefined });
          }
          for (const item of allItems) {
            const key = normalizeTitleKey(item.title);
            const { parseChineseNumber } = await import("@/lib/trending-api");
            const numericHeat = parseChineseNumber(item.heat);
            if (!topicAgg.has(key)) {
              const titleHash = crypto.createHash("md5").update(key).digest("hex");
              topicAgg.set(key, { title: item.title, titleHash, platforms: new Set([item.platform]), maxHeat: numericHeat, url: item.url, category: item.category });
            } else {
              const existing = topicAgg.get(key)!;
              existing.platforms.add(item.platform);
              if (numericHeat > existing.maxHeat) existing.maxHeat = numericHeat;
              if (item.url && !existing.url) existing.url = item.url;
            }
          }

          const now = new Date();
          const timeLabel = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
          let newCount = 0;
          let updatedCount = 0;

          for (const [, agg] of topicAgg) {
            const platformCount = agg.platforms.size;
            const heatScore = normalizeHeatScore(agg.maxHeat, platformCount);
            const platformsArray = Array.from(agg.platforms);
            const priority = platformCount >= 3 || heatScore > 85 ? "P0" : platformCount >= 2 || heatScore >= 50 ? "P1" : "P2";

            await db.insert(hotTopics).values({
              organizationId, title: agg.title, titleHash: agg.titleHash,
              sourceUrl: agg.url || null, priority, heatScore,
              trend: "rising", source: platformsArray[0] || "",
              category: agg.category || null, platforms: platformsArray,
              heatCurve: [{ time: timeLabel, value: heatScore }], discoveredAt: now,
            }).onConflictDoUpdate({
              target: [hotTopics.organizationId, hotTopics.titleHash],
              set: { heatScore, platforms: platformsArray, discoveredAt: now, updatedAt: now },
            });

            // Simplified counting
            newCount++;
          }

          send("complete", { newTopics: newCount, updatedTopics: updatedCount });
        } else {
          send("complete", { newTopics: 0, updatedTopics: 0 });
        }

        revalidatePath("/inspiration");
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : "Unknown error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 3: Update frontend handleRefresh in inspiration-client.tsx**

Replace the existing `handleRefresh` and add state for progress:

```typescript
// Add state near other state declarations
const [crawlProgress, setCrawlProgress] = useState<{ current: number; total: number; platform: string } | null>(null);

// Replace handleRefresh
const handleRefresh = useCallback(async () => {
  setCrawlProgress({ current: 0, total: 10, platform: "" });
  try {
    const res = await fetch("/api/inspiration/crawl", { method: "POST" });
    if (!res.ok || !res.body) throw new Error("Crawl failed");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.current) {
              setCrawlProgress({ current: data.current, total: data.total, platform: data.platform });
            }
            if (data.newTopics !== undefined) {
              setCrawlProgress(null);
              router.refresh();
            }
          } catch { /* skip */ }
        }
      }
    }
  } catch {
    setCrawlProgress(null);
  }
}, [router]);
```

- [ ] **Step 4: Add progress bar UI**

In the main content column (Column 2), add a progress bar above the AISummaryBar:

```typescript
{/* Crawl Progress Bar */}
{crawlProgress && (
  <div className="border-b border-gray-200 dark:border-white/5">
    <div className="px-4 py-2 flex items-center gap-3">
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-300"
          style={{ width: `${(crawlProgress.current / crawlProgress.total) * 100}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
        {crawlProgress.current}/{crawlProgress.total} 平台已完成
      </span>
    </div>
  </div>
)}
```

- [ ] **Step 5: Remove old isRefreshing/startRefreshTransition usage**

Remove the `useTransition` for refreshing since we now use direct fetch. Clean up the old `startRefreshTransition` code. The PageHeader refresh button should use `handleRefresh` directly and show disabled state based on `crawlProgress !== null`.

- [ ] **Step 6: Type check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/api/inspiration/crawl/route.ts src/app/actions/hot-topics.ts src/app/(dashboard)/inspiration/inspiration-client.tsx
git commit -m "feat(inspiration): SSE crawl progress with per-platform updates"
```

### Task 8: User Inspiration Input Panel

**Files:**
- Create: `src/app/api/inspiration/organize/route.ts`
- Modify: `src/app/(dashboard)/inspiration/inspiration-client.tsx`

- [ ] **Step 1: Create organize API route**

Create `src/app/api/inspiration/organize/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateText } from "ai";
import { resolveModelConfig, getLanguageModel } from "@/lib/agent/model-router";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { message, history } = await request.json() as {
    message: string;
    history?: { role: "user" | "assistant"; content: string }[];
  };

  if (!message?.trim()) return new Response("Empty message", { status: 400 });

  const config = resolveModelConfig(["analysis"]);
  const model = getLanguageModel(config);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const messages = [
          {
            role: "system" as const,
            content: `你是小策（xiaoce），Vibe Media 的内容策划专员。用户会输入一条灵感或想法，你需要将其整理成结构化的选题建议。

请按以下 JSON 格式输出：
{
  "title": "精炼后的选题标题",
  "summary": "内容摘要（50-100字）",
  "angles": ["切入角度1", "切入角度2", "切入角度3"],
  "relatedKeywords": ["关联关键词1", "关联关键词2"],
  "confidence": "high|medium|low"
}

保持回复简洁专业。如果用户在追问或修改方向，基于之前的对话继续优化建议。`,
          },
          ...(history ?? []).map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          { role: "user" as const, content: message },
        ];

        const { text } = await generateText({
          model,
          maxOutputTokens: 1000,
          messages,
        });

        controller.enqueue(
          encoder.encode(`event: result\ndata: ${JSON.stringify({ content: text })}\n\n`)
        );
      } catch (err) {
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ message: err instanceof Error ? err.message : "AI 处理失败" })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}
```

- [ ] **Step 2: Add InspirationInput component to inspiration-client.tsx**

Add a new component at the bottom of the file (before the CalendarEventSheet):

```typescript
function InspirationInput() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/inspiration/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, history: messages }),
      });

      if (!res.ok || !res.body) throw new Error("Failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                setMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "抱歉，处理失败，请重试。" }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, messages, isLoading]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  return (
    <div className="border-t border-gray-200 dark:border-white/5 mt-4">
      <div className="flex items-center gap-1.5 px-1 pt-3 pb-1">
        <Sparkles size={14} className="text-blue-500" />
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">灵感输入</span>
      </div>

      {messages.length > 0 && (
        <div ref={scrollRef} className="max-h-[240px] overflow-y-auto px-1 space-y-2 mb-2">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "text-xs rounded-lg px-3 py-2 leading-relaxed",
                msg.role === "user"
                  ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 ml-6"
                  : "bg-gray-50 dark:bg-white/5 text-gray-700 dark:text-gray-300 mr-2"
              )}
            >
              {msg.role === "assistant" ? (
                <InspirationResultCard content={msg.content} />
              ) : (
                msg.content
              )}
            </div>
          ))}
          {isLoading && (
            <div className="text-xs text-gray-400 dark:text-gray-500 px-3 py-2">
              小策正在整理...
            </div>
          )}
        </div>
      )}

      <div className="flex items-end gap-1.5 px-1 pb-1">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="输入你的灵感想法..."
          rows={2}
          className="flex-1 text-xs rounded-lg bg-gray-100 dark:bg-white/5 px-3 py-2 resize-none outline-none focus:ring-1 focus:ring-blue-500/30 text-gray-700 dark:text-gray-300 placeholder:text-gray-400"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="shrink-0 p-2 rounded-lg bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-700 transition-colors border-0"
        >
          <ArrowUp size={14} />
        </button>
      </div>
    </div>
  );
}

function InspirationResultCard({ content }: { content: string }) {
  try {
    const data = JSON.parse(content);
    return (
      <div className="space-y-1.5">
        <div className="font-medium text-gray-900 dark:text-gray-100">{data.title}</div>
        {data.summary && <p className="text-gray-500 dark:text-gray-400">{data.summary}</p>}
        {data.angles?.length > 0 && (
          <div className="space-y-0.5">
            <span className="text-gray-400 dark:text-gray-500">建议角度：</span>
            {data.angles.map((a: string, i: number) => (
              <div key={i} className="text-blue-600 dark:text-blue-400 pl-2">
                {i + 1}. {a}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  } catch {
    return <span>{content}</span>;
  }
}
```

- [ ] **Step 3: Insert InspirationInput into EditorialBriefing**

In the `EditorialBriefing` component, add `<InspirationInput />` at the end of the content (after the "一键追踪全部 P0" button):

```typescript
{/* ... existing content ... */}
{p0Count > 0 && (
  <Button ...>...</Button>
)}

{/* Inspiration Input */}
<InspirationInput />
```

- [ ] **Step 4: Type check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/inspiration/organize/route.ts src/app/(dashboard)/inspiration/inspiration-client.tsx
git commit -m "feat(inspiration): add AI inspiration input panel in right sidebar"
```

---

## Phase 3: Benchmarking — Topic Comparison (Tasks 9-12)

### Task 9: Update DAL — Published Articles & Enhanced Missed Topics

**Files:**
- Modify: `src/lib/dal/benchmarking.ts`

- [ ] **Step 1: Add getPublishedArticlesForBenchmark**

```typescript
import { articles } from "@/db/schema";

export async function getPublishedArticlesForBenchmark(
  orgId: string,
  limit = 30
): Promise<BenchmarkArticleUI[]> {
  const rows = await db
    .select({
      id: articles.id,
      title: articles.title,
      summary: articles.summary,
      status: articles.status,
      publishedAt: articles.publishedAt,
      publishChannels: articles.publishChannels,
      spreadData: articles.spreadData,
    })
    .from(articles)
    .where(
      and(
        eq(articles.organizationId, orgId),
        inArray(articles.status, ["published", "review"])
      )
    )
    .orderBy(desc(articles.publishedAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary ?? undefined,
    status: row.status,
    publishedAt: row.publishedAt?.toISOString(),
    publishChannels: (row.publishChannels as string[]) ?? [],
    spreadData: (row.spreadData as BenchmarkArticleUI["spreadData"]) ?? {},
  }));
}
```

Import `BenchmarkArticleUI` from `@/lib/types` and add `inArray` to drizzle-orm imports.

- [ ] **Step 2: Add searchArticlesForLinking**

```typescript
export async function searchArticlesForLinking(
  orgId: string,
  query: string,
  limit = 20
): Promise<{ id: string; title: string; publishedAt?: string; status: string }[]> {
  const rows = await db
    .select({
      id: articles.id,
      title: articles.title,
      publishedAt: articles.publishedAt,
      status: articles.status,
    })
    .from(articles)
    .where(
      and(
        eq(articles.organizationId, orgId),
        sql`${articles.title} ILIKE ${"%" + query + "%"}`
      )
    )
    .orderBy(desc(articles.updatedAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    publishedAt: r.publishedAt?.toISOString(),
    status: r.status,
  }));
}
```

- [ ] **Step 3: Update getMissedTopics to return new fields**

Update the existing `getMissedTopics` function to include new fields:

```typescript
export async function getMissedTopics(orgId: string): Promise<MissedTopic[]> {
  const rows = await db.query.missedTopics.findMany({
    where: eq(missedTopics.organizationId, orgId),
    orderBy: [desc(missedTopics.heatScore), desc(missedTopics.discoveredAt)],
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    priority: row.priority,
    discoveredAt: row.discoveredAt.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    competitors: (row.competitors as string[]) || [],
    heatScore: row.heatScore || 0,
    category: row.category || "",
    type: row.type,
    status: row.status,
    sourceType: row.sourceType ?? undefined,
    sourceUrl: row.sourceUrl ?? undefined,
    sourcePlatform: row.sourcePlatform ?? undefined,
    matchedArticleId: row.matchedArticleId ?? undefined,
    aiSummary: (row.aiSummary as MissedTopic["aiSummary"]) ?? undefined,
    pushedAt: row.pushedAt?.toISOString(),
    pushedToSystem: row.pushedToSystem ?? undefined,
  }));
}
```

Import `MissedTopic` from `@/lib/types`.

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/dal/benchmarking.ts
git commit -m "feat(dal): add published articles query, article search, enhanced missed topics"
```

### Task 10: Enhanced Missed Topic Identification (Spec 3.2)

**Files:**
- Modify: `src/lib/dal/benchmarking.ts`

- [ ] **Step 1: Add cross-comparison function for hotTopics → missedTopics**

Add a new function that checks P0 hot topics against articles to find uncovered ones:

```typescript
export async function identifyMissedFromHotTopics(orgId: string): Promise<void> {
  // Find P0 hot topics that have no matching article title
  const p0Topics = await db
    .select({ id: hotTopics.id, title: hotTopics.title, heatScore: hotTopics.heatScore, category: hotTopics.category, platforms: hotTopics.platforms })
    .from(hotTopics)
    .where(and(eq(hotTopics.organizationId, orgId), eq(hotTopics.priority, "P0")));

  for (const topic of p0Topics) {
    // Check if article with similar title exists
    const [match] = await db
      .select({ id: articles.id })
      .from(articles)
      .where(and(eq(articles.organizationId, orgId), sql`${articles.title} ILIKE ${"%" + topic.title.slice(0, 20) + "%"}`))
      .limit(1);

    if (match) continue; // We have coverage

    // Check if already in missedTopics
    const [existing] = await db
      .select({ id: missedTopics.id })
      .from(missedTopics)
      .where(and(eq(missedTopics.organizationId, orgId), sql`${missedTopics.title} = ${topic.title}`))
      .limit(1);

    if (existing) continue;

    await db.insert(missedTopics).values({
      organizationId: orgId,
      title: topic.title,
      priority: "high",
      discoveredAt: new Date(),
      competitors: [],
      heatScore: topic.heatScore || 0,
      category: topic.category || "综合",
      type: "trending",
      status: "missed",
      sourceType: "social_hot",
      sourcePlatform: ((topic.platforms as string[]) ?? [])[0] ?? "热搜",
    });
  }
}
```

Add the needed imports at the top: `hotTopics` from `@/db/schema` and `articles` from `@/db/schema`.

- [ ] **Step 2: Call from autoGenerateAnalysisIfNeeded**

In the existing `autoGenerateAnalysisIfNeeded` function, add a call at the end:

```typescript
// At the end of autoGenerateAnalysisIfNeeded, add:
await identifyMissedFromHotTopics(orgId);
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/dal/benchmarking.ts
git commit -m "feat(benchmarking): add hotTopics cross-comparison for missed topic identification"
```

### Task 11: Benchmarking Actions — Interpret, Link, Push, Report

**Files:**
- Modify: `src/app/actions/benchmarking.ts`
- Create: `src/app/api/benchmarking/interpret/route.ts`
- Create: `src/app/api/benchmarking/report/route.ts`

- [ ] **Step 1: Add interpretContent API route**

Create `src/app/api/benchmarking/interpret/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { platformContent } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateText } from "ai";
import { resolveModelConfig, getLanguageModel } from "@/lib/agent/model-router";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contentId } = await request.json();

  // Check if already interpreted
  const [content] = await db
    .select({ id: platformContent.id, title: platformContent.title, summary: platformContent.summary, body: platformContent.body, aiInterpretation: platformContent.aiInterpretation })
    .from(platformContent)
    .where(eq(platformContent.id, contentId))
    .limit(1);

  if (!content) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (content.aiInterpretation) {
    return NextResponse.json({ interpretation: content.aiInterpretation });
  }

  const config = resolveModelConfig(["analysis"]);
  const model = getLanguageModel(config);
  const { text } = await generateText({
    model,
    maxOutputTokens: 800,
    messages: [
      { role: "system", content: "你是一位资深媒体编辑。请对以下新闻报道进行要点解读，包括：核心观点、关键数据、报道角度、值得关注的信息。用简洁的要点列表形式输出。" },
      { role: "user", content: `标题：${content.title}\n\n内容：${content.body || content.summary || "无详细内容"}` },
    ],
  });

  // Cache result
  await db.update(platformContent).set({ aiInterpretation: text }).where(eq(platformContent.id, contentId));

  return NextResponse.json({ interpretation: text });
}
```

- [ ] **Step 2: Add report SSE route**

Create `src/app/api/benchmarking/report/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { generateTopicAIReport } from "@/lib/ai-report";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { topicTitle } = await request.json();
  if (!topicTitle) return new Response("Missing topicTitle", { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`event: status\ndata: ${JSON.stringify({ step: "searching" })}\n\n`));

        const report = await generateTopicAIReport(topicTitle);

        controller.enqueue(encoder.encode(`event: result\ndata: ${JSON.stringify(report)}\n\n`));
      } catch (err) {
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: err instanceof Error ? err.message : "生成失败" })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}
```

- [ ] **Step 3: Add server actions to benchmarking.ts**

In `src/app/actions/benchmarking.ts`, add:

```typescript
export async function linkMissedTopicToArticle(topicId: string, articleId: string) {
  await requireAuth();
  await db.update(missedTopics).set({
    status: "resolved",
    matchedArticleId: articleId,
  }).where(eq(missedTopics.id, topicId));
  revalidatePath("/benchmarking");
}

export async function saveMissedTopicAISummary(topicId: string, aiSummary: unknown) {
  await requireAuth();
  await db.update(missedTopics).set({ aiSummary }).where(eq(missedTopics.id, topicId));
  revalidatePath("/benchmarking");
}

export async function pushMissedTopicToExternal(topicId: string) {
  await requireAuth();

  const topic = await db.query.missedTopics.findFirst({
    where: eq(missedTopics.id, topicId),
  });
  if (!topic) throw new Error("Topic not found");

  const webhookUrl = process.env.MISSED_TOPIC_WEBHOOK_URL;
  if (!webhookUrl) throw new Error("推送地址未配置（MISSED_TOPIC_WEBHOOK_URL）");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: topic.title,
        priority: topic.priority,
        heatScore: topic.heatScore,
        sourceUrl: topic.sourceUrl,
        competitors: topic.competitors,
        category: topic.category,
        sourceType: topic.sourceType,
      }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`推送失败: HTTP ${res.status}`);

    await db.update(missedTopics).set({
      pushedAt: new Date(),
      pushedToSystem: webhookUrl,
    }).where(eq(missedTopics.id, topicId));

    revalidatePath("/benchmarking");
    return { success: true };
  } finally {
    clearTimeout(timeout);
  }
}
```

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/benchmarking/interpret/route.ts src/app/api/benchmarking/report/route.ts src/app/actions/benchmarking.ts
git commit -m "feat(benchmarking): add AI interpret, report SSE, link/push actions"
```

### Task 11: Topic Report Panel + Article Compare View Components

**Files:**
- Create: `src/app/(dashboard)/benchmarking/topic-report-panel.tsx`
- Create: `src/app/(dashboard)/benchmarking/article-compare-view.tsx`

- [ ] **Step 1: Create topic-report-panel.tsx**

```typescript
"use client";

import { useState } from "react";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink, Building2, Newspaper, Sparkles, FileText } from "lucide-react";
import type { BenchmarkAISummary } from "@/lib/types";

interface TopicReportPanelProps {
  topicTitle: string;
  cachedReport?: BenchmarkAISummary;
  onReportGenerated?: (report: BenchmarkAISummary) => void;
}

const MEDIA_LEVEL_STYLE: Record<string, { label: string; color: string }> = {
  central: { label: "央媒", color: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
  provincial: { label: "省媒", color: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
  municipal: { label: "市媒", color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  industry: { label: "行业", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  unknown: { label: "其他", color: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
};

export function TopicReportPanel({ topicTitle, cachedReport, onReportGenerated }: TopicReportPanelProps) {
  const [report, setReport] = useState<BenchmarkAISummary | undefined>(cachedReport);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState("");

  async function handleGenerate() {
    setIsLoading(true);
    setStep("searching");
    try {
      const res = await fetch("/api/benchmarking/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicTitle }),
      });
      if (!res.ok || !res.body) throw new Error("Failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.step) setStep(data.step);
              if (data.centralMediaReport) {
                setReport(data as BenchmarkAISummary);
                onReportGenerated?.(data as BenchmarkAISummary);
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch { /* handled by empty report */ }
    finally { setIsLoading(false); setStep(""); }
  }

  if (!report && !isLoading) {
    return (
      <GlassCard>
        <div className="flex flex-col items-center py-8 text-center">
          <Sparkles size={24} className="text-blue-500 mb-3" />
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            点击生成「{topicTitle}」的全网报道 AI 总结
          </p>
          <Button onClick={handleGenerate} className="bg-blue-600 hover:bg-blue-700 text-white border-0">
            <Sparkles size={14} className="mr-1.5" />
            AI 全网报道总结
          </Button>
        </div>
      </GlassCard>
    );
  }

  if (isLoading) {
    return (
      <GlassCard>
        <div className="flex flex-col items-center py-12">
          <Loader2 size={24} className="text-blue-500 animate-spin mb-3" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {step === "searching" ? "正在搜索全网报道..." : "正在生成 AI 总结..."}
          </p>
        </div>
      </GlassCard>
    );
  }

  if (!report) return null;

  return (
    <div className="space-y-4">
      {/* Four-section summary */}
      {[
        { icon: Building2, title: "官媒及央媒报道", content: report.centralMediaReport },
        { icon: Newspaper, title: "其他媒体报道", content: report.otherMediaReport },
        { icon: Sparkles, title: "报道亮点与创新", content: report.highlights },
        { icon: FileText, title: "整体报道总结", content: report.overallSummary },
      ].map(({ icon: Icon, title, content }) => (
        <GlassCard key={title} padding="sm">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
            <Icon size={14} className="text-blue-500" />
            {title}
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{content}</p>
        </GlassCard>
      ))}

      {/* Source articles */}
      {report.sourceArticles.length > 0 && (
        <GlassCard padding="sm">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">
            来源文章（{report.sourceArticles.length} 篇）
          </h4>
          <div className="space-y-2">
            {report.sourceArticles.map((article, i) => {
              const levelStyle = MEDIA_LEVEL_STYLE[article.mediaLevel] || MEDIA_LEVEL_STYLE.unknown;
              return (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <Badge variant="secondary" className={levelStyle.color}>
                    {levelStyle.label}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-gray-800 dark:text-gray-200 hover:underline line-clamp-1">
                      {article.title}
                      <ExternalLink size={10} className="inline ml-1 opacity-50" />
                    </a>
                    <span className="text-gray-400 dark:text-gray-500 ml-2">{article.platform}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create article-compare-view.tsx**

```typescript
"use client";

import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Eye, FileText, Clock } from "lucide-react";
import type { BenchmarkArticleUI, PlatformContentUI } from "@/lib/types";
import { TopicReportPanel } from "./topic-report-panel";

interface ArticleCompareViewProps {
  ourArticle?: BenchmarkArticleUI;
  competitorContent: PlatformContentUI[];
  topicTitle: string;
}

export function ArticleCompareView({ ourArticle, competitorContent, topicTitle }: ArticleCompareViewProps) {
  return (
    <div className="space-y-4">
      {/* Side-by-side: competitor vs ours */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left: Competitor articles */}
        <GlassCard padding="sm">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
            <Eye size={14} />
            竞品报道（{competitorContent.length} 篇）
          </h4>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {competitorContent.map((item) => (
              <div key={item.id} className="p-2 rounded-lg bg-gray-50 dark:bg-white/5">
                <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-gray-800 dark:text-gray-200 hover:underline line-clamp-2">
                  {item.title}
                  <ExternalLink size={10} className="inline ml-1 opacity-50" />
                </a>
                {item.summary && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{item.summary}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5 text-[11px] text-gray-400">
                  <span>{item.platformName}</span>
                  {item.publishedAt && <span><Clock size={9} className="inline mr-0.5" />{new Date(item.publishedAt).toLocaleDateString("zh-CN")}</span>}
                </div>
              </div>
            ))}
            {competitorContent.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">暂无竞品报道</p>
            )}
          </div>
        </GlassCard>

        {/* Right: Our article */}
        <GlassCard padding="sm">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
            <FileText size={14} />
            我方报道
          </h4>
          {ourArticle ? (
            <div className="space-y-3">
              <div>
                <h5 className="text-sm font-medium text-gray-800 dark:text-gray-200">{ourArticle.title}</h5>
                {ourArticle.summary && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{ourArticle.summary}</p>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-gray-400">
                {ourArticle.publishedAt && <span><Clock size={9} className="inline mr-0.5" />{new Date(ourArticle.publishedAt).toLocaleDateString("zh-CN")}</span>}
                <Badge variant="secondary" className="text-[10px]">{ourArticle.status}</Badge>
              </div>
              {/* Spread data */}
              {(ourArticle.spreadData.views || ourArticle.spreadData.likes) && (
                <div className="flex gap-3 text-[11px]">
                  {ourArticle.spreadData.views && <span className="text-gray-500">阅读 {ourArticle.spreadData.views.toLocaleString()}</span>}
                  {ourArticle.spreadData.likes && <span className="text-gray-500">点赞 {ourArticle.spreadData.likes}</span>}
                  {ourArticle.spreadData.shares && <span className="text-gray-500">转发 {ourArticle.spreadData.shares}</span>}
                  {ourArticle.spreadData.comments && <span className="text-gray-500">评论 {ourArticle.spreadData.comments}</span>}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center py-8 text-center">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">我方暂未覆盖此话题</p>
              <Button variant="ghost" size="sm" className="text-xs border-0">
                一键创建稿件
              </Button>
            </div>
          )}
        </GlassCard>
      </div>

      {/* AI Report */}
      <TopicReportPanel topicTitle={topicTitle} />
    </div>
  );
}
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/benchmarking/topic-report-panel.tsx src/app/(dashboard)/benchmarking/article-compare-view.tsx
git commit -m "feat(benchmarking): add topic report panel and article compare view"
```

### Task 12: Rework Compare Tab + Media Level Labels + Auto Crawl

**Files:**
- Modify: `src/app/(dashboard)/benchmarking/benchmarking-client.tsx`
- Modify: `src/app/(dashboard)/benchmarking/platform-status-tree.tsx`
- Modify: `src/app/(dashboard)/benchmarking/crawl-feed-list.tsx`
- Modify: `src/app/(dashboard)/benchmarking/page.tsx`

- [ ] **Step 1: Update page.tsx to pass published articles**

In `src/app/(dashboard)/benchmarking/page.tsx`, import and call the new DAL function:

```typescript
import { getPublishedArticlesForBenchmark } from "@/lib/dal/benchmarking";
```

Add to the Promise.all:
```typescript
getPublishedArticlesForBenchmark(orgId),
```

Pass to client: `publishedArticles={publishedArticles}`

- [ ] **Step 2: Add media level badges to platform-status-tree.tsx**

In `PlatformStatusTree`, add category color mapping and render badges next to platform names:

```typescript
const LEVEL_BADGE: Record<string, { label: string; className: string }> = {
  central: { label: "央媒", className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
  provincial: { label: "省媒", className: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
  municipal: { label: "市媒", className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  industry: { label: "行业", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};
```

Render badge after each platform name.

- [ ] **Step 3: Add AI interpret button to crawl-feed-list.tsx**

Add an "AI 解读" button to each feed item. When clicked, call `/api/benchmarking/interpret` and show result in an expandable row.

- [ ] **Step 4: Rework compare tab in benchmarking-client.tsx**

Replace the current search-based topic picker with:
1. A list of published articles (our works) at the top
2. When user selects an article, show `ArticleCompareView` with matching `platformContent`
3. Keep existing radar chart as supplementary view

- [ ] **Step 5: Add auto-crawl trigger after platform initialization**

In `benchmarking-client.tsx`, when `hasData === false` and platforms exist, add a "开始抓取" button that calls `crawlPlatformDirect` for each platform sequentially with progress display.

- [ ] **Step 6: Type check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/(dashboard)/benchmarking/
git commit -m "feat(benchmarking): rework compare tab with article list, media levels, AI interpret"
```

---

## Phase 4: Missed Topic Detection (Tasks 13-14)

### Task 13: Missed Topic Detail Panel

**Files:**
- Create: `src/app/(dashboard)/benchmarking/missed-topic-detail.tsx`

- [ ] **Step 1: Create missed-topic-detail.tsx**

Build the detail panel component with:
- Source type badge (social_hot/sentiment_event/benchmark_media with colored labels)
- Original text display with "查看原文" link
- AI report generation button (reuses TopicReportPanel)
- "关联自有作品" search dialog
- "推送" button with error handling

```typescript
"use client";

import { useState, useTransition } from "react";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  ExternalLink, Link2, Send, Search, Loader2, CheckCircle,
} from "lucide-react";
import { linkMissedTopicToArticle, pushMissedTopicToExternal } from "@/app/actions/benchmarking";
import { TopicReportPanel } from "./topic-report-panel";
import type { MissedTopic, BenchmarkAISummary } from "@/lib/types";

const SOURCE_TYPE_STYLE: Record<string, { label: string; color: string }> = {
  social_hot: { label: "社媒热榜", color: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
  sentiment_event: { label: "舆情事件", color: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
  benchmark_media: { label: "对标媒体", color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
};

interface MissedTopicDetailProps {
  topic: MissedTopic;
  onUpdate: () => void;
}

export function MissedTopicDetail({ topic, onUpdate }: MissedTopicDetailProps) {
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; title: string; publishedAt?: string; status: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPushing, startPushTransition] = useTransition();
  const [pushError, setPushError] = useState<string | null>(null);

  const sourceStyle = SOURCE_TYPE_STYLE[topic.sourceType ?? "social_hot"] ?? SOURCE_TYPE_STYLE.social_hot;

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/benchmarking/search-articles?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) setSearchResults(await res.json());
    } finally { setIsSearching(false); }
  }

  async function handleLink(articleId: string) {
    await linkMissedTopicToArticle(topic.id, articleId);
    setShowLinkDialog(false);
    onUpdate();
  }

  function handlePush() {
    setPushError(null);
    startPushTransition(async () => {
      try {
        await pushMissedTopicToExternal(topic.id);
        onUpdate();
      } catch (err) {
        setPushError(err instanceof Error ? err.message : "推送失败");
      }
    });
  }

  return (
    <div className="space-y-4 py-2">
      {/* Source badge + heat */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className={sourceStyle.color}>{sourceStyle.label}</Badge>
        {topic.sourcePlatform && <span className="text-xs text-gray-500">{topic.sourcePlatform}</span>}
        <span className="text-xs text-gray-400 ml-auto">热度 {topic.heatScore}</span>
      </div>

      {/* Source URL */}
      {topic.sourceUrl && (
        <a href={topic.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
          查看原文 <ExternalLink size={10} />
        </a>
      )}

      {/* Actions row */}
      <div className="flex items-center gap-2">
        {topic.status !== "resolved" && (
          <Button variant="ghost" size="sm" className="text-xs border-0" onClick={() => setShowLinkDialog(true)}>
            <Link2 size={12} className="mr-1" />
            关联自有作品
          </Button>
        )}
        {topic.matchedArticleId && (
          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            <CheckCircle size={10} /> 已关联
          </span>
        )}
        {!topic.pushedAt ? (
          <Button variant="ghost" size="sm" className="text-xs border-0" onClick={handlePush} disabled={isPushing}>
            <Send size={12} className="mr-1" />
            {isPushing ? "推送中..." : "推送至三方"}
          </Button>
        ) : (
          <span className="text-xs text-gray-400">已推送</span>
        )}
        {pushError && <span className="text-xs text-red-500">{pushError}</span>}
      </div>

      {/* AI Report */}
      <TopicReportPanel topicTitle={topic.title} cachedReport={topic.aiSummary} />

      {/* Link article dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="bg-white dark:bg-gray-950 border-gray-200 dark:border-white/10">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-gray-100">关联自有作品</DialogTitle>
            <DialogDescription className="text-gray-500">搜索已有文章，关联后将标记为已覆盖</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="输入文章标题关键词" onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
            <Button onClick={handleSearch} disabled={isSearching} className="border-0 bg-blue-600 text-white">
              {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            </Button>
          </div>
          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {searchResults.map((article) => (
              <button key={article.id} onClick={() => handleLink(article.id)} className="w-full text-left p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 text-sm">
                <div className="font-medium text-gray-800 dark:text-gray-200 truncate">{article.title}</div>
                <div className="text-xs text-gray-400 mt-0.5">{article.status} · {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString("zh-CN") : ""}</div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/benchmarking/missed-topic-detail.tsx
git commit -m "feat(benchmarking): add missed topic detail panel with link, push, AI report"
```

### Task 14: Integrate Missed Topic Enhancements into Main Client

**Files:**
- Modify: `src/app/(dashboard)/benchmarking/benchmarking-client.tsx`
- Create: `src/app/api/benchmarking/search-articles/route.ts`

- [ ] **Step 1: Create search-articles API route**

Create `src/app/api/benchmarking/search-articles/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { searchArticlesForLinking } from "@/lib/dal/benchmarking";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json([], { status: 401 });

  const profile = await db.query.userProfiles.findFirst({ where: eq(userProfiles.id, user.id) });
  if (!profile?.organizationId) return NextResponse.json([]);

  const q = request.nextUrl.searchParams.get("q") ?? "";
  const results = await searchArticlesForLinking(profile.organizationId, q);
  return NextResponse.json(results);
}
```

- [ ] **Step 2: Update missed topics tab in benchmarking-client.tsx**

In the missed topics tab content, replace the existing card-based list with expandable rows that show `MissedTopicDetail` when clicked:

- Add import: `import { MissedTopicDetail } from "./missed-topic-detail";`
- Add state: `const [expandedMissedId, setExpandedMissedId] = useState<string | null>(null);`
- Each missed topic card becomes clickable; when expanded, renders `<MissedTopicDetail topic={topic} onUpdate={() => router.refresh()} />`
- Add source type badges to each row using `SOURCE_TYPE_STYLE`
- Highlight items with `heatScore >= 80` with red-tinted background

- [ ] **Step 3: Type check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS

- [ ] **Step 4: Full visual verification**

Run: `npm run dev`, navigate to `/benchmarking`:
- Monitor tab: shows data or crawl button
- Compare tab: shows article list + comparison view
- Missed tab: expandable detail panels with source badges
- All media level labels render correctly

- [ ] **Step 5: Commit**

```bash
git add src/app/api/benchmarking/search-articles/ src/app/(dashboard)/benchmarking/benchmarking-client.tsx
git commit -m "feat(benchmarking): integrate missed topic detail, article search, source badges"
```

### Task 15: Final Build Verification

- [ ] **Step 1: Full type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit any remaining fixes**

If build revealed issues, fix and commit.
