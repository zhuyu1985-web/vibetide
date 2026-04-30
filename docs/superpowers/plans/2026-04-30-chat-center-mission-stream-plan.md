# 对话中心 · 场景任务流式对话化 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把对话中心场景启动后的静态 `MissionCard` 替换为逐步骤气泡流（计划总览 + 每步气泡 + sticky 进度 chip + 失败重试 + 收尾气泡），并扩展 SSE 把 `outputSummary` / `errorMessage` / 模板 step 元信息一起推到前端。

**Architecture:** 后端只动 `/api/missions/[id]/progress` SSE 路由（加 `mission-init` 事件 + 扩 task-update payload）和 `parse-mission-event` 解析层；前端拆 5 个组件 + 1 个打字机 hook；新增 `retryMissionTask` server action 走现有 `mission/task-ready` Inngest 事件。执行引擎、`/missions/[id]` 详情页、自由对话路径全部不动。

**Tech Stack:** Next.js 16 / React 19 / TypeScript strict / Drizzle ORM / Inngest / SSE / Tailwind 4 / vitest（环境为 `node`，无 React 组件单测）

**Spec:** `docs/superpowers/specs/2026-04-30-chat-center-mission-stream-design.md`

**Single-branch policy:** 仓库强制单 main 分支（CLAUDE.md `Git Workflow`）。本计划切成 3 个独立可发的 commit，每个 commit 都能 `npx tsc --noEmit && npm run build` 单独通过。**不要建 worktree、不要建 feature 分支。**

---

## 文件结构（locked-in）

### 新建

| 路径 | 责任 |
|------|------|
| `src/lib/hooks/use-typewriter.ts` | 打字机渲染 hook：`useTypewriter(text, charsPerSec, key)` —— `key` 变化时重新播放，否则不回放 |
| `src/lib/hooks/__tests__/use-typewriter.test.ts` | 上面那个 hook 的单测 |
| `src/components/chat/mission-stream.tsx` | 替换 `MissionCardMessage` 在对话流里的入口；内部聚合所有 mission 子组件 |
| `src/components/chat/mission-planning-bubble.tsx` | 计划总览气泡（单独抽，便于将来复用） |
| `src/components/chat/mission-step-bubble.tsx` | 单个步骤气泡（5 种状态机渲染） |
| `src/components/chat/mission-progress-chip.tsx` | 右上角 sticky 进度 chip |
| `src/components/chat/mission-summary-bubble.tsx` | 收尾气泡（completed / failed） |
| `src/lib/mission-task-status.ts` | DB 9 状态 → UI 5 状态的纯函数映射 + 单测 |
| `src/lib/__tests__/mission-task-status.test.ts` | 上面映射的单测 |

### 修改

| 路径 | 改动 |
|------|------|
| `src/lib/chat/parse-mission-event.ts` | 加 `MissionInitData` 类型 + `mission-init` 事件分支 + `MissionTask` 扩字段（outputSummary / errorMessage / errorRecoverable / retryCount / phase / assignedRole） |
| `src/lib/chat/__tests__/parse-mission-event.test.ts` | 新事件 + 新字段的测试 |
| `src/lib/hooks/use-mission-progress.ts` | 注册 `mission-init` 监听；返回 state 多带一个 `init` 字段 |
| `src/app/api/missions/[id]/progress/route.ts` | 连接建立时发一次 `mission-init` 事件（查 workflow_templates.steps 拿 step name + skillName）；task-update payload 多带 outputSummary / errorMessage / errorRecoverable / retryCount / phase |
| `src/app/actions/missions.ts` | 新增 `retryMissionTask(taskId)` server action：reset task → emit `mission/task-ready` |
| `src/app/(dashboard)/chat/chat-panel.tsx:670` | `mission_card` 分支从 `<MissionCardMessage>` 改为 `<MissionStream>` |

### 删除

| 路径 | 原因 |
|------|------|
| `src/components/chat/mission-card-message.tsx` | 被 `MissionStream` 完全替换；本仓库内只在 `chat-panel.tsx:670` 一处用 |

---

## Commit 切片（强制顺序）

1. **Commit 1 — 后端 SSE 扩展 + 解析层**：T1 → T7。落地后老 `MissionCardMessage` 仍能工作（多余字段不读），可先发可后发。
2. **Commit 2 — 前端组件 + 切换 + 删旧**：T8 → T17。一次性原子切换。
3. **Commit 3 — 重试 server action + 重试按钮接线**：T18 → T20。Commit 2 的"重试本步"按钮先 stub 跳转到 `/missions/[id]`，Commit 3 替换为内联调用。

每个 commit 末尾跑 `npx tsc --noEmit && npm test && npm run build`，全绿才落 commit。

---

## Commit 1：后端 SSE 扩展

### Task 1：`MissionInitData` / `MissionTask` 类型扩展（TDD）

**Files:**
- Modify: `src/lib/chat/parse-mission-event.ts`
- Modify: `src/lib/chat/__tests__/parse-mission-event.test.ts`

- [ ] **Step 1.1：写失败测试** —— 测 `mission-init` 事件被解析成 `state.init`

在 `src/lib/chat/__tests__/parse-mission-event.test.ts` 末尾追加：

```ts
describe("applyMissionEvent · mission-init", () => {
  it("stores init payload on first emission", () => {
    let s = emptyMissionProgress();
    s = applyMissionEvent(s, "mission-init", JSON.stringify({
      templateId: "tpl-1",
      templateName: "深度新闻调研",
      steps: [
        { phase: 1, name: "全网线索扫描", skillName: "热点扫描" },
        { phase: 2, name: "深度信息采集", skillName: "网页深读" },
      ],
    }));
    expect(s.init).not.toBeNull();
    expect(s.init?.templateName).toBe("深度新闻调研");
    expect(s.init?.steps).toHaveLength(2);
    expect(s.init?.steps[0].skillName).toBe("热点扫描");
  });

  it("ignores malformed init payload", () => {
    let s = emptyMissionProgress();
    s = applyMissionEvent(s, "mission-init", "{not json");
    expect(s.init).toBeNull();
  });
});

describe("applyMissionEvent · task-update extended fields", () => {
  it("captures outputSummary on completion", () => {
    let s = emptyMissionProgress();
    s = applyMissionEvent(s, "task-update", JSON.stringify({
      taskId: "t1", title: "选题", status: "completed",
      outputSummary: "已识别 3 条主线索",
      phase: 1,
    }));
    expect(s.tasksById.t1.outputSummary).toBe("已识别 3 条主线索");
    expect(s.tasksById.t1.phase).toBe(1);
  });

  it("captures error fields on failure", () => {
    let s = emptyMissionProgress();
    s = applyMissionEvent(s, "task-update", JSON.stringify({
      taskId: "t1", title: "核验", status: "failed",
      errorMessage: "知网 API 403",
      errorRecoverable: true,
      retryCount: 1,
    }));
    expect(s.tasksById.t1.errorMessage).toBe("知网 API 403");
    expect(s.tasksById.t1.errorRecoverable).toBe(true);
    expect(s.tasksById.t1.retryCount).toBe(1);
  });
});
```

