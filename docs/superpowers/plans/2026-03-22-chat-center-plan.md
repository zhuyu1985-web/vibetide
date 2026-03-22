# AI 员工对话中心 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone conversation center (`/chat`) with IM layout enabling free chat and scenario-driven interactions with all 8 AI employees.

**Architecture:** New `/chat` route with dual-panel layout (employee list + chat). Reuses existing agent assembly pipeline and SSE streaming. Adds `saved_conversations` table for bookmarks. New `/api/chat/stream` endpoint for free chat, reusing the same SSE protocol as `/api/scenarios/execute`.

**Tech Stack:** Next.js 16, Drizzle ORM, Supabase Auth, AI SDK v6 (streamText, stepCountIs), SSE streaming, shadcn/ui, Tailwind CSS v4, Lucide icons

**Spec:** `docs/superpowers/specs/2026-03-22-chat-center-design.md`

---

## Phase 1: Database & Schema

### Task 1: Create `saved_conversations` schema

**Files:**
- Create: `src/db/schema/saved-conversations.ts`
- Modify: `src/db/schema/index.ts`
- Modify: `src/db/types.ts`

- [ ] **Step 1: Create schema file**

```typescript
// src/db/schema/saved-conversations.ts
import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { organizations } from "./users";

export const savedConversations = pgTable("saved_conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  userId: uuid("user_id").notNull(),
  employeeSlug: text("employee_slug").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  messages: jsonb("messages").notNull().$type<SavedMessageJson[]>(),
  scenarioId: uuid("scenario_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export interface SavedMessageJson {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  durationMs?: number;
  thinkingSteps?: { tool: string; label: string; skillName?: string }[];
  skillsUsed?: { tool: string; skillName: string }[];
  sources?: string[];
  referenceCount?: number;
}
```

- [ ] **Step 2: Export from schema index**

Add `export * from "./saved-conversations";` to `src/db/schema/index.ts`.

- [ ] **Step 3: Add DB types**

Add to `src/db/types.ts`:
```typescript
import { savedConversations } from "./schema/saved-conversations";
export type SavedConversationRow = InferSelectModel<typeof savedConversations>;
export type NewSavedConversation = InferInsertModel<typeof savedConversations>;
```

- [ ] **Step 4: Generate and apply migration**

Run: `npm run db:generate` then `npm run db:push`

- [ ] **Step 5: Commit**

```
feat: add saved_conversations schema for chat bookmarks
```

---

## Phase 2: Shared Utilities (Extract from existing code)

### Task 2: Extract SSE parser and chat types to shared utils

**Files:**
- Create: `src/lib/chat-utils.ts`

- [ ] **Step 1: Create shared chat utilities**

Extract `parseSSE`, chat types (`ChatMessage`, `ThinkingStep`, `SkillUsed`), and SSE event handling logic from `src/app/(dashboard)/employee/[id]/scenario-chat-sheet.tsx` into a shared module.

