# Phase 2: AI 员工市场页 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构 `/ai-employees` 为 Genspark 风格智能体市场页，大卡片展示角色描述、热门任务示例、技能标签和派发任务按钮。

**Architecture:** 复用现有 `getEmployees()` DAL 函数获取员工+技能数据，新建 Genspark 风格的卡片组件替代现有简单卡片，增加"热门任务"配置数据，将旧 `/employee-marketplace` 路由重定向到新路由。

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS v4, shadcn/ui, Drizzle ORM

**Spec:** `docs/superpowers/specs/2026-04-06-genspark-style-redesign.md` Section 2.3.2

---

## File Structure

### New Files
```
src/app/(dashboard)/ai-employees/page.tsx                — 服务端组件
src/app/(dashboard)/ai-employees/ai-employees-client.tsx  — 客户端组件
src/components/ai-employees/employee-agent-card.tsx       — Genspark 风格大卡片
src/lib/employee-tasks.ts                                 — 热门任务示例配置
```

### Modified Files
```
(none — 旧 /employee-marketplace 保留，Phase 1 已添加 301 重定向)
```

---

## Task 1: 热门任务示例配置

**Files:**
- Create: `src/lib/employee-tasks.ts`

- [ ] **Step 1: 创建热门任务配置**

为每个员工定义 2-3 个热门任务示例。这些是可点击的快捷任务，点击后直接跳转到首页以该文本发起对话。

```typescript
// src/lib/employee-tasks.ts
import type { EmployeeId } from "@/lib/constants";

export interface HotTask {
  label: string;
  prompt: string; // 实际发送给 AI 的完整提示
}

export const EMPLOYEE_HOT_TASKS: Record<string, HotTask[]> = {
  xiaolei: [
    { label: "监测今日全网热点", prompt: "帮我监测今天的全网热点事件，按热度排序" },
    { label: "竞品动态追踪", prompt: "追踪主要竞品的最新动态和报道" },
    { label: "舆情风险预警", prompt: "分析当前舆情态势，识别潜在风险点" },
  ],
  xiaoce: [
    { label: "策划深度专题选题", prompt: "基于当前热点，策划一个深度专题报道的选题方案" },
    { label: "节日选题规划", prompt: "规划下一个节日节点的选题方案和内容日历" },
    { label: "爆款选题分析", prompt: "分析近期爆款内容的选题规律，提供选题建议" },
  ],
  xiaozi: [
    { label: "整理项目素材库", prompt: "帮我整理和分类当前项目的素材资源" },
    { label: "搜索相关素材", prompt: "根据选题需求，搜索和推荐合适的素材资源" },
  ],
  xiaowen: [
    { label: "撰写新闻稿件", prompt: "根据最新热点信息，撰写一篇新闻稿件" },
    { label: "改写优化文章", prompt: "帮我改写和优化这篇文章的表达和结构" },
    { label: "生成社交媒体文案", prompt: "为这个主题生成适合各平台的社交媒体文案" },
  ],
  xiaojian: [
    { label: "生成短视频脚本", prompt: "为这个选题生成一个短视频拍摄脚本" },
    { label: "视频剪辑方案", prompt: "根据素材清单，制定视频剪辑和后期方案" },
  ],
  xiaoshen: [
    { label: "审核稿件质量", prompt: "审核这篇稿件的内容质量、事实准确性和合规性" },
    { label: "内容合规检查", prompt: "对这批内容进行全面的合规性检查" },
  ],
  xiaofa: [
    { label: "制定分发策略", prompt: "为这篇内容制定全渠道分发策略和最佳发布时间" },
    { label: "渠道效果分析", prompt: "分析各渠道的发布效果，给出优化建议" },
  ],
  xiaoshu: [
    { label: "生成数据分析报告", prompt: "生成本周的内容运营数据分析报告" },
    { label: "内容效果复盘", prompt: "对近期发布的内容进行效果复盘分析" },
    { label: "用户画像分析", prompt: "分析目标受众的用户画像和阅读偏好" },
  ],
};
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/lib/employee-tasks.ts
git commit -m "feat: add hot task examples config for each AI employee"
```

---

## Task 2: Genspark 风格员工卡片组件

**Files:**
- Create: `src/components/ai-employees/employee-agent-card.tsx`

- [ ] **Step 1: 创建大卡片组件**

该组件是市场页的核心，Genspark 风格的智能体卡片：

```
┌───────────────────────────────┐
│  [icon] 小雷 · 热点猎手        │  ← 头像 + 昵称 + 角色名
│  [工作中]                     │  ← 状态徽章
│                               │
│  实时监测全网热点动态，         │  ← 一句话描述 (motto)
│  分析传播趋势和舆情态势。       │
│                               │
│  热门任务:                     │
│  · 监测今日全网热点  ↗         │  ← 可点击热门任务
│  · 竞品动态追踪     ↗         │
│  · 舆情风险预警     ↗         │
│                               │
│  [热点监测] [趋势分析] [舆情]  │  ← 技能标签（最多5个）
│                               │
│            [+ 派发任务]         │  ← 底部操作按钮
└───────────────────────────────┘
```