- [ ] **Step 1.2：跑测试，看到失败**

```bash
npx vitest run src/lib/chat/__tests__/parse-mission-event.test.ts
```

预期：3 个新 case 失败（`init` undefined / 字段不存在）。

- [ ] **Step 1.3：实现** —— 修改 `src/lib/chat/parse-mission-event.ts`

完整新文件内容：

```ts
export type MissionEventName =
  | "task-update"
  | "mission-progress"
  | "mission-completed"
  | "mission-init"
  | "error";

export interface MissionTask {
  id: string;
  title: string;
  status: "pending" | "ready" | "claimed" | "in_progress" | "in_review" | "completed" | "failed" | "cancelled" | "blocked";
  progress?: number;
  assignedEmployeeId?: string | null;
  outputSummary?: string | null;
  errorMessage?: string | null;
  errorRecoverable?: boolean;
  retryCount?: number;
  phase?: number | null;
}

export interface MissionInitStep {
  phase: number;
  name: string;
  skillName?: string;
  assignedEmployeeIdHint?: string;
}

export interface MissionInitData {
  templateId: string;
  templateName: string;
  steps: MissionInitStep[];
}

export interface MissionProgressData {
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  tasksById: Record<string, MissionTask>;
  notFound: boolean;
  init: MissionInitData | null;
}

export function emptyMissionProgress(): MissionProgressData {
  return { status: "pending", progress: 0, tasksById: {}, notFound: false, init: null };
}

export function applyMissionEvent(
  prev: MissionProgressData,
  event: MissionEventName,
  raw: string,
): MissionProgressData {
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return prev; }
  if (typeof data !== "object" || data === null) return prev;
  const d = data as Record<string, unknown>;

  if (event === "error" && d.message === "Mission not found") {
    return { ...prev, notFound: true };
  }
  if (event === "mission-init") {
    if (typeof d.templateId !== "string" || !Array.isArray(d.steps)) return prev;
    return {
      ...prev,
      init: {
        templateId: d.templateId,
        templateName: String(d.templateName ?? ""),
        steps: (d.steps as unknown[]).map((s) => {
          const r = s as Record<string, unknown>;
          return {
            phase: typeof r.phase === "number" ? r.phase : 0,
            name: String(r.name ?? ""),
            skillName: typeof r.skillName === "string" ? r.skillName : undefined,
            assignedEmployeeIdHint: typeof r.assignedEmployeeIdHint === "string"
              ? r.assignedEmployeeIdHint : undefined,
          };
        }),
      },
    };
  }
  if (event === "task-update" && typeof d.taskId === "string") {
    return {
      ...prev,
      tasksById: {
        ...prev.tasksById,
        [d.taskId]: {
          id: d.taskId,
          title: String(d.title ?? ""),
          status: (d.status as MissionTask["status"]) ?? "pending",
          progress: typeof d.progress === "number" ? d.progress : undefined,
          assignedEmployeeId: (d.assignedEmployeeId as string | null) ?? null,
          outputSummary: typeof d.outputSummary === "string" ? d.outputSummary : null,
          errorMessage: typeof d.errorMessage === "string" ? d.errorMessage : null,
          errorRecoverable: typeof d.errorRecoverable === "boolean" ? d.errorRecoverable : undefined,
          retryCount: typeof d.retryCount === "number" ? d.retryCount : 0,
          phase: typeof d.phase === "number" ? d.phase : null,
        },
      },
    };
  }
  if (event === "mission-progress" || event === "mission-completed") {
    return {
      ...prev,
      status: (d.status as MissionProgressData["status"]) ?? prev.status,
      progress: typeof d.progress === "number" ? d.progress : prev.progress,
    };
  }
  return prev;
}
```

- [ ] **Step 1.4：跑测试看 PASS**

```bash
npx vitest run src/lib/chat/__tests__/parse-mission-event.test.ts
```

预期：所有 case 都 PASS（包括原有的 + 新加的）。

---

### Task 2：DB 状态 → UI 状态映射工具（TDD）

**Files:**
- Create: `src/lib/mission-task-status.ts`
- Create: `src/lib/__tests__/mission-task-status.test.ts`

- [ ] **Step 2.1：写失败测试**

`src/lib/__tests__/mission-task-status.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mapTaskStatusToUiState, type UiTaskState } from "@/lib/mission-task-status";

describe("mapTaskStatusToUiState", () => {
  const cases: Array<[string, UiTaskState]> = [
    ["pending", "pending"],
    ["ready", "pending"],
    ["claimed", "pending"],
    ["blocked", "pending"],
    ["in_progress", "running"],
    ["in_review", "running"],
    ["completed", "completed"],
    ["failed", "failed"],
    ["cancelled", "cancelled"],
  ];

  for (const [db, ui] of cases) {
    it(`maps ${db} → ${ui}`, () => {
      expect(mapTaskStatusToUiState(db as never)).toBe(ui);
    });
  }

  it("falls back to pending on unknown", () => {
    expect(mapTaskStatusToUiState("garbage" as never)).toBe("pending");
  });
});
```

- [ ] **Step 2.2：跑测试看失败**

```bash
npx vitest run src/lib/__tests__/mission-task-status.test.ts
```

- [ ] **Step 2.3：实现**

`src/lib/mission-task-status.ts`:

```ts
import type { MissionTask } from "@/lib/chat/parse-mission-event";

export type UiTaskState =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export function mapTaskStatusToUiState(s: MissionTask["status"]): UiTaskState {
  switch (s) {
    case "pending":
    case "ready":
    case "claimed":
    case "blocked":
      return "pending";
    case "in_progress":
    case "in_review":
      return "running";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return "pending";
  }
}
```

