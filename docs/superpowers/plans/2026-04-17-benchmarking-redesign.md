# 同题漏题模块 UX 重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将单体 `/benchmarking` 页面拆分为两个独立模块：`/topic-compare`（同题对比）和 `/missing-topics`（漏题筛查），每个模块有独立的列表页和详情页。

**Architecture:** Next.js App Router，Server Component 做数据获取，Client Component 做交互。复用现有 DAL 层和 DB Schema，新增/改造 DAL 函数适配新页面结构。UI 复用 GlassCard、StatCard、PageHeader 等现有组件。

**Tech Stack:** Next.js 16, React 19, TypeScript, Drizzle ORM, Supabase, shadcn/ui, Tailwind CSS v4, Lucide icons

**Spec:** `docs/superpowers/specs/2026-04-17-benchmarking-redesign-design.md`

---

## 文件结构总览

```
src/
├── app/(dashboard)/
│   ├── topic-compare/
│   │   ├── page.tsx                          # NEW - Server: 作品列表
│   │   ├── topic-compare-client.tsx          # NEW - Client: 筛选+表格
│   │   ├── loading.tsx                       # NEW - Skeleton
│   │   └── [id]/
│   │       ├── page.tsx                      # NEW - Server: 详情数据
│   │       ├── topic-detail-client.tsx       # NEW - Client: 3 Tab编排
│   │       ├── overview-tab.tsx              # NEW - 全网报道概览(AI总结)
│   │       ├── articles-tab.tsx              # NEW - 全网报道列表
│   │       ├── competitor-tab.tsx            # NEW - 竞品媒体对标
│   │       └── loading.tsx                   # NEW - Skeleton
│   │
│   ├── missing-topics/
│   │   ├── page.tsx                          # NEW - Server: KPI+线索列表
│   │   ├── missing-topics-client.tsx         # NEW - Client: 看板+表格
│   │   ├── loading.tsx                       # NEW - Skeleton
│   │   └── [id]/
│   │       ├── page.tsx                      # NEW - Server: 漏题详情
│   │       ├── missing-detail-client.tsx     # NEW - Client: 左右分栏
│   │       ├── source-panel.tsx              # NEW - 左侧原文面板
│   │       ├── analysis-panel.tsx            # NEW - 右侧AI分析面板
│   │       ├── action-bar.tsx                # NEW - 底部操作区
│   │       └── loading.tsx                   # NEW - Skeleton
│   │
│   └── benchmarking/                         # 保留不动（后续可删除）
│
├── components/layout/
│   └── app-sidebar.tsx                       # MODIFY - 导航菜单
│
├── lib/
│   ├── dal/benchmarking.ts                   # MODIFY - 新增/改造 DAL
│   └── types.ts                              # MODIFY - 新增类型
│
├── app/actions/benchmarking.ts               # MODIFY - 新增 actions
│
└── data/benchmarking-data.ts                 # MODIFY - 新增 mock 数据
```

---

### Task 1: 侧边栏导航更新

**Files:**
- Modify: `src/components/layout/app-sidebar.tsx`

- [ ] **Step 1: 更新导航菜单项**

在 `NAV_ITEMS` 数组中，将 `同题对标` 单入口替换为两个独立入口。找到现有的 benchmarking 条目（约第72行）：

```typescript
{ label: "同题对标", href: "/benchmarking", icon: Crosshair },
```

替换为：

```typescript
{ label: "同题对比", href: "/topic-compare", icon: Target },
{ label: "漏题筛查", href: "/missing-topics", icon: SearchX },
```

在文件顶部的 lucide-react import 中添加 `Target` 和 `SearchX`。

- [ ] **Step 2: 验证并提交**

```bash
npx tsc --noEmit
git add src/components/layout/app-sidebar.tsx
git commit -m "feat: split benchmarking sidebar into topic-compare and missing-topics entries"
```

---

### Task 2: 类型定义与 Mock 数据

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/data/benchmarking-data.ts`

- [ ] **Step 1: 新增类型定义**

在 `src/lib/types.ts` 中已有 benchmarking 类型区域（约1262行之后）添加新类型：

```typescript
/** 同题对比 - 作品列表项（列表页用） */
export interface TopicCompareArticle {
  id: string;
  title: string;
  publishedAt: string;
  channels: string[];
  contentType: "text" | "video" | "live" | "short_video";
  readCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  benchmarkCount: number; // 全网同题报道数
  hasAnalysis: boolean;
}

/** 同题对比 - 详情页全网报道概览 */
export interface TopicCompareDetail {
  article: TopicCompareArticle;
  stats: {
    totalReports: number;
    centralCount: number;
    provincialCount: number;
    otherCount: number;
    earliestTime: string;
    latestTime: string;
    trendDelta: number; // 与上次刷新对比
  };
  aiSummary: BenchmarkAISummary | null;
  lastAnalyzedAt: string | null;
}

/** 同题对比 - 全网报道文章（报道列表Tab用） */
export interface NetworkReport {
  id: string;
  title: string;
  sourceOutlet: string;
  mediaLevel: "central" | "provincial" | "city" | "industry" | "self_media";
  publishedAt: string;
  author: string;
  summary: string;
  sourceUrl: string;
  contentType: string;
  aiInterpretation: ArticleAIInterpretation | null;
}

/** 单篇文章AI解读 */
export interface ArticleAIInterpretation {
  coreAngle: string;
  keyInformation: string[];
  uniqueContent: string;
  writingTechnique: string;
  sourceAnalysis: string;
  referenceValue: { level: "high" | "medium" | "low"; reason: string };
}

/** 竞品媒体对标 - 分组数据 */
export interface CompetitorGroup {
  level: "central" | "provincial" | "city" | "other";
  levelLabel: string;
  levelColor: string;
  outlets: CompetitorOutlet[];
}