```typescript
// src/lib/chat-utils.ts

export interface ThinkingStep {
  tool: string;
  label: string;
  skillName?: string;
}

export interface SkillUsed {
  tool: string;
  skillName: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  durationMs?: number;
  thinkingSteps?: ThinkingStep[];
  skillsUsed?: SkillUsed[];
  sources?: string[];
  referenceCount?: number;
  scenarioCard?: {
    name: string;
    icon: string;
    inputs: Record<string, string>;
  };
}

/** Parse SSE events from a text buffer. Returns parsed events and remaining buffer. */
export function parseSSE(buffer: string) {
  const events: { event: string; data: string }[] = [];
  const parts = buffer.split("\n\n");
  const remaining = parts.pop() || "";

  for (const part of parts) {
    if (!part.trim()) continue;
    let eventType = "";
    let data = "";
    for (const line of part.split("\n")) {
      if (line.startsWith("event: ")) eventType = line.slice(7);
      else if (line.startsWith("data: ")) data = line.slice(6);
    }
    if (eventType && data) {
      events.push({ event: eventType, data });
    }
  }

  return { events, remaining };
}

/** Execute an SSE streaming request and process events into ChatMessage state. */
export async function executeStreamingChat(options: {
  url: string;
  body: Record<string, unknown>;
  onThinking: (step: ThinkingStep) => void;
  onSkillUsed: (skill: SkillUsed) => void;
  onSource: (sources: string[], totalReferences: number) => void;
  onTextDelta: (accumulated: string) => void;
  onDone: (data: { sources: string[]; referenceCount: number; skillsUsed: SkillUsed[] }) => void;
  onError: (message: string) => void;
}): Promise<{ text: string; durationMs: number; thinkingSteps: ThinkingStep[]; skillsUsed: SkillUsed[]; sources: string[]; referenceCount: number }> {
  const startTime = Date.now();
  const thinkingSteps: ThinkingStep[] = [];
  const skillsUsed: SkillUsed[] = [];
  const skillSet = new Set<string>();
  const sources: string[] = [];
  let refCount = 0;
  let accumulated = "";

  const res = await fetch(options.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options.body),
  });

  if (!res.ok) {
    throw new Error((await res.text()) || `HTTP ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No stream");

  const decoder = new TextDecoder();
  let sseBuffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    sseBuffer += decoder.decode(value, { stream: true });

    const { events, remaining } = parseSSE(sseBuffer);
    sseBuffer = remaining;

    for (const evt of events) {
      try {
        const payload = JSON.parse(evt.data);

        switch (evt.event) {
          case "thinking": {
            const step: ThinkingStep = {
              tool: payload.tool,
              label: payload.label,
              skillName: payload.skillName,
            };
            thinkingSteps.push(step);
            options.onThinking(step);
            if (payload.skillName && !skillSet.has(payload.tool)) {
              skillSet.add(payload.tool);
              skillsUsed.push({ tool: payload.tool, skillName: payload.skillName });
              options.onSkillUsed({ tool: payload.tool, skillName: payload.skillName });
            }
            break;
          }
          case "source": {
            const newSources = payload.sources as string[];
            for (const s of newSources) {
              if (!sources.includes(s)) sources.push(s);
            }
            refCount = payload.totalReferences ?? refCount;
            options.onSource([...sources], refCount);
            break;
          }
          case "text-delta": {
            accumulated += payload.text;
            options.onTextDelta(accumulated);
            break;
          }
          case "done": {
            refCount = payload.referenceCount ?? refCount;
            const finalSources = (payload.sources as string[]) ?? sources;
            if (Array.isArray(payload.skillsUsed)) {
              for (const s of payload.skillsUsed as SkillUsed[]) {
                if (!skillSet.has(s.tool)) {
                  skillSet.add(s.tool);
                  skillsUsed.push(s);
                }
              }
            }
            options.onDone({ sources: finalSources, referenceCount: refCount, skillsUsed });
            break;
          }
          case "error": {
            options.onError(payload.message || "未知错误");
            throw new Error(payload.message || "未知错误");
          }
        }
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message !== "未知错误" && !evt.data.startsWith("{")) {
          continue;
        }
        throw parseErr;
      }
    }
  }

  return {
    text: accumulated,
    durationMs: Date.now() - startTime,
    thinkingSteps,
    skillsUsed,
    sources,
    referenceCount: refCount,
  };
}
```

- [ ] **Step 2: Commit**

```
refactor: extract SSE parser and chat types to shared lib/chat-utils
```

---

## Phase 3: API Layer

### Task 3: Create free chat streaming endpoint

**Files:**
- Create: `src/app/api/chat/stream/route.ts`

- [ ] **Step 1: Create the endpoint**

Follows the same pattern as `src/app/api/scenarios/execute/route.ts` but without scenario template injection. Key differences:
- Accepts `employeeSlug` instead of `employeeDbId`
- No `scenarioId` or `userInputs`
- Uses agent's own system prompt without scenario overlay
- Same SSE event protocol (thinking/source/text-delta/done/error)

```typescript
// src/app/api/chat/stream/route.ts
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { aiEmployees, userProfiles } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { streamText, stepCountIs } from "ai";
import { getLanguageModel } from "@/lib/agent/model-router";
import { toVercelTools } from "@/lib/agent/tool-registry";
import { assembleAgent } from "@/lib/agent/assembly";
import { BUILTIN_SKILLS } from "@/lib/constants";