- [ ] **Step 2.4：跑测试看 PASS**

```bash
npx vitest run src/lib/__tests__/mission-task-status.test.ts
```

---

### Task 3：扩展 `useMissionProgress` 透出 init

**Files:**
- Modify: `src/lib/hooks/use-mission-progress.ts`

- [ ] **Step 3.1：实现**

把 hook 改为：

```ts
"use client";

import { useEffect, useState } from "react";
import {
  applyMissionEvent,
  emptyMissionProgress,
  type MissionProgressData,
  type MissionEventName,
} from "@/lib/chat/parse-mission-event";

export function useMissionProgress(missionId: string): MissionProgressData & {
  isLoading: boolean;
} {
  const [prevMissionId, setPrevMissionId] = useState(missionId);
  const [state, setState] = useState<MissionProgressData>(emptyMissionProgress);
  const [isLoading, setIsLoading] = useState(true);

  if (prevMissionId !== missionId) {
    setPrevMissionId(missionId);
    setState(emptyMissionProgress());
    setIsLoading(true);
  }

  useEffect(() => {
    if (!missionId) return;

    const es = new EventSource(`/api/missions/${missionId}/progress`);

    const onEvent = (name: MissionEventName) => (ev: Event) => {
      const me = ev as MessageEvent;
      setIsLoading(false);
      setState((prev) => applyMissionEvent(prev, name, me.data));
    };

    es.addEventListener("mission-init", onEvent("mission-init"));
    es.addEventListener("task-update", onEvent("task-update"));
    es.addEventListener("mission-progress", onEvent("mission-progress"));
    es.addEventListener("mission-completed", (ev) => {
      onEvent("mission-completed")(ev);
      es.close();
    });
    es.addEventListener("error", (ev) => {
      if ((ev as MessageEvent).data) {
        onEvent("error")(ev);
      }
    });

    return () => es.close();
  }, [missionId]);

  return { ...state, isLoading };
}
```

- [ ] **Step 3.2：tsc 验证**

```bash
npx tsc --noEmit
```

预期：通过。

---

### Task 4：扩展 SSE 路由 emit `mission-init` + 新字段

**Files:**
- Modify: `src/app/api/missions/[id]/progress/route.ts`

- [ ] **Step 4.1：替换整个文件**

```ts
import { NextRequest } from "next/server";
import { db } from "@/db";
import { missions, missionTasks } from "@/db/schema";
import { workflowTemplates } from "@/db/schema/workflows";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: missionId } = await params;

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      // 一次性发 mission-init
      try {
        const m = await db.query.missions.findFirst({
          where: eq(missions.id, missionId),
          columns: { id: true, workflowTemplateId: true, title: true },
        });
        if (m?.workflowTemplateId) {
          const tpl = await db.query.workflowTemplates.findFirst({
            where: eq(workflowTemplates.id, m.workflowTemplateId),
            columns: { id: true, name: true, steps: true },
          });
          if (tpl) {
            const initSteps = (tpl.steps ?? [])
              .map((s, idx) => ({
                phase: typeof s.order === "number" ? s.order : idx + 1,
                name: s.name ?? s.label ?? "",
                skillName: s.config?.skillName,
                assignedEmployeeIdHint: s.config?.employeeSlug ?? s.employeeSlug,
              }))
              .sort((a, b) => a.phase - b.phase);
            send("mission-init", {
              templateId: tpl.id,
              templateName: tpl.name,
              steps: initSteps,
            });
          }
        }
      } catch {
        // init 拉失败不致命，前端会 fallback
      }

      let prevTaskMap = new Map<string, string>();
      let prevProgress = -1;
      let prevStatus = "";

      const poll = async () => {
        if (closed) return;

        try {
          const [mission, tasks] = await Promise.all([
            db.select({ status: missions.status, progress: missions.progress })
              .from(missions).where(eq(missions.id, missionId)).limit(1),
            db.select({
              id: missionTasks.id,
              title: missionTasks.title,
              status: missionTasks.status,
              progress: missionTasks.progress,
              assignedEmployeeId: missionTasks.assignedEmployeeId,
              outputSummary: missionTasks.outputSummary,
              errorMessage: missionTasks.errorMessage,
              errorRecoverable: missionTasks.errorRecoverable,
              retryCount: missionTasks.retryCount,
              phase: missionTasks.phase,
            }).from(missionTasks).where(eq(missionTasks.missionId, missionId)),
          ]);

          if (!mission[0]) {
            send("error", { message: "Mission not found" });
            closed = true;
            controller.close();
            return;
          }

          const m = mission[0];

          for (const t of tasks) {
            const prev = prevTaskMap.get(t.id);
            if (prev !== t.status) {
              send("task-update", {
                taskId: t.id,
                title: t.title,
                status: t.status,
                progress: t.progress,
                assignedEmployeeId: t.assignedEmployeeId,
                outputSummary: t.outputSummary,
                errorMessage: t.errorMessage,
                errorRecoverable: t.errorRecoverable === 1,
                retryCount: t.retryCount,
                phase: t.phase,
              });
            }
          }

          if (m.progress !== prevProgress || m.status !== prevStatus) {
            send("mission-progress", {
              status: m.status,
              progress: m.progress,
              completedTasks: tasks.filter((t) => t.status === "completed").length,
              totalTasks: tasks.length,
            });
          }

          prevTaskMap = new Map(tasks.map((t) => [t.id, t.status]));
          prevProgress = m.progress;
          prevStatus = m.status;

          if (["completed", "failed", "cancelled"].includes(m.status)) {
            send("mission-completed", { status: m.status, progress: m.progress });
            closed = true;
            controller.close();
            return;
          }
        } catch {
          // skip this tick
        }

        if (!closed) {
          setTimeout(poll, 2000);
        }
      };

      poll();

      req.signal.addEventListener("abort", () => {
        closed = true;
      });
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

注意点：
- `errorRecoverable` 在 DB 是 `integer`(0/1)，前端用 boolean，路由层转一下。
- `tpl.steps` 可能是 `WorkflowStepDef[]`，既有的字段名 `name` / `order` / `config.skillName` 在 `src/db/schema/workflows.ts:25-47` 已定义。

- [ ] **Step 4.2：tsc**

```bash
npx tsc --noEmit
```

预期：通过。如果 `tpl.steps` 类型 narrow 报警，加 `as WorkflowStepDef[]` 显式断言。

- [ ] **Step 4.3：手动 smoke test（dev server）**

```bash
npm run dev
```

打开 `/chat`，启动任意场景；浏览器 DevTools Network → `progress` SSE 连接 → 看到事件流：
- 第一条 `event: mission-init`，data 含 `templateId / templateName / steps[]`
- 后续 `event: task-update` 含 `outputSummary` / `errorMessage` / `phase` 等新字段

如果 init 没出来：检查 mission 是否真有 `workflowTemplateId`（自由对话路径生成的 mission 可能为 null —— 这种情况 init 缺失是正常的，前端要兜住）。

---

### Task 5：Commit 1

- [ ] **Step 5.1：跑全套验证**

```bash
npx tsc --noEmit && npm test && npm run build
```

三个全绿才能 commit。`npm test` 跑全部 vitest，包含新加的 5 个测试 case。

- [ ] **Step 5.2：commit**

```bash
git add src/lib/chat/parse-mission-event.ts \
        src/lib/chat/__tests__/parse-mission-event.test.ts \
        src/lib/mission-task-status.ts \
        src/lib/__tests__/mission-task-status.test.ts \
        src/lib/hooks/use-mission-progress.ts \
        src/app/api/missions/\[id\]/progress/route.ts