export interface CompetitorOutlet {
  outletName: string;
  articles: {
    title: string;
    subject: string; // AI提取的报道主体
    publishedAt: string;
    channel: string;
    sourceUrl: string;
  }[];
}

/** 漏题筛查 - KPI 看板数据 */
export interface MissingTopicKPIs {
  totalClues: number;
  suspectedMissed: number;
  confirmedMissed: number;
  handled: number;
  coverageRate: number;
}

/** 漏题筛查 - 线索列表项 */
export interface MissingTopicClue {
  id: string;
  title: string;
  sourceType: "social_hot" | "sentiment_event" | "benchmark_media";
  sourceDetail: string;
  heatScore: number;
  discoveredAt: string;
  status: "covered" | "suspected" | "confirmed" | "excluded" | "pushed";
  urgency: "urgent" | "normal" | "watch";
  isMultiSource: boolean;
  competitors: string[];
}

/** 漏题详情 - 完整数据 */
export interface MissingTopicDetail {
  id: string;
  title: string;
  sourceType: "social_hot" | "sentiment_event" | "benchmark_media";
  sourceDetail: string;
  sourceTags: string[]; // 所有来源标识
  sourceUrl: string;
  heatScore: number;
  discoveredAt: string;
  publishedAt: string;
  status: "covered" | "suspected" | "confirmed" | "excluded" | "pushed";
  urgency: "urgent" | "normal" | "watch";
  isMultiSource: boolean;
  contentSummary: string;
  contentLength: number;
  reportedBy: {
    name: string;
    level: "central" | "provincial" | "city" | "industry" | "self_media";
  }[];
  aiAnalysis: BenchmarkAISummary | null;
  linkedArticleId: string | null;
  linkedArticleTitle: string | null;
  pushedAt: string | null;
  pushedToSystem: string | null;
}
```

- [ ] **Step 2: 新增 Mock 数据**

在 `src/data/benchmarking-data.ts` 中添加：

```typescript
export const topicCompareArticles: TopicCompareArticle[] = [
  {
    id: "tc-1",
    title: "AI手机大战：三巨头旗舰同日发布引发市场震动",
    publishedAt: "2026-04-17T09:30:00Z",
    channels: ["APP", "微信", "微博"],
    contentType: "text",
    readCount: 125000,
    likeCount: 3280,
    commentCount: 856,
    shareCount: 1204,
    benchmarkCount: 47,
    hasAnalysis: true,
  },
  {
    id: "tc-2",
    title: "新能源汽车降价潮：消费者持币观望还是立即入手",
    publishedAt: "2026-04-16T14:20:00Z",
    channels: ["APP", "微信"],
    contentType: "video",
    readCount: 83000,
    likeCount: 1560,
    commentCount: 423,
    shareCount: 678,
    benchmarkCount: 23,
    hasAnalysis: true,
  },
  {
    id: "tc-3",
    title: "两会数字经济前瞻：政策解读与产业趋势分析",
    publishedAt: "2026-04-15T08:00:00Z",
    channels: ["APP"],
    contentType: "text",
    readCount: 51000,
    likeCount: 890,
    commentCount: 234,
    shareCount: 345,
    benchmarkCount: 15,
    hasAnalysis: true,
  },
  {
    id: "tc-4",
    title: "春季招聘季：高校毕业生就业新趋势调查报告",
    publishedAt: "2026-04-14T16:45:00Z",
    channels: ["微信", "抖音"],
    contentType: "text",
    readCount: 38000,
    likeCount: 620,
    commentCount: 156,
    shareCount: 203,
    benchmarkCount: 0,
    hasAnalysis: false,
  },
];

export const missingTopicClues: MissingTopicClue[] = [
  {
    id: "mt-1",
    title: "科技部发布AI安全白皮书，业界反响强烈",
    sourceType: "sentiment_event",
    sourceDetail: "舆情系统·重大事件推送",
    heatScore: 92,
    discoveredAt: "2026-04-17T10:15:00Z",
    status: "suspected",
    urgency: "urgent",
    isMultiSource: true,
    competitors: ["人民日报", "新华社", "央视新闻"],
  },
  {
    id: "mt-2",
    title: "字节跳动内部大模型产品线全面曝光",
    sourceType: "social_hot",
    sourceDetail: "微博热搜 #5",
    heatScore: 75,
    discoveredAt: "2026-04-17T09:42:00Z",
    status: "suspected",
    urgency: "normal",
    isMultiSource: false,
    competitors: ["澎湃新闻", "第一财经"],
  },
  {
    id: "mt-3",
    title: "新华社深度报道：农村电商助力乡村振兴新模式",
    sourceType: "benchmark_media",
    sourceDetail: "新华社公众号",
    heatScore: 38,
    discoveredAt: "2026-04-17T08:30:00Z",
    status: "covered",
    urgency: "watch",
    isMultiSource: false,
    competitors: ["新华社"],
  },
  {
    id: "mt-4",
    title: "多地出台住房公积金新政策，利率下调",
    sourceType: "sentiment_event",
    sourceDetail: "舆情系统·热点事件",
    heatScore: 85,
    discoveredAt: "2026-04-17T07:20:00Z",
    status: "confirmed",
    urgency: "urgent",
    isMultiSource: false,
    competitors: ["人民日报", "经济日报", "各省党报"],
  },
  {
    id: "mt-5",
    title: "韩国综艺节目引发网络热议",
    sourceType: "social_hot",
    sourceDetail: "抖音热榜 TOP8",
    heatScore: 62,
    discoveredAt: "2026-04-17T09:00:00Z",
    status: "excluded",
    urgency: "watch",
    isMultiSource: false,
    competitors: [],
  },
];

