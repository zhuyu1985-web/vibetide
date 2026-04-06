# Phase 1: 首页重构 + 侧边栏精简 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构登录后首页为统一输入框 + AI 员工面板 + 内嵌对话，精简侧边栏为 8 个一级入口 + "更多"面板。

**Architecture:** 新建 `/home` 路由作为登录后默认首页，从现有 `chat-center-client.tsx` 提取可复用的对话 hook（`useChatStream`），在首页嵌入轻量对话面板。侧边栏从 20+ 分组菜单重构为 8 个扁平一级入口 + "更多"浮层面板。RBAC 权限按 Tab 粒度适配。

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4, shadcn/ui, Supabase Auth, AI SDK v6, SSE streaming

**Spec:** `docs/superpowers/specs/2026-04-06-genspark-style-redesign.md`

**Agent Team Roles:**
- **UI Designer** — iOS 26 液态玻璃风格，确保首页和侧边栏的视觉高级感
- **UX Engineer** — 对话面板展开/收起动画，输入框交互反馈
- **Full-stack Engineer** — hook 提取、API 复用、会话持久化、RBAC 适配
- **Test Engineer** — 组件测试、集成测试、E2E 测试

---

## File Structure

### New Files
```
src/app/(dashboard)/home/page.tsx                    — 首页服务端组件（数据获取）
src/app/(dashboard)/home/home-client.tsx              — 首页客户端组件（UI + 交互）
src/hooks/use-chat-stream.ts                          — 提取的对话流 hook（核心复用）
src/components/home/employee-quick-panel.tsx           — 员工图标快捷面板
src/components/home/embedded-chat-panel.tsx            — 首页内嵌对话面板
src/components/home/recent-section.tsx                 — 最近任务/对话快捷区
src/components/layout/more-panel.tsx                   — "更多"浮层面板
```

### Modified Files
```
src/components/layout/app-sidebar.tsx:188-260          — 菜单项重构为 8 个一级入口
src/lib/rbac-constants.ts:62-87                        — MENU_PERMISSION_MAP 添加新路由
src/app/page.tsx:10                                    — 重定向 /missions → /home
src/lib/supabase/middleware.ts:51                       — 认证用户重定向 → /home
src/app/(dashboard)/chat/chat-center-client.tsx         — 提取 hook 后简化
```

---

## Task 1: 提取对话流 Hook — `useChatStream`

从 `chat-center-client.tsx` 的 652 行中提取核心对话逻辑为可复用 hook。这是首页内嵌对话的基础。

**Files:**
- Create: `src/hooks/use-chat-stream.ts`
- Modify: `src/app/(dashboard)/chat/chat-center-client.tsx`

- [ ] **Step 1: 创建 `useChatStream` hook**

这个 hook 封装：消息状态、SSE 流、意图识别、意图执行。不包含员工切换、会话保存等 UI 逻辑。