git commit -m "$(cat <<'EOF'
feat(chat): SSE 加 mission-init 事件 + task-update 扩字段，准备前端 mission stream

- parse-mission-event 加 MissionInitData 类型与 mission-init 事件分支
- MissionTask 新增 outputSummary / errorMessage / errorRecoverable / retryCount / phase
- DB 9 状态映射到 UI 5 状态的纯函数 + 单测
- useMissionProgress 注册 mission-init 监听并透出 init 字段
- /api/missions/[id]/progress 启动时一次性下发 template steps（含 skillName）；task-update payload 多带新字段
- 老的 MissionCardMessage 不消费新字段，兼容继续工作

下一 commit 落前端组件切换。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Commit 2：前端组件 + 切换 + 删旧

### Task 6：`useTypewriter` hook（TDD）

**Files:**
- Create: `src/lib/hooks/use-typewriter.ts`
- Create: `src/lib/hooks/__tests__/use-typewriter.test.ts`

> **注意**：vitest 当前 `environment: "node"`，hook 需要在 happy-dom 或 jsdom 下测才能用 React Testing Library。我们这里**不引入 RTL**——只测纯函数 / 计时逻辑。把 hook 拆成两块：①纯函数 `nextRevealLength(text, startedAt, charsPerSec, now)`（可 node 测） ②useEffect 仅做 setInterval。只测纯函数。

- [ ] **Step 6.1：写失败测试**

`src/lib/hooks/__tests__/use-typewriter.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { nextRevealLength } from "@/lib/hooks/use-typewriter";

describe("nextRevealLength", () => {
  it("returns 0 at start time", () => {
    expect(nextRevealLength("hello world", 1000, 30, 1000)).toBe(0);
  });

  it("reveals chars proportional to elapsed", () => {
    // 30 chars/sec, 1s elapsed → 30 chars
    expect(nextRevealLength("a".repeat(50), 0, 30, 1000)).toBe(30);
  });

  it("clamps to text length", () => {
    expect(nextRevealLength("hello", 0, 30, 10000)).toBe(5);
  });

  it("handles empty text", () => {
    expect(nextRevealLength("", 0, 30, 999)).toBe(0);
  });

  it("handles non-positive charsPerSec by revealing all", () => {
    expect(nextRevealLength("hello", 0, 0, 0)).toBe(5);
  });
});
```

- [ ] **Step 6.2：跑看失败**

```bash
npx vitest run src/lib/hooks/__tests__/use-typewriter.test.ts
```

- [ ] **Step 6.3：实现**

`src/lib/hooks/use-typewriter.ts`:

```ts
"use client";

import { useEffect, useRef, useState } from "react";

export function nextRevealLength(
  text: string,
  startedAt: number,
  charsPerSec: number,
  now: number,
): number {
  if (!text) return 0;
  if (charsPerSec <= 0) return text.length;
  const elapsedSec = Math.max(0, (now - startedAt) / 1000);
  return Math.min(text.length, Math.floor(elapsedSec * charsPerSec));
}

/**
 * 打字机渲染。`replayKey` 变化时重新播放；同 key 重渲不回放。
 * 用法：useTypewriter(outputSummary, 30, taskId)
 */
export function useTypewriter(
  text: string,
  charsPerSec: number,
  replayKey: string | null,
): string {
  const [revealed, setRevealed] = useState("");
  const playedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!replayKey) {
      setRevealed(text);
      return;
    }
    if (playedRef.current.has(replayKey)) {
      // 已经播过，直接补全
      setRevealed(text);
      return;
    }
    playedRef.current.add(replayKey);
    const startedAt = Date.now();
    setRevealed("");

    const id = setInterval(() => {
      const n = nextRevealLength(text, startedAt, charsPerSec, Date.now());
      setRevealed(text.slice(0, n));
      if (n >= text.length) clearInterval(id);
    }, 50);

    return () => clearInterval(id);
  }, [text, charsPerSec, replayKey]);

  return revealed;
}
```

- [ ] **Step 6.4：跑测试**

```bash
npx vitest run src/lib/hooks/__tests__/use-typewriter.test.ts
```

预期：5 个 case PASS。

---

### Task 7：`MissionPlanningBubble` 组件

**Files:**
- Create: `src/components/chat/mission-planning-bubble.tsx`

- [ ] **Step 7.1：实现**

