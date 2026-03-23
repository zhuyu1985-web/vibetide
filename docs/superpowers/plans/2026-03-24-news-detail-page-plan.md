# 新闻稿件详情页实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完全重写新闻稿件详情页，实现三栏布局、Tiptap 富文本编辑器、AI 伴读伴写、批注系统、视频模式的全功能"第二大脑"工作台。

**Architecture:** Feature-Sliced 垂直切片架构，9 个功能模块各自独立。Zustand 管理跨模块 UI 协调状态，Feature Hooks 管理子系统。Server Component 获取数据，Client Component 处理交互。AI 使用 DeepSeek API（OpenAI 兼容接口）+ AI SDK v6 流式输出。

**Tech Stack:** Next.js 16 + TypeScript + Tailwind CSS v4 + Tiptap 2.x + Zustand 5 + AI SDK v6 + @ai-sdk/openai + Drizzle ORM + Supabase

**Spec:** `docs/superpowers/specs/2026-03-24-news-detail-page-design.md`

**Verification:** 每个 Task 完成后运行 `npx tsc --noEmit`，每个 Phase 完成后运行 `npm run build`。

---

## File Structure

```
src/app/(dashboard)/articles/[id]/
├── page.tsx                              ← Server Component（重写）
├── article-detail-client.tsx             ← Client 入口（完全重写）
├── store.ts                              ← Zustand 全局协调 store（新建）
├── types.ts                              ← 页面级类型定义（新建）
├── features/
│   ├── header/
│   │   ├── article-header.tsx            ← 顶部导航栏
│   │   ├── view-switcher.tsx             ← 4 视图切换
│   │   ├── appearance-popover.tsx        ← 阅读外观设置
│   │   └── actions-menu.tsx              ← 更多操作菜单
│   ├── reader/
│   │   ├── article-reader.tsx            ← 阅读模式主组件
│   │   ├── meta-header.tsx               ← 元信息头
│   │   ├── text-selection-menu.tsx        ← 划词气泡菜单
│   │   └── image-lightbox.tsx            ← 图片查看
│   ├── editor/
│   │   ├── article-editor.tsx            ← Tiptap 编辑器
│   │   ├── editor-toolbar.tsx            ← 工具栏
│   │   ├── slash-command.tsx             ← "/" 命令菜单
│   │   ├── bubble-menu-bar.tsx           ← 选中文本浮动栏
│   │   ├── editor-status-bar.tsx         ← 底部状态栏
│   │   └── extensions/
│   │       └── ai-highlight.ts           ← AI 内容高亮扩展
│   ├── ai-chat/
│   │   ├── ai-chat-panel.tsx             ← 左侧 AI 对话面板
│   │   ├── chat-message.tsx              ← 消息组件
│   │   ├── action-card.tsx               ← AI 操作卡片
│   │   ├── quick-commands.tsx            ← 快捷指令栏
│   │   ├── chat-input.tsx                ← 输入框
│   │   └── use-ai-chat.ts               ← 对话 hook
│   ├── ai-analysis/
│   │   ├── ai-analysis-panel.tsx         ← 右侧 AI 解读面板
│   │   ├── perspective-selector.tsx      ← 视角切换
│   │   ├── analysis-content.tsx          ← 解读内容渲染
│   │   └── use-ai-analysis.ts           ← 解读 hook
│   ├── annotations/
│   │   ├── annotations-panel.tsx         ← 批注列表面板
│   │   ├── annotation-card.tsx           ← 批注卡片
│   │   ├── floating-note.tsx             ← 浮顶悬浮笔记
│   │   └── use-annotations.ts           ← 批注 hook
│   ├── video-player/
│   │   ├── video-player.tsx              ← 视频播放器
│   │   ├── player-controls.tsx           ← 控制栏
│   │   └── use-video-player.ts          ← 播放器 hook
│   ├── transcript/
│   │   ├── transcript-panel.tsx          ← 听记面板
│   │   ├── transcript-segment.tsx        ← 单条听记
│   │   └── use-transcript.ts            ← 听记 hook
│   └── outline/
│       ├── outline-panel.tsx             ← 智能大纲
│       ├── video-chapters.tsx            ← 视频章节
│       └── use-outline.ts               ← 大纲 hook
├── hooks/
│   └── use-article-context.ts            ← 文章上下文 hook
├── data/
│   └── mock-video.ts                     ← 视频模式 Mock 数据

src/db/schema/
├── enums.ts                              ← 新增 3 个 enum（修改）
├── article-annotations.ts                ← 批注表（新建）
├── article-ai-analysis.ts               ← AI 解读缓存表（新建）
├── article-chat-history.ts              ← 对话历史表（新建）
└── articles.ts                           ← 新增字段（修改）

src/lib/dal/
├── annotations.ts                        ← 批注 DAL（新建）
├── ai-analysis.ts                        ← AI 解读 DAL（新建）

src/app/actions/
├── annotations.ts                        ← 批注 Actions（新建）
├── ai-analysis.ts                        ← AI 解读 Actions（新建）

src/app/api/ai/
├── chat/route.ts                         ← AI 对话 API（新建）
├── analysis/route.ts                     ← AI 解读 API（新建）
└── edit/route.ts                         ← AI 编辑 API（新建）
```

---

## Phase 1 — MVP 核心骨架

### Task 1: 安装依赖 + 数据库 Schema 扩展

**Files:**
- Modify: `package.json`
- Modify: `src/db/schema/enums.ts`
- Create: `src/db/schema/article-annotations.ts`
- Create: `src/db/schema/article-ai-analysis.ts`
- Create: `src/db/schema/article-chat-history.ts`
- Modify: `src/db/schema/articles.ts`

- [ ] **Step 1: 安装 Tiptap + Zustand + @ai-sdk/openai**

> **Note:** `updateArticle` 已存在于 `src/app/actions/articles.ts`，无需新增。Glass UI CSS 变量 (`--glass-panel-bg`, `--glass-border`, `--ease-glass`) 已在 `src/app/globals.css` 中定义。DAL 函数 (`getAnnotations`, `getAIAnalysisCache`) 在 Task 10 (Phase 2) 中创建，Phase 1 使用空数组占位。

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/pm @tiptap/extension-underline @tiptap/extension-text-align @tiptap/extension-text-style @tiptap/extension-color @tiptap/extension-highlight @tiptap/extension-image @tiptap/extension-link @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header @tiptap/extension-task-list @tiptap/extension-task-item @tiptap/extension-code-block-lowlight @tiptap/extension-placeholder @tiptap/extension-character-count @tiptap/extension-dropcursor @tiptap/extension-typography @tiptap/extension-subscript @tiptap/extension-superscript lowlight zustand @ai-sdk/openai@^1.0.0
```

- [ ] **Step 2: 新增 Drizzle Enums**

在 `src/db/schema/enums.ts` 文件末尾添加：

```typescript
export const annotationColorEnum = pgEnum("annotation_color", [
  "red", "yellow", "green", "blue", "purple",
]);

export const aiAnalysisPerspectiveEnum = pgEnum("ai_analysis_perspective", [
  "summary", "journalist", "quotes", "timeline", "qa", "deep",
]);