const TOOL_LABELS: Record<string, string> = {
  web_search: "正在搜索互联网资料",
  deep_read: "正在深度阅读网页",
  trending_topics: "正在获取全网热榜",
  content_generate: "正在生成内容",
  fact_check: "正在进行事实核查",
  media_search: "正在检索媒资库",
  data_report: "正在生成数据报告",
};

const TOOL_TO_SKILL: Record<string, string> = Object.fromEntries(
  BUILTIN_SKILLS.map((s) => [s.slug, s.name])
);

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url; }
}

function extractSources(toolResult: unknown): string[] {
  if (!toolResult || typeof toolResult !== "object") return [];
  const obj = toolResult as Record<string, unknown>;
  if (Array.isArray(obj.results)) {
    const domains = new Set<string>();
    for (const r of obj.results) {
      if (r && typeof r === "object") {
        const item = r as Record<string, unknown>;
        if (typeof item.url === "string") domains.add(extractDomain(item.url));
        else if (typeof item.source === "string") domains.add(item.source);
      }
    }
    return Array.from(domains);
  }
  if (typeof obj.url === "string") return [extractDomain(obj.url)];
  return [];
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  const { employeeSlug, message, conversationHistory } = body as {
    employeeSlug: string;
    message: string;
    conversationHistory?: { role: "user" | "assistant"; content: string }[];
  };

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile?.organizationId) return new Response("Organization not found", { status: 403 });

  const employeeRecord = await db.query.aiEmployees.findFirst({
    where: and(
      eq(aiEmployees.slug, employeeSlug),
      eq(aiEmployees.organizationId, profile.organizationId)
    ),
  });
  if (!employeeRecord) return new Response("员工不存在", { status: 404 });

  let agent;
  try {
    agent = await assembleAgent(employeeRecord.id);
  } catch (err) {
    return new Response(`Agent assembly failed: ${err instanceof Error ? err.message : String(err)}`, { status: 500 });
  }

  const messages: { role: "user" | "assistant"; content: string }[] = [];
  if (conversationHistory && conversationHistory.length > 0) {
    messages.push(...conversationHistory.slice(-10));
  }
  messages.push({ role: "user", content: message });

  let model;
  try {
    model = getLanguageModel(agent.modelConfig);
  } catch (err) {
    return new Response(`Model init failed: ${err instanceof Error ? err.message : String(err)}`, { status: 500 });
  }

  const vercelTools = toVercelTools(agent.tools, agent.pluginConfigs);

  const result = streamText({
    model,
    system: agent.systemPrompt,
    messages,
    tools: vercelTools,
    stopWhen: stepCountIs(10),
    maxOutputTokens: 8192,
    temperature: 0.5,
  });

  // SSE stream — same protocol as /api/scenarios/execute
  const encoder = new TextEncoder();
  const allSources: string[] = [];
  let referenceCount = 0;
  const usedSkills: { tool: string; skillName: string }[] = [];
  const usedToolSet = new Set<string>();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        for await (const part of result.fullStream) {
          switch (part.type) {
            case "tool-call": {
              const label = TOOL_LABELS[part.toolName] ?? `正在执行${part.toolName}`;
              const skillName = TOOL_TO_SKILL[part.toolName] ?? part.toolName;
              if (!usedToolSet.has(part.toolName)) {
                usedToolSet.add(part.toolName);
                usedSkills.push({ tool: part.toolName, skillName });
              }
              send("thinking", { tool: part.toolName, label, skillName });
              break;
            }
            case "tool-result": {
              const sources = extractSources(part.output);
              if (sources.length > 0) {
                for (const s of sources) { if (!allSources.includes(s)) allSources.push(s); }
                referenceCount += sources.length;
                send("source", { tool: part.toolName, sources, totalSources: allSources.length, totalReferences: referenceCount });
              }
              break;
            }
            case "text-delta": { send("text-delta", { text: part.text }); break; }
            case "finish": { send("done", { sources: allSources, referenceCount, finishReason: part.finishReason, skillsUsed: usedSkills }); break; }
          }
        }
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : "未知错误" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
```

- [ ] **Step 2: Commit**

```
feat: add /api/chat/stream endpoint for free employee chat
```

### Task 4: Create employee scenarios API endpoint

**Files:**
- Create: `src/app/api/employees/[slug]/scenarios/route.ts`

- [ ] **Step 1: Create the endpoint**

```typescript
// src/app/api/employees/[slug]/scenarios/route.ts
import { createClient } from "@/lib/supabase/server";
import { getScenariosByEmployeeSlug } from "@/lib/dal/scenarios";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json([], { status: 401 });

  const { slug } = await params;
  const scenarios = await getScenariosByEmployeeSlug(slug);
  return Response.json(scenarios);
}
```

- [ ] **Step 2: Commit**

```
feat: add GET /api/employees/[slug]/scenarios endpoint
```

### Task 5: Create conversation server actions and DAL

**Files:**
- Create: `src/lib/dal/conversations.ts`
- Create: `src/app/actions/conversations.ts`

- [ ] **Step 1: Create DAL**

```typescript
// src/lib/dal/conversations.ts
import { db } from "@/db";
import { savedConversations } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { getCurrentUserOrg } from "./shared";