```tsx
"use client";

import { CheckCircle2 } from "lucide-react";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import type { MissionInitData } from "@/lib/chat/parse-mission-event";
import type { AIEmployee } from "@/lib/types";

interface Props {
  init: MissionInitData;
  ownerEmployee: AIEmployee | null; // 对话框顶上选定的员工，作为发声头像
  employees: AIEmployee[];          // 用于反查 employee 名
}

export function MissionPlanningBubble({ init, ownerEmployee, employees }: Props) {
  // 计划气泡里"员工去重列表"：按 init.steps 取 assignedEmployeeIdHint，反查 EMPLOYEE_META
  const participantNames = Array.from(
    new Set(
      init.steps
        .map((s) => s.assignedEmployeeIdHint)
        .filter(Boolean) as string[]
    ),
  ).map((slug) => EMPLOYEE_META[slug as EmployeeId]?.name ?? slug);

  const ownerName = ownerEmployee
    ? EMPLOYEE_META[ownerEmployee.id as EmployeeId]?.name ?? ownerEmployee.title
    : "AI 团队";

  return (
    <div className="flex gap-3">
      {ownerEmployee && (
        <EmployeeAvatar
          employeeId={ownerEmployee.id}
          size="sm"
          className="mt-0.5 flex-shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <CheckCircle2 size={14} className="text-blue-500" />
          <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
            {ownerName}已规划任务
          </span>
          <span className="text-[11px] text-gray-400">耗时 0.2s · 无 LLM 调用</span>
        </div>
        <div className="bg-gradient-to-br from-white/90 to-gray-50/70 dark:from-gray-800/60 dark:to-gray-800/40 backdrop-blur-sm rounded-2xl px-5 py-4 shadow-[0_1px_6px_rgba(0,0,0,0.06)] ring-1 ring-gray-200/30 dark:ring-gray-700/30">
          <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">
            理解了。本次「<strong>{init.templateName}</strong>」共 <strong className="text-blue-600">{init.steps.length} 步</strong>
            {participantNames.length > 0 && (
              <>，由 {participantNames.join(" / ")} 协作完成</>
            )}
            ：
          </p>
          <ol className="mt-2.5 space-y-1.5 text-[13px] text-gray-700 dark:text-gray-300">
            {init.steps.map((s, i) => {
              const empName = s.assignedEmployeeIdHint
                ? EMPLOYEE_META[s.assignedEmployeeIdHint as EmployeeId]?.name ?? s.assignedEmployeeIdHint
                : null;
              return (
                <li key={i} className="flex items-start gap-2">
                  <span className="font-mono text-gray-400 w-4 flex-shrink-0">{i + 1}.</span>
                  <div className="flex-1">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{s.name}</span>
                    {empName && <> — {empName}</>}
                    {s.skillName && (
                      <> · 使用「<span className="text-violet-600 font-medium">{s.skillName}</span>」</>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-[12px] text-gray-500">现在开始执行 →</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7.2：tsc**

```bash
npx tsc --noEmit
```

---

### Task 8：`MissionStepBubble` 组件

**Files:**
- Create: `src/components/chat/mission-step-bubble.tsx`

- [ ] **Step 8.1：实现**

```tsx
"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import {
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Clock,
  SkipForward,
  StopCircle,
  RefreshCw,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import type { MissionTask } from "@/lib/chat/parse-mission-event";
import type { AIEmployee } from "@/lib/types";
import { mapTaskStatusToUiState } from "@/lib/mission-task-status";
import { useTypewriter } from "@/lib/hooks/use-typewriter";
import { remarkPlugins, markdownComponents } from "@/app/(dashboard)/employee/[id]/collapsible-markdown";
import { cn } from "@/lib/utils";

interface Props {
  task: MissionTask;
  stepNumber: number;
  totalSteps: number;
  skillName?: string;
  ownerEmployee: AIEmployee | null;   // assignedEmployeeId 缺失时 fallback
  employees: AIEmployee[];
  missionId: string;                  // 用于失败按钮跳转 /missions/[id]
  onRetry?: () => void;               // 内联重试；Commit 2 阶段为空（跳详情页），Commit 3 接入
}