**Props:**
```typescript
interface EmployeeAgentCardProps {
  employee: AIEmployee;
  hotTasks: HotTask[];
  onDispatchTask: (employeeSlug: string) => void;
  onHotTaskClick: (employeeSlug: string, prompt: string) => void;
}
```

**样式要求：**
- iOS 26 液态玻璃风格，与首页一致
- 卡片: `bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-2xl`
- 深度阴影: `shadow-[0_8px_32px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.06)]`
- 热门任务项: hover 时显示箭头，cursor-pointer
- 技能标签: `px-2.5 py-1 rounded-full bg-white/[0.06] text-[11px] text-white/50`
- "+ 派发任务"按钮: **无边框**，ghost style，hover 时 bg-white/10
- 卡片 hover: subtle scale(1.01) + border-white/[0.12]

- [ ] **Step 2: 验证编译**
- [ ] **Step 3: Commit**

---

## Task 3: AI 员工市场页（服务端 + 客户端组件）

**Files:**
- Create: `src/app/(dashboard)/ai-employees/page.tsx`
- Create: `src/app/(dashboard)/ai-employees/ai-employees-client.tsx`

- [ ] **Step 1: 服务端组件**

复用现有 `getEmployees()` DAL 函数。与旧 `employee-marketplace/page.tsx` 相同的数据获取逻辑。

```typescript
// src/app/(dashboard)/ai-employees/page.tsx
import { getEmployees } from "@/lib/dal/employees";
import { getCurrentUserOrg } from "@/lib/dal/organizations";
import { AiEmployeesClient } from "./ai-employees-client";

export const dynamic = "force-dynamic";

export default async function AiEmployeesPage() {
  let employees: any[] = [];
  let organizationId = "";

  try {
    const [emps, org] = await Promise.all([
      Promise.race([getEmployees(), new Promise((_, r) => setTimeout(() => r("timeout"), 15000))]),
      getCurrentUserOrg(),
    ]);
    employees = emps as any[];
    organizationId = org?.id || "";
  } catch {
    // Graceful degradation
  }

  return <AiEmployeesClient employees={employees} organizationId={organizationId} />;
}
```

- [ ] **Step 2: 客户端组件**

Genspark "所有智能体" 页面风格：

**页面结构：**
- 页头: "AI 数字员工" 标题 + "你的智能媒体团队" 副标题 + [+ 创建新员工] 按钮
- 搜索栏 + 状态筛选
- 4列网格 (xl:4, lg:3, md:2, sm:1)
- 每个员工渲染 `EmployeeAgentCard`

**交互：**
- 搜索: 按名字/昵称/职位筛选
- 状态筛选: 全部/工作中/空闲/学习中
- "+ 派发任务": 跳转到 `/home?employee=xxx` (首页预选该员工)
- 热门任务点击: 跳转到 `/home?employee=xxx&task=<encoded_prompt>` (首页预填任务)
- [+ 创建新员工]: 打开创建对话框（复用现有 EmployeeFormDialog）

- [ ] **Step 3: 验证编译和构建**

Run: `npx tsc --noEmit && npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/ai-employees/
git commit -m "feat: add Genspark-style AI employee marketplace page"
```

---

## Task 4: 首页联动 — 接收员工和任务参数

**Files:**
- Modify: `src/app/(dashboard)/home/home-client.tsx`

- [ ] **Step 1: 读取 URL 参数**

从 URL query 读取 `employee` 和 `task` 参数：
- `?employee=xiaolei` → 预选该员工
- `?task=监测今日全网热点` → 预填输入框并自动发送

```typescript
// 在 HomeClient 中添加
const searchParams = useSearchParams();
const initialEmployee = searchParams.get("employee") as EmployeeId | null;
const initialTask = searchParams.get("task");

// useEffect: 如果有 initialEmployee，设置 activeEmployee
// useEffect: 如果有 initialTask，设置 inputValue 并自动发送
```

- [ ] **Step 2: 验证**
- [ ] **Step 3: Commit**

---

## Task 5: 集成验证

- [ ] **Step 1: TypeScript + Build**

Run: `npx tsc --noEmit && npm run build`

- [ ] **Step 2: 功能验证清单**

- [ ] `/ai-employees` 页面加载，显示 8+ 员工大卡片
- [ ] 每张卡片显示：头像、昵称、角色名、描述、热门任务、技能标签、状态
- [ ] 搜索和状态筛选正常工作
- [ ] 点击热门任务跳转到首页并预填任务
- [ ] 点击"+ 派发任务"跳转到首页预选该员工
- [ ] 首页接收 URL 参数正确预选员工和预填任务
- [ ] `/employee-marketplace` 自动重定向到 `/ai-employees`

---

## Dependency Graph

```
Task 1 (hot tasks config) ─┐
                            ├── Task 2 depends on Task 1
Task 2 (agent card)  ───────┤
                            ├── Task 3 depends on Tasks 1, 2
Task 3 (marketplace page) ──┤
                            ├── Task 4 depends on Task 3
Task 4 (home page linkage) ─┘
Task 5 (integration test)  ← depends on all above
```