export async function getSavedConversations(userId: string, employeeSlug?: string) {
  const conditions = [eq(savedConversations.userId, userId)];
  if (employeeSlug) {
    conditions.push(eq(savedConversations.employeeSlug, employeeSlug));
  }
  return db
    .select()
    .from(savedConversations)
    .where(and(...conditions))
    .orderBy(desc(savedConversations.createdAt))
    .limit(100);
}

export async function getSavedConversationById(id: string, userId: string) {
  return db.query.savedConversations.findFirst({
    where: and(
      eq(savedConversations.id, id),
      eq(savedConversations.userId, userId)
    ),
  });
}
```

- [ ] **Step 2: Create server actions**

```typescript
// src/app/actions/conversations.ts
"use server";

import { db } from "@/db";
import { savedConversations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { userProfiles } from "@/db/schema";
import { revalidatePath } from "next/cache";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile?.organizationId) throw new Error("No organization");
  return { userId: user.id, organizationId: profile.organizationId };
}

export async function saveConversation(data: {
  employeeSlug: string;
  title: string;
  messages: unknown[];
  scenarioId?: string;
  metadata?: Record<string, unknown>;
}) {
  const { userId, organizationId } = await requireAuth();
  const [row] = await db
    .insert(savedConversations)
    .values({
      organizationId,
      userId,
      employeeSlug: data.employeeSlug,
      title: data.title,
      messages: data.messages,
      scenarioId: data.scenarioId || null,
      metadata: data.metadata || null,
    })
    .returning({ id: savedConversations.id });
  revalidatePath("/chat");
  return { id: row.id };
}

export async function deleteSavedConversation(id: string) {
  const { userId } = await requireAuth();
  await db
    .delete(savedConversations)
    .where(and(eq(savedConversations.id, id), eq(savedConversations.userId, userId)));
  revalidatePath("/chat");
}

export async function updateConversationTitle(id: string, title: string) {
  const { userId } = await requireAuth();
  await db
    .update(savedConversations)
    .set({ title, updatedAt: new Date() })
    .where(and(eq(savedConversations.id, id), eq(savedConversations.userId, userId)));
  revalidatePath("/chat");
}
```

- [ ] **Step 3: Commit**

```
feat: add conversation DAL and server actions for chat bookmarks
```

---

## Phase 4: Frontend — Chat Center Page

### Task 6: Create chat center page (server component)

**Files:**
- Create: `src/app/(dashboard)/chat/page.tsx`
- Create: `src/app/(dashboard)/chat/loading.tsx`

- [ ] **Step 1: Create server page**

```typescript
// src/app/(dashboard)/chat/page.tsx
export const dynamic = "force-dynamic";

import { getEmployees } from "@/lib/dal/employees";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { userProfiles, savedConversations } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { ChatCenterClient } from "./chat-center-client";