export function MissionStepBubble({
  task,
  stepNumber,
  totalSteps,
  skillName,
  ownerEmployee,
  employees,
  missionId,
  onRetry,
}: Props) {
  const ui = mapTaskStatusToUiState(task.status);
  const employee = task.assignedEmployeeId
    ? employees.find((e) => e.id === task.assignedEmployeeId) ?? ownerEmployee
    : ownerEmployee;
  const empMeta = employee ? EMPLOYEE_META[employee.id as EmployeeId] : null;
  const empName = empMeta?.name ?? employee?.title ?? "AI 员工";

  const summary = task.outputSummary ?? "";
  const revealed = useTypewriter(
    summary,
    30,
    ui === "completed" ? task.id : null,
  );

  // ── pending：极简一行预览
  if (ui === "pending") {
    return (
      <div className="flex gap-3 opacity-50" data-status="pending">
        {employee && <EmployeeAvatar employeeId={employee.id} size="sm" className="mt-0.5 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Clock size={14} className="text-gray-400" />
            <span className="text-xs text-gray-500 font-medium">{empName} · 步骤 {stepNumber}/{totalSteps} · 等待依赖</span>
            {skillName && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-[11px] text-gray-500">
                {skillName}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── cancelled：一行 + ⏹
  if (ui === "cancelled") {
    return (
      <div className="flex gap-3 opacity-60" data-status="cancelled">
        {employee && <EmployeeAvatar employeeId={employee.id} size="sm" className="mt-0.5 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <StopCircle size={14} className="text-gray-400" />
            <span className="text-xs text-gray-500 font-medium">{empName} · 步骤 {stepNumber}/{totalSteps} · 已取消</span>
          </div>
        </div>
      </div>
    );
  }

  // ── 通用头部
  const header = (
    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
      {ui === "completed" && <CheckCircle2 size={14} className="text-blue-500" />}
      {ui === "running" && <Loader2 size={14} className="animate-spin text-blue-500" />}
      {ui === "failed" && <AlertTriangle size={14} className="text-red-500" />}
      <span className={cn(
        "text-xs font-medium",
        ui === "failed" ? "text-red-600" : "text-blue-600 dark:text-blue-400",
      )}>
        {empName} · 步骤 {stepNumber}/{totalSteps} · {
          ui === "completed" ? "已完成" :
          ui === "running" ? "进行中…" :
          "执行失败"
        }
      </span>
      {skillName && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/30 text-[11px] text-violet-600 dark:text-violet-400">
          <Sparkles size={10} />
          {skillName}
        </span>
      )}
      {(task.retryCount ?? 0) > 0 && (
        <span className="text-[11px] text-gray-400">已重试 {task.retryCount}/3</span>
      )}
    </div>
  );

  // ── failed
  if (ui === "failed") {
    return (
      <div className="flex gap-3" data-status="failed">
        {employee && <EmployeeAvatar employeeId={employee.id} size="sm" className="mt-0.5 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          {header}
          <div className="bg-red-50/70 dark:bg-red-950/30 ring-1 ring-red-200/60 dark:ring-red-800/40 rounded-2xl px-5 py-4">
            <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">交叉核验失败</p>
            <p className="text-[13px] text-red-700/90 dark:text-red-400/90">
              {task.errorMessage ?? "未知错误"}
            </p>
            <div className="flex gap-2 mt-3 flex-wrap">
              {onRetry ? (
                <button
                  type="button"
                  onClick={onRetry}
                  disabled={task.errorRecoverable === false}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all border-0 flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw size={12} />
                  重试本步
                </button>
              ) : (
                <Link
                  href={`/missions/${missionId}`}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <RefreshCw size={12} />
                  重试本步
                </Link>
              )}
              <Link
                href={`/missions/${missionId}`}
                className="text-xs px-3 py-1.5 text-gray-400 hover:text-blue-500 inline-flex items-center"
              >
                查看完整错误日志
                <ExternalLink size={12} className="ml-1" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── running
  if (ui === "running") {
    return (
      <div className="flex gap-3" data-status="running">
        {employee && <EmployeeAvatar employeeId={employee.id} size="sm" className="mt-0.5 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          {header}
          <div className="bg-gradient-to-br from-white/90 to-gray-50/70 dark:from-gray-800/60 dark:to-gray-800/40 backdrop-blur-sm rounded-2xl px-5 py-4 shadow-[0_1px_6px_rgba(0,0,0,0.06)] ring-1 ring-gray-200/30 dark:ring-gray-700/30">
            <div className="flex gap-1.5">
              <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── completed
  return (
    <div className="flex gap-3" data-status="completed">
      {employee && <EmployeeAvatar employeeId={employee.id} size="sm" className="mt-0.5 flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        {header}
        <div className="bg-gradient-to-br from-white/90 to-gray-50/70 dark:from-gray-800/60 dark:to-gray-800/40 backdrop-blur-sm rounded-2xl px-5 py-4 shadow-[0_1px_6px_rgba(0,0,0,0.06)] ring-1 ring-gray-200/30 dark:ring-gray-700/30">
          {summary ? (
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
              <ReactMarkdown remarkPlugins={remarkPlugins} components={markdownComponents}>
                {revealed}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-[13px] text-gray-500 italic">本步骤未产出文本摘要。</p>
          )}
          <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-700/50">
            <Link
              href={`/missions/${missionId}`}
              className="text-[11px] text-gray-400 hover:text-blue-500 inline-flex items-center gap-1"
            >
              查看完整结果
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 8.2：tsc**

```bash
npx tsc --noEmit
```

---

### Task 9：`MissionProgressChip` 组件

**Files:**
- Create: `src/components/chat/mission-progress-chip.tsx`

- [ ] **Step 9.1：实现**

```tsx
"use client";

import * as React from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { MissionProgressData } from "@/lib/chat/parse-mission-event";
import { mapTaskStatusToUiState } from "@/lib/mission-task-status";
import { cn } from "@/lib/utils";

interface Props {
  state: MissionProgressData;
}

export function MissionProgressChip({ state }: Props) {
  const tasks = Object.values(state.tasksById).sort((a, b) => (a.phase ?? 0) - (b.phase ?? 0));
  if (tasks.length === 0) return null;

  const uiStates = tasks.map((t) => mapTaskStatusToUiState(t.status));
  const completed = uiStates.filter((s) => s === "completed").length;
  const total = tasks.length;

  const onClick = () => {
    const el = document.querySelector('[data-status="running"]');
    if (el && "scrollIntoView" in el) {
      (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const overall = state.status;

  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed top-20 right-6 z-40 flex items-center gap-2 px-3 py-2 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-md ring-1 ring-gray-200/60 dark:ring-gray-700/60 shadow-md cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all border-0"
    >
      {overall === "completed" ? (
        <CheckCircle2 size={12} className="text-blue-500" />
      ) : overall === "failed" || overall === "cancelled" ? (
        <AlertTriangle size={12} className="text-red-500" />
      ) : (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
        </span>
      )}
      <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
        {completed} / {total} 步 · {
          overall === "completed" ? "已完成" :
          overall === "failed" ? "失败" :
          overall === "cancelled" ? "已取消" :
          "进行中"
        }
      </span>
      <div className="flex items-center gap-1 ml-1 pl-2 border-l border-gray-200 dark:border-gray-700">
        {uiStates.map((s, i) => (
          <span
            key={i}
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              s === "completed" && "bg-blue-500",
              s === "running" && "bg-blue-300 animate-pulse",
              s === "failed" && "bg-red-500",
              s === "cancelled" && "bg-gray-400",
              s === "pending" && "bg-gray-200 dark:bg-gray-600",
            )}
          />
        ))}
      </div>
    </button>
  );
}
```

- [ ] **Step 9.2：tsc**

---

### Task 10：`MissionSummaryBubble` 组件

**Files:**
- Create: `src/components/chat/mission-summary-bubble.tsx`

- [ ] **Step 10.1：实现**

```tsx
"use client";

import { CheckCircle2, AlertTriangle } from "lucide-react";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import type { MissionProgressData } from "@/lib/chat/parse-mission-event";
import type { AIEmployee } from "@/lib/types";
import { mapTaskStatusToUiState } from "@/lib/mission-task-status";

interface Props {
  state: MissionProgressData;
  templateName: string;
  ownerEmployee: AIEmployee | null;
}

export function MissionSummaryBubble({ state, templateName, ownerEmployee }: Props) {
  if (state.status !== "completed" && state.status !== "failed" && state.status !== "cancelled") {
    return null;
  }

  const tasks = Object.values(state.tasksById);
  const failedCount = tasks.filter((t) => mapTaskStatusToUiState(t.status) === "failed").length;
  const completedCount = tasks.filter((t) => mapTaskStatusToUiState(t.status) === "completed").length;

  const text = state.status === "completed"
    ? `任务「${templateName}」已完成 · 共完成 ${completedCount} 步。`
    : state.status === "failed"
      ? `任务「${templateName}」执行失败。${tasks.length} 步中 ${failedCount} 步失败。点击对应失败步骤的「重试本步」可恢复执行。`
      : `任务「${templateName}」已取消。`;

  return (
    <div className="flex gap-3">
      {ownerEmployee && (
        <EmployeeAvatar employeeId={ownerEmployee.id} size="sm" className="mt-0.5 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          {state.status === "completed" ? (
            <CheckCircle2 size={14} className="text-blue-500" />
          ) : (
            <AlertTriangle size={14} className="text-red-500" />
          )}
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">任务收尾</span>
        </div>
        <div className="bg-gradient-to-br from-white/90 to-gray-50/70 dark:from-gray-800/60 dark:to-gray-800/40 backdrop-blur-sm rounded-2xl px-5 py-4 shadow-[0_1px_6px_rgba(0,0,0,0.06)] ring-1 ring-gray-200/30 dark:ring-gray-700/30">
          <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">{text}</p>
        </div>
      </div>
    </div>
  );
}
```

---

### Task 11：`MissionStream` 主入口

**Files:**
- Create: `src/components/chat/mission-stream.tsx`

- [ ] **Step 11.1：实现**

```tsx
"use client";

import * as React from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { useMissionProgress } from "@/lib/hooks/use-mission-progress";
import { MissionPlanningBubble } from "./mission-planning-bubble";
import { MissionStepBubble } from "./mission-step-bubble";
import { MissionProgressChip } from "./mission-progress-chip";
import { MissionSummaryBubble } from "./mission-summary-bubble";
import type { AIEmployee } from "@/lib/types";

interface Props {
  missionId: string;
  templateName: string;
  ownerEmployee: AIEmployee | null;
  employees: AIEmployee[];
}

export function MissionStream({ missionId, templateName, ownerEmployee, employees }: Props) {
  const state = useMissionProgress(missionId);

  if (state.isLoading) {
    return (
      <GlassCard padding="sm" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 size={14} className="animate-spin" />
        正在启动「{templateName}」…
      </GlassCard>
    );
  }

  if (state.notFound) {
    return (
      <GlassCard padding="sm" className="flex items-center gap-2 text-sm text-muted-foreground opacity-60">
        <AlertCircle size={14} />
        任务「{templateName}」已被删除
      </GlassCard>
    );
  }

  // 任务列表，按 phase 排；phase 为 null 时退到 createdAt（这里 SSE 不下发 createdAt，
  // 因此 fallback 到对象 key 顺序——SSE 推送顺序近似创建顺序）。
  const tasks = Object.values(state.tasksById).sort((a, b) => (a.phase ?? 0) - (b.phase ?? 0));
  const total = tasks.length;
  // pending（含 cancelled 后被折叠的步骤）的折叠规则：
  // mission cancelled 时 pending 状态步骤不渲染
  const visibleTasks = state.status === "cancelled"
    ? tasks.filter((t) => t.status !== "pending" && t.status !== "ready" && t.status !== "blocked")
    : tasks;

  return (
    <>
      <MissionProgressChip state={state} />
      <div className="space-y-5">
        {state.init && (
          <MissionPlanningBubble
            init={state.init}
            ownerEmployee={ownerEmployee}
            employees={employees}
          />
        )}
        {visibleTasks.map((task, idx) => {
          const skillName = state.init?.steps[idx]?.skillName;
          return (
            <MissionStepBubble
              key={task.id}
              task={task}
              stepNumber={idx + 1}
              totalSteps={total}
              skillName={skillName}
              ownerEmployee={ownerEmployee}
              employees={employees}
              missionId={missionId}
              // Commit 2 阶段不传 onRetry —— 失败按钮 fallback 到 /missions/[id]
              // Commit 3 接入 onRetry={() => retryMissionTask(task.id)}
            />
          );
        })}
        <MissionSummaryBubble
          state={state}
          templateName={templateName}
          ownerEmployee={ownerEmployee}
        />
      </div>
    </>
  );
}
```

- [ ] **Step 11.2：tsc**

---

### Task 12：切换 `chat-panel.tsx` + 删旧组件

**Files:**
- Modify: `src/app/(dashboard)/chat/chat-panel.tsx:670` 附近
- Delete: `src/components/chat/mission-card-message.tsx`

- [ ] **Step 12.1：替换 chat-panel.tsx 里的 mission_card 渲染**

打开 `src/app/(dashboard)/chat/chat-panel.tsx`，搜 `MissionCardMessage`，把 import 行替换：

```tsx
// 旧：
import { MissionCardMessage } from "@/components/chat/mission-card-message";

// 新：
import { MissionStream } from "@/components/chat/mission-stream";
```

然后在渲染分支（约 670 行）里改：

```tsx
// 旧：
if (msg.kind === "mission_card" && msg.missionId) {
  return (
    <MissionCardMessage
      key={i}
      missionId={msg.missionId}
      templateName={msg.templateName ?? "任务"}
    />
  );
}

// 新：
if (msg.kind === "mission_card" && msg.missionId) {
  return (
    <MissionStream
      key={i}
      missionId={msg.missionId}
      templateName={msg.templateName ?? "任务"}
      ownerEmployee={employee}
      employees={[]}  // 见下面的 prop 透传说明
    />
  );
}
```

> **`employees` prop 透传**：`chat-panel.tsx` 当前不接 `employees`。这个 prop 来自 `chat-center-client.tsx` 的 `employees`。需要：
> 1. `chat-panel.tsx` 在 `ChatPanelProps` 加 `employees: AIEmployee[]`
> 2. `chat-center-client.tsx:481` 附近调用 `<ChatPanel ... employees={employees} />`

- [ ] **Step 12.2：删旧文件**

```bash
git rm src/components/chat/mission-card-message.tsx
```

- [ ] **Step 12.3：grep 确认无残留引用**

```bash
grep -r "MissionCardMessage\|mission-card-message" src/ 2>&1
```

预期：空输出。如果有残留（除了刚才改的 chat-panel.tsx 的 history），处理掉。

- [ ] **Step 12.4：tsc**

```bash
npx tsc --noEmit
```

- [ ] **Step 12.5：build**

```bash
npm run build
```

预期：通过。

---

### Task 13：浏览器手测（必做）

- [ ] **Step 13.1：起 dev server**

```bash
npm run dev
```

- [ ] **Step 13.2：手测 7 个用户路径**

打开 `http://localhost:3000/chat`：

1. **正常路径**：选小策 → 点击场景"深度新闻调研"→ 填表单提交 → 预期看到 ① 计划总览气泡 ② 步骤气泡按依赖顺序变 running → completed ③ 右上角进度 chip 跟随更新 ④ mission 完成后出现收尾气泡。
2. **多员工头像**：每个步骤气泡的头像必须按 `task.assignedEmployeeId` 反查，不能全是小策。**重点确认这条**。
3. **打字机回放限制**：等步骤 1 完成、看到打字机渲染完，故意切到别的员工再切回来 —— 步骤 1 应直接显示完整文本，不应回放。
4. **失败路径（可选）**：故意把 `OPENAI_API_KEY` 改错，启动场景，预期失败步骤气泡变红、出现"重试本步"按钮（点击跳转到 `/missions/[id]`，因为 Commit 2 阶段尚未接入内联重试）。
5. **进度 chip 锚跳**：mission 跑到一半时点击右上角 chip，预期滚动到当前 running 那条气泡。
6. **取消路径**：在 `/missions/[id]` 点取消 → 回到 `/chat` → 预期 running 步骤变 ⏹️ "已取消"，pending 步骤完全折叠。
7. **mission 缺 templateId 兜底**：自由对话路径产生的 mission（如有）打开 `/chat` 不应报错，只是看不到计划总览气泡和技能徽章。

如果任一项不通过，就地修；不要留作 follow-up。

---

### Task 14：Commit 2

- [ ] **Step 14.1：再跑一遍**

```bash
npx tsc --noEmit && npm test && npm run build
```

- [ ] **Step 14.2：commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(chat): 用对话化 MissionStream 替换静态 MissionCardMessage

每个 mission 的对话流变成 5 段：
1) 计划总览气泡（字符串模板，零 LLM）
2) 步骤气泡列表（按 task.assignedEmployeeId 反查头像；5 状态机）
3) 进行中骨架 + completed 后打字机渲染 outputSummary
4) 失败步骤红卡 + 重试按钮（暂跳详情页，下 commit 接内联）
5) 收尾气泡

右上角 sticky 进度 chip 同步显示，点击锚跳到当前 running 步骤。

新增：
- src/lib/hooks/use-typewriter.ts（含纯函数单测）
- src/components/chat/{mission-stream,mission-planning-bubble,mission-step-bubble,mission-progress-chip,mission-summary-bubble}.tsx

删除：
- src/components/chat/mission-card-message.tsx

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Commit 3：内联重试 server action（可选 polish）

> **可单独发**。如果你赶时间，Commit 2 落了就够用，失败按钮跳详情页能保证用户不被卡住。Commit 3 把它升级为内联体验。

### Task 15：`retryMissionTask` server action（TDD-light）

**Files:**
- Modify: `src/app/actions/missions.ts`

- [ ] **Step 15.1：在文件末尾加 server action**

```ts
/**
 * Retry a single failed mission task. Resets state and re-emits the
 * `mission/task-ready` Inngest event so executeMissionTask picks it up.
 */
export async function retryMissionTask(taskId: string) {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("无法获取组织信息");

  const task = await db.query.missionTasks.findFirst({
    where: eq(missionTasks.id, taskId),
    with: { mission: { columns: { id: true, organizationId: true } } },
  });
  if (!task) throw new Error("任务不存在");
  if (task.mission.organizationId !== orgId) throw new Error("无权操作");
  if (task.status !== "failed") throw new Error("只能重试失败的任务");

  await db.update(missionTasks).set({
    status: "ready",
    errorMessage: null,
    retryCount: (task.retryCount ?? 0) + 1,
    startedAt: null,
    completedAt: null,
  }).where(eq(missionTasks.id, taskId));

  await inngest.send({
    name: "mission/task-ready",
    data: {
      missionId: task.missionId,
      taskId: task.id,
      organizationId: orgId,
    },
  });

  revalidatePath(`/missions/${task.missionId}`);
}
```

> **注意**：
> - `inngest` 客户端的 import 路径要跟文件里其他 `inngest.send` 调用一致；可能是 `@/inngest/client`（搜一下文件顶部）。
> - `with: { mission }` 需要 drizzle relation 配置；如果 schema 里没有，改成 `db.select(...)` 两步查。
> - `revalidatePath` 已在文件中其他 action 用过；保持一致。

- [ ] **Step 15.2：tsc + build**

```bash
npx tsc --noEmit && npm run build
```

---

### Task 16：MissionStream 接入 onRetry

**Files:**
- Modify: `src/components/chat/mission-stream.tsx`

- [ ] **Step 16.1：在 MissionStream 里给 MissionStepBubble 传 onRetry**

```tsx
import { retryMissionTask } from "@/app/actions/missions";

// 在 visibleTasks.map 里：
<MissionStepBubble
  ...
  onRetry={async () => {
    try {
      await retryMissionTask(task.id);
    } catch (e) {
      console.error("重试失败:", e);
      alert(e instanceof Error ? e.message : "重试失败");
    }
  }}
/>
```

- [ ] **Step 16.2：浏览器手测**

```bash
npm run dev
```

- 故意制造一个失败步骤
- 点击"重试本步"
- 预期：按钮变 loading 态（短暂） → 该步骤气泡回到 running → 后续依赖步骤继续执行

---

### Task 17：Commit 3

- [ ] **Step 17.1：验证**

```bash
npx tsc --noEmit && npm test && npm run build
```

- [ ] **Step 17.2：commit**

```bash
git add src/app/actions/missions.ts src/components/chat/mission-stream.tsx
git commit -m "$(cat <<'EOF'
feat(chat): 接入内联 retryMissionTask；失败步骤气泡支持原地重试

- 新增 retryMissionTask server action：reset task → emit mission/task-ready
- MissionStream 给 MissionStepBubble 透 onRetry，失败按钮不再跳 /missions/[id]

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## 完成判定（对应 spec §12 验收清单）

3 个 commit 都落地后逐项手测：

- [ ] 启动场景后看到计划总览气泡，正确陈述执行计划
- [ ] 每步气泡头像按 `task.assignedEmployeeId` 显示，不是顶上员工
- [ ] running → 骨架；completed → outputSummary 打字机首次播放，重渲不回放
- [ ] 失败步骤红卡 + "重试本步"（Commit 3 后内联重试，Commit 2 阶段跳详情页）
- [ ] 技能徽章按 `mission-init.steps[].skillName` 对位
- [ ] sticky chip 跟随滚动，点击锚跳到 running 步骤
- [ ] mission 完成出现收尾气泡
- [ ] mission 取消：running 步骤变 ⏹️，pending 步骤折叠
- [ ] `mission-card-message.tsx` 文件不存在
- [ ] `npx tsc --noEmit` 与 `npm run build` 全绿

---

## 已知不在范围（spec §8 复述）

- token 级流式
- mission_messages 渲染
- 顶部紧凑总览卡
- /missions/[id] 详情页改造
- 自由对话路径改造