```typescript
// src/hooks/use-chat-stream.ts
"use client";

import { useState, useRef, useCallback } from "react";
import {
  type ChatMessage,
  type ThinkingStep,
  type SkillUsed,
  type StepInfo,
  executeStreamingChat,
} from "@/lib/chat-utils";
import type { IntentResult } from "@/lib/agent/types";
import type { IntentProgress } from "@/components/chat/intent-bubble";

interface UseChatStreamOptions {
  employeeSlug: string;
  onConversationCreated?: (conversationId: string) => void;
}

interface UseChatStreamReturn {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  isStreaming: boolean;
  currentThinking: ThinkingStep[];
  currentSkillsUsed: SkillUsed[];
  currentSources: string[];
  currentRefCount: number;
  currentStep: StepInfo | null;
  pendingIntent: IntentResult | null;
  pendingMessage: string;
  intentLoading: boolean;
  intentProgress: IntentProgress[];
  sendMessage: (text: string) => Promise<void>;
  executeIntent: (intent: IntentResult) => Promise<void>;
  cancelIntent: () => void;
  clearMessages: () => void;
}

export function useChatStream({
  employeeSlug,
  onConversationCreated,
}: UseChatStreamOptions): UseChatStreamReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentThinking, setCurrentThinking] = useState<ThinkingStep[]>([]);
  const [currentSkillsUsed, setCurrentSkillsUsed] = useState<SkillUsed[]>([]);
  const [currentSources, setCurrentSources] = useState<string[]>([]);
  const [currentRefCount, setCurrentRefCount] = useState(0);
  const [currentStep, setCurrentStep] = useState<StepInfo | null>(null);

  // Intent state
  const [pendingIntent, setPendingIntent] = useState<IntentResult | null>(null);
  const [pendingMessage, setPendingMessage] = useState("");
  const [intentLoading, setIntentLoading] = useState(false);
  const [intentProgress, setIntentProgress] = useState<IntentProgress[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  const resetStreamingState = useCallback(() => {
    setCurrentThinking([]);
    setCurrentSkillsUsed([]);
    setCurrentSources([]);
    setCurrentRefCount(0);
    setCurrentStep(null);
  }, []);

  // Core chat execution (reused by both direct chat and intent execution)
  const executeChat = useCallback(
    async (
      url: string,
      body: Record<string, unknown>,
      userMessage?: string
    ) => {
      setIsStreaming(true);
      resetStreamingState();

      if (userMessage) {
        setMessages((prev) => [
          ...prev,
          { role: "user" as const, content: userMessage },
        ]);
      }

      // Add placeholder assistant message
      setMessages((prev) => [...prev, { role: "assistant" as const, content: "" }]);

      const startTime = Date.now();

      try {
        const { accumulated } = await executeStreamingChat(url, body, {
          onThinking: (step) =>
            setCurrentThinking((prev) => [...prev, step]),
          onSkillUsed: (skill) =>
            setCurrentSkillsUsed((prev) => [...prev, skill]),
          onSource: (sources, total) => {
            setCurrentSources(sources);
            setCurrentRefCount(total);
          },
          onStepStart: (step) => setCurrentStep(step),
          onStepComplete: () => setCurrentStep(null),
          onTextDelta: (_delta, acc) =>
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: acc,
              };
              return updated;
            }),
          onDone: (result) => {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              updated[updated.length - 1] = {
                ...last,
                durationMs: Date.now() - startTime,
                skillsUsed: result.skillsUsed,
                sources: result.sources,
                referenceCount: result.referenceCount,
              };
              return updated;
            });
          },
          onError: (msg) => {
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: `❌ ${msg}`,
                durationMs: Date.now() - startTime,
              };
              return updated;
            });
          },
        });
      } finally {
        setIsStreaming(false);
        resetStreamingState();
      }
    },
    [resetStreamingState]
  );

  // Intent recognition via SSE
  const recognizeIntent = useCallback(
    async (text: string) => {
      setIntentLoading(true);
      setIntentProgress([]);
      setPendingMessage(text);

      try {
        const res = await fetch("/api/chat/intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            employeeSlug,
          }),
        });

        if (!res.ok || !res.body) {
          throw new Error("意图识别请求失败");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const block of lines) {
            const eventMatch = block.match(/^event:\s*(.+)/m);
            const dataMatch = block.match(/^data:\s*(.+)/m);
            if (!eventMatch || !dataMatch) continue;

            const eventType = eventMatch[1].trim();
            const data = JSON.parse(dataMatch[1].trim());

            if (eventType === "progress") {
              setIntentProgress((prev) => [...prev, data]);
            } else if (eventType === "result") {
              const intent = data as IntentResult;
              // Route based on confidence
              if (
                intent.intentType === "general_chat" ||
                intent.steps.length === 0
              ) {
                // Fallback to direct chat
                await executeChat(
                  "/api/chat/stream",
                  {
                    employeeSlug,
                    conversationHistory: [
                      ...messages.map((m) => ({
                        role: m.role,
                        content: m.content,
                      })),
                    ],
                  },
                  text
                );
              } else if (intent.confidence >= 0.8) {
                // Auto-execute
                setPendingIntent(intent);
                await executeIntentInner(intent, text);
              } else {
                // Show confirmation
                setPendingIntent(intent);
              }
            } else if (eventType === "error") {
              // Fallback to direct chat on intent error
              await executeChat(
                "/api/chat/stream",
                {
                  employeeSlug,
                  conversationHistory: messages.map((m) => ({
                    role: m.role,
                    content: m.content,
                  })),
                },
                text
              );
            }
          }
        }
      } catch {
        // On failure, fallback to direct chat
        await executeChat(
          "/api/chat/stream",
          {
            employeeSlug,
            conversationHistory: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          },
          text
        );
      } finally {
        setIntentLoading(false);
      }
    },
    [employeeSlug, messages, executeChat]
  );

  const executeIntentInner = useCallback(
    async (intent: IntentResult, originalMessage: string) => {
      await executeChat(
        "/api/chat/intent-execute",
        {
          message: originalMessage,
          intent,
          conversationHistory: messages,
        },
        undefined // user message already added during recognition
      );
      setPendingIntent(null);
      setPendingMessage("");
    },
    [messages, executeChat]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;
      await recognizeIntent(text);
    },
    [isStreaming, recognizeIntent]
  );

  const executeIntent = useCallback(
    async (intent: IntentResult) => {
      // Add user message now (wasn't added during recognition for low-confidence)
      setMessages((prev) => [
        ...prev,
        { role: "user" as const, content: pendingMessage },
      ]);
      await executeIntentInner(intent, pendingMessage);
    },
    [pendingMessage, executeIntentInner]
  );

  const cancelIntent = useCallback(() => {
    setPendingIntent(null);
    setPendingMessage("");
    setIntentProgress([]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setPendingIntent(null);
    setPendingMessage("");
  }, []);

  return {
    messages,
    setMessages,
    isStreaming,
    currentThinking,
    currentSkillsUsed,
    currentSources,
    currentRefCount,
    currentStep,
    pendingIntent,
    pendingMessage,
    intentLoading,
    intentProgress,
    sendMessage,
    executeIntent,
    cancelIntent,
    clearMessages,
  };
}
```