export default async function ChatPage() {
  let employees, saved, userId;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id;
    [employees, saved] = await Promise.all([
      getEmployees(),
      user
        ? db
            .select()
            .from(savedConversations)
            .where(eq(savedConversations.userId, user.id))
            .orderBy(desc(savedConversations.createdAt))
            .limit(100)
        : [],
    ]);
  } catch {
    employees = [];
    saved = [];
  }
  return <ChatCenterClient employees={employees ?? []} savedConversations={saved ?? []} />;
}
```

- [ ] **Step 2: Create loading skeleton**

```typescript
// src/app/(dashboard)/chat/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <div className="w-[280px] border-r border-border/50 p-4 space-y-3">
        <Skeleton className="h-9 w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
      <div className="flex-1 p-6">
        <Skeleton className="h-12 w-1/3 mb-6" />
        <Skeleton className="h-[60vh] w-full" />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```
feat: add chat center server page with data loading
```

### Task 7: Create EmployeeListPanel component

**Files:**
- Create: `src/app/(dashboard)/chat/employee-list-panel.tsx`

- [ ] **Step 1: Create employee list panel**

Left panel (~280px) with:
- Search input
- Tab switch (员工 | 收藏)
- Employee list items (avatar, name, status, role title)
- Saved conversation items (title, employee, time)

Component receives `employees`, `savedConversations`, `selectedSlug`, `onSelectEmployee`, `onSelectSaved` as props. Uses `EmployeeAvatar`, `EMPLOYEE_META` for icons/colors. Shows relative time for saved conversations.

- [ ] **Step 2: Commit**

```
feat: add EmployeeListPanel for chat center left sidebar
```

### Task 8: Create ChatPanel component

**Files:**
- Create: `src/app/(dashboard)/chat/chat-panel.tsx`

- [ ] **Step 1: Create chat panel**

Right panel with:
- ChatHeader: employee avatar + name + title + bookmark button (☆/★) + "新对话" button
- ScenarioBar: horizontal scrollable row of ScenarioChip buttons. Each chip shows icon + name. Loads via `fetch(/api/employees/[slug]/scenarios)` on employee change.
- MessageList: renders ChatMessage array. Reuses markdown rendering from `collapsible-markdown.tsx`. Shows thinking steps (collapsible), source badges, skill badges on assistant messages. Shows scenario card for scenario-initiated messages.
- ChatInput: Auto-resizing textarea + send button. Uses border animation from existing code (`buildBorderPath`). Ctrl+Enter or click to send.

Uses `executeStreamingChat` from `lib/chat-utils.ts` for the streaming logic. Two modes:
- Free chat: POST to `/api/chat/stream`
- Scenario: first message POST to `/api/scenarios/execute`, follow-ups switch to `/api/chat/stream`

- [ ] **Step 2: Commit**

```
feat: add ChatPanel with streaming chat, scenarios, and bookmarks
```

### Task 9: Create ChatCenterClient (main layout)

**Files:**
- Create: `src/app/(dashboard)/chat/chat-center-client.tsx`

- [ ] **Step 1: Create client layout**

Composes `EmployeeListPanel` + `ChatPanel` in a flex row. Manages:
- `selectedEmployee` state (from URL query param `employee` or first employee)
- `messages` state (local, cleared on employee switch)
- `activeScenario` state
- `viewingSaved` state (null or saved conversation ID)
- Unsaved conversation warning on employee switch

Uses `useSearchParams` for `?employee=xxx` and `useRouter` to update URL.

- [ ] **Step 2: Commit**

```
feat: add ChatCenterClient composing employee list and chat panels
```

### Task 10: Create ScenarioFormSheet component

**Files:**
- Create: `src/app/(dashboard)/chat/scenario-form-sheet.tsx`

- [ ] **Step 1: Create scenario form sheet**

Sheet that opens when user clicks a scenario chip. Renders dynamic form fields from `scenario.inputFields`. On submit, closes sheet and triggers scenario execution in ChatPanel.

Reuses the form rendering pattern from `scenario-chat-sheet.tsx` lines 489-570 but as a standalone Sheet component.

- [ ] **Step 2: Commit**

```
feat: add ScenarioFormSheet for scenario parameter input
```

---

## Phase 5: Navigation & Integration