export const aiSentimentEnum = pgEnum("ai_sentiment", [
  "neutral", "bullish", "critical", "advertorial",
]);
```

- [ ] **Step 3: 创建 article_annotations Schema**

创建 `src/db/schema/article-annotations.ts`：

```typescript
import { pgTable, uuid, text, integer, numeric, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { articles } from "./articles";
import { organizations } from "./organizations"; // 如果存在
import { annotationColorEnum } from "./enums";

export const articleAnnotations = pgTable("article_annotations", {
  id: uuid("id").primaryKey().defaultRandom(),
  articleId: uuid("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").notNull(),
  userId: uuid("user_id").notNull(),
  quote: text("quote").notNull(),
  note: text("note"),
  color: annotationColorEnum("color").notNull().default("yellow"),
  position: integer("position").notNull().default(0),
  timecode: numeric("timecode"),
  frameSnapshot: text("frame_snapshot"),
  isPinned: boolean("is_pinned").notNull().default(false),
  pinnedPosition: jsonb("pinned_position").$type<{ x: number; y: number } | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const articleAnnotationsRelations = relations(articleAnnotations, ({ one }) => ({
  article: one(articles, { fields: [articleAnnotations.articleId], references: [articles.id] }),
}));
```

- [ ] **Step 4: 创建 article_ai_analysis Schema**

创建 `src/db/schema/article-ai-analysis.ts`：

```typescript
import { pgTable, uuid, text, jsonb, timestamp, unique } from "drizzle-orm/pg-core";
import { articles } from "./articles";
import { aiAnalysisPerspectiveEnum, aiSentimentEnum } from "./enums";

export const articleAiAnalysis = pgTable("article_ai_analysis", {
  id: uuid("id").primaryKey().defaultRandom(),
  articleId: uuid("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").notNull(),
  perspective: aiAnalysisPerspectiveEnum("perspective").notNull(),
  analysisText: text("analysis_text").notNull(),
  sentiment: aiSentimentEnum("sentiment"),
  metadata: jsonb("metadata"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("article_ai_analysis_unique").on(table.articleId, table.perspective),
]);
```

- [ ] **Step 5: 创建 article_chat_history Schema**

创建 `src/db/schema/article-chat-history.ts`：

```typescript
import { pgTable, uuid, text, varchar, jsonb, timestamp } from "drizzle-orm/pg-core";
import { articles } from "./articles";

export const articleChatHistory = pgTable("article_chat_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  articleId: uuid("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull(),
  role: varchar("role", { length: 10 }).notNull(), // 'user' | 'assistant'
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 6: 扩展 articles 表**

在 `src/db/schema/articles.ts` 的 articles 表定义中添加字段：

```typescript
  webArchiveHtml: text("web_archive_html"),
  webArchiveAt: timestamp("web_archive_at", { withTimezone: true }),
  readProgress: integer("read_progress").default(0),
  transcript: jsonb("transcript"),
  chapters: jsonb("chapters"),
```

- [ ] **Step 7: 生成并应用迁移**

```bash
npm run db:generate
npm run db:push
```

- [ ] **Step 8: 验证类型**

```bash
npx tsc --noEmit
```

- [ ] **Step 9: 提交**

```bash
git add -A
git commit -m "feat: add article detail page database schema (annotations, ai_analysis, chat_history)"
```

---

### Task 2: 页面级类型 + Zustand Store + 共享 Hook

**Files:**
- Create: `src/app/(dashboard)/articles/[id]/types.ts`
- Create: `src/app/(dashboard)/articles/[id]/store.ts`
- Create: `src/app/(dashboard)/articles/[id]/hooks/use-article-context.ts`

- [ ] **Step 1: 创建页面级类型定义**

创建 `src/app/(dashboard)/articles/[id]/types.ts`：

```typescript
import type { ArticleDetail } from "@/lib/types";

// 批注类型
export type AnnotationColor = "red" | "yellow" | "green" | "blue" | "purple";

export interface Annotation {
  id: string;
  articleId: string;
  quote: string;
  note?: string;
  color: AnnotationColor;
  position: number;
  timecode?: number;
  frameSnapshot?: string;
  isPinned: boolean;
  pinnedPosition?: { x: number; y: number } | null;
  createdAt: string;
  updatedAt: string;
}

// AI 解读类型
export type AIAnalysisPerspective = "summary" | "journalist" | "quotes" | "timeline" | "qa" | "deep";
export type AISentiment = "neutral" | "bullish" | "critical" | "advertorial";

export interface AIAnalysisCacheItem {
  id: string;
  articleId: string;
  perspective: AIAnalysisPerspective;
  analysisText: string;
  sentiment?: AISentiment;
  metadata?: Record<string, unknown>;
  generatedAt: string;
}

// 视频模式类型
export interface TranscriptSegment {
  id: string;
  speaker: string;
  speakerLabel?: string;
  startTime: number;
  endTime: number;
  text: string;
  correctedText?: string;
}

export interface VideoChapter {
  title: string;
  startTime: number;
  endTime: number;
}

// 页面 Props
export interface ArticleDetailClientProps {
  article: ArticleDetail;
  initialAnnotations: Annotation[];
  initialAIAnalysis: AIAnalysisCacheItem[];
}

// 视图模式
export type ViewMode = "read" | "edit";
export type ContentType = "article" | "video";
export type ActiveView = "immersive" | "web" | "brief" | "archive";
export type LeftTab = "outline" | "chat" | "history";
export type RightTab = "analysis" | "annotations" | "transcript";

// 阅读外观
export interface AppearanceSettings {
  fontSize: number;
  lineHeight: "compact" | "comfortable" | "loose";
  margins: "narrow" | "standard" | "wide";
  theme: "light" | "dark" | "sepia" | "system";
  fontFamily: "system" | "serif" | "sans" | "mono";
}
```

- [ ] **Step 2: 创建 Zustand Store**

创建 `src/app/(dashboard)/articles/[id]/store.ts`：

```typescript
import { create } from "zustand";
import type {
  ViewMode,
  ContentType,
  ActiveView,
  LeftTab,
  RightTab,
} from "./types";

interface ArticlePageStore {
  // 模式状态
  viewMode: ViewMode;
  contentType: ContentType;
  activeView: ActiveView;

  // 面板状态
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  leftTab: LeftTab;
  rightTab: RightTab;
  zenMode: boolean;

  // 跨组件联动
  selectedText: string | null;
  selectedRange: { from: number; to: number } | null;
  scrollToPosition: number | null;
  highlightAnnotationId: string | null;

  // Actions
  setViewMode: (mode: ViewMode) => void;
  setContentType: (type: ContentType) => void;
  setActiveView: (view: ActiveView) => void;
  setLeftTab: (tab: LeftTab) => void;
  setRightTab: (tab: RightTab) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  toggleZenMode: () => void;
  setSelectedText: (text: string | null, range?: { from: number; to: number }) => void;
  scrollToAnnotation: (annotationId: string) => void;
  clearScrollTarget: () => void;
}

export const useArticlePageStore = create<ArticlePageStore>((set) => ({
  viewMode: "read",
  contentType: "article",
  activeView: "immersive",
  leftPanelOpen: true,
  rightPanelOpen: true,
  leftTab: "outline",
  rightTab: "analysis",
  zenMode: false,
  selectedText: null,
  selectedRange: null,
  scrollToPosition: null,
  highlightAnnotationId: null,

  setViewMode: (mode) => set({ viewMode: mode }),
  setContentType: (type) => set({ contentType: type }),
  setActiveView: (view) => set({ activeView: view }),
  setLeftTab: (tab) => set({ leftTab: tab }),
  setRightTab: (tab) => set({ rightTab: tab }),
  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen, zenMode: false })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen, zenMode: false })),
  toggleZenMode: () =>
    set((s) => ({
      zenMode: !s.zenMode,
      leftPanelOpen: s.zenMode, // 退出禅模式恢复
      rightPanelOpen: s.zenMode,
    })),
  setSelectedText: (text, range) =>
    set({ selectedText: text, selectedRange: range ?? null }),
  scrollToAnnotation: (id) =>
    set({ highlightAnnotationId: id, scrollToPosition: Date.now() }),
  clearScrollTarget: () =>
    set({ highlightAnnotationId: null, scrollToPosition: null }),
}));
```

- [ ] **Step 3: 创建文章上下文 Hook**

创建 `src/app/(dashboard)/articles/[id]/hooks/use-article-context.ts`：

```typescript
"use client";

import { useState, useCallback } from "react";
import type { AppearanceSettings } from "../types";

const STORAGE_KEY = "article-appearance";

const DEFAULT_APPEARANCE: AppearanceSettings = {
  fontSize: 16,
  lineHeight: "comfortable",
  margins: "standard",
  theme: "system",
  fontFamily: "system",
};

export function useAppearance() {
  const [appearance, setAppearanceState] = useState<AppearanceSettings>(() => {
    if (typeof window === "undefined") return DEFAULT_APPEARANCE;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...DEFAULT_APPEARANCE, ...JSON.parse(stored) } : DEFAULT_APPEARANCE;
    } catch {
      return DEFAULT_APPEARANCE;
    }
  });

  const setAppearance = useCallback(
    (updates: Partial<AppearanceSettings>) => {
      setAppearanceState((prev) => {
        const next = { ...prev, ...updates };
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
    },
    []
  );

  return { appearance, setAppearance };
}
```

- [ ] **Step 4: 验证类型**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: add article page types, Zustand store, and appearance hook"
```

---

### Task 3: 三栏布局壳 + 面板折叠

**Files:**
- Rewrite: `src/app/(dashboard)/articles/[id]/article-detail-client.tsx`
- Rewrite: `src/app/(dashboard)/articles/[id]/page.tsx`

- [ ] **Step 1: 重写 Server Component page.tsx**

重写 `src/app/(dashboard)/articles/[id]/page.tsx`：

```typescript
import { notFound } from "next/navigation";
import { getArticle } from "@/lib/dal/articles"; // 已有 DAL 不变，后续 Task 加 annotations/ai_analysis
import ArticleDetailClient from "./article-detail-client";

export const dynamic = "force-dynamic";

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const article = await getArticle(id).catch(() => null);
  if (!article) notFound();

  return (
    <ArticleDetailClient
      article={article}
      initialAnnotations={[]}
      initialAIAnalysis={[]}
    />
  );
}
```

- [ ] **Step 2: 重写 Client 入口 — 三栏布局**

重写 `src/app/(dashboard)/articles/[id]/article-detail-client.tsx`：

```typescript
"use client";

import { useArticlePageStore } from "./store";
import { useAppearance } from "./hooks/use-article-context";
import type { ArticleDetailClientProps } from "./types";
import { cn } from "@/lib/utils";

export default function ArticleDetailClient({
  article,
  initialAnnotations,
  initialAIAnalysis,
}: ArticleDetailClientProps) {
  const {
    leftPanelOpen,
    rightPanelOpen,
    zenMode,
    viewMode,
    contentType,
  } = useArticlePageStore();
  const { appearance } = useAppearance();

  // 根据 article.mediaType 判断内容类型
  const isVideo = article.mediaType === "video";

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {/* 阅读进度条 */}
      <div className="h-0.5 bg-muted">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300"
          style={{ width: "0%" }}
        />
      </div>

      {/* 顶部导航栏 - placeholder */}
      <div className="h-12 flex items-center justify-between px-4 border-b border-[var(--glass-border)] bg-[var(--glass-panel-bg)] backdrop-blur-xl shrink-0">
        <div className="text-sm text-muted-foreground">
          ← 稿件管理 / {article.categoryName ?? "未分类"} / {article.title.slice(0, 20)}...
        </div>
        <div className="text-xs text-muted-foreground">
          [视图切换器占位]
        </div>
        <div className="text-xs text-muted-foreground">
          [工具栏占位]
        </div>
      </div>

      {/* 三栏主体 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧栏 */}
        <div
          className={cn(
            "border-r border-[var(--glass-border)] bg-[var(--glass-panel-bg)] backdrop-blur-xl transition-all duration-300 ease-[var(--ease-glass)] overflow-hidden shrink-0",
            leftPanelOpen ? "w-[22%] min-w-[280px]" : "w-7"
          )}
        >
          {leftPanelOpen ? (
            <div className="flex flex-col h-full">
              <div className="p-3 text-sm font-medium border-b border-[var(--glass-border)] flex items-center justify-between">
                <span>✦ AI 助手</span>
                <button
                  className="text-muted-foreground hover:text-foreground text-xs"
                  onClick={() => useArticlePageStore.getState().toggleLeftPanel()}
                >
                  ◀
                </button>
              </div>
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                [左侧面板内容占位]
              </div>
            </div>
          ) : (
            <button
              className="w-full h-full flex items-start justify-center pt-3 text-blue-500 hover:text-blue-400"
              onClick={() => useArticlePageStore.getState().toggleLeftPanel()}
            >
              ✦
            </button>
          )}
        </div>

        {/* 中间核心区域 */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[680px] mx-auto px-8 py-6">
            {/* 元信息头 placeholder */}
            <h1 className="text-2xl font-bold mb-3">{article.title}</h1>
            <div className="text-sm text-muted-foreground mb-4">
              {article.assigneeName ?? "未知来源"} · {article.updatedAt}
            </div>
            {/* 正文 placeholder */}
            <div
              className="prose prose-invert max-w-none leading-relaxed"
              dangerouslySetInnerHTML={{ __html: article.body ?? "" }}
            />
          </div>
        </div>

        {/* 右侧栏 */}
        <div
          className={cn(
            "border-l border-[var(--glass-border)] bg-[var(--glass-panel-bg)] backdrop-blur-xl transition-all duration-300 ease-[var(--ease-glass)] overflow-hidden shrink-0",
            rightPanelOpen ? "w-[27%] min-w-[300px]" : "w-7"
          )}
        >
          {rightPanelOpen ? (
            <div className="flex flex-col h-full">
              <div className="flex border-b border-[var(--glass-border)] text-xs">
                <span className="flex-1 text-center py-2 text-blue-500 border-b-2 border-blue-500">AI 解读</span>
                <span className="flex-1 text-center py-2 text-muted-foreground">批注</span>
                <span className="flex-1 text-center py-2 text-muted-foreground">听记</span>
              </div>
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                [右侧面板内容占位]
              </div>
            </div>
          ) : (
            <button
              className="w-full h-full flex items-start justify-center pt-3 text-muted-foreground hover:text-foreground"
              onClick={() => useArticlePageStore.getState().toggleRightPanel()}
            >
              📝
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 验证类型 + 本地预览**

```bash
npx tsc --noEmit
npm run dev
# 访问 /articles/[任意已有文章id] 确认三栏布局渲染
```

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat: implement three-column layout shell with panel collapse"
```

---

### Task 4: 顶部导航栏 (Header Feature)

**Files:**
- Create: `src/app/(dashboard)/articles/[id]/features/header/article-header.tsx`
- Create: `src/app/(dashboard)/articles/[id]/features/header/view-switcher.tsx`
- Modify: `src/app/(dashboard)/articles/[id]/article-detail-client.tsx`

- [ ] **Step 1: 创建视图切换器**

创建 `src/app/(dashboard)/articles/[id]/features/header/view-switcher.tsx`：

```typescript
"use client";

import { useArticlePageStore } from "../../store";
import type { ActiveView } from "../../types";
import { cn } from "@/lib/utils";

const VIEWS: { key: ActiveView; label: string }[] = [
  { key: "immersive", label: "沉浸阅读" },
  { key: "web", label: "原始网页" },
  { key: "brief", label: "AI 速览" },
  { key: "archive", label: "网页存档" },
];

export function ViewSwitcher() {
  const { activeView, setActiveView } = useArticlePageStore();

  return (
    <div className="flex bg-muted/50 rounded-md overflow-hidden text-xs">
      {VIEWS.map((v) => (
        <button
          key={v.key}
          className={cn(
            "px-3 py-1.5 transition-colors",
            activeView === v.key
              ? "bg-blue-500 text-white"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setActiveView(v.key)}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 创建顶部导航栏**

创建 `src/app/(dashboard)/articles/[id]/features/header/article-header.tsx`：

```typescript
"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, Pencil, Type, Sparkles, PenLine, MoreHorizontal } from "lucide-react";
import { useArticlePageStore } from "../../store";
import { ViewSwitcher } from "./view-switcher";
import type { ArticleDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ArticleHeaderProps {
  article: ArticleDetail;
  annotationCount: number;
}

export function ArticleHeader({ article, annotationCount }: ArticleHeaderProps) {
  const router = useRouter();
  const { viewMode, setViewMode, setRightTab, toggleRightPanel, rightPanelOpen } =
    useArticlePageStore();

  const handleAnnotationClick = () => {
    if (!rightPanelOpen) toggleRightPanel();
    setRightTab("annotations");
  };

  const handleAIClick = () => {
    if (!rightPanelOpen) toggleRightPanel();
    setRightTab("analysis");
  };

  return (
    <div className="h-12 flex items-center justify-between px-4 border-b border-[var(--glass-border)] bg-[var(--glass-panel-bg)] backdrop-blur-xl shrink-0">
      {/* 左侧：导航 */}
      <div className="flex items-center gap-2 text-sm">
        <button
          className="text-muted-foreground hover:text-foreground"
          onClick={() => router.push("/articles")}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-muted-foreground">/</span>
        <span className="text-muted-foreground">稿件管理</span>
        {article.categoryName && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground">{article.categoryName}</span>
          </>
        )}
      </div>

      {/* 中间：视图切换 */}
      <ViewSwitcher />

      {/* 右侧：工具栏 */}
      <div className="flex items-center gap-1">
        {/* 阅读/编辑切换 */}
        <button
          className={cn(
            "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-colors",
            viewMode === "read"
              ? "bg-blue-500/10 text-blue-500"
              : "bg-green-500/10 text-green-500"
          )}
          onClick={() => setViewMode(viewMode === "read" ? "edit" : "read")}
        >
          {viewMode === "read" ? <Eye className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
          {viewMode === "read" ? "阅读" : "编辑"}
        </button>

        {/* 外观 */}
        <button className="p-2 text-muted-foreground hover:text-foreground rounded-md">
          <Type className="w-4 h-4" />
        </button>

        {/* AI 解读 */}
        <button
          className="p-2 text-muted-foreground hover:text-foreground rounded-md"
          onClick={handleAIClick}
        >
          <Sparkles className="w-4 h-4" />
        </button>

        {/* 批注 */}
        <button
          className="p-2 text-muted-foreground hover:text-foreground rounded-md relative"
          onClick={handleAnnotationClick}
        >
          <PenLine className="w-4 h-4" />
          {annotationCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] px-1 rounded-full min-w-[14px] text-center">
              {annotationCount}
            </span>
          )}
        </button>

        {/* 更多 */}
        <button className="p-2 text-muted-foreground hover:text-foreground rounded-md">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 在 article-detail-client.tsx 中替换 header 占位**

将 `article-detail-client.tsx` 中的 header 占位 div 替换为：

```typescript
import { ArticleHeader } from "./features/header/article-header";

// 在组件内：
<ArticleHeader article={article} annotationCount={initialAnnotations.length} />
```

- [ ] **Step 4: 验证类型**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: add article header with view switcher and toolbar"
```

---

### Task 5: 阅读模式 (Reader Feature)

**Files:**
- Create: `src/app/(dashboard)/articles/[id]/features/reader/meta-header.tsx`
- Create: `src/app/(dashboard)/articles/[id]/features/reader/article-reader.tsx`
- Modify: `src/app/(dashboard)/articles/[id]/article-detail-client.tsx`

- [ ] **Step 1: 创建元信息头组件**

创建 `src/app/(dashboard)/articles/[id]/features/reader/meta-header.tsx`：

```typescript
"use client";

import type { ArticleDetail } from "@/lib/types";

interface MetaHeaderProps {
  article: ArticleDetail;
}

export function MetaHeader({ article }: MetaHeaderProps) {
  const readTime = Math.max(1, Math.ceil((article.wordCount || 0) / 500));
  const tags = article.tags ?? [];

  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold leading-tight mb-3">
        {article.title}
      </h1>

      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
        {/* 来源图标 */}
        <span className="w-4 h-4 bg-red-500 rounded text-[8px] text-white flex items-center justify-center shrink-0">
          {(article.assigneeName ?? "?")[0]}
        </span>
        <span className="text-foreground/80">{article.assigneeName ?? "未知来源"}</span>
        <span className="text-muted-foreground/40">·</span>
        <span>发布 {article.publishedAt ?? article.createdAt}</span>
        <span className="text-muted-foreground/40">·</span>
        <span>约 {readTime} 分钟读完 · {article.wordCount ?? 0} 字</span>
      </div>

      {tags.length > 0 && (
        <div className="flex items-center gap-1.5 mb-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded"
            >
              {tag}
            </span>
          ))}
          <button className="text-[10px] px-1.5 py-0.5 border border-dashed border-muted-foreground/30 text-muted-foreground rounded">
            + 标签
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 创建阅读模式主组件**

创建 `src/app/(dashboard)/articles/[id]/features/reader/article-reader.tsx`：

```typescript
"use client";

import type { ArticleDetail } from "@/lib/types";
import type { AppearanceSettings } from "../../types";
import { MetaHeader } from "./meta-header";
import { cn } from "@/lib/utils";

interface ArticleReaderProps {
  article: ArticleDetail;
  appearance: AppearanceSettings;
}

const LINE_HEIGHT_MAP = {
  compact: "leading-relaxed",    // 1.625
  comfortable: "leading-loose",  // 2.0
  loose: "[line-height:2.25]",
};

const MARGIN_MAP = {
  narrow: "max-w-[560px]",
  standard: "max-w-[680px]",
  wide: "max-w-[800px]",
};

const FONT_MAP = {
  system: "font-sans",
  serif: "font-serif",
  sans: "font-sans",
  mono: "font-mono",
};

export function ArticleReader({ article, appearance }: ArticleReaderProps) {
  return (
    <div className={cn("mx-auto px-8 py-6", MARGIN_MAP[appearance.margins])}>
      <MetaHeader article={article} />

      <div className="h-px bg-border mb-5" />

      <article
        className={cn(
          "prose dark:prose-invert max-w-none",
          LINE_HEIGHT_MAP[appearance.lineHeight],
          FONT_MAP[appearance.fontFamily],
          "prose-blockquote:border-l-blue-500 prose-blockquote:bg-blue-500/5",
          "prose-img:rounded-lg",
          "prose-code:bg-muted prose-code:px-1 prose-code:rounded",
        )}
        style={{ fontSize: `${appearance.fontSize}px` }}
        dangerouslySetInnerHTML={{ __html: article.body ?? "<p>暂无正文内容</p>" }}
      />
    </div>
  );
}
```

- [ ] **Step 3: 在 article-detail-client.tsx 中集成 Reader**

替换中间核心区域的占位内容：

```typescript
import { ArticleReader } from "./features/reader/article-reader";

// 在中间区域：
<div className="flex-1 overflow-y-auto">
  <ArticleReader article={article} appearance={appearance} />
</div>
```

- [ ] **Step 4: 验证**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: add article reader with meta header and appearance settings"
```

---

### Task 6: Tiptap 编辑器基础 (Editor Feature)

**Files:**
- Create: `src/app/(dashboard)/articles/[id]/features/editor/article-editor.tsx`
- Create: `src/app/(dashboard)/articles/[id]/features/editor/editor-toolbar.tsx`
- Create: `src/app/(dashboard)/articles/[id]/features/editor/editor-status-bar.tsx`
- Modify: `src/app/(dashboard)/articles/[id]/article-detail-client.tsx`

- [ ] **Step 1: 创建编辑器工具栏**

创建 `src/app/(dashboard)/articles/[id]/features/editor/editor-toolbar.tsx`：

```typescript
"use client";

import type { Editor } from "@tiptap/react";
import {
  Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, CheckSquare,
  Quote, Minus, Code2,
  Link2, ImageIcon, Paperclip,
  Undo, Redo, Save, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EditorToolbarProps {
  editor: Editor | null;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

function ToolButton({
  icon: Icon,
  active = false,
  onClick,
  title,
}: {
  icon: React.ElementType;
  active?: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      className={cn(
        "p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors",
        active && "bg-blue-500/15 text-blue-500"
      )}
      onClick={onClick}
      title={title}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

function Separator() {
  return <div className="w-px h-4 bg-border mx-1" />;
}

export function EditorToolbar({ editor, onSave, onCancel, isSaving }: EditorToolbarProps) {
  if (!editor) return null;

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-[var(--glass-border)] bg-[var(--glass-panel-bg)] backdrop-blur-xl flex-wrap">
      {/* 标题 */}
      <div className="flex gap-0.5 bg-muted/30 rounded p-0.5">
        {[1, 2, 3].map((level) => (
          <button
            key={level}
            className={cn(
              "px-1.5 py-0.5 text-[10px] rounded",
              editor.isActive("heading", { level })
                ? "bg-blue-500/15 text-blue-500"
                : "text-muted-foreground"
            )}
            onClick={() => editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run()}
          >
            H{level}
          </button>
        ))}
      </div>

      <Separator />

      {/* 文本格式 */}
      <ToolButton icon={Bold} active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="加粗" />
      <ToolButton icon={Italic} active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="斜体" />
      <ToolButton icon={Underline} active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="下划线" />
      <ToolButton icon={Strikethrough} active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="删除线" />

      <Separator />

      {/* 列表 */}
      <ToolButton icon={List} active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="无序列表" />
      <ToolButton icon={ListOrdered} active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="有序列表" />
      <ToolButton icon={CheckSquare} active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()} title="任务列表" />

      <Separator />

      {/* 块元素 */}
      <ToolButton icon={Quote} active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="引用" />
      <ToolButton icon={Minus} active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="分割线" />
      <ToolButton icon={Code2} active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="代码块" />

      <Separator />

      {/* 媒体 */}
      <ToolButton icon={Link2} active={editor.isActive("link")} onClick={() => {
        const url = window.prompt("输入链接 URL");
        if (url) editor.chain().focus().setLink({ href: url }).run();
      }} title="链接" />
      <ToolButton icon={ImageIcon} active={false} onClick={() => {
        const url = window.prompt("输入图片 URL");
        if (url) editor.chain().focus().setImage({ src: url }).run();
      }} title="图片" />

      <div className="flex-1" />

      {/* 撤销/重做 */}
      <ToolButton icon={Undo} active={false} onClick={() => editor.chain().focus().undo().run()} title="撤销" />
      <ToolButton icon={Redo} active={false} onClick={() => editor.chain().focus().redo().run()} title="重做" />

      <Separator />

      {/* 保存/取消 */}
      <button
        className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-500 transition-colors"
        onClick={onSave}
        disabled={isSaving}
      >
        <Save className="w-3 h-3" />
        {isSaving ? "保存中..." : "保存"}
      </button>
      <button
        className="flex items-center gap-1 px-3 py-1 text-muted-foreground text-xs rounded-md hover:text-foreground transition-colors"
        onClick={onCancel}
      >
        取消
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 创建编辑器状态栏**

创建 `src/app/(dashboard)/articles/[id]/features/editor/editor-status-bar.tsx`：

```typescript
"use client";

interface EditorStatusBarProps {
  characterCount: number;
  wordCount: number;
  lastSavedAt: string | null;
}

export function EditorStatusBar({ characterCount, wordCount, lastSavedAt }: EditorStatusBarProps) {
  return (
    <div className="flex justify-between px-4 py-2 border-t border-border text-[10px] text-muted-foreground">
      <span>{wordCount} 字 · {characterCount} 字符</span>
      <div className="flex gap-3">
        {lastSavedAt && (
          <span className="text-green-500">● 自动保存于 {lastSavedAt}</span>
        )}
        <span>Markdown 快捷键已启用</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 创建 Tiptap 编辑器主组件**

创建 `src/app/(dashboard)/articles/[id]/features/editor/article-editor.tsx`：

```typescript
"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import Typography from "@tiptap/extension-typography";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { updateArticle } from "@/app/actions/articles";
import { useArticlePageStore } from "../../store";
import { EditorToolbar } from "./editor-toolbar";
import { EditorStatusBar } from "./editor-status-bar";
import type { ArticleDetail } from "@/lib/types";

interface ArticleEditorProps {
  article: ArticleDetail;
}

export function ArticleEditor({ article }: ArticleEditorProps) {
  const { setViewMode } = useArticlePageStore();
  const [isPending, startTransition] = useTransition();
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const originalContentRef = useRef(article.body ?? "");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: false }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "开始编写..." }),
      CharacterCount,
      Typography,
      Subscript,
      Superscript,
    ],
    content: article.body ?? "",
    editorProps: {
      attributes: {
        class: "prose dark:prose-invert max-w-none focus:outline-none min-h-[300px] px-8 py-6",
      },
    },
    onUpdate: () => {
      // 防抖自动保存 3 秒
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => handleAutoSave(), 3000);
    },
  });

  const handleAutoSave = useCallback(() => {
    if (!editor) return;
    const html = editor.getHTML();
    startTransition(async () => {
      await updateArticle(article.id, { body: html });
      setLastSavedAt(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
    });
  }, [editor, article.id]);

  const handleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    handleAutoSave();
    setViewMode("read");
  }, [handleAutoSave, setViewMode]);

  const handleCancel = useCallback(() => {
    if (!editor) return;
    const isDirty = editor.getHTML() !== originalContentRef.current;
    if (isDirty && !window.confirm("有未保存的修改，确定丢弃？")) return;
    editor.commands.setContent(originalContentRef.current);
    setViewMode("read");
  }, [editor, setViewMode]);

  // ⌘S 快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleAutoSave();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleAutoSave]);

  // beforeunload 保护
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (editor && editor.getHTML() !== originalContentRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [editor]);

  const chars = editor?.storage.characterCount?.characters() ?? 0;
  const words = editor?.storage.characterCount?.words() ?? 0;

  return (
    <div className="flex flex-col h-full">
      <EditorToolbar editor={editor} onSave={handleSave} onCancel={handleCancel} isSaving={isPending} />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-none">
          {/* 可编辑标题 */}
          <div className="px-8 pt-6">
            <input
              className="w-full text-2xl font-bold bg-transparent border-b border-dashed border-border/30 focus:border-blue-500 outline-none pb-2 mb-4"
              defaultValue={article.title}
              placeholder="输入标题..."
            />
          </div>
          <EditorContent editor={editor} />
        </div>
      </div>
      <EditorStatusBar characterCount={chars} wordCount={words} lastSavedAt={lastSavedAt} />
    </div>
  );
}
```

- [ ] **Step 4: 集成到 article-detail-client.tsx**

在中间区域根据 viewMode 切换显示：

```typescript
import { ArticleEditor } from "./features/editor/article-editor";

// 在中间区域：
<div className="flex-1 overflow-y-auto flex flex-col">
  {viewMode === "read" ? (
    <ArticleReader article={article} appearance={appearance} />
  ) : (
    <ArticleEditor article={article} />
  )}
</div>
```

- [ ] **Step 5: 验证**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat: add Tiptap rich text editor with toolbar and auto-save"
```

---

### Task 7: 智能大纲 (Outline Feature)

**Files:**
- Create: `src/app/(dashboard)/articles/[id]/features/outline/outline-panel.tsx`
- Create: `src/app/(dashboard)/articles/[id]/features/outline/use-outline.ts`

- [ ] **Step 1: 创建大纲 Hook**

创建 `src/app/(dashboard)/articles/[id]/features/outline/use-outline.ts`：

```typescript
"use client";

import { useMemo } from "react";

export interface OutlineItem {
  id: string;
  text: string;
  level: number;
  position: number;
}

export function useOutline(htmlContent: string): OutlineItem[] {
  return useMemo(() => {
    if (!htmlContent) return [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");
    const headings = doc.querySelectorAll("h1, h2, h3");
    return Array.from(headings).map((h, i) => ({
      id: `heading-${i}`,
      text: h.textContent?.trim() ?? "",
      level: parseInt(h.tagName[1]),
      position: i,
    }));
  }, [htmlContent]);
}
```

- [ ] **Step 2: 创建大纲面板**

创建 `src/app/(dashboard)/articles/[id]/features/outline/outline-panel.tsx`：

```typescript
"use client";

import { useOutline } from "./use-outline";
import { cn } from "@/lib/utils";

interface OutlinePanelProps {
  htmlContent: string;
  activeIndex?: number;
  onItemClick?: (position: number) => void;
}

export function OutlinePanel({ htmlContent, activeIndex, onItemClick }: OutlinePanelProps) {
  const items = useOutline(htmlContent);

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-4">
        文章较短，无需导航
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3">
      <nav className="space-y-0.5">
        {items.map((item, i) => (
          <button
            key={item.id}
            className={cn(
              "block w-full text-left px-2 py-1.5 rounded text-xs transition-colors truncate",
              item.level === 1 && "font-medium",
              item.level === 2 && "pl-4",
              item.level === 3 && "pl-6 text-muted-foreground",
              activeIndex === i
                ? "bg-blue-500/10 text-blue-500"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
            onClick={() => onItemClick?.(item.position)}
          >
            {item.text}
          </button>
        ))}
      </nav>
    </div>
  );
}
```

- [ ] **Step 3: 验证 + 提交**

```bash
npx tsc --noEmit
git add -A
git commit -m "feat: add outline panel with heading extraction"
```

---

### Task 8: 左侧面板 Tab 结构 + 集成

**Files:**
- Modify: `src/app/(dashboard)/articles/[id]/article-detail-client.tsx`

- [ ] **Step 1: 替换左侧面板占位为 Tab 结构**

在 `article-detail-client.tsx` 中替换左侧面板内容：

```typescript
import { OutlinePanel } from "./features/outline/outline-panel";

// 左侧面板内容替换为：
{leftPanelOpen ? (
  <div className="flex flex-col h-full">
    <div className="px-3 py-2 text-sm font-medium border-b border-[var(--glass-border)] flex items-center justify-between">
      <span>✦ AI 助手</span>
      <button
        className="text-muted-foreground hover:text-foreground text-xs"
        onClick={() => useArticlePageStore.getState().toggleLeftPanel()}
      >
        ◀
      </button>
    </div>
    {/* Tabs */}
    <div className="flex border-b border-[var(--glass-border)] text-xs">
      {(["outline", "chat", "history"] as const).map((tab) => (
        <button
          key={tab}
          className={cn(
            "flex-1 text-center py-2 transition-colors",
            leftTab === tab
              ? "text-blue-500 border-b-2 border-blue-500"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => useArticlePageStore.getState().setLeftTab(tab)}
        >
          {tab === "outline" ? "大纲" : tab === "chat" ? "对话" : "历史"}
        </button>
      ))}
    </div>
    {/* Tab 内容 */}
    <div className="flex-1 overflow-hidden flex flex-col">
      {leftTab === "outline" && (
        <OutlinePanel htmlContent={article.body ?? ""} />
      )}
      {leftTab === "chat" && (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          [AI 对话 — Phase 2 实现]
        </div>
      )}
      {leftTab === "history" && (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          [对话历史 — Phase 5 实现]
        </div>
      )}
    </div>
  </div>
) : (/* 折叠态保持不变 */)}
```

- [ ] **Step 2: 验证 + 提交**

```bash
npx tsc --noEmit
git add -A
git commit -m "feat: integrate outline panel with left sidebar tabs"
```

---

### Task 9: Phase 1 Build 验证

- [ ] **Step 1: 完整构建验证**

```bash
npx tsc --noEmit
npm run build
```

- [ ] **Step 2: 本地运行验证**

```bash
npm run dev
# 验证：
# 1. 三栏布局正确渲染
# 2. 面板可折叠/展开
# 3. 阅读模式正文排版正确
# 4. 编辑模式 Tiptap 编辑器可用
# 5. 工具栏按钮响应
# 6. 大纲导航渲染
# 7. 阅读/编辑切换保持流畅
```

- [ ] **Step 3: 提交 Phase 1 完成标记**

```bash
git add -A
git commit -m "feat: complete Phase 1 — MVP skeleton (layout, reader, editor, outline)"
```

---

## Phase 2 — AI 对话与批注

### Task 10: DAL + Server Actions (批注 + AI 解读)

**Files:**
- Create: `src/lib/dal/annotations.ts`
- Create: `src/lib/dal/ai-analysis.ts`
- Create: `src/app/actions/annotations.ts`
- Create: `src/app/actions/ai-analysis.ts`
- Modify: `src/app/(dashboard)/articles/[id]/page.tsx`

- [ ] **Step 1: 创建批注 DAL**

创建 `src/lib/dal/annotations.ts`：

```typescript
import { db } from "@/db";
import { articleAnnotations } from "@/db/schema/article-annotations";
import { eq, asc } from "drizzle-orm";
import type { Annotation } from "@/app/(dashboard)/articles/[id]/types";

export async function getAnnotations(articleId: string): Promise<Annotation[]> {
  const rows = await db
    .select()
    .from(articleAnnotations)
    .where(eq(articleAnnotations.articleId, articleId))
    .orderBy(asc(articleAnnotations.position));

  return rows.map((r) => ({
    id: r.id,
    articleId: r.articleId,
    quote: r.quote,
    note: r.note ?? undefined,
    color: r.color as Annotation["color"],
    position: r.position,
    timecode: r.timecode ? parseFloat(r.timecode) : undefined,
    frameSnapshot: r.frameSnapshot ?? undefined,
    isPinned: r.isPinned,
    pinnedPosition: r.pinnedPosition as Annotation["pinnedPosition"],
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}
```

- [ ] **Step 2: 创建 AI 解读 DAL**

创建 `src/lib/dal/ai-analysis.ts`：

```typescript
import { db } from "@/db";
import { articleAiAnalysis } from "@/db/schema/article-ai-analysis";
import { eq } from "drizzle-orm";
import type { AIAnalysisCacheItem } from "@/app/(dashboard)/articles/[id]/types";

export async function getAIAnalysisCache(articleId: string): Promise<AIAnalysisCacheItem[]> {
  const rows = await db
    .select()
    .from(articleAiAnalysis)
    .where(eq(articleAiAnalysis.articleId, articleId));

  return rows.map((r) => ({
    id: r.id,
    articleId: r.articleId,
    perspective: r.perspective as AIAnalysisCacheItem["perspective"],
    analysisText: r.analysisText,
    sentiment: (r.sentiment ?? undefined) as AIAnalysisCacheItem["sentiment"],
    metadata: r.metadata as Record<string, unknown> | undefined,
    generatedAt: r.generatedAt.toISOString(),
  }));
}
```

- [ ] **Step 3: 创建批注 Server Actions**

创建 `src/app/actions/annotations.ts`：

```typescript
"use server";

import { db } from "@/db";
import { articleAnnotations } from "@/db/schema/article-annotations";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function createAnnotation(
  articleId: string,
  data: {
    quote: string;
    position: number;
    note?: string;
    color?: "red" | "yellow" | "green" | "blue" | "purple";
  }
) {
  const user = await requireAuth();
  const [created] = await db
    .insert(articleAnnotations)
    .values({
      articleId,
      organizationId: user.user_metadata?.organization_id ?? "",
      userId: user.id,
      quote: data.quote,
      position: data.position,
      note: data.note,
      color: data.color ?? "yellow",
    })
    .returning();
  revalidatePath(`/articles/${articleId}`);
  return created;
}

export async function updateAnnotation(
  annotationId: string,
  data: Partial<{
    note: string;
    color: "red" | "yellow" | "green" | "blue" | "purple";
    isPinned: boolean;
    pinnedPosition: { x: number; y: number } | null;
  }>
) {
  const user = await requireAuth();
  await db
    .update(articleAnnotations)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(articleAnnotations.id, annotationId), eq(articleAnnotations.userId, user.id)));
  revalidatePath("/articles");
}

export async function deleteAnnotation(annotationId: string) {
  const user = await requireAuth();
  await db
    .delete(articleAnnotations)
    .where(and(eq(articleAnnotations.id, annotationId), eq(articleAnnotations.userId, user.id)));
  revalidatePath("/articles");
}
```

- [ ] **Step 4: 更新 page.tsx 获取批注和 AI 缓存**

```typescript
import { getAnnotations } from "@/lib/dal/annotations";
import { getAIAnalysisCache } from "@/lib/dal/ai-analysis";

// Promise.all 中加入：
const [article, annotations, aiAnalysis] = await Promise.all([
  getArticle(id).catch(() => null),
  getAnnotations(id).catch(() => []),
  getAIAnalysisCache(id).catch(() => []),
]);

// 传递给 client：
<ArticleDetailClient
  article={article}
  initialAnnotations={annotations}
  initialAIAnalysis={aiAnalysis}
/>
```

- [ ] **Step 5: 验证 + 提交**

```bash
npx tsc --noEmit
git add -A
git commit -m "feat: add DAL and server actions for annotations and AI analysis"
```

---

### Task 11: AI 对话 API Route + Chat Hook

**Files:**
- Create: `src/app/api/ai/chat/route.ts`
- Create: `src/app/(dashboard)/articles/[id]/features/ai-chat/use-ai-chat.ts`

- [ ] **Step 1: 创建 AI 对话 Route Handler**

创建 `src/app/api/ai/chat/route.ts`：

```typescript
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

const deepseek = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  baseURL: process.env.OPENAI_API_BASE_URL!,
});

export async function POST(req: Request) {
  const { messages, articleContent, selectedText } = await req.json();

  const systemPrompt = `你是一位专业的新闻分析 AI 助手。基于以下文章内容回答用户问题。

文章内容：
${articleContent?.slice(0, 12000) ?? "无内容"}`;

  const lastMessage = messages[messages.length - 1];
  const userContent = selectedText
    ? `[用户选中的文本：「${selectedText}」]\n\n${lastMessage.content}`
    : lastMessage.content;

  const result = streamText({
    model: deepseek.chat(process.env.OPENAI_MODEL || "deepseek-chat"),
    system: systemPrompt,
    messages: [
      ...messages.slice(0, -1),
      { role: "user", content: userContent },
    ],
  });

  return result.toTextStreamResponse();
}
```

- [ ] **Step 2: 创建 AI 对话 Hook**

创建 `src/app/(dashboard)/articles/[id]/features/ai-chat/use-ai-chat.ts`：

```typescript
"use client";

import { useState, useCallback, useRef } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export function useAIChat(articleContent: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (userMessage: string, selectedText?: string) => {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: userMessage,
        timestamp: Date.now(),
      };

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...messages, userMsg].map((m) => ({
              role: m.role,
              content: m.content,
            })),
            articleContent,
            selectedText,
          }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error("AI 请求失败");
        if (!res.body) throw new Error("无响应流");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullText += decoder.decode(value, { stream: true });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: fullText } : m
            )
          );
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: "抱歉，AI 响应出错，请重试。" }
                : m
            )
          );
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, articleContent]
  );

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, isStreaming, sendMessage, clearMessages };
}
```

- [ ] **Step 3: 验证 + 提交**

```bash
npx tsc --noEmit
git add -A
git commit -m "feat: add AI chat API route and streaming hook"
```

---

### Task 12: AI 对话面板 UI

**Files:**
- Create: `src/app/(dashboard)/articles/[id]/features/ai-chat/chat-message.tsx`
- Create: `src/app/(dashboard)/articles/[id]/features/ai-chat/quick-commands.tsx`
- Create: `src/app/(dashboard)/articles/[id]/features/ai-chat/chat-input.tsx`
- Create: `src/app/(dashboard)/articles/[id]/features/ai-chat/ai-chat-panel.tsx`

- [ ] **Step 1: 创建消息组件 chat-message.tsx**

```typescript
"use client";

import type { ChatMessage } from "./use-ai-chat";
import { cn } from "@/lib/utils";

export function ChatMessageItem({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "rounded-lg px-3 py-2 text-xs leading-relaxed mb-2",
        isUser
          ? "bg-blue-500/10 text-foreground ml-6"
          : "bg-muted/50 text-foreground/90"
      )}
    >
      {!isUser && (
        <div className="text-blue-500 text-[10px] mb-1">✦ AI 助手</div>
      )}
      <div className="whitespace-pre-wrap">{message.content || "..."}</div>
    </div>
  );
}
```

- [ ] **Step 2: 创建快捷指令栏 quick-commands.tsx**

```typescript
"use client";

import type { ViewMode } from "../../types";

interface QuickCommandsProps {
  viewMode: ViewMode;
  contentType: "article" | "video";
  onCommand: (command: string) => void;
}

const COMMANDS = {
  read: ["总结全文", "提取金句", "分析立场", "生成时间线", "翻译全文", "事实核查"],
  edit: ["润色选中", "续写下文", "生成标题", "缩写摘要", "扩写详述", "改为正式语体"],
  video: ["总结视频", "提取关键帧描述", "生成文字稿", "识别说话人"],
};

export function QuickCommands({ viewMode, contentType, onCommand }: QuickCommandsProps) {
  const items = contentType === "video" ? COMMANDS.video : COMMANDS[viewMode];

  return (
    <div className="flex gap-1 flex-wrap px-3 py-1.5 border-t border-[var(--glass-border)]">
      {items.map((cmd) => (
        <button
          key={cmd}
          className="text-[9px] px-2 py-1 bg-muted/50 text-muted-foreground rounded-full hover:text-foreground hover:bg-muted transition-colors"
          onClick={() => onCommand(cmd)}
        >
          {cmd}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: 创建输入框 chat-input.tsx**

```typescript
"use client";

import { useState, useCallback, type KeyboardEvent } from "react";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder = "基于文章内容提问..." }: ChatInputProps) {
  const [value, setValue] = useState("");

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }, [value, disabled, onSend]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-t border-[var(--glass-border)]">
      <input
        className="flex-1 bg-muted/30 rounded-md px-3 py-1.5 text-xs outline-none placeholder:text-muted-foreground/50"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
      />
      <button
        className="text-blue-500 hover:text-blue-400 disabled:text-muted-foreground"
        onClick={handleSend}
        disabled={disabled || !value.trim()}
      >
        <Send className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: 创建 AI 对话面板 ai-chat-panel.tsx**

```typescript
"use client";

import { useRef, useEffect } from "react";
import { useAIChat } from "./use-ai-chat";
import { ChatMessageItem } from "./chat-message";
import { QuickCommands } from "./quick-commands";
import { ChatInput } from "./chat-input";
import { useArticlePageStore } from "../../store";
import type { ViewMode } from "../../types";

interface AIChatPanelProps {
  articleContent: string;
  viewMode: ViewMode;
  contentType: "article" | "video";
}

export function AIChatPanel({ articleContent, viewMode, contentType }: AIChatPanelProps) {
  const { messages, isStreaming, sendMessage } = useAIChat(articleContent);
  const { selectedText } = useArticlePageStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (text: string) => {
    sendMessage(text, selectedText ?? undefined);
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
            <span className="text-blue-500">✦</span> 你好！我正在阅读这篇文章，你可以问我任何关于文章内容的问题。
          </div>
        ) : (
          messages.map((msg) => <ChatMessageItem key={msg.id} message={msg} />)
        )}
      </div>
      <QuickCommands viewMode={viewMode} contentType={contentType} onCommand={handleSend} />
      <ChatInput onSend={handleSend} disabled={isStreaming} />
    </div>
  );
}
```

- [ ] **Step 5: 集成到左侧面板的 chat Tab**

在 `article-detail-client.tsx` 中替换 chat Tab 占位：

```typescript
import { AIChatPanel } from "./features/ai-chat/ai-chat-panel";

// leftTab === "chat" 时：
{leftTab === "chat" && (
  <AIChatPanel
    articleContent={article.body ?? ""}
    viewMode={viewMode}
    contentType={isVideo ? "video" : "article"}
  />
)}
```

- [ ] **Step 6: 验证 + 提交**

```bash
npx tsc --noEmit
git add -A
git commit -m "feat: add AI chat panel with streaming and quick commands"
```

---

### Task 13: AI 解读面板 + API Route

**Files:**
- Create: `src/app/api/ai/analysis/route.ts`
- Create: `src/app/(dashboard)/articles/[id]/features/ai-analysis/use-ai-analysis.ts`
- Create: `src/app/(dashboard)/articles/[id]/features/ai-analysis/perspective-selector.tsx`
- Create: `src/app/(dashboard)/articles/[id]/features/ai-analysis/analysis-content.tsx`
- Create: `src/app/(dashboard)/articles/[id]/features/ai-analysis/ai-analysis-panel.tsx`

- [ ] **Step 1: 创建 AI 解读 Route Handler**

创建 `src/app/api/ai/analysis/route.ts`（参照设计文档 Section 5.4 的完整代码）。

- [ ] **Step 2: 创建 use-ai-analysis Hook**

创建 Hook 管理解读缓存和流式生成，接收 `initialCache` 作为初始值，按 perspective 索引。

- [ ] **Step 3: 创建视角选择器 + 内容渲染 + 面板主组件**

按设计文档实现 6 种视角下拉切换、流式 Loading 状态。AI 解读内容为 Markdown 格式，使用简单的 `whitespace-pre-wrap` 文本渲染（非 AI 对话场景，不需要 UIMessage 渲染）。如需更丰富的 Markdown 渲染，可安装 `react-markdown`。**注意：不要对 AI 生成内容使用 `dangerouslySetInnerHTML`**。

- [ ] **Step 4: 集成到右侧面板 analysis Tab**

- [ ] **Step 5: 验证 + 提交**

```bash
npx tsc --noEmit
git add -A
git commit -m "feat: add AI analysis panel with multi-perspective views"
```

---

### Task 14: 划词气泡菜单 + 高亮

**Files:**
- Create: `src/app/(dashboard)/articles/[id]/features/reader/text-selection-menu.tsx`
- Modify: `src/app/(dashboard)/articles/[id]/features/reader/article-reader.tsx`

- [ ] **Step 1: 创建划词气泡菜单组件**

使用 `document.getSelection()` + `getBoundingClientRect()` 定位，显示 5 色高亮、批注、AI 解释、搜索、复制按钮。100ms debounce，点击外部/滚动时消失。

- [ ] **Step 2: 集成到 article-reader.tsx**

添加 mouseup 监听，选中文本时显示气泡菜单。点击颜色 → 调用 `createAnnotation` Server Action。点击 AI → 切换左侧面板到 chat Tab 并设置选中文本到 store。

- [ ] **Step 3: 验证 + 提交**

```bash
npx tsc --noEmit
git add -A
git commit -m "feat: add text selection popover with highlight colors"
```

---

### Task 15: 批注面板 + 双向联动

**Files:**
- Create: `src/app/(dashboard)/articles/[id]/features/annotations/use-annotations.ts`
- Create: `src/app/(dashboard)/articles/[id]/features/annotations/annotation-card.tsx`
- Create: `src/app/(dashboard)/articles/[id]/features/annotations/annotations-panel.tsx`

- [ ] **Step 1: 创建批注 Hook**

管理批注列表状态（接收 `initialAnnotations`），提供 create/update/delete 方法（调用 Server Actions），管理浮顶列表。

- [ ] **Step 2: 创建批注卡片和面板**

批注卡片：左侧颜色竖线、引用原文、笔记内容、操作栏（改色/复制/删除/浮顶）。面板：按位置排序的卡片列表。

- [ ] **Step 3: 实现双向联动**

- 点击批注卡片 → `store.scrollToAnnotation(id)` → Reader 组件监听并滚动
- 点击正文高亮 → `store.setRightTab("annotations")` + 高亮对应卡片

- [ ] **Step 4: 验证 + 提交**

```bash
npx tsc --noEmit
git add -A
git commit -m "feat: add annotations panel with bidirectional linking"
```

---

### Task 16: Phase 2 Build 验证

- [ ] **Step 1: 完整构建**

```bash
npx tsc --noEmit
npm run build
```

- [ ] **Step 2: 端到端验证**

```
1. AI 对话：输入问题 → 流式回复
2. AI 解读：切换视角 → 生成/缓存解读
3. 划词菜单：选中文本 → 弹出 → 高亮 → 批注创建
4. 批注联动：点击批注 → 正文跳转；点击高亮 → 面板高亮
```

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: complete Phase 2 — AI chat, analysis, and annotations"
```

---

## Phase 3 — AI 编辑能力

### Task 17: AI 编辑 Route + 操作卡片

**Files:**
- Create: `src/app/api/ai/edit/route.ts`
- Create: `src/app/(dashboard)/articles/[id]/features/ai-chat/action-card.tsx`

- [ ] **Step 1: 创建 AI 编辑 Route**（参照设计文档 Section 5.4）
- [ ] **Step 2: 创建 Action Card 组件**（Diff 预览、应用到编辑器、复制、重新生成、逐段审核）
- [ ] **Step 3: 验证 + 提交**

---

### Task 18: Slash Command + Bubble Menu AI 按钮

**Files:**
- Create: `src/app/(dashboard)/articles/[id]/features/editor/slash-command.tsx`
- Create: `src/app/(dashboard)/articles/[id]/features/editor/bubble-menu-bar.tsx`
- Create: `src/app/(dashboard)/articles/[id]/features/editor/extensions/ai-highlight.ts`

- [ ] **Step 1: 创建 Slash Command 扩展**（`/` 触发命令菜单，包含块元素 + `/ai` 指令）
- [ ] **Step 2: 创建 Bubble Menu Bar**（选中文本浮动格式栏 + AI 按钮）
- [ ] **Step 3: 创建 AI Highlight 扩展**（AI 生成内容淡紫色背景 2s 渐隐）
- [ ] **Step 4: 集成到 article-editor.tsx**
- [ ] **Step 5: 验证 + 提交**

---

### Task 19: 选中文本 ↔ AI 对话联动

- [ ] **Step 1: 编辑模式选中文本**
  - 编辑器 `selectionUpdate` → `store.setSelectedText()` → 左侧面板自动切换到 chat Tab
  - 快捷指令切换为编辑模式指令集

- [ ] **Step 2: AI 操作应用到编辑器**
  - Action Card "应用" → 获取 editor 实例 → `editor.chain().focus().insertContentAt()` 或 `replaceRange()`
  - 应用后触发 AI Highlight 扩展标记

- [ ] **Step 3: Phase 3 Build 验证 + 提交**

```bash
npx tsc --noEmit && npm run build
git add -A
git commit -m "feat: complete Phase 3 — AI editing capabilities"
```

---

## Phase 4 — 视频模式

### Task 20: Mock 数据 + 视频播放器

**Files:**
- Create: `src/app/(dashboard)/articles/[id]/data/mock-video.ts`
- Create: `src/app/(dashboard)/articles/[id]/features/video-player/use-video-player.ts`
- Create: `src/app/(dashboard)/articles/[id]/features/video-player/video-player.tsx`
- Create: `src/app/(dashboard)/articles/[id]/features/video-player/player-controls.tsx`

- [ ] **Step 1: 创建 Mock 数据**（视频 URL、TranscriptSegment[]、VideoChapter[]）
- [ ] **Step 2: 创建播放器 Hook**（播放/暂停、时间、倍速、音量）
- [ ] **Step 3: 创建播放器 UI**（自适应画幅、控制栏、进度条）
- [ ] **Step 4: 集成到中间区域**（video contentType 时显示播放器替代阅读器）
- [ ] **Step 5: 验证 + 提交**

---

### Task 21: ASR 听记面板 + 音文同步

**Files:**
- Create: `src/app/(dashboard)/articles/[id]/features/transcript/use-transcript.ts`
- Create: `src/app/(dashboard)/articles/[id]/features/transcript/transcript-segment.tsx`
- Create: `src/app/(dashboard)/articles/[id]/features/transcript/transcript-panel.tsx`

- [ ] **Step 1: 创建听记 Hook**（当前高亮段、时间同步、校对修改）
- [ ] **Step 2: 创建听记面板 UI**（说话人区分颜色、卡拉OK式高亮、点击跳转）
- [ ] **Step 3: 集成到右侧面板 transcript Tab**
- [ ] **Step 4: 验证 + 提交**

---

### Task 22: 视频章节导航 + 时间锚点批注

**Files:**
- Create: `src/app/(dashboard)/articles/[id]/features/outline/video-chapters.tsx`

- [ ] **Step 1: 创建视频章节组件**（时间戳 + 标题列表，点击跳转 + 听记同步）
- [ ] **Step 2: 左侧大纲 Tab 视频模式切换**（video 时显示章节替代大纲）
- [ ] **Step 3: 批注面板支持视频时间码**（timecode 字段、截帧图片）
- [ ] **Step 4: Phase 4 Build 验证 + 提交**

```bash
npx tsc --noEmit && npm run build
git add -A
git commit -m "feat: complete Phase 4 — video mode with transcript and chapters"
```

---

## Phase 5 — 完善与打磨

### Task 23: 浮顶悬浮笔记

**Files:**
- Create: `src/app/(dashboard)/articles/[id]/features/annotations/floating-note.tsx`

- [ ] **Step 1: 创建浮顶笔记组件**（可拖拽、半透明、z-50、归位动画）
- [ ] **Step 2: 集成到批注系统**（isPinned 状态管理、位置持久化到 DB）
- [ ] **Step 3: 验证 + 提交**

---

### Task 24: 多视角 AI 解读 + 对话历史

- [ ] **Step 1: 完善 6 种视角的 prompt 和渲染**（记者视点、金句、时间线、关键问答、深度剖析）
- [ ] **Step 2: 实现对话历史 Tab**（History Tab，从 DB 加载历史记录，按时间分组）
- [ ] **Step 3: 验证 + 提交**

---

### Task 25: 视图切换 + 导出 + 外观设置

**Files:**
- Create: `src/app/(dashboard)/articles/[id]/features/header/appearance-popover.tsx`
- Create: `src/app/(dashboard)/articles/[id]/features/header/actions-menu.tsx`

- [ ] **Step 1: 实现外观设置 Popover**（字号滑块、行高/边距/主题/字体选择器）
- [ ] **Step 2: 实现视图切换内容**（原始网页 iframe、AI 速览卡片、网页存档）
- [ ] **Step 3: 实现更多操作菜单**（复制/导出/整理分组）
- [ ] **Step 4: 验证 + 提交**

---

### Task 26: 快捷键 + 禅模式 + 性能优化

- [ ] **Step 1: 全局快捷键注册**（⌘E 切模式、⌘/ 左面板、⌘. 右面板、⌘\ 禅模式、1234 切视图）
- [ ] **Step 2: 禅模式完善**（平滑动画、折叠态 icon bar）
- [ ] **Step 3: 性能优化**（图片懒加载、AI 解读预加载、大纲滚动联动 debounce）
- [ ] **Step 4: Final Build 验证**

```bash
npx tsc --noEmit && npm run build
```

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: complete Phase 5 — polish, shortcuts, and performance"
```

---

## Summary

| Phase | Tasks | 核心交付 |
|-------|-------|---------|
| Phase 1 | Task 1-9 | 三栏布局 + 阅读/编辑模式 + Tiptap + 大纲 |
| Phase 2 | Task 10-16 | AI 对话 + AI 解读 + 划词高亮 + 批注系统 |
| Phase 3 | Task 17-19 | AI 编辑操作 + Slash Command + 文本联动 |
| Phase 4 | Task 20-22 | 视频播放器 + ASR 听记 + 章节导航 |
| Phase 5 | Task 23-26 | 浮顶笔记 + 多视角 + 导出 + 快捷键 + 性能 |