export const missingTopicKPIs: MissingTopicKPIs = {
  totalClues: 156,
  suspectedMissed: 12,
  confirmedMissed: 5,
  handled: 3,
  coverageRate: 94.5,
};
```

- [ ] **Step 3: 验证并提交**

```bash
npx tsc --noEmit
git add src/lib/types.ts src/data/benchmarking-data.ts
git commit -m "feat: add types and mock data for topic-compare and missing-topics modules"
```

---

### Task 3: 同题对比 - 列表页

**Files:**
- Create: `src/app/(dashboard)/topic-compare/page.tsx`
- Create: `src/app/(dashboard)/topic-compare/topic-compare-client.tsx`
- Create: `src/app/(dashboard)/topic-compare/loading.tsx`

- [ ] **Step 1: 创建 loading.tsx**

```typescript
import { PageHeaderSkeleton, TableSkeleton } from "@/components/shared/skeleton-loaders";

export default function TopicCompareLoading() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeaderSkeleton />
      <TableSkeleton rows={8} />
    </div>
  );
}
```

- [ ] **Step 2: 创建 page.tsx (Server Component)**

```typescript
export const dynamic = "force-dynamic";

import { getCurrentUserOrg } from "@/lib/dal/auth";
import { TopicCompareClient } from "./topic-compare-client";
import { topicCompareArticles } from "@/data/benchmarking-data";
import type { TopicCompareArticle } from "@/lib/types";

export default async function TopicComparePage() {
  let articles: TopicCompareArticle[] = [];

  try {
    const { organizationId } = await getCurrentUserOrg();
    // TODO: 对接真实 DAL — getPublishedArticlesWithBenchmark(organizationId)
    articles = topicCompareArticles;
  } catch {
    articles = topicCompareArticles;
  }

  return <TopicCompareClient articles={articles} />;
}
```

- [ ] **Step 3: 创建 topic-compare-client.tsx (Client Component)**

这是列表页的核心客户端组件，包含筛选区和作品表格。

```typescript
"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, FileText, Video, Radio, Film } from "lucide-react";
import type { TopicCompareArticle } from "@/lib/types";

const contentTypeIcons: Record<string, { icon: React.ReactNode; label: string }> = {
  text: { icon: <FileText size={13} />, label: "图文" },
  video: { icon: <Video size={13} />, label: "视频" },
  live: { icon: <Radio size={13} />, label: "直播" },
  short_video: { icon: <Film size={13} />, label: "短视频" },
};

const channelColors: Record<string, string> = {
  APP: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  微信: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  微博: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  抖音: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  视频号: "bg-pink-50 text-pink-700 dark:bg-pink-950/40 dark:text-pink-400",
  网站: "bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}千`;
  return String(n);
}

function getBenchmarkBadgeStyle(count: number): string {
  if (count === 0) return "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500";
  if (count > 30) return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400";
  if (count > 10) return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400";
  return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400";
}

function isNew(publishedAt: string): boolean {
  return Date.now() - new Date(publishedAt).getTime() < 24 * 60 * 60 * 1000;
}

interface TopicCompareClientProps {
  articles: TopicCompareArticle[];
}