### Task 11: Add sidebar navigation entry

**Files:**
- Modify: `src/components/layout/app-sidebar.tsx`

- [ ] **Step 1: Add chat item to workspaceItems**

Add `MessageSquare` import and new nav item after "AI员工市场":

```typescript
import { MessageSquare } from "lucide-react";

const workspaceItems: NavItem[] = [
  { label: "任务中心", href: "/missions", icon: Target },
  { label: "AI员工市场", href: "/employee-marketplace", icon: UserCog },
  { label: "对话中心", href: "/chat", icon: MessageSquare },
  { label: "技能管理", href: "/skills", icon: Sparkles },
  { label: "频道顾问", href: "/channel-advisor", icon: Brain },
];
```

- [ ] **Step 2: Commit**

```
feat: add conversation center to sidebar navigation
```

### Task 12: Add "对话" button to employee marketplace cards

**Files:**
- Modify: `src/app/(dashboard)/employee-marketplace/employee-marketplace-client.tsx`

- [ ] **Step 1: Add chat button to employee cards**

Add a `MessageSquare` icon button on each employee card that links to `/chat?employee={slug}`. Place it next to the existing action buttons.

- [ ] **Step 2: Commit**

```
feat: add chat shortcut button on employee marketplace cards
```

---

## Phase 6: Scenario Seed Data

### Task 13: Create seed script for all 8 employee scenarios

**Files:**
- Create: `scripts/seed-scenarios.ts`

- [ ] **Step 1: Write scenario seed script**

Script that:
1. Connects to DB
2. For each of the 8 employees, finds their DB record by slug
3. Upserts 3-5 scenarios per employee into `employee_scenarios` table
4. Each scenario has: name, description, icon, systemInstruction (with {{}} templates), inputFields array, toolsHint array, sortOrder

Covers all 27 scenarios from the design spec:
- xiaolei: 突发热点监控, 竞品动态追踪, 热点深度解读
- xiaoce: 选题策划, 受众分析, 内容日历规划
- xiaozi: 素材搜集, 案例参考, 资料整理
- xiaowen: 文章创作, 标题生成, 脚本创作, 内容改写
- xiaojian: 视频策划, 封面设计建议, 音频方案
- xiaoshen: 内容审核, 合规检查, 事实核查
- xiaofa: 发布策略, 渠道分析, 推广方案
- xiaoshu: 数据报告, 趋势分析, 效果复盘

- [ ] **Step 2: Run seed script**

Run: `npx tsx scripts/seed-scenarios.ts`

- [ ] **Step 3: Commit**

```
feat: seed 27 scenarios for all 8 AI employees
```

---

## Phase 7: Verification & Polish

### Task 14: Type check and build verification

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Fix any type errors.

- [ ] **Step 2: Build**

Run: `npm run build`
Fix any build errors.

- [ ] **Step 3: Final commit**

```
fix: resolve type and build issues for chat center
```

### Task 15: Update ScenarioChatSheet to use shared utils

**Files:**
- Modify: `src/app/(dashboard)/employee/[id]/scenario-chat-sheet.tsx`

- [ ] **Step 1: Refactor to use shared types**

Import `ChatMessage`, `ThinkingStep`, `SkillUsed`, `parseSSE` from `@/lib/chat-utils` instead of locally defining them. Remove duplicate type definitions and the local `parseSSE` function.

- [ ] **Step 2: Verify existing scenario workbench still works**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```
refactor: ScenarioChatSheet uses shared chat-utils
```

---

## Agent Team Assignment

For parallel execution:

| Agent | Tasks | Scope |
|-------|-------|-------|
| **全栈开发 Agent 1** | Tasks 1-5 | Schema, APIs, DAL, Server Actions |
| **全栈开发 Agent 2** | Tasks 6-10 | Frontend components |
| **全栈开发 Agent 3** | Tasks 11-13 | Navigation, marketplace integration, seed data |
| **测试 Agent** | Tasks 14-15 | Type check, build, refactor verification |

Tasks 6-10 depend on Tasks 1-5 (need schema + API).
Tasks 11-13 can run in parallel with Tasks 6-10.
Tasks 14-15 run after all others complete.