- [ ] **Step 2: 验证 hook 编译通过**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors)

- [ ] **Step 3: 将 `chat-center-client.tsx` 迁移到使用 `useChatStream`**

保留 `chat-center-client.tsx` 的全部功能（员工切换、会话保存、场景等），但将核心流式对话逻辑替换为 `useChatStream` hook 调用。员工切换时更新 hook 的 `employeeSlug`。

关键改动：
- 删除 `chat-center-client.tsx` 中与 `useChatStream` 重复的 state（约 15 个 useState）
- 保留员工切换、会话保存、场景、unread 等 UI 逻辑
- `handleSend` 改为调用 `chatStream.sendMessage(text)`

- [ ] **Step 4: 验证对话中心功能正常**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS

手动验证：打开 `/chat`，选择员工，发送消息，确认流式对话、意图识别、意图执行均正常。

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-chat-stream.ts src/app/\(dashboard\)/chat/chat-center-client.tsx
git commit -m "refactor: extract useChatStream hook from chat center"
```

---

## Task 2: 侧边栏精简 — 8 个一级入口 + "更多"

**Files:**
- Create: `src/components/layout/more-panel.tsx`
- Modify: `src/components/layout/app-sidebar.tsx:188-260`
- Modify: `src/lib/rbac-constants.ts:62-87`

- [ ] **Step 1: 创建"更多"浮层面板组件**

```typescript
// src/components/layout/more-panel.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain, Gem, CalendarDays, CheckSquare, BookOpen, Shield,
  Building2, Users, type LucideIcon
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MoreHorizontal } from "lucide-react";

interface MoreItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

const MORE_ITEMS: MoreItem[] = [
  { label: "频道顾问", href: "/channel-advisor", icon: Brain, description: "管理频道发布顾问" },
  { label: "节赛会展", href: "/event-auto", icon: CalendarDays, description: "节日赛事自动化" },
  { label: "批量审核", href: "/batch-review", icon: CheckSquare, description: "内容批量审核" },
  { label: "案例库", href: "/case-library", icon: BookOpen, description: "优秀案例参考" },
];

const ADMIN_ITEMS: MoreItem[] = [
  { label: "组织管理", href: "/admin/organizations", icon: Building2, description: "管理组织信息" },
  { label: "用户管理", href: "/admin/users", icon: Users, description: "管理用户账号" },
  { label: "角色权限", href: "/admin/roles", icon: Shield, description: "配置角色权限" },
];

interface MorePanelProps {
  canSeeItem: (href: string) => boolean;
  canAccessAdmin: boolean;
}