export function TopicCompareClient({ articles }: TopicCompareClientProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "analyzed" | "pending">("all");
  const [sortBy, setSortBy] = useState<"time" | "reads">("time");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    let list = articles;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.title.toLowerCase().includes(q));
    }

    if (statusFilter === "analyzed") list = list.filter((a) => a.hasAnalysis);
    if (statusFilter === "pending") list = list.filter((a) => !a.hasAnalysis);

    list = [...list].sort((a, b) => {
      const val = sortBy === "time"
        ? new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
        : a.readCount - b.readCount;
      return sortDir === "desc" ? -val : val;
    });

    return list;
  }, [articles, search, statusFilter, sortBy, sortDir]);

  function toggleSort(field: "time" | "reads") {
    if (sortBy === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader title="同题对比" description="以我方已发布作品为起点，对比全网同题报道" />

      {/* 筛选区 */}
      <GlassCard padding="sm" className="mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 dark:text-gray-400">同题状态</span>
            <div className="flex gap-1">
              {(["all", "analyzed", "pending"] as const).map((s) => (
                <Button
                  key={s}
                  variant="ghost"
                  size="sm"
                  className={`text-xs h-7 px-3 ${
                    statusFilter === s
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                      : ""
                  }`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === "all" ? "全部" : s === "analyzed" ? "已分析" : "未分析"}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex-1" />
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索标题关键词..."
              className="text-xs pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 w-52"
            />
          </div>
        </div>
      </GlassCard>

      {/* 表格 */}
      <GlassCard padding="none">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search size={24} className="text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {articles.length === 0 ? "暂无已发布作品" : "未找到匹配的作品，请调整筛选条件"}
            </p>
            {articles.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">作品数据将从发布系统自动同步</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400">作品标题</th>
                  <th
                    className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 w-[100px] cursor-pointer select-none"
                    onClick={() => toggleSort("time")}
                  >
                    发布时间 {sortBy === "time" ? (sortDir === "desc" ? "↓" : "↑") : "↕"}
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 w-[140px]">发布渠道</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 w-[60px]">类型</th>
                  <th
                    className="text-right py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 w-[90px] cursor-pointer select-none"
                    onClick={() => toggleSort("reads")}
                  >
                    阅读量 {sortBy === "reads" ? (sortDir === "desc" ? "↓" : "↑") : "↕"}
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 w-[80px]">同题报道</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 w-[110px]">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((article) => {
                  const ct = contentTypeIcons[article.contentType] || contentTypeIcons.text;
                  return (
                    <tr key={article.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-blue-50/30 dark:hover:bg-blue-950/10 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          {isNew(article.publishedAt) && (
                            <span className="shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 text-[9px] px-1 py-0.5 rounded">新</span>
                          )}
                          <span className="text-gray-800 dark:text-gray-100 truncate max-w-md">{article.title}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-500 dark:text-gray-400">
                        {new Date(article.publishedAt).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })}{" "}
                        {new Date(article.publishedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex gap-1 flex-wrap">
                          {article.channels.slice(0, 3).map((ch) => (
                            <span key={ch} className={`text-[10px] px-1.5 py-0.5 rounded ${channelColors[ch] || "bg-gray-100 text-gray-600"}`}>
                              {ch}
                            </span>
                          ))}
                          {article.channels.length > 3 && (
                            <span className="text-[10px] text-gray-400">+{article.channels.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-1">{ct.icon} {ct.label}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right text-xs text-gray-800 dark:text-gray-200">
                        {formatCount(article.readCount)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${getBenchmarkBadgeStyle(article.benchmarkCount)}`}>
                          {article.benchmarkCount > 0 ? article.benchmarkCount : "—"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {article.hasAnalysis ? (
                          <Link href={`/topic-compare/${article.id}`} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                            查看同题对比 →
                          </Link>
                        ) : (
                          <span className="text-xs text-gray-400">未生成分析</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-400">共 {filtered.length} 篇作品</span>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
```

- [ ] **Step 4: 验证并提交**

```bash
npx tsc --noEmit
git add src/app/\(dashboard\)/topic-compare/
git commit -m "feat(topic-compare): add list page with article table and filters"
```

---

### Task 4: 同题对比 - 详情页框架与概览Tab

**Files:**
- Create: `src/app/(dashboard)/topic-compare/[id]/page.tsx`
- Create: `src/app/(dashboard)/topic-compare/[id]/topic-detail-client.tsx`
- Create: `src/app/(dashboard)/topic-compare/[id]/overview-tab.tsx`
- Create: `src/app/(dashboard)/topic-compare/[id]/loading.tsx`

- [ ] **Step 1: 创建 loading.tsx**

```typescript
import { PageHeaderSkeleton, ChartSkeleton } from "@/components/shared/skeleton-loaders";

export default function TopicDetailLoading() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-5 gap-3 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
        ))}
      </div>
      <ChartSkeleton />
    </div>
  );
}
```

- [ ] **Step 2: 创建 page.tsx (Server Component)**

使用 Next.js 15+ 的 `params: Promise<{id}>` 模式。

```typescript
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { TopicDetailClient } from "./topic-detail-client";
import { topicCompareArticles } from "@/data/benchmarking-data";
import type { TopicCompareDetail, NetworkReport, CompetitorGroup } from "@/lib/types";

export default async function TopicDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let detail: TopicCompareDetail | null = null;
  let reports: NetworkReport[] = [];
  let competitorGroups: CompetitorGroup[] = [];

  try {
    await getCurrentUserOrg();
    // TODO: 对接真实 DAL
  } catch {
    // fallback to mock
  }

  // Mock data
  const article = topicCompareArticles.find((a) => a.id === id);
  if (!article) notFound();

  detail = {
    article,
    stats: {
      totalReports: article.benchmarkCount,
      centralCount: 8,
      provincialCount: 15,
      otherCount: article.benchmarkCount - 23,
      earliestTime: "2026-04-16 18:00",
      latestTime: "2026-04-17 11:30",
      trendDelta: 5,
    },
    aiSummary: null,
    lastAnalyzedAt: article.hasAnalysis ? "2026-04-17 10:15" : null,
  };

  // Mock reports
  reports = [
    {
      id: "nr-1", title: "AI手机产业链对国产芯片的推动作用", sourceOutlet: "人民日报",
      mediaLevel: "central", publishedAt: "2026-04-17T08:00:00Z", author: "科技部记者",
      summary: "人民日报从产业政策角度分析AI手机对国产芯片生态的推动...", sourceUrl: "#", contentType: "text",
      aiInterpretation: null,
    },
    {
      id: "nr-2", title: "AI手机价格战对消费者的实际影响调查", sourceOutlet: "新华社",
      mediaLevel: "central", publishedAt: "2026-04-17T07:30:00Z", author: "新华社记者",
      summary: "新华社从消费者权益视角，调查走访了多个城市的手机卖场...", sourceUrl: "#", contentType: "text",
      aiInterpretation: null,
    },
    {
      id: "nr-3", title: "中美AI手机技术差距深度对比", sourceOutlet: "央视新闻",
      mediaLevel: "central", publishedAt: "2026-04-17T09:00:00Z", author: "央视科技组",
      summary: "央视新闻从国际竞争力角度出发，对比中美AI手机技术水平...", sourceUrl: "#", contentType: "video",
      aiInterpretation: null,
    },
    {
      id: "nr-4", title: "三大品牌AI手机性能横评：谁才是真旗舰？", sourceOutlet: "澎湃新闻",
      mediaLevel: "provincial", publishedAt: "2026-04-17T10:00:00Z", author: "数码编辑部",
      summary: "澎湃新闻数码组拿到三款新机进行全方位性能横评...", sourceUrl: "#", contentType: "text",
      aiInterpretation: null,
    },
  ];

  // Mock competitor groups
  competitorGroups = [
    {
      level: "central", levelLabel: "央级媒体", levelColor: "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800/30",
      outlets: [
        { outletName: "人民日报", articles: [{ title: "AI手机产业链对国产芯片的推动作用", subject: "产业政策", publishedAt: "04-17 08:00", channel: "微信公众号", sourceUrl: "#" }] },
        { outletName: "新华社", articles: [{ title: "AI手机价格战对消费者的实际影响调查", subject: "消费者权益", publishedAt: "04-17 07:30", channel: "APP", sourceUrl: "#" }] },
        { outletName: "央视新闻", articles: [{ title: "中美AI手机技术差距深度对比", subject: "国际竞争力", publishedAt: "04-17 09:00", channel: "央视频", sourceUrl: "#" }] },
      ],
    },
    {
      level: "provincial", levelLabel: "省级媒体", levelColor: "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800/30",
      outlets: [
        { outletName: "澎湃新闻", articles: [{ title: "三大品牌AI手机性能横评", subject: "产品评测", publishedAt: "04-17 10:00", channel: "APP", sourceUrl: "#" }] },
        { outletName: "第一财经", articles: [{ title: "AI手机供应链成本结构拆解", subject: "供应链分析", publishedAt: "04-17 09:30", channel: "网站", sourceUrl: "#" }] },
      ],
    },
  ];

  return (
    <TopicDetailClient
      detail={detail}
      reports={reports}
      competitorGroups={competitorGroups}
    />
  );
}
```

- [ ] **Step 3: 创建 topic-detail-client.tsx (Client Component)**

3个子Tab的编排组件。

```typescript
"use client";

import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GlassCard } from "@/components/shared/glass-card";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, Globe, Newspaper, Users } from "lucide-react";
import type { TopicCompareDetail, NetworkReport, CompetitorGroup } from "@/lib/types";
import { OverviewTab } from "./overview-tab";
import { ArticlesTab } from "./articles-tab";
import { CompetitorTab } from "./competitor-tab";

const channelColors: Record<string, string> = {
  APP: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  微信: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  微博: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  抖音: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
};

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return String(n);
}

interface TopicDetailClientProps {
  detail: TopicCompareDetail;
  reports: NetworkReport[];
  competitorGroups: CompetitorGroup[];
}

export function TopicDetailClient({ detail, reports, competitorGroups }: TopicDetailClientProps) {
  const { article, stats } = detail;

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* 面包屑 + 信息栏 */}
      <div className="mb-4">
        <Link href="/topic-compare" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-3">
          <ArrowLeft size={12} /> 返回作品列表
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg text-gray-900 dark:text-gray-50 mb-2">{article.title}</h1>
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
              <span>发布时间：{new Date(article.publishedAt).toLocaleString("zh-CN")}</span>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <div className="flex gap-1">
                {article.channels.map((ch) => (
                  <span key={ch} className={`text-[10px] px-1.5 py-0.5 rounded ${channelColors[ch] || "bg-gray-100 text-gray-600"}`}>{ch}</span>
                ))}
              </div>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span>阅读 {formatCount(article.readCount)} · 点赞 {formatCount(article.likeCount)} · 评论 {formatCount(article.commentCount)} · 转发 {formatCount(article.shareCount)}</span>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-xs shrink-0">
            <RefreshCw size={12} className="mr-1" /> 刷新数据
          </Button>
        </div>
      </div>

      {/* KPI 卡片 */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        <StatCard label="全网报道总量" value={stats.totalReports} change={stats.trendDelta} />
        <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-3 text-center">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.centralCount}</div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">央级媒体报道</div>
        </div>
        <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-3 text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.provincialCount}</div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">省级媒体报道</div>
        </div>
        <StatCard label="其他媒体报道" value={stats.otherCount} />
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3 text-center">
          <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-relaxed">
            {stats.earliestTime}<br />~ {stats.latestTime}
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">报道时间跨度</div>
        </div>
      </div>

      {/* 3个子Tab */}
      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview"><Globe size={14} className="mr-1" />全网报道概览</TabsTrigger>
          <TabsTrigger value="articles"><Newspaper size={14} className="mr-1" />全网报道列表</TabsTrigger>
          <TabsTrigger value="competitors"><Users size={14} className="mr-1" />竞品媒体对标</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab detail={detail} />
        </TabsContent>
        <TabsContent value="articles">
          <ArticlesTab reports={reports} />
        </TabsContent>
        <TabsContent value="competitors">
          <CompetitorTab groups={competitorGroups} ourTitle={article.title} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 4: 创建 overview-tab.tsx（AI总结4板块）**

```typescript
"use client";

import { useState } from "react";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { RefreshCw, ChevronDown, ChevronUp, Copy, FileDown, ThumbsUp, ThumbsDown } from "lucide-react";
import type { TopicCompareDetail } from "@/lib/types";

const sections = [
  { key: "central", label: "官媒及央媒报道分析", tagColor: "bg-red-600", tagText: "央级媒体" },
  { key: "other", label: "其他媒体报道分析", tagColor: "bg-blue-600", tagText: "其他媒体" },
  { key: "highlights", label: "报道亮点与创新点", tagColor: "bg-amber-500", tagText: "💡 亮点" },
  { key: "summary", label: "整体报道总结", tagColor: "bg-gray-500", tagText: "📊 总结" },
];

// Mock AI summary content
const mockSummaryContent: Record<string, string> = {
  central: "3家央级媒体已报道。人民日报侧重产业政策解读视角，聚焦AI手机产业链对国产芯片的推动作用；新华社从消费者权益视角出发，关注价格战对消费者的实际影响；央视新闻从国际竞争力视角，对比中美AI手机技术差距。央级媒体普遍关注技术自主可控议题，引用了工信部、中国信通院的权威数据。",
  other: "省级媒体侧重本地产业链影响分析；都市媒体偏重用户实际评测体验和性价比对比；行业媒体深入技术参数和供应链成本拆解；自媒体聚焦性价比讨论和消费者购买建议。澎湃新闻的性能横评和第一财经的供应链分析较有深度。",
  highlights: "澎湃新闻独家获取三家厂商出货量内部数据做对比可视化（我方未涉及）。第一财经从供应链角度拆解成本结构（已覆盖）。建议借鉴：数据可视化驱动的深度报道方式，以及独家信源的开发策略。",
  summary: "该话题全网热度持续上升，央级媒体已全面跟进。我方报道时效性表现良好（首发媒体之一），但在深度数据可视化和国际对比角度上存在差距。建议追加深度报道，角度：AI手机出货量数据对比可视化，紧急程度：高。",
};

interface OverviewTabProps {
  detail: TopicCompareDetail;
}

export function OverviewTab({ detail }: OverviewTabProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggleCollapse(key: string) {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="space-y-3">
      {sections.map((section) => (
        <GlassCard key={section.key} padding="md">
          <div className="flex items-center gap-2 mb-3 cursor-pointer" onClick={() => toggleCollapse(section.key)}>
            <span className={`${section.tagColor} text-white text-[10px] px-2 py-0.5 rounded`}>
              {section.tagText}
            </span>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{section.label}</span>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2 text-gray-400" onClick={(e) => { e.stopPropagation(); }}>
              <RefreshCw size={10} className="mr-1" /> 重新生成
            </Button>
            {collapsed[section.key] ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronUp size={14} className="text-gray-400" />}
          </div>
          {!collapsed[section.key] && (
            <div className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              {mockSummaryContent[section.key]}
            </div>
          )}
        </GlassCard>
      ))}

      {/* 底部操作 */}
      <div className="flex items-center gap-3 pt-2">
        <Button variant="ghost" size="sm" className="text-xs text-gray-500">
          <Copy size={12} className="mr-1" /> 复制全文
        </Button>
        <Button variant="ghost" size="sm" className="text-xs text-gray-500">
          <FileDown size={12} className="mr-1" /> 导出文档
        </Button>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {detail.lastAnalyzedAt && <span>上次分析：{detail.lastAnalyzedAt}</span>}
          <Button variant="ghost" size="sm" className="h-6 px-2"><ThumbsUp size={12} /></Button>
          <Button variant="ghost" size="sm" className="h-6 px-2"><ThumbsDown size={12} /></Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 验证并提交**

```bash
npx tsc --noEmit
git add src/app/\(dashboard\)/topic-compare/\[id\]/
git commit -m "feat(topic-compare): add detail page with overview tab and AI summary panels"
```

---

### Task 5: 同题对比 - 报道列表Tab + 竞品对标Tab

**Files:**
- Create: `src/app/(dashboard)/topic-compare/[id]/articles-tab.tsx`
- Create: `src/app/(dashboard)/topic-compare/[id]/competitor-tab.tsx`

- [ ] **Step 1: 创建 articles-tab.tsx（全网报道列表）**

```typescript
"use client";

import { useState, useMemo } from "react";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Sparkles, ExternalLink } from "lucide-react";
import type { NetworkReport } from "@/lib/types";

const mediaLevelConfig: Record<string, { label: string; color: string }> = {
  central: { label: "央级", color: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" },
  provincial: { label: "省级", color: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" },
  city: { label: "市级", color: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" },
  industry: { label: "行业", color: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400" },
  self_media: { label: "自媒体", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

interface ArticlesTabProps {
  reports: NetworkReport[];
}

export function ArticlesTab({ reports }: ArticlesTabProps) {
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    let list = reports;
    if (levelFilter !== "all") list = list.filter((r) => r.mediaLevel === levelFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) => r.title.toLowerCase().includes(q) || r.sourceOutlet.toLowerCase().includes(q));
    }
    return list;
  }, [reports, levelFilter, searchQuery]);

  return (
    <div className="space-y-3">
      {/* 筛选区 */}
      <GlassCard padding="sm">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className={`text-xs h-7 ${levelFilter === "all" ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40" : ""}`} onClick={() => setLevelFilter("all")}>全部</Button>
            {Object.entries(mediaLevelConfig).map(([key, cfg]) => (
              <Button key={key} variant="ghost" size="sm" className={`text-xs h-7 ${levelFilter === key ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40" : ""}`} onClick={() => setLevelFilter(key)}>
                {cfg.label}
              </Button>
            ))}
          </div>
          <div className="flex-1" />
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="在结果中搜索..."
              className="text-xs pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 w-48"
            />
          </div>
        </div>
      </GlassCard>

      {/* 报道列表 */}
      {filtered.length === 0 ? (
        <GlassCard>
          <div className="text-center py-12 text-sm text-gray-400">未检索到相关报道</div>
        </GlassCard>
      ) : (
        <GlassCard padding="none">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400">报道标题</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 w-[120px]">来源媒体</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 w-[100px]">发布时间</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 w-[80px]">作者</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 w-[130px]">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((report) => {
                const level = mediaLevelConfig[report.mediaLevel];
                return (
                  <tr key={report.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-blue-50/30 dark:hover:bg-blue-950/10 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="text-gray-800 dark:text-gray-100 mb-1">{report.title}</div>
                      <div className="text-[11px] text-gray-400 dark:text-gray-500 line-clamp-1">{report.summary}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-800 dark:text-gray-200">{report.sourceOutlet}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${level.color}`}>{level.label}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-gray-500">{new Date(report.publishedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="py-3.5 px-4 text-xs text-gray-500">{report.author}</td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" className="text-xs h-6 px-2">
                          <Sparkles size={11} className="mr-1" /> AI解读
                        </Button>
                        <a href={report.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-500">
                          <ExternalLink size={13} />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400">
            共 {filtered.length} 篇报道
          </div>
        </GlassCard>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 创建 competitor-tab.tsx（竞品媒体对标）**

```typescript
"use client";

import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Sparkles, ExternalLink } from "lucide-react";
import type { CompetitorGroup } from "@/lib/types";

const levelBadgeConfig: Record<string, { label: string; color: string }> = {
  central: { label: "央级", color: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" },
  provincial: { label: "省级", color: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" },
  city: { label: "市级", color: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" },
  other: { label: "其他", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

interface CompetitorTabProps {
  groups: CompetitorGroup[];
  ourTitle: string;
}

export function CompetitorTab({ groups, ourTitle }: CompetitorTabProps) {
  if (groups.length === 0) {
    return (
      <GlassCard>
        <div className="text-center py-12 text-sm text-gray-400">暂无竞品媒体对标数据</div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const badge = levelBadgeConfig[group.level] || levelBadgeConfig.other;
        return (
          <GlassCard key={group.level} padding="none" className={group.levelColor}>
            {/* 分组标题 */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${badge.color}`}>{badge.label}</span>
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{group.levelLabel}</span>
              <span className="text-xs text-gray-400 ml-1">({group.outlets.length} 家)</span>
            </div>

            {group.outlets.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-gray-400">
                该级别竞品媒体暂无同题报道
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 w-[100px]">媒体名称</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 dark:text-gray-400">报道标题</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 w-[80px]">报道主体</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 w-[90px]">发布时间</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 w-[80px]">发布渠道</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 w-[110px]">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {group.outlets.flatMap((outlet) =>
                    outlet.articles.map((art, i) => (
                      <tr key={`${outlet.outletName}-${i}`} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-white/50 dark:hover:bg-gray-900/50 transition-colors">
                        <td className="py-3 px-4 text-xs font-medium text-gray-800 dark:text-gray-200">{outlet.outletName}</td>
                        <td className="py-3 px-4 text-xs text-gray-700 dark:text-gray-300">{art.title}</td>
                        <td className="py-3 px-4 text-xs text-gray-500">{art.subject}</td>
                        <td className="py-3 px-4 text-xs text-gray-500">{art.publishedAt}</td>
                        <td className="py-3 px-4 text-xs text-gray-500">{art.channel}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm" className="text-xs h-6 px-2">
                              <Sparkles size={11} className="mr-1" /> AI解读
                            </Button>
                            <a href={art.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-500">
                              <ExternalLink size={13} />
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </GlassCard>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: 验证并提交**

```bash
npx tsc --noEmit
git add src/app/\(dashboard\)/topic-compare/\[id\]/articles-tab.tsx src/app/\(dashboard\)/topic-compare/\[id\]/competitor-tab.tsx
git commit -m "feat(topic-compare): add articles list tab and competitor benchmarking tab"
```

---

### Task 6: 漏题筛查 - 列表页

**Files:**
- Create: `src/app/(dashboard)/missing-topics/page.tsx`
- Create: `src/app/(dashboard)/missing-topics/missing-topics-client.tsx`
- Create: `src/app/(dashboard)/missing-topics/loading.tsx`

- [ ] **Step 1: 创建 loading.tsx**

```typescript
import { PageHeaderSkeleton, TableSkeleton } from "@/components/shared/skeleton-loaders";

export default function MissingTopicsLoading() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-5 gap-3 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
        ))}
      </div>
      <TableSkeleton rows={8} />
    </div>
  );
}
```

- [ ] **Step 2: 创建 page.tsx (Server Component)**

```typescript
export const dynamic = "force-dynamic";

import { getCurrentUserOrg } from "@/lib/dal/auth";
import { MissingTopicsClient } from "./missing-topics-client";
import { missingTopicClues, missingTopicKPIs } from "@/data/benchmarking-data";
import type { MissingTopicClue, MissingTopicKPIs } from "@/lib/types";

export default async function MissingTopicsPage() {
  let clues: MissingTopicClue[] = [];
  let kpis: MissingTopicKPIs = missingTopicKPIs;

  try {
    const { organizationId } = await getCurrentUserOrg();
    // TODO: 对接真实 DAL — getMissingTopicClues(organizationId), getMissingTopicKPIs(organizationId)
    clues = missingTopicClues;
  } catch {
    clues = missingTopicClues;
  }

  return <MissingTopicsClient clues={clues} kpis={kpis} />;
}
```

- [ ] **Step 3: 创建 missing-topics-client.tsx (Client Component)**

包含KPI看板、筛选区和线索表格。篇幅较长但结构清晰——KPI卡片组 + 筛选条 + 表格 + 分页。

实现要点：
- 顶部5个KPI卡片：复用 StatCard，漏题数用红色，已处置用绿色
- 筛选区：来源类型标签切换 + 状态下拉 + 排序切换
- 表格：紧急程度图标 + 标题 + 来源标签 + 热度进度条 + 状态标签
- 疑似漏题行高亮（urgent=红底，normal=黄底）
- 多源交叉标签

参考 Task 3 的 `topic-compare-client.tsx` 结构，按照设计文档 Section 5.1 的字段和交互规格实现。

核心差异点：
- 热度进度条使用 `<div>` 宽度百分比 + 颜色按数值变化
- 来源标签颜色：社媒热榜=橙色、对标媒体=蓝色、舆情预警=红色
- 紧急程度图标：🔴/🟡/🟢 + 判定逻辑（热度>80且央级已报且<6h = urgent）
- 行高亮：`status === "suspected" && urgency === "urgent"` 加红色背景

- [ ] **Step 4: 验证并提交**

```bash
npx tsc --noEmit
git add src/app/\(dashboard\)/missing-topics/
git commit -m "feat(missing-topics): add list page with KPI dashboard and clue table"
```

---

### Task 7: 漏题筛查 - 详情页

**Files:**
- Create: `src/app/(dashboard)/missing-topics/[id]/page.tsx`
- Create: `src/app/(dashboard)/missing-topics/[id]/missing-detail-client.tsx`
- Create: `src/app/(dashboard)/missing-topics/[id]/source-panel.tsx`
- Create: `src/app/(dashboard)/missing-topics/[id]/analysis-panel.tsx`
- Create: `src/app/(dashboard)/missing-topics/[id]/action-bar.tsx`
- Create: `src/app/(dashboard)/missing-topics/[id]/loading.tsx`

- [ ] **Step 1: 创建 loading.tsx**

```typescript
import { PageHeaderSkeleton } from "@/components/shared/skeleton-loaders";

export default function MissingDetailLoading() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="h-96 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
        <div className="h-96 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 page.tsx (Server Component)**

```typescript
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { MissingDetailClient } from "./missing-detail-client";
import { missingTopicClues } from "@/data/benchmarking-data";
import type { MissingTopicDetail } from "@/lib/types";

export default async function MissingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let detail: MissingTopicDetail | null = null;

  try {
    await getCurrentUserOrg();
    // TODO: 对接真实 DAL — getMissingTopicDetail(organizationId, id)
  } catch {
    // fallback
  }

  // Mock
  const clue = missingTopicClues.find((c) => c.id === id);
  if (!clue) notFound();

  detail = {
    ...clue,
    sourceTags: clue.isMultiSource
      ? [clue.sourceType, "multi_source"]
      : [clue.sourceType],
    sourceUrl: "#",
    publishedAt: "2026-04-17T09:45:00Z",
    contentSummary: "科技部今日正式发布《人工智能安全发展白皮书（2026）》，全文共计8章42节，涵盖大模型安全评估框架、数据安全治理规范、AI伦理准则等核心议题。白皮书首次提出\"AI安全分级管理制度\"，将AI应用按风险等级分为四类...",
    contentLength: 3200,
    reportedBy: clue.competitors.map((name) => ({
      name,
      level: ["人民日报", "新华社", "央视新闻", "光明日报", "经济日报"].includes(name) ? "central" as const : "provincial" as const,
    })),
    aiAnalysis: null,
    linkedArticleId: null,
    linkedArticleTitle: null,
    pushedAt: null,
    pushedToSystem: null,
  };

  return <MissingDetailClient detail={detail} />;
}
```

- [ ] **Step 3: 创建 source-panel.tsx（左侧原文面板）**

展示漏题线索的原文信息：标题、来源标签组、元信息网格、内容摘要、已报道媒体列表。

实现参照设计文档 Section 5.2 左侧面板规格：
- 来源标签：社媒热榜=橙色🔥、对标媒体=蓝色📰、舆情预警=红色⚠️、多源交叉=紫色🔗
- 元信息网格：来源平台、发布时间、发现时间、热度进度条、原文链接
- 已报道媒体：按级别分色（央级红、省级蓝）

- [ ] **Step 4: 创建 analysis-panel.tsx（右侧AI分析面板）**

5个板块：4个通用板块（复用 overview-tab.tsx 的 section 结构）+ 补报建议板块。

补报建议板块（蓝色高亮卡片）包含：
- 紧急程度标识
- 建议角度列表（每个角度有"复制为选题"按钮）
- 风险提示区域

- [ ] **Step 5: 创建 action-bar.tsx（底部操作区）**

固定在底部的操作按钮组：
- 关联已有作品（触发搜索弹窗 — 后续对接）
- 确认为漏题
- 排除（弹出理由选择）
- 转为选题
- 推送处置（主操作按钮，蓝色）

每个操作调用对应的 server action（本期先做 UI 和基本交互，action 调用用 TODO 标注）。

- [ ] **Step 6: 创建 missing-detail-client.tsx（左右分栏编排）**

```typescript
"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { MissingTopicDetail } from "@/lib/types";
import { SourcePanel } from "./source-panel";
import { AnalysisPanel } from "./analysis-panel";
import { ActionBar } from "./action-bar";

const urgencyConfig: Record<string, { label: string; color: string }> = {
  urgent: { label: "🔴 紧急", color: "text-red-600" },
  normal: { label: "🟡 一般", color: "text-amber-600" },
  watch: { label: "🟢 关注", color: "text-green-600" },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  suspected: { label: "疑似漏题", color: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400" },
  confirmed: { label: "已确认漏题", color: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" },
  covered: { label: "已覆盖", color: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" },
  excluded: { label: "已排除", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  pushed: { label: "已推送", color: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" },
};

interface MissingDetailClientProps {
  detail: MissingTopicDetail;
}

export function MissingDetailClient({ detail }: MissingDetailClientProps) {
  const urgency = urgencyConfig[detail.urgency] || urgencyConfig.watch;
  const status = statusConfig[detail.status] || statusConfig.suspected;

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* 面包屑 + 状态 */}
      <div className="flex items-center justify-between mb-4">
        <Link href="/missing-topics" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <ArrowLeft size={12} /> 返回漏题列表
        </Link>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-xs ${status.color}`}>{status.label}</Badge>
          <span className={`text-xs ${urgency.color}`}>{urgency.label}</span>
        </div>
      </div>

      {/* 左右分栏 */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <SourcePanel detail={detail} />
        <AnalysisPanel detail={detail} />
      </div>

      {/* 底部操作区 */}
      <ActionBar detail={detail} />
    </div>
  );
}
```

- [ ] **Step 7: 验证并提交**

```bash
npx tsc --noEmit
git add src/app/\(dashboard\)/missing-topics/\[id\]/
git commit -m "feat(missing-topics): add detail page with source panel, AI analysis, and action bar"
```

---

### Task 8: 类型检查 + 构建验证 + 最终提交

**Files:** 无新文件

- [ ] **Step 1: TypeScript 类型检查**

```bash
npx tsc --noEmit
```

修复任何类型错误。

- [ ] **Step 2: 生产构建验证**

```bash
npm run build
```

修复任何构建错误（常见：import 路径错误、缺少 `force-dynamic`、Server/Client 组件边界问题）。

- [ ] **Step 3: 开发服务器手动验证**

```bash
npm run dev
```

验证清单：
- [ ] 侧边栏显示"同题对比"和"漏题筛查"两个独立入口
- [ ] `/topic-compare` 列表页正常渲染，筛选功能正常
- [ ] 点击作品进入 `/topic-compare/[id]` 详情页
- [ ] 详情页 3 个子 Tab 切换正常
- [ ] AI 总结 4 个板块支持折叠/展开
- [ ] `/missing-topics` 列表页正常渲染，KPI 看板显示
- [ ] 线索行高亮逻辑正确
- [ ] 点击线索进入 `/missing-topics/[id]` 详情页
- [ ] 左右分栏布局正确
- [ ] 底部操作按钮可见
- [ ] 旧路由 `/benchmarking` 仍然可以访问（未删除）

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "feat: complete benchmarking module UX redesign - topic-compare and missing-topics"
```