export function MorePanel({ canSeeItem, canAccessAdmin }: MorePanelProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const visibleItems = MORE_ITEMS.filter((item) => canSeeItem(item.href));
  const visibleAdminItems = canAccessAdmin ? ADMIN_ITEMS : [];

  if (visibleItems.length === 0 && visibleAdminItems.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-3 w-full px-3 py-2 rounded-xl
            text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
        >
          <MoreHorizontal className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm group-data-[collapsible=icon]:hidden">更多</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        className="w-80 p-4 bg-black/80 backdrop-blur-xl border-white/10"
      >
        <div className="grid grid-cols-2 gap-2">
          {visibleItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-white/10 ${
                pathname.startsWith(item.href) ? "bg-white/10" : ""
              }`}
            >
              <item.icon className="h-5 w-5 text-white/60" />
              <div>
                <div className="text-sm font-medium text-white/90">
                  {item.label}
                </div>
              </div>
            </Link>
          ))}
        </div>
        {visibleAdminItems.length > 0 && (
          <>
            <div className="my-3 border-t border-white/10" />
            <div className="text-xs text-white/40 mb-2 px-1">系统管理</div>
            <div className="grid grid-cols-2 gap-2">
              {visibleAdminItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-white/10 ${
                    pathname.startsWith(item.href) ? "bg-white/10" : ""
                  }`}
                >
                  <item.icon className="h-5 w-5 text-white/60" />
                  <span className="text-sm text-white/90">{item.label}</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: 重构侧边栏菜单结构**

修改 `src/components/layout/app-sidebar.tsx`。

将现有的 `workspaceItems`（lines 188-194）和 `navGroups`（lines 196-248）替换为扁平的 8 个一级入口：

```typescript
// 替换 lines 188-260 的菜单配置

const PRIMARY_NAV: NavItem[] = [
  { label: "首页", href: "/home", icon: Home },
  { label: "AI 员工", href: "/ai-employees", icon: UserCog },
  { label: "工作流", href: "/workflows", icon: GitBranch },
  { label: "任务中心", href: "/missions", icon: Target },
  { label: "创作中心", href: "/creation", icon: Wand2 },
  { label: "内容管理", href: "/content", icon: FolderOpen },
  { label: "数据分析", href: "/analytics", icon: BarChart3 },
];

// "更多" 作为特殊入口，不在 PRIMARY_NAV 中
```

侧边栏渲染逻辑从分组折叠改为扁平列表 + "更多"按钮。

保留现有的玻璃质感样式、收起/展开行为、图标式导航。

- [ ] **Step 3: 更新 RBAC 权限映射**

修改 `src/lib/rbac-constants.ts`，添加新路由的权限映射：

```typescript
// 在 MENU_PERMISSION_MAP 中添加新路由
"/home": undefined,  // 首页所有人可见
"/ai-employees": PERMISSIONS.MENU_EMPLOYEES,
"/workflows": PERMISSIONS.MENU_MISSIONS,  // 复用任务中心权限
"/creation": undefined,  // Tab 级别控制（见下方）
"/content": undefined,   // Tab 级别控制
"/analytics": undefined, // Tab 级别控制

// 新增 Tab 权限映射
export const TAB_PERMISSION_MAP: Record<string, Record<string, string>> = {
  "/creation": {
    inspiration: PERMISSIONS.MENU_INSPIRATION,
    benchmarking: PERMISSIONS.MENU_BENCHMARKING,
    "super-creation": PERMISSIONS.MENU_SUPER_CREATION,
    "premium-content": PERMISSIONS.MENU_PREMIUM_CONTENT,
    "video-batch": PERMISSIONS.MENU_VIDEO_BATCH,
    "production-templates": PERMISSIONS.MENU_PRODUCTION_TEMPLATES,
  },
  "/content": {
    assets: PERMISSIONS.MENU_MEDIA_ASSETS,
    articles: PERMISSIONS.MENU_ARTICLES,
    categories: PERMISSIONS.MENU_CATEGORIES,
    intelligence: PERMISSIONS.MENU_ASSET_INTELLIGENCE,
    knowledge: PERMISSIONS.MENU_CHANNEL_KNOWLEDGE,
    revive: PERMISSIONS.MENU_ASSET_REVIVE,
  },
  "/analytics": {
    publishing: PERMISSIONS.MENU_PUBLISHING,
    analytics: PERMISSIONS.MENU_ANALYTICS,
    leaderboard: PERMISSIONS.MENU_LEADERBOARD,
    excellence: PERMISSIONS.MENU_CONTENT_EXCELLENCE,
  },
};
```

- [ ] **Step 4: 验证编译**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/app-sidebar.tsx src/components/layout/more-panel.tsx src/lib/rbac-constants.ts
git commit -m "refactor: simplify sidebar to 8 primary entries + more panel"
```

---

## Task 3: 员工图标快捷面板组件

**Files:**
- Create: `src/components/home/employee-quick-panel.tsx`

- [ ] **Step 1: 创建员工快捷面板**

```typescript
// src/components/home/employee-quick-panel.tsx
"use client";

import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

// 8 个核心员工（排除 advisor 和 leader）
const DISPLAY_EMPLOYEES: EmployeeId[] = [
  "xiaolei", "xiaoce", "xiaozi", "xiaowen",
  "xiaojian", "xiaoshen", "xiaofa", "xiaoshu",
];

interface EmployeeQuickPanelProps {
  onSelectEmployee: (slug: EmployeeId) => void;
}

export function EmployeeQuickPanel({ onSelectEmployee }: EmployeeQuickPanelProps) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-center gap-3 flex-wrap">
      {DISPLAY_EMPLOYEES.map((slug) => {
        const meta = EMPLOYEE_META[slug];
        return (
          <button
            key={slug}
            onClick={() => onSelectEmployee(slug)}
            className="group flex flex-col items-center gap-2 p-3 rounded-2xl
              transition-all duration-300 hover:scale-105
              hover:bg-white/5 backdrop-blur-sm"
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center
                text-2xl transition-all duration-300 group-hover:shadow-lg"
              style={{
                backgroundColor: meta.bgColor,
                boxShadow: `0 0 0 1px ${meta.color}20`,
              }}
            >
              <meta.icon className="w-6 h-6" style={{ color: meta.color }} />
            </div>
            <div className="text-center">
              <div className="text-xs font-medium text-white/80">
                {meta.nickname}
              </div>
              <div className="text-[10px] text-white/40">{meta.title}</div>
            </div>
          </button>
        );
      })}

      {/* "全部员工" 入口 */}
      <button
        onClick={() => router.push("/ai-employees")}
        className="group flex flex-col items-center gap-2 p-3 rounded-2xl
          transition-all duration-300 hover:scale-105 hover:bg-white/5"
      >
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center
          bg-gradient-to-br from-white/10 to-white/5 border border-white/10
          transition-all duration-300 group-hover:border-white/20">
          <Sparkles className="w-6 h-6 text-white/60" />
        </div>
        <div className="text-center">
          <div className="text-xs font-medium text-white/80">全部</div>
          <div className="text-[10px] text-white/40">员工</div>
        </div>
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/home/employee-quick-panel.tsx
git commit -m "feat: add employee quick panel component for home page"
```

---

## Task 4: 首页内嵌对话面板组件

**Files:**
- Create: `src/components/home/embedded-chat-panel.tsx`

- [ ] **Step 1: 创建内嵌对话面板**

该面板是首页的核心交互区域。输入后展开，显示对话过程，支持展开到独立对话页。

需要复用：
- `useChatStream` hook（Task 1）
- 意图识别组件（`IntentAnalyzing`, `IntentResultBubble`, `IntentConfirmCard`）
- 消息渲染（简化版，不需要完整 ChatPanel 的所有功能）

```typescript
// src/components/home/embedded-chat-panel.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import { IntentAnalyzing, IntentResultBubble, IntentConfirmCard } from "@/components/chat/intent-bubble";
import { Maximize2, X, Loader2, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveConversation } from "@/app/actions/conversations";

interface EmbeddedChatPanelProps {
  activeEmployee: EmployeeId;
  chat: ReturnType<typeof import("@/hooks/use-chat-stream").useChatStream>;
  onClose: () => void;
}

export function EmbeddedChatPanel({
  activeEmployee,
  chat,
  onClose,
}: EmbeddedChatPanelProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const meta = EMPLOYEE_META[activeEmployee];
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat.messages, chat.currentThinking]);

  // Persist conversation after first assistant response (guard against race)
  const savingRef = useRef(false);
  useEffect(() => {
    if (
      !conversationId &&
      !savingRef.current &&
      chat.messages.length >= 2 &&
      !chat.isStreaming &&
      chat.messages.some((m) => m.role === "assistant" && m.content)
    ) {
      savingRef.current = true;
      saveConversation({
        employeeSlug: activeEmployee,
        title: chat.messages.find((m) => m.role === "user")?.content.slice(0, 50) || "新对话",
        messages: chat.messages,
      }).then((saved) => {
        if (saved) setConversationId(saved.id);
        savingRef.current = false;
      });
    }
  }, [chat.messages, chat.isStreaming, conversationId, activeEmployee]);

  const handleExpand = () => {
    if (conversationId) {
      router.push(`/chat/${conversationId}`);
    } else {
      router.push(`/chat?employee=${activeEmployee}`);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto mt-6 rounded-2xl overflow-hidden
      bg-black/30 backdrop-blur-2xl border border-white/10
      shadow-2xl shadow-black/20
      animate-in slide-in-from-bottom-4 fade-in duration-500">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: meta.bgColor }}
          >
            <meta.icon className="w-4 h-4" style={{ color: meta.color }} />
          </div>
          <div>
            <span className="text-sm font-medium text-white/90">{meta.nickname}</span>
            <span className="text-xs text-white/40 ml-2">{meta.title}</span>
          </div>
          {chat.isStreaming && (
            <Loader2 className="w-4 h-4 text-white/40 animate-spin" />
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleExpand}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white/80"
            title="展开到独立页面"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white/80"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="max-h-96 overflow-y-auto p-4 space-y-4">
        {/* Intent analyzing indicator */}
        {chat.intentLoading && (
          <IntentAnalyzing steps={chat.intentProgress} />
        )}

        {/* Pending intent confirmation */}
        {chat.pendingIntent && !chat.isStreaming && chat.pendingIntent.confidence < 0.8 && (
          <IntentConfirmCard
            intent={chat.pendingIntent}
            onConfirm={chat.executeIntent}
            onCancel={chat.cancelIntent}
          />
        )}

        {/* Intent execution indicator */}
        {chat.pendingIntent && chat.isStreaming && (
          <IntentResultBubble
            intent={chat.pendingIntent}
            executing={chat.isStreaming}
            currentStep={chat.currentStep}
            onCancel={chat.cancelIntent}
          />
        )}

        {/* Messages */}
        {chat.messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                msg.role === "user"
                  ? "bg-blue-500/20 text-white/90"
                  : "bg-white/5 text-white/80"
              )}
            >
              {/* Thinking steps */}
              {msg.role === "assistant" && i === chat.messages.length - 1 && chat.currentThinking.length > 0 && (
                <div className="mb-2 space-y-1">
                  {chat.currentThinking.map((step, si) => (
                    <div key={si} className="text-xs text-white/30 flex items-center gap-1">
                      <Wrench className="w-3 h-3" /> {step.skillName || step.tool}
                    </div>
                  ))}
                </div>
              )}

              {/* Message content */}
              <div className="prose prose-invert prose-sm max-w-none">
                {msg.content || (
                  <span className="text-white/30 animate-pulse">思考中...</span>
                )}
              </div>

              {/* Sources & skills */}
              {msg.role === "assistant" && msg.skillsUsed && msg.skillsUsed.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {msg.skillsUsed.map((s, si) => (
                    <span
                      key={si}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40"
                    >
                      {s.skillName}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/home/embedded-chat-panel.tsx
git commit -m "feat: add embedded chat panel component for home page"
```

---

## Task 5: 最近任务/对话快捷区组件

**Files:**
- Create: `src/components/home/recent-section.tsx`

- [ ] **Step 1: 创建最近任务/对话组件**

```typescript
// src/components/home/recent-section.tsx
"use client";

import Link from "next/link";
import { Clock, ArrowRight, MessageSquare, Target } from "lucide-react";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

interface RecentMission {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  sourceModule?: string;
}

interface RecentConversation {
  id: string;
  title: string;
  employeeSlug: string;
  updatedAt: string;
}

interface RecentSectionProps {
  missions: RecentMission[];
  conversations: RecentConversation[];
}

export function RecentSection({ missions, conversations }: RecentSectionProps) {
  return (
    <div className="w-full max-w-3xl mx-auto mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* 最近任务 */}
      <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/5 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-medium text-white/70">
            <Target className="w-4 h-4" />
            最近任务
          </div>
          <Link
            href="/missions"
            className="text-xs text-white/40 hover:text-white/60 flex items-center gap-1 transition-colors"
          >
            查看全部 <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {missions.length === 0 ? (
          <div className="text-xs text-white/20 text-center py-4">暂无任务</div>
        ) : (
          <div className="space-y-2">
            {missions.slice(0, 5).map((mission) => (
              <Link
                key={mission.id}
                href={`/missions/${mission.id}`}
                className="block p-3 rounded-xl hover:bg-white/5 transition-colors"
              >
                <div className="text-sm text-white/80 truncate">{mission.title}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-white/30">
                    {formatDistanceToNow(new Date(mission.createdAt), {
                      addSuffix: true,
                      locale: zhCN,
                    })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* 最近对话 */}
      <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/5 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-medium text-white/70">
            <MessageSquare className="w-4 h-4" />
            最近对话
          </div>
          <Link
            href="/chat"
            className="text-xs text-white/40 hover:text-white/60 flex items-center gap-1 transition-colors"
          >
            查看全部 <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {conversations.length === 0 ? (
          <div className="text-xs text-white/20 text-center py-4">暂无对话</div>
        ) : (
          <div className="space-y-2">
            {conversations.slice(0, 5).map((conv) => {
              const empMeta = EMPLOYEE_META[conv.employeeSlug as EmployeeId];
              return (
                <Link
                  key={conv.id}
                  href={`/chat/${conv.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors"
                >
                  {empMeta && (
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: empMeta.bgColor }}
                    >
                      <empMeta.icon className="w-3.5 h-3.5" style={{ color: empMeta.color }} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white/80 truncate">{conv.title}</div>
                    <div className="text-[10px] text-white/30">
                      {formatDistanceToNow(new Date(conv.updatedAt), {
                        addSuffix: true,
                        locale: zhCN,
                      })}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/home/recent-section.tsx
git commit -m "feat: add recent missions/conversations component for home page"
```

---

## Task 6: 首页 — 服务端 + 客户端组件

**Files:**
- Create: `src/app/(dashboard)/home/page.tsx`
- Create: `src/app/(dashboard)/home/home-client.tsx`

- [ ] **Step 1: 创建首页服务端组件**

负责数据获取：最近任务、最近对话、员工列表。

```typescript
// src/app/(dashboard)/home/page.tsx
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { missions, savedConversations } from "@/db/schema";
import { userProfiles } from "@/db/schema/users";
import { desc, eq } from "drizzle-orm";
import { HomeClient } from "./home-client";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let recentMissions: any[] = [];
  let recentConversations: any[] = [];

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // Get user's organization
      const profile = await db
        .select({ organizationId: userProfiles.organizationId })
        .from(userProfiles)
        .where(eq(userProfiles.id, user.id))
        .limit(1);

      const orgId = profile[0]?.organizationId;

      // Fetch recent missions (missions belong to org, not individual user)
      if (orgId) {
        const missionsResult = await db
          .select({
            id: missions.id,
            title: missions.title,
            status: missions.status,
            createdAt: missions.createdAt,
            sourceModule: missions.sourceModule,
          })
          .from(missions)
          .where(eq(missions.organizationId, orgId))
          .orderBy(desc(missions.createdAt))
          .limit(5);

        recentMissions = missionsResult.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
        }));
      }

      // Fetch recent conversations (owned by user)
      const convsResult = await db
        .select({
          id: savedConversations.id,
          title: savedConversations.title,
          employeeSlug: savedConversations.employeeSlug,
          updatedAt: savedConversations.updatedAt,
        })
        .from(savedConversations)
        .where(eq(savedConversations.userId, user.id))
        .orderBy(desc(savedConversations.updatedAt))
        .limit(5);

      recentConversations = convsResult.map((c) => ({
        ...c,
        updatedAt: c.updatedAt.toISOString(),
      }));
    }
  } catch {
    // Graceful degradation
  }

  return (
    <HomeClient
      recentMissions={recentMissions}
      recentConversations={recentConversations}
    />
  );
}
```

- [ ] **Step 2: 创建首页客户端组件**

iOS 26 液态玻璃风格，统一输入框 + 员工面板 + 内嵌对话。

```typescript
// src/app/(dashboard)/home/home-client.tsx
"use client";

import { useState, useRef } from "react";
import { EmployeeQuickPanel } from "@/components/home/employee-quick-panel";
import { EmbeddedChatPanel } from "@/components/home/embedded-chat-panel";
import { RecentSection } from "@/components/home/recent-section";
import { useChatStream } from "@/hooks/use-chat-stream";
import type { EmployeeId } from "@/lib/constants";
import { Send, Paperclip, Sparkles } from "lucide-react";

interface HomeClientProps {
  recentMissions: any[];
  recentConversations: any[];
}

export function HomeClient({
  recentMissions,
  recentConversations,
}: HomeClientProps) {
  const [inputValue, setInputValue] = useState("");
  const [activeEmployee, setActiveEmployee] = useState<EmployeeId | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const chat = useChatStream({
    employeeSlug: activeEmployee || "xiaolei",
  });

  const handleSubmit = async () => {
    if (!inputValue.trim()) return;

    // If no employee selected, let intent recognition decide
    if (!activeEmployee) {
      setActiveEmployee("xiaolei"); // Default, intent will re-route
    }

    setChatOpen(true);
    const text = inputValue;
    setInputValue("");
    await chat.sendMessage(text);
  };

  const handleSelectEmployee = (slug: EmployeeId) => {
    setActiveEmployee(slug);
    setChatOpen(false);
    chat.clearMessages();
    inputRef.current?.focus();
  };

  const handleCloseChat = () => {
    setChatOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-[calc(100vh-80px)] px-4 pt-[10vh]">
      {/* Title */}
      <h1 className="text-3xl font-bold text-white/90 mb-2 tracking-tight">
        Vibetide{" "}
        <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          智媒工作空间
        </span>
      </h1>
      <p className="text-sm text-white/40 mb-8">
        描述你的需求，AI 员工为你完成
      </p>

      {/* Unified Input Box — iOS 26 liquid glass style */}
      <div className="w-full max-w-3xl">
        <div className="relative rounded-2xl overflow-hidden
          bg-white/[0.06] backdrop-blur-2xl
          border border-white/[0.12]
          shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)]
          transition-all duration-300
          focus-within:border-white/20
          focus-within:shadow-[0_8px_40px_rgba(59,130,246,0.15),inset_0_1px_0_rgba(255,255,255,0.15)]">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述你的需求，AI 员工为你完成..."
            rows={2}
            className="w-full bg-transparent px-5 pt-4 pb-12 text-sm text-white/90
              placeholder:text-white/30 resize-none focus:outline-none"
          />
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white/30 hover:text-white/60"
                title="添加附件"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              {activeEmployee && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 text-xs text-white/50">
                  <Sparkles className="w-3 h-3" />
                  {activeEmployee}
                </div>
              )}
            </div>
            <button
              onClick={handleSubmit}
              disabled={!inputValue.trim() || chat.isStreaming}
              className="p-2.5 rounded-xl bg-blue-500/80 hover:bg-blue-500/90
                disabled:opacity-30 disabled:cursor-not-allowed
                transition-all duration-200 text-white shadow-lg shadow-blue-500/20"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Employee Quick Panel */}
      <div className="mt-8">
        <EmployeeQuickPanel onSelectEmployee={handleSelectEmployee} />
      </div>

      {/* Embedded Chat Panel (conditionally rendered) */}
      {chatOpen && activeEmployee && (
        <EmbeddedChatPanel
          activeEmployee={activeEmployee}
          chat={chat}
          onClose={handleCloseChat}
        />
      )}

      {/* Recent Section */}
      {!chatOpen && (
        <RecentSection
          missions={recentMissions}
          conversations={recentConversations}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: 验证编译**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/home/
git commit -m "feat: add home page with unified input and embedded chat"
```

---

## Task 7: 路由重定向 — 登录后跳转 `/home`

**Files:**
- Modify: `src/app/page.tsx:10`
- Modify: `src/lib/supabase/middleware.ts:51`

- [ ] **Step 1: 修改根页面重定向**

```typescript
// src/app/page.tsx — 修改 redirect 目标
// 将 redirect("/missions") 改为 redirect("/home")
```

- [ ] **Step 2: 修改中间件认证重定向**

```typescript
// src/lib/supabase/middleware.ts — 修改认证用户重定向
// 将 url.pathname = "/missions" 改为 url.pathname = "/home"
```

- [ ] **Step 3: 添加旧路由重定向**

在 `next.config.ts`（或 `next.config.mjs`）中添加永久重定向，确保旧书签和分享链接不失效：

```typescript
// next.config.ts — 添加 redirects
async redirects() {
  return [
    { source: "/employee-marketplace", destination: "/ai-employees", permanent: true },
    { source: "/team-hub", destination: "/home", permanent: true },
  ];
},
```

- [ ] **Step 4: 验证编译和路由**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/lib/supabase/middleware.ts next.config.ts
git commit -m "feat: redirect authenticated users to /home, add legacy route redirects"
```

---

## Task 8: UI 视觉打磨 — iOS 26 液态玻璃风格

**角色:** UI Designer 主导

**Files:**
- Modify: `src/app/(dashboard)/home/home-client.tsx`
- Modify: `src/components/home/employee-quick-panel.tsx`
- Modify: `src/components/home/embedded-chat-panel.tsx`
- Modify: `src/components/home/recent-section.tsx`
- Modify: `src/components/layout/app-sidebar.tsx`

- [ ] **Step 1: 首页背景和光效**

为首页添加微妙的渐变背景光效和粒子效果，营造 AI 工作空间氛围：
- 顶部居中的柔和径向渐变光晕
- 输入框聚焦时的光效扩散
- 员工卡片的微光边框

关键 CSS 类：
```css
/* 页面光效 */
.home-glow {
  background: radial-gradient(ellipse 600px 400px at 50% 20%, rgba(59,130,246,0.08), transparent);
}

/* 玻璃卡片 */
.glass-card {
  background: rgba(255,255,255,0.03);
  backdrop-filter: blur(40px) saturate(1.2);
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06);
}
```

- [ ] **Step 2: 侧边栏视觉更新**

保持现有玻璃质感，但调整为更精简的图标导航样式：
- 默认状态：仅图标 + tooltip
- Hover：显示文字标签
- Active：左侧彩色指示条 + 图标高亮

- [ ] **Step 3: 动画和过渡**

- 输入框聚焦：border 颜色渐变 + 外发光扩散
- 对话面板展开：slide-in-from-bottom + fade-in（已在组件中预设）
- 员工卡片 hover：scale + 背景光
- 消息出现：fade-in-up

- [ ] **Step 4: 验证视觉效果**

手动在浏览器中验证所有视觉效果和动画，确保：
- 半透明玻璃效果在深色背景下层次分明
- 动画流畅无闪烁
- 响应式布局在不同屏幕尺寸下表现正常

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "style: apply iOS 26 liquid glass design to home page and sidebar"
```

---

## Task 9: 集成测试和验收

**角色:** Test Engineer 主导

**Files:**
- 验证范围覆盖所有新增/修改文件

- [ ] **Step 1: TypeScript 类型检查**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: PASS, no build errors

- [ ] **Step 3: 首页功能手动验证清单**

在浏览器中逐一验证：
- [ ] 登录后自动跳转到 `/home`
- [ ] 首页显示标题、输入框、员工图标面板
- [ ] 输入框可输入文字，Enter 发送
- [ ] 发送后展开内嵌对话面板，显示 AI 回复流
- [ ] 意图识别工作正常（高置信度自动执行/低置信度显示确认卡片）
- [ ] 点击"展开到独立页面"跳转到 `/chat`
- [ ] 点击员工图标切换对话上下文
- [ ] 最近任务和最近对话正确显示
- [ ] 点击"全部员工"跳转到 `/ai-employees`（此路由尚未创建，验证链接正确即可）

- [ ] **Step 4: 侧边栏功能验证**

- [ ] 侧边栏显示 8 个一级入口（首页/AI员工/工作流/任务中心/创作中心/内容管理/数据分析/更多）
- [ ] "更多"按钮点击弹出浮层面板
- [ ] 浮层面板中的链接可正常跳转
- [ ] RBAC 权限过滤生效（不同角色看到不同菜单）
- [ ] 当前页面高亮正确

- [ ] **Step 5: 对话中心回归测试**

确认提取 hook 后，原有对话中心功能不受影响：
- [ ] `/chat` 页面正常加载
- [ ] 员工切换正常
- [ ] 流式对话正常
- [ ] 意图识别和执行正常
- [ ] 会话保存和加载正常

- [ ] **Step 6: Commit**

```bash
git commit --allow-empty -m "test: phase 1 verification complete — home page and sidebar restructuring"
```

---

## Dependency Graph

```
Task 1 (useChatStream hook)
  ↓
Task 3 (employee quick panel)  ─┐  ← no dependency on Task 1
Task 4 (embedded chat panel)  ──┤  ← depends on Task 1
Task 5 (recent section)       ──┤  ← no dependency on Task 1
  ↓                             │
Task 6 (home page) ─────────────┘  depends on Tasks 1,3,4,5
  ↓
Task 2 (sidebar refactor)    ← independent, can parallel with Tasks 3-5
  ↓
Task 7 (route redirects)     ← depends on Task 6
  ↓
Task 8 (UI polish)           ← depends on Tasks 2,6,7
  ↓
Task 9 (integration test)    ← depends on all above
```

**Parallelization opportunities:**
- Task 2 (sidebar) can run in parallel with everything up to Task 7
- Tasks 3, 5 have no dependencies — can start immediately
- Task 4 depends on Task 1 only
- Note: sidebar routes `/ai-employees`, `/workflows`, `/creation`, `/content`, `/analytics` are Phase 2-4 items and will 404 until those phases are implemented. This is expected.
