# 超级个体门户 Phase 1 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构首页门户为"超级个体智媒工作空间"，包含员工重命名/拟人化头像、6个媒体场景快捷启动、炫酷动画效果。

**Architecture:** 保留现有 server/client split 架构（`page.tsx` 服务端取数据 → `home-client.tsx` 客户端交互）。修改 `EMPLOYEE_META` 常量实现重命名，新增6个高级场景配置。首页重构为输入框主体 + 员工横栏 + 场景网格 + 动态信息流的四层布局。场景启动复用现有 Mission 系统。

**Tech Stack:** Next.js 16 + React 19 + TypeScript + Framer Motion + Tailwind CSS v4 + Lottie (lottie-react) + 现有 Supabase/Drizzle 基础设施

**Spec:** `docs/superpowers/specs/2026-04-17-super-individual-portal-design.md`

---

## File Map

### Modified Files

| File | Responsibility | Changes |
|------|---------------|---------|
| `src/lib/constants.ts:25-149,441-552` | Employee & scenario config | Rename 2 employees, add 6 new scenario configs |
| `src/lib/types.ts:1` | EmployeeId type | Widen to `string` for future custom employees |
| `src/app/(dashboard)/home/page.tsx` | Server data fetching | Add scenario config fetching for new 6 scenarios |
| `src/app/(dashboard)/home/home-client.tsx` | Homepage client | Full rewrite → new 4-layer layout |
| `src/components/home/employee-quick-panel.tsx` | Employee display | Refactor to horizontal scroll + new avatar |
| `src/components/home/recent-section.tsx` | Recent section | Minor: use title instead of nickname |
| `src/components/shared/employee-avatar.tsx` | Avatar component | Support PNG avatars + CSS micro-animations |
| `src/app/(dashboard)/missions/missions-client.tsx` | Mission UI | Add new scenario keys to filters |
| `src/components/home/embedded-chat-panel.tsx` | Embedded chat | Update nickname references |

### New Files

| File | Responsibility |
|------|---------------|
| `src/components/shared/particle-background.tsx` | Canvas 粒子背景（从 landing 提取） |
| `src/components/home/scenario-grid.tsx` | 6个场景卡片网格 |
| `src/components/home/scenario-detail-sheet.tsx` | 场景详情面板（Sheet/SlideOver） |
| `src/components/home/hero-section.tsx` | Hero区（标题+状态标签+输入框） |
| `public/avatars/*.png` | 8个员工3D卡通头像 |

### Reference Files (read-only)

| File | Why |
|------|-----|
| `src/app/landing/components/hero-background.tsx` | 粒子系统源码，提取为共享组件 |
| `src/app/actions/missions.ts` | `startMission` action，场景启动复用 |
| `src/lib/dal/scenarios.ts` | Scenario DAL，理解数据结构 |
| `src/app/api/scenarios/execute/route.ts` | 场景执行 API |

---

## Task 1: 员工重命名 — 修改常量和类型

**Files:**
- Modify: `src/lib/constants.ts:25-149`
- Modify: `src/lib/types.ts:1`

- [ ] **Step 1: 修改 EMPLOYEE_META 中的 nickname 和 title**

在 `src/lib/constants.ts` 中：
- `xiaolei`: nickname 从 `"小雷"` 改为 `"热点分析师"`，title 从 `"热点猎手"` 改为 `"热点分析师"`
- `xiaozi`: nickname 从 `"小资"` 改为 `"素材研究员"`，title 从 `"素材管家"` 改为 `"素材研究员"`
- 其余6个员工：nickname 改为与 title 一致（`xiaoce` nickname 从 `"小策"` 改为 `"选题策划师"`，以此类推）
- `leader` 和 `advisor` 保持不变

```typescript
// xiaolei 示例（注意同时更新 name、nickname、title 三个字段）
xiaolei: {
  id: "xiaolei",
  name: "热点分析师",       // was "热点猎手"
  icon: Telescope,
  color: "#f59e0b",
  bgColor: "rgba(245, 158, 11, 0.15)",
  nickname: "热点分析师",   // was "小雷"
  title: "热点分析师",      // was "热点猎手"
  description: "...", // keep existing
},

// 需要更改 name 字段的员工：
// xiaolei: name "热点猎手" → "热点分析师"
// xiaozi: name "素材管家" → "素材研究员"
// 其余6个: name 已与 title 一致，仅改 nickname
```

- [ ] **Step 2: 放宽 EmployeeId 类型**

在 `src/lib/constants.ts` 中，保留 `EmployeeId` 联合类型不变（Phase 1 不涉及自定义员工）。但在 `src/lib/types.ts` 中添加一个宽松版本供后续使用：

```typescript
// src/lib/types.ts 顶部，现有 import 下方
export type AnyEmployeeId = EmployeeId | (string & {});
```

Phase 1 暂不使用，仅预留。

- [ ] **Step 3: 验证类型检查**

Run: `npx tsc --noEmit`
Expected: PASS（nickname 是 string 类型，改值不影响类型）

- [ ] **Step 4: 全局搜索并更新 nickname 引用**

搜索所有引用 `nickname` 显示的地方，确认用户看到的是新名称。重点文件：
- `src/components/home/employee-quick-panel.tsx` — 如果同时显示 nickname 和 title，改为只显示 title
- `src/components/home/recent-section.tsx` — 对话列表中的员工名称
- `src/components/home/embedded-chat-panel.tsx` — 聊天面板中的员工名称
- `src/app/(dashboard)/chat/components/employee-list-panel.tsx` — 聊天中心员工列表
- `src/app/(dashboard)/chat/components/chat-panel.tsx` — 聊天消息中的员工名称

具体改动（已知引用点）：
- `src/components/home/embedded-chat-panel.tsx:322` — 将 `.nickname` 改为 `.title`
- `src/components/home/embedded-chat-panel.tsx:361` — 将 `.nickname` 改为 `.title`
- `src/components/home/employee-quick-panel.tsx:51` — 将 `.nickname` 改为 `.title`
- `src/app/(dashboard)/chat/components/employee-list-panel.tsx` — 搜索 `.nickname` 引用并改为 `.title`
- `src/app/(dashboard)/chat/components/chat-panel.tsx` — 搜索 `.nickname` 引用并改为 `.title`

运行 `grep -rn "\.nickname" src/ --include="*.tsx" --include="*.ts"` 确认是否有遗漏。

- [ ] **Step 5: 验证构建**

Run: `npm run build`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "refactor: rename AI employees to professional titles

Change xiaolei to 热点分析师, xiaozi to 素材研究员.
All 8 employees now use title as display name instead of cute nicknames."
```

---

## Task 2: 员工头像资源 — 占位 PNG + 头像组件升级

**Files:**
- Create: `public/avatars/xiaolei.png` (及其余7个)
- Modify: `src/components/shared/employee-avatar.tsx`

- [ ] **Step 1: 创建头像占位资源**

在 Phase 1 初期，使用占位头像。每个员工生成一个带品牌色背景和首字的 SVG 转 PNG（后续替换为 AI 生成的 3D 卡通头像）。

暂时使用现有 Lucide 图标 + CSS 动画作为过渡方案。在 `public/avatars/` 创建 `.gitkeep` 文件预留目录：

```bash
mkdir -p public/avatars
touch public/avatars/.gitkeep
```

- [ ] **Step 2: 升级 EmployeeAvatar 组件**

修改 `src/components/shared/employee-avatar.tsx`，支持：
1. 检测 PNG 头像是否存在，存在则使用 `<Image>`，否则 fallback 到 Lucide 图标
2. 新增 `animated` prop，启用 CSS 微动效

保留现有 `EmployeeAvatar` 组件的结构和 `employeeId: EmployeeId | string` 类型签名，仅添加两个功能：

1. 新增 `animated?: boolean` prop
2. 当 `animated=true` 时，在头像外层添加 CSS 微动效环

```tsx
// 在现有 employee-avatar.tsx 中添加（不要替换整个文件）

// 1. 在文件顶部添加微动效映射
const MICRO_ANIMATION: Record<string, string> = {
  xiaolei: "animate-radar-pulse",
  xiaoce: "animate-bulb-flicker",
  xiaozi: "animate-page-flip",
  xiaowen: "animate-pen-write",
  xiaojian: "animate-film-rotate",
  xiaoshen: "animate-magnify-scan",
  xiaofa: "animate-signal-wave",
  xiaoshu: "animate-chart-bounce",
};

// 2. 在 EmployeeAvatarProps 中添加
animated?: boolean;

// 3. 在 return 的 JSX 中，status indicator 之前添加
{animated && MICRO_ANIMATION[employeeId as string] && (
  <span
    className={cn(
      "absolute inset-[-3px] rounded-full opacity-40",
      MICRO_ANIMATION[employeeId as string]
    )}
    style={{ borderColor: meta.color, borderWidth: 2, borderStyle: "solid" }}
  />
)}
```

**不要改动**：wrapper div 的 className（保留 `inline-flex shrink-0`）、`employeeId` 类型、`showStatus` 逻辑、现有的 Lucide 图标渲染。PNG 头像支持推迟到实际头像素材就绪后再添加。

- [ ] **Step 3: 添加 CSS 微动效**

在 `src/app/globals.css` 中添加微动效 keyframes（Tailwind v4 中直接写 CSS）：

```css
/* Employee avatar micro-animations */
@keyframes radar-pulse {
  0%, 100% { transform: scale(1); opacity: 0.4; }
  50% { transform: scale(1.15); opacity: 0.1; }
}
@keyframes bulb-flicker {
  0%, 100% { opacity: 0.4; }
  30% { opacity: 0.7; }
  60% { opacity: 0.2; }
}
@keyframes film-rotate {
  from { transform: rotate(0deg); opacity: 0.3; }
  to { transform: rotate(360deg); opacity: 0.3; }
}
@keyframes magnify-scan {
  0%, 100% { transform: translateX(-2px); opacity: 0.3; }
  50% { transform: translateX(2px); opacity: 0.5; }
}
@keyframes signal-wave {
  0%, 100% { transform: scale(1); opacity: 0.4; }
  50% { transform: scale(1.2); opacity: 0.1; }
}
@keyframes chart-bounce {
  0%, 100% { transform: scaleY(1); opacity: 0.3; }
  50% { transform: scaleY(1.1); opacity: 0.5; }
}

.animate-radar-pulse { animation: radar-pulse 2s ease-in-out infinite; }
.animate-bulb-flicker { animation: bulb-flicker 3s ease-in-out infinite; }
.animate-page-flip { animation: radar-pulse 2.5s ease-in-out infinite; }
.animate-pen-write { animation: magnify-scan 1.5s ease-in-out infinite; }
.animate-film-rotate { animation: film-rotate 8s linear infinite; }
.animate-magnify-scan { animation: magnify-scan 2s ease-in-out infinite; }
.animate-signal-wave { animation: signal-wave 2s ease-in-out infinite; }
.animate-chart-bounce { animation: chart-bounce 1.5s ease-in-out infinite; }
```

- [ ] **Step 4: 验证**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: upgrade EmployeeAvatar with PNG support and micro-animations

Add animated prop for CSS micro-animations per employee.
PNG avatar with fallback to Lucide icons.
Prepare public/avatars/ directory for 3D cartoon assets."
```

---

## Task 3: 提取 ParticleBackground 共享组件

**Files:**
- Read: `src/app/landing/components/hero-background.tsx`
- Create: `src/components/shared/particle-background.tsx`

- [ ] **Step 1: 读取 landing 页 hero-background.tsx**

读取 `src/app/landing/components/hero-background.tsx` 的完整源码。

- [ ] **Step 2: 提取为共享组件**

创建 `src/components/shared/particle-background.tsx`，基于 hero-background 代码但做以下调整：
- 移除 landing 页特定逻辑（如特定的文案引用）
- 添加 `particleCount`、`colors`、`cursorGlow` 等可配置 props
- 默认配置与 landing 页一致，首页可传入不同参数

```tsx
// src/components/shared/particle-background.tsx
"use client";

import { useEffect, useRef } from "react";

interface ParticleBackgroundProps {
  particleCount?: number;
  colors?: string[];
  cursorGlow?: boolean;
  className?: string;
}

export function ParticleBackground({
  particleCount = 80,
  colors = ["#6366f1", "#06b6d4", "#8b5cf6"],
  cursorGlow = true,
  className,
}: ParticleBackgroundProps) {
  // ... 从 hero-background.tsx 提取的 Canvas 粒子逻辑
  // 包含: 粒子物理、鼠标跟踪光晕、粒子连线
  // 尊重 prefers-reduced-motion
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // 提取 hero-background 中的 canvas 初始化和动画循环
    // 用 props 替换硬编码值
  }, [particleCount, colors, cursorGlow]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    />
  );
}
```

**具体提取步骤**：
1. 读取 `src/app/landing/components/hero-background.tsx` 完整源码
2. 复制整个 Canvas 初始化和 `requestAnimationFrame` 动画循环到新组件的 `useEffect` 中
3. 将硬编码的粒子数 `80` 替换为 `particleCount` prop
4. 将颜色数组 `["#6366f1", "#06b6d4", "#8b5cf6"]` 替换为 `colors` prop
5. 将鼠标跟踪光晕的启用逻辑包裹在 `if (cursorGlow)` 条件中
6. 移除任何 landing 页特有的文案引用或布局逻辑
7. 保留 `prefers-reduced-motion` 检测逻辑

- [ ] **Step 3: 验证**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add src/components/shared/particle-background.tsx
git commit -m "feat: extract ParticleBackground as shared component

Reusable Canvas-based particle system from landing page.
Configurable particle count, colors, and cursor glow effect."
```

---

## Task 4: 新增6个高级场景配置

**Files:**
- Modify: `src/lib/constants.ts:441+`
- Modify: `src/lib/types.ts` (如需新类型)

- [ ] **Step 1: 定义新场景配置**

在 `src/lib/constants.ts` 中，在现有 `SCENARIO_CONFIG` 之后，新增 `ADVANCED_SCENARIO_CONFIG`：

```typescript
// 将 Building2, Timer, Target, Home 添加到 constants.ts 顶部已有的 lucide-react import 中
// 注意：Zap 和 Newspaper 已在现有 import 中，不要重复导入

export type AdvancedScenarioKey =
  | "lianghui_coverage"
  | "marathon_live"
  | "emergency_response"
  | "theme_promotion"
  | "livelihood_service"
  | "quick_publish";

export interface AdvancedScenarioConfig {
  key: AdvancedScenarioKey;
  label: string;
  icon: LucideIcon;
  emoji: string;
  color: string;
  bgColor: string;
  description: string;
  teamMembers: EmployeeId[];
  teamDescription: string;
  timeTarget: string;
  inputFields: {
    name: string;
    label: string;
    type: "text" | "textarea" | "select";
    required: boolean;
    placeholder?: string;
    options?: string[];
  }[];
  workflowSteps: {
    employeeSlug: EmployeeId;
    title: string;
    skills: string[];
    description: string;
    dependsOn?: number[];
    parallel?: boolean;
  }[];
}

export const ADVANCED_SCENARIO_CONFIG: Record<AdvancedScenarioKey, AdvancedScenarioConfig> = {
  lianghui_coverage: {
    key: "lianghui_coverage",
    label: "两会报道团",
    icon: Building2,
    emoji: "🏛️",
    color: "#ef4444",
    bgColor: "rgba(239, 68, 68, 0.1)",
    description: "全程直播 · 深度解读 · 多端同步",
    teamMembers: ["xiaolei", "xiaoce", "xiaowen", "xiaoshen"],
    teamDescription: "4人协同 · 全流程",
    timeTarget: "快讯10min",
    inputFields: [
      { name: "conference_name", label: "会议名称", type: "text", required: true, placeholder: "例：2026年全国两会" },
      { name: "focus_topics", label: "关注议题", type: "textarea", required: false, placeholder: "可选，多个议题用换行分隔" },
      { name: "output_channels", label: "输出渠道", type: "select", required: false, options: ["全平台", "微信优先", "微博优先", "客户端优先"] },
    ],
    workflowSteps: [
      { employeeSlug: "xiaolei", title: "全网热点扫描", skills: ["web_search", "trending_topics", "social_listening"], description: "扫描会议相关热点、政策要点、舆情焦点" },
      { employeeSlug: "xiaoce", title: "报道角度设计", skills: ["topic_extraction", "angle_design"], description: "设计四级内容流水线（快讯/短视频/深度/数据新闻）", dependsOn: [0] },
      { employeeSlug: "xiaowen", title: "分级内容生产", skills: ["content_generate", "headline_generate", "script_generate"], description: "快讯10min、短视频30min、深度2h、数据新闻图文", dependsOn: [1] },
      { employeeSlug: "xiaoshen", title: "政治合规审核", skills: ["quality_review", "compliance_check", "fact_check"], description: "政治合规 + 事实核查 + 三审留痕", dependsOn: [2] },
      { employeeSlug: "xiaowen", title: "审核修订", skills: ["content_generate", "style_rewrite"], description: "根据审核意见修订终稿", dependsOn: [3] },
    ],
  },
  marathon_live: {
    key: "marathon_live",
    label: "马拉松直击队",
    icon: Timer,
    emoji: "🏃",
    color: "#3b82f6",
    bgColor: "rgba(59, 130, 246, 0.1)",
    description: "即拍即发 · 多机位 · 短视频爆款",
    teamMembers: ["xiaolei", "xiaowen", "xiaojian"],
    teamDescription: "3人协同 · 即拍即发",
    timeTarget: "关键镜头5min",
    inputFields: [
      { name: "event_name", label: "赛事名称", type: "text", required: true, placeholder: "例：2026安阳马拉松" },
      { name: "event_time", label: "赛事时间", type: "text", required: false, placeholder: "例：2026-05-01 08:00" },
      { name: "focus_points", label: "重点关注", type: "select", required: false, options: ["冠军冲线", "人物故事", "城市风貌", "综合报道"] },
    ],
    workflowSteps: [
      { employeeSlug: "xiaolei", title: "赛事信息汇总", skills: ["web_search", "trending_topics"], description: "参赛阵容、赛道路线、历史数据" },
      { employeeSlug: "xiaowen", title: "预热内容", skills: ["content_generate", "headline_generate"], description: "赛前预告稿 + 选手/城市故事稿", dependsOn: [0] },
      { employeeSlug: "xiaowen", title: "即时快讯", skills: ["content_generate"], description: "关键节点5min出稿", dependsOn: [1], parallel: true },
      { employeeSlug: "xiaojian", title: "视频方案", skills: ["video_edit_plan", "thumbnail_generate"], description: "高光片段脚本 + 剪辑方案", dependsOn: [1], parallel: true },
      { employeeSlug: "xiaolei", title: "舆情监控", skills: ["social_listening", "heat_scoring"], description: "实时话题热度追踪", dependsOn: [1], parallel: true },
      { employeeSlug: "xiaowen", title: "赛后总结", skills: ["content_generate", "script_generate"], description: "纪录片脚本、人物专访稿、城市宣传文案", dependsOn: [2, 3, 4] },
    ],
  },
  emergency_response: {
    key: "emergency_response",
    label: "突发应急组",
    icon: Zap,
    emoji: "⚡",
    color: "#f59e0b",
    bgColor: "rgba(245, 158, 11, 0.1)",
    description: "15min首发 · 权威核实 · 舆情引导",
    teamMembers: ["xiaolei", "xiaowen", "xiaoshen"],
    teamDescription: "极速响应 · 15min",
    timeTarget: "首发15min",
    inputFields: [
      { name: "event_description", label: "事件描述", type: "textarea", required: true, placeholder: "简述事件经过" },
      { name: "event_type", label: "事件类型", type: "select", required: true, options: ["自然灾害", "安全事故", "公共卫生", "社会事件", "其他"] },
      { name: "urgency", label: "紧急程度", type: "select", required: true, options: ["特急", "紧急", "较急"] },
    ],
    workflowSteps: [
      { employeeSlug: "xiaolei", title: "紧急信息采集", skills: ["web_search", "social_listening", "trending_topics"], description: "事件经过、官方通报、现场信息（标注信源可信度）" },
      { employeeSlug: "xiaoshen", title: "信息核实", skills: ["fact_check", "compliance_check"], description: "交叉验证信源、识别谣言", dependsOn: [0] },
      { employeeSlug: "xiaowen", title: "应急内容生产", skills: ["content_generate", "headline_generate"], description: "快讯首发15min、滚动更新、辟谣/预警、服务型内容", dependsOn: [1] },
      { employeeSlug: "xiaolei", title: "持续追踪", skills: ["web_search", "social_listening"], description: "救援进展、舆情变化、后续处理", dependsOn: [2] },
    ],
  },
  theme_promotion: {
    key: "theme_promotion",
    label: "主题宣传队",
    icon: Target,
    emoji: "🎯",
    color: "#8b5cf6",
    bgColor: "rgba(139, 92, 246, 0.1)",
    description: "创意策划 · 精品制作 · IP化传播",
    teamMembers: ["xiaoce", "xiaowen", "xiaojian", "xiaofa"],
    teamDescription: "精品策划 · IP化",
    timeTarget: "按日历排期",
    inputFields: [
      { name: "theme", label: "宣传主题", type: "text", required: true, placeholder: "例：建党105周年" },
      { name: "audience", label: "目标受众", type: "text", required: false, placeholder: "例：年轻网民、党员干部" },
      { name: "period", label: "传播周期", type: "text", required: false, placeholder: "例：2周" },
      { name: "channels", label: "重点渠道", type: "select", required: false, options: ["全平台", "短视频平台", "微信生态", "电视+新媒体"] },
    ],
    workflowSteps: [
      { employeeSlug: "xiaoce", title: "主题拆解与策划", skills: ["topic_extraction", "angle_design", "task_planning"], description: "模块化拆解、系列化IP方案、传播节奏表" },
      { employeeSlug: "xiaowen", title: "批量内容生产", skills: ["content_generate", "script_generate", "headline_generate"], description: "短视频脚本、长视频脚本、图文海报文案", dependsOn: [0] },
      { employeeSlug: "xiaojian", title: "视觉方案", skills: ["video_edit_plan", "layout_design", "thumbnail_generate"], description: "视频分镜、封面海报设计方案", dependsOn: [0], parallel: true },
      { employeeSlug: "xiaofa", title: "分发策略", skills: ["publish_strategy", "audience_analysis"], description: "多平台适配、KOL联动、话题运营策略", dependsOn: [1, 2] },
    ],
  },
  livelihood_service: {
    key: "livelihood_service",
    label: "民生服务组",
    icon: Home,
    emoji: "🏘️",
    color: "#10b981",
    bgColor: "rgba(16, 185, 129, 0.1)",
    description: "线索采集 · 2h闭环 · 舆论监督",
    teamMembers: ["xiaolei", "xiaowen"],
    teamDescription: "2h闭环 · 贴近群众",
    timeTarget: "线索到发布2h",
    inputFields: [
      { name: "topic", label: "民生线索/话题", type: "textarea", required: true, placeholder: "描述需要关注的民生问题" },
      { name: "domain", label: "涉及领域", type: "select", required: false, options: ["交通", "医疗", "教育", "消费", "环境", "住房", "其他"] },
      { name: "report_type", label: "报道类型", type: "select", required: false, options: ["调查报道", "政策解读", "服务指南", "舆论监督"] },
    ],
    workflowSteps: [
      { employeeSlug: "xiaolei", title: "线索深挖", skills: ["web_search", "trending_topics", "social_listening"], description: "相关政策梳理、类似案例检索、舆情热度分析" },
      { employeeSlug: "xiaowen", title: "民生内容生产", skills: ["content_generate", "script_generate"], description: "短视频稿（竖屏口语化）、图文稿、服务型内容", dependsOn: [0] },
      { employeeSlug: "xiaolei", title: "反馈追踪", skills: ["social_listening", "trending_topics"], description: "评论区舆情、问题解决进展追踪（报道→反馈→解决闭环）", dependsOn: [1] },
    ],
  },
  quick_publish: {
    key: "quick_publish",
    label: "快发流水线",
    icon: Newspaper,
    emoji: "📰",
    color: "#14b8a6",
    bgColor: "rgba(20, 184, 166, 0.1)",
    description: "标准化流水线 · 先网后台 · 高效率",
    teamMembers: ["xiaolei", "xiaowen", "xiaofa"],
    teamDescription: "标准化 · 高效率",
    timeTarget: "首发率90%",
    inputFields: [
      { name: "news_source", label: "新闻线索/通稿", type: "textarea", required: true, placeholder: "粘贴通稿内容或描述新闻线索" },
      { name: "priority", label: "发稿优先级", type: "select", required: true, options: ["紧急", "重点", "一般"] },
      { name: "target_channels", label: "目标渠道", type: "select", required: false, options: ["全平台", "微博+微信", "客户端优先", "视频号优先"] },
    ],
    workflowSteps: [
      { employeeSlug: "xiaolei", title: "信息汇聚与筛选", skills: ["web_search", "trending_topics"], description: "信息聚合、按优先级分类" },
      { employeeSlug: "xiaowen", title: "标准化快速生产", skills: ["content_generate", "headline_generate", "style_rewrite"], description: "新媒体首发稿 + 多平台适配版本", dependsOn: [0] },
      { employeeSlug: "xiaofa", title: "分发排期", skills: ["publish_strategy", "audience_analysis"], description: "三波次推送（求快→求全→求深）、最佳发布时间", dependsOn: [1] },
    ],
  },
};

export const ADVANCED_SCENARIO_KEYS = Object.keys(ADVANCED_SCENARIO_CONFIG) as AdvancedScenarioKey[];
```

- [ ] **Step 2: 验证**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add src/lib/constants.ts
git commit -m "feat: add 6 advanced media scenario configurations

Pre-configured workflows for: 两会报道团, 马拉松直击队, 突发应急组,
主题宣传队, 民生服务组, 快发流水线. Each with team, input fields,
and step-by-step workflow definitions."
```

---

## Task 5: HeroSection 组件 — 标题 + 状态标签 + 输入框

**Files:**
- Create: `src/components/home/hero-section.tsx`

- [ ] **Step 1: 实现 HeroSection**

```tsx
// src/components/home/hero-section.tsx
"use client";

import { useRef, useState } from "react";
import { Mic, Paperclip, ArrowUp, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface HeroSectionProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  isRecording: boolean;
  onVoiceToggle: () => void;
  disabled?: boolean;
}

const MODELS = [
  { value: "auto", label: "自动选择" },
  { value: "deepseek-chat", label: "DeepSeek" },
  { value: "glm-5", label: "GLM-5" },
  { value: "glm-4-flash", label: "GLM-4-Flash" },
];

export function HeroSection({
  inputValue,
  onInputChange,
  onSubmit,
  selectedModel,
  onModelChange,
  isRecording,
  onVoiceToggle,
  disabled = false,
}: HeroSectionProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [modelOpen, setModelOpen] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim()) onSubmit();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";
    }
  };

  return (
    <div className="text-center pt-16 pb-4 px-6">
      {/* 状态标签 */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full
          bg-indigo-500/10 text-xs text-indigo-300 mb-5"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        超级个体已就绪 · 8 位专家待命
      </motion.div>

      {/* 标题 */}
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-3xl font-extrabold bg-gradient-to-r from-slate-200 via-indigo-300 to-indigo-400
          bg-clip-text text-transparent mb-2"
      >
        你的智媒工作空间
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-sm text-slate-500 mb-8"
      >
        与 AI 团队协作，高效完成内容生产
      </motion.p>

      {/* 输入框（主体） */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="max-w-2xl mx-auto bg-white/[0.04] border border-white/10 rounded-2xl
          px-5 py-4 transition-all hover:border-indigo-500/30 hover:shadow-[0_0_40px_rgba(99,102,241,0.08)]
          focus-within:border-indigo-500/40 focus-within:shadow-[0_0_40px_rgba(99,102,241,0.12)]"
      >
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => { onInputChange(e.target.value); handleInput(); }}
          onKeyDown={handleKeyDown}
          placeholder="告诉超级个体你想做什么..."
          rows={1}
          disabled={disabled}
          className="w-full bg-transparent text-slate-200 text-base resize-none
            outline-none placeholder:text-slate-600 pb-3 border-b border-white/[0.06]"
        />
        <div className="flex items-center justify-between pt-3">
          <div className="flex gap-1.5">
            <button
              onClick={onVoiceToggle}
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                isRecording ? "bg-red-500/20 text-red-400" : "bg-white/[0.06] text-slate-400 hover:bg-indigo-500/15"
              )}
            >
              <Mic size={16} />
            </button>
            <button className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center text-slate-400 hover:bg-indigo-500/15 transition-all">
              <Paperclip size={16} />
            </button>
            {/* 模型选择 */}
            <div className="relative">
              <button
                onClick={() => setModelOpen(!modelOpen)}
                className="h-9 px-3 rounded-xl bg-white/[0.06] flex items-center gap-1 text-xs text-slate-400 hover:bg-indigo-500/15 transition-all"
              >
                {MODELS.find(m => m.value === selectedModel)?.label ?? "自动选择"}
                <ChevronDown size={12} />
              </button>
              {modelOpen && (
                <div className="absolute bottom-full mb-1 left-0 bg-slate-900 border border-white/10 rounded-lg py-1 min-w-[140px] z-50">
                  {MODELS.map(m => (
                    <button
                      key={m.value}
                      onClick={() => { onModelChange(m.value); setModelOpen(false); }}
                      className={cn(
                        "w-full text-left px-3 py-1.5 text-xs transition-colors",
                        selectedModel === m.value ? "text-indigo-400 bg-indigo-500/10" : "text-slate-400 hover:bg-white/5"
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onSubmit}
            disabled={!inputValue.trim() || disabled}
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500
              flex items-center justify-center text-white shadow-lg shadow-indigo-500/30
              transition-all hover:scale-105 hover:shadow-indigo-500/40
              disabled:opacity-40 disabled:hover:scale-100"
          >
            <ArrowUp size={18} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: 验证**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add src/components/home/hero-section.tsx
git commit -m "feat: add HeroSection component with animated input box

Status badge, gradient title, auto-resizing textarea, voice/attachment
buttons, model selector. Framer Motion entrance animations."
```

---

## Task 6: ScenarioGrid 组件 — 6个场景卡片

**Files:**
- Create: `src/components/home/scenario-grid.tsx`

- [ ] **Step 1: 实现 ScenarioGrid**

```tsx
// src/components/home/scenario-grid.tsx
"use client";

import { ADVANCED_SCENARIO_CONFIG, ADVANCED_SCENARIO_KEYS, type AdvancedScenarioKey } from "@/lib/constants";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { motion } from "framer-motion";

interface ScenarioGridProps {
  onScenarioClick: (key: AdvancedScenarioKey) => void;
  onCustomClick: () => void;
}

export function ScenarioGrid({ onScenarioClick, onCustomClick }: ScenarioGridProps) {
  return (
    <div className="px-6 mt-8">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-400 tracking-wide">场景快捷启动</span>
        <button
          onClick={onCustomClick}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          + 自定义场景
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {ADVANCED_SCENARIO_KEYS.map((key, i) => {
          const sc = ADVANCED_SCENARIO_CONFIG[key];
          return (
            <motion.button
              key={key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.05 }}
              onClick={() => onScenarioClick(key)}
              className="text-left p-4 rounded-xl transition-all group relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${sc.bgColor}, ${sc.bgColor.replace("0.1", "0.03")})`,
              }}
            >
              {/* Hover glow border */}
              <div
                className="absolute inset-0 rounded-xl border border-transparent transition-all
                  group-hover:border-current group-hover:shadow-[0_0_20px_var(--glow)]
                  group-hover:-translate-y-0.5"
                style={{ color: sc.color, "--glow": sc.bgColor } as React.CSSProperties}
              />
              <div className="relative">
                <span className="text-2xl block mb-2">{sc.emoji}</span>
                <div className="text-sm font-semibold mb-1" style={{ color: sc.color }}>
                  {sc.label}
                </div>
                <div className="text-[11px] text-slate-500">{sc.description}</div>
                <div className="flex gap-0.5 mt-2.5">
                  {sc.teamMembers.map((slug) => (
                    <EmployeeAvatar key={slug} employeeId={slug} size="xs" />
                  ))}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add src/components/home/scenario-grid.tsx
git commit -m "feat: add ScenarioGrid with 6 media scenario cards

3x2 grid, animated entrance, hover glow, team member avatars.
Supports click to open scenario detail sheet."
```

---

## Task 7: ScenarioDetailSheet 组件 — 场景详情面板

**Files:**
- Create: `src/components/home/scenario-detail-sheet.tsx`

- [ ] **Step 1: 实现 ScenarioDetailSheet**

此组件使用 shadcn/ui 的 Sheet 组件。展示场景详情、工作流步骤 Pipeline、输入表单、双按钮（一键启动/进入对话）。

```tsx
// src/components/home/scenario-detail-sheet.tsx
"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ADVANCED_SCENARIO_CONFIG, EMPLOYEE_META, type AdvancedScenarioKey } from "@/lib/constants";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { ArrowRight, Play, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScenarioDetailSheetProps {
  scenarioKey: AdvancedScenarioKey | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLaunch: (key: AdvancedScenarioKey, inputs: Record<string, string>) => void;
  onChat: (key: AdvancedScenarioKey) => void;
}

export function ScenarioDetailSheet({
  scenarioKey,
  open,
  onOpenChange,
  onLaunch,
  onChat,
}: ScenarioDetailSheetProps) {
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  if (!scenarioKey) return null;
  const sc = ADVANCED_SCENARIO_CONFIG[scenarioKey];

  const handleLaunch = () => {
    onLaunch(scenarioKey, formValues);
    setFormValues({});
  };

  const handleChat = () => {
    onChat(scenarioKey);
    setFormValues({});
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] bg-slate-950 border-white/10 overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{sc.emoji}</span>
            <div>
              <SheetTitle className="text-lg text-slate-100">{sc.label}</SheetTitle>
              <p className="text-xs text-slate-500 mt-0.5">{sc.description}</p>
            </div>
          </div>
        </SheetHeader>

        {/* 团队成员 */}
        <div className="py-4 border-b border-white/[0.06]">
          <div className="text-xs font-semibold text-slate-400 mb-3">参与团队 · {sc.teamDescription}</div>
          <div className="flex gap-3">
            {sc.teamMembers.map((slug) => {
              const meta = EMPLOYEE_META[slug];
              return (
                <div key={slug} className="flex flex-col items-center gap-1.5">
                  <EmployeeAvatar employeeId={slug} size="md" animated />
                  <span className="text-[10px] text-slate-500">{meta.title}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 工作流步骤 */}
        <div className="py-4 border-b border-white/[0.06]">
          <div className="text-xs font-semibold text-slate-400 mb-3">工作流程</div>
          <div className="space-y-3">
            {sc.workflowSteps.map((step, i) => {
              const meta = EMPLOYEE_META[step.employeeSlug];
              return (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: meta.bgColor, color: meta.color }}
                    >
                      {i + 1}
                    </div>
                    {i < sc.workflowSteps.length - 1 && (
                      <div className="w-px flex-1 bg-white/[0.06] my-1" />
                    )}
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="text-sm text-slate-200 font-medium">{step.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{meta.title} · {step.description}</div>
                    {step.parallel && (
                      <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">
                        并行
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 输入表单 */}
        <div className="py-4 border-b border-white/[0.06]">
          <div className="text-xs font-semibold text-slate-400 mb-3">任务参数</div>
          <div className="space-y-3">
            {sc.inputFields.map((field) => (
              <div key={field.name}>
                <label className="text-xs text-slate-400 mb-1 block">
                  {field.label} {field.required && <span className="text-red-400">*</span>}
                </label>
                {field.type === "select" ? (
                  <select
                    value={formValues[field.name] ?? ""}
                    onChange={(e) => setFormValues({ ...formValues, [field.name]: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2
                      text-sm text-slate-200 outline-none focus:border-indigo-500/40"
                  >
                    <option value="">请选择</option>
                    {field.options?.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : field.type === "textarea" ? (
                  <textarea
                    value={formValues[field.name] ?? ""}
                    onChange={(e) => setFormValues({ ...formValues, [field.name]: e.target.value })}
                    placeholder={field.placeholder}
                    rows={3}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2
                      text-sm text-slate-200 outline-none resize-none focus:border-indigo-500/40"
                  />
                ) : (
                  <input
                    type="text"
                    value={formValues[field.name] ?? ""}
                    onChange={(e) => setFormValues({ ...formValues, [field.name]: e.target.value })}
                    placeholder={field.placeholder}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2
                      text-sm text-slate-200 outline-none focus:border-indigo-500/40"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="pt-4 flex gap-3">
          <button
            onClick={handleLaunch}
            className="flex-1 h-11 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500
              text-white text-sm font-medium flex items-center justify-center gap-2
              shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all"
          >
            <Play size={14} /> 一键启动
          </button>
          <button
            onClick={handleChat}
            className="flex-1 h-11 rounded-xl bg-white/[0.06]
              text-slate-300 text-sm font-medium flex items-center justify-center gap-2
              hover:bg-white/[0.08] transition-all"
          >
            <MessageSquare size={14} /> 进入对话
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: 验证**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add src/components/home/scenario-detail-sheet.tsx
git commit -m "feat: add ScenarioDetailSheet with workflow pipeline and input form

Shows team members, step-by-step workflow visualization, input form,
and dual action buttons (launch mission / enter chat)."
```

---

## Task 8: 重构 EmployeeQuickPanel — 横向滚动 + 动态头像

**Files:**
- Modify: `src/components/home/employee-quick-panel.tsx`

- [ ] **Step 1: 重写 EmployeeQuickPanel**

改为横向滚动布局，使用 EmployeeAvatar 带 animated 效果，hover 上浮：

```tsx
// src/components/home/employee-quick-panel.tsx
"use client";

import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { motion } from "framer-motion";
import Link from "next/link";

const DISPLAY_EMPLOYEES: EmployeeId[] = [
  "xiaolei", "xiaoce", "xiaozi", "xiaowen",
  "xiaojian", "xiaoshen", "xiaofa", "xiaoshu",
];

interface EmployeeQuickPanelProps {
  activeEmployee?: EmployeeId | null;
  onEmployeeClick: (id: EmployeeId) => void;
}

export function EmployeeQuickPanel({ activeEmployee, onEmployeeClick }: EmployeeQuickPanelProps) {
  return (
    <div className="px-6 mt-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-400 tracking-wide">AI 专家团队</span>
        <Link href="/ai-employees" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
          全部员工 →
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {DISPLAY_EMPLOYEES.map((id, i) => {
          const meta = EMPLOYEE_META[id];
          const isActive = activeEmployee === id;
          return (
            <motion.button
              key={id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.04 }}
              onClick={() => onEmployeeClick(id)}
              className={`flex-shrink-0 w-[88px] flex flex-col items-center gap-2
                py-3 px-2 rounded-xl transition-all
                ${isActive
                  ? "bg-white/[0.08] ring-1 ring-white/15"
                  : "bg-white/[0.02] hover:bg-white/[0.06] hover:-translate-y-1"
                }`}
            >
              <EmployeeAvatar employeeId={id} size="lg" animated />
              <span className={`text-[11px] text-center leading-tight whitespace-nowrap
                ${isActive ? "text-slate-200" : "text-slate-500"}`}>
                {meta.title}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 确保 scrollbar-hide 样式存在**

检查 `src/app/globals.css` 是否有 `.scrollbar-hide`，如果没有添加：

```css
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
```

- [ ] **Step 3: 验证**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add src/components/home/employee-quick-panel.tsx src/app/globals.css
git commit -m "refactor: employee panel to horizontal scroll with animated avatars

Replace grid layout with horizontal scroll. Use EmployeeAvatar with
micro-animations. Active employee highlighting. Hover float effect."
```

---

## Task 9: 重构 HomeClient — 组装四层布局

**Files:**
- Modify: `src/app/(dashboard)/home/home-client.tsx`
- Modify: `src/app/(dashboard)/home/page.tsx`

- [ ] **Step 1: 重写 home-client.tsx**

将现有 643 行的 HomeClient 重构为使用新组件的四层布局。保留核心状态管理和聊天逻辑，但 UI 结构完全重组：

```tsx
// src/app/(dashboard)/home/home-client.tsx
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EMPLOYEE_META, ADVANCED_SCENARIO_CONFIG, type EmployeeId, type AdvancedScenarioKey } from "@/lib/constants";
import { startMission } from "@/app/actions/missions";
import { ParticleBackground } from "@/components/shared/particle-background";
import { HeroSection } from "@/components/home/hero-section";
import { EmployeeQuickPanel } from "@/components/home/employee-quick-panel";
import { ScenarioGrid } from "@/components/home/scenario-grid";
import { ScenarioDetailSheet } from "@/components/home/scenario-detail-sheet";
import { RecentSection } from "@/components/home/recent-section";
import { EmbeddedChatPanel } from "@/components/home/embedded-chat-panel";
import type { ScenarioCardData } from "@/lib/types";

// Props 必须与 page.tsx 实际传递的数据类型完全一致
interface HomeClientProps {
  recentMissions: { id: string; title: string; status: string; createdAt: string }[];
  recentConversations: { id: string; title: string | null; employeeSlug: string; updatedAt: string }[];
  scenarioMap: Record<string, ScenarioCardData[]>;
  employeeDbIdMap: Record<string, string>;
}

// 注意：使用 named export（不是 default），与 page.tsx 的 import { HomeClient } 一致
export function HomeClient({
  recentMissions,
  recentConversations,
  scenarioMap,
  employeeDbIdMap,
}: HomeClientProps) {
  const router = useRouter();

  // Core state
  const [inputValue, setInputValue] = useState("");
  const [activeEmployee, setActiveEmployee] = useState<EmployeeId | null>(null);
  const [selectedModel, setSelectedModel] = useState("auto");
  const [isRecording, setIsRecording] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // Scenario state
  const [selectedScenario, setSelectedScenario] = useState<AdvancedScenarioKey | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const effectiveEmployee = activeEmployee ?? "xiaolei";

  // 提交输入 → 进入对话模式
  const handleSubmit = useCallback(() => {
    if (!inputValue.trim()) return;
    // 存储到 sessionStorage 以便对话中心接收
    sessionStorage.setItem("chat-handoff", JSON.stringify({
      employeeSlug: effectiveEmployee,
      initialMessage: inputValue,
    }));
    router.push(`/chat?handoff=1&employee=${effectiveEmployee}`);
  }, [inputValue, effectiveEmployee, router]);

  // 点击员工
  const handleEmployeeClick = useCallback((id: EmployeeId) => {
    setActiveEmployee(id);
  }, []);

  // 场景卡片点击 → 打开详情面板
  const handleScenarioClick = useCallback((key: AdvancedScenarioKey) => {
    setSelectedScenario(key);
    setSheetOpen(true);
  }, []);

  // 场景一键启动 → 使用现有 startMission server action 创建 Mission
  const handleScenarioLaunch = useCallback(async (key: AdvancedScenarioKey, inputs: Record<string, string>) => {
    const sc = ADVANCED_SCENARIO_CONFIG[key];
    try {
      // 直接调用 server action（不走 API route，因为 /api/missions 不存在）
      const result = await startMission({
        title: `${sc.label} - ${inputs[sc.inputFields[0]?.name] ?? ""}`.trim(),
        scenario: key,
        userInstruction: Object.entries(inputs)
          .filter(([, v]) => v)
          .map(([k, v]) => `${sc.inputFields.find(f => f.name === k)?.label}: ${v}`)
          .join("\n"),
        teamMembers: sc.teamMembers,
      });

      if (result?.error) throw new Error(result.error);
      toast.success(`${sc.label} 已启动`);
      setSheetOpen(false);
      if (result?.missionId) router.push(`/missions/${result.missionId}`);
    } catch {
      toast.error("启动失败，请重试");
    }
  }, [router]);

  // 场景进入对话模式
  const handleScenarioChat = useCallback((key: AdvancedScenarioKey) => {
    const sc = ADVANCED_SCENARIO_CONFIG[key];
    const leader = sc.teamMembers[0];
    sessionStorage.setItem("chat-handoff", JSON.stringify({
      employeeSlug: leader,
      scenarioKey: key,
    }));
    setSheetOpen(false);
    router.push(`/chat?handoff=1&employee=${leader}`);
  }, [router]);

  // 语音录制
  const handleVoiceToggle = useCallback(() => {
    // 复用现有 Web Speech API 逻辑
    setIsRecording(prev => !prev);
  }, []);

  // 自定义场景 → 跳转工作流中心
  const handleCustomScenario = useCallback(() => {
    router.push("/workflows?action=create");
  }, [router]);

  // 对话模式
  if (chatOpen) {
    return (
      <EmbeddedChatPanel
        employeeSlug={effectiveEmployee}
        employeeDbId={employeeDbIdMap[effectiveEmployee] ?? ""}
        scenarios={scenarioMap[effectiveEmployee] ?? []}
        allScenarios={scenarioMap}
        employeeDbIdMap={employeeDbIdMap}
        onBack={() => setChatOpen(false)}
      />
    );
  }

  return (
    <div className="relative h-full overflow-y-auto">
      {/* 粒子背景 */}
      <ParticleBackground
        particleCount={60}
        className="fixed inset-0 z-0 pointer-events-none opacity-50"
      />

      <div className="relative z-10 max-w-3xl mx-auto pb-12">
        {/* Layer 1: Hero — 状态标签 + 标题 + 输入框 */}
        <HeroSection
          inputValue={inputValue}
          onInputChange={setInputValue}
          onSubmit={handleSubmit}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          isRecording={isRecording}
          onVoiceToggle={handleVoiceToggle}
        />

        {/* Layer 2: AI 专家团队 */}
        <EmployeeQuickPanel
          activeEmployee={activeEmployee}
          onEmployeeClick={handleEmployeeClick}
        />

        {/* Layer 3: 场景快捷启动 */}
        <ScenarioGrid
          onScenarioClick={handleScenarioClick}
          onCustomClick={handleCustomScenario}
        />

        {/* Layer 4: 动态信息流 */}
        {/* 注意：RecentSection 的 props 名是 missions/conversations，不是 recentMissions/recentConversations */}
        <RecentSection
          missions={recentMissions}
          conversations={recentConversations}
        />
      </div>

      {/* 场景详情面板 */}
      <ScenarioDetailSheet
        scenarioKey={selectedScenario}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onLaunch={handleScenarioLaunch}
        onChat={handleScenarioChat}
      />
    </div>
  );
}
```

- [ ] **Step 2: 更新 page.tsx 的 props**

确保 `page.tsx` 传递的 props 与新 HomeClient 接口匹配。检查现有 page.tsx 的数据获取逻辑，保留不变，只确认 prop 名称一致。

- [ ] **Step 3: 更新 RecentSection 接口**

确保 `RecentSection` 接受 `recentMissions` 和 `recentConversations` props（检查现有实现是否已经是这样），并使用 `meta.title` 而非 `meta.nickname` 显示员工名称。

- [ ] **Step 4: 验证**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: redesign homepage as super individual command center

Four-layer layout: HeroSection (input-first), EmployeeQuickPanel
(horizontal scroll), ScenarioGrid (6 media scenarios), RecentSection.
Particle background, scenario detail sheet with workflow pipeline."
```

---

## Task 10: 场景启动对接 — 验证 startMission server action 兼容性

**Files:**
- Read: `src/app/actions/missions.ts`
- Possibly modify: `src/app/actions/missions.ts`（如参数不兼容）
- Possibly modify: `src/db/schema/enums.ts`（如 scenario 是枚举类型）

- [ ] **Step 1: 读取 startMission action 的参数接口**

读取 `src/app/actions/missions.ts`，确认 `startMission` 接受的参数结构。Task 9 的 `handleScenarioLaunch` 调用 `startMission({ title, scenario, userInstruction, teamMembers })`，确保这些字段都被支持。

- [ ] **Step 2: 检查 scenario 字段类型**

读取 `src/db/schema/` 中 missions 表的 `scenario` 列定义：
- 如果是 `text` 类型 → 无需改动，新的 AdvancedScenarioKey 值直接存入
- 如果是 `enum` 类型 → 需要在枚举中添加 6 个新值：`lianghui_coverage`, `marathon_live`, `emergency_response`, `theme_promotion`, `livelihood_service`, `quick_publish`

- [ ] **Step 3: 适配 startMission 参数（如需要）**

如果 `startMission` 的参数签名与 Task 9 调用不匹配（如字段名不同、缺少某些字段），在此步骤做适配。可能需要：
- 添加缺少的参数到 action
- 或在 HomeClient 中转换参数格式

- [ ] **Step 4: 验证**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: ensure startMission supports advanced scenario keys

Verify and adapt mission creation for new media scenario workflows."
```

---

## 注意事项：延迟到后续迭代的功能

以下功能在 spec 中提及但 Phase 1 暂不实现，在首页可用后单独迭代：

1. **输入框智能路由**（Spec 2.4）：用户输入后的意图识别 + 置信度分级路由。Phase 1 的输入框直接跳转对话中心，不做意图识别。后续迭代中集成 `intent-recognition.ts`。
2. **Hero-to-Chat 模式切换动画**（Spec 2.3）：Framer Motion layoutAnimation 从首页无缝过渡到对话。Phase 1 使用 `router.push` 页面导航。后续迭代中改为页内动画切换。

---

## Task 11: Mission 页面兼容 — 新增场景筛选

**Files:**
- Modify: `src/app/(dashboard)/missions/missions-client.tsx`

- [ ] **Step 1: 添加新场景到筛选器**

在 `missions-client.tsx` 中，找到场景筛选 UI（使用 `SCENARIO_CONFIG`），添加 `ADVANCED_SCENARIO_CONFIG` 的场景到筛选选项中。

具体做法：导入 `ADVANCED_SCENARIO_CONFIG`，在筛选下拉中合并两组场景。确保新场景的 label 和 color 正确显示。

- [ ] **Step 2: 验证**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: add advanced scenario filters to mission list

Support filtering by new media scenario keys in mission center."
```

---

## Task 12: 端到端验证 & 清理

- [ ] **Step 1: 完整构建验证**

```bash
npx tsc --noEmit && npm run build
```

Expected: PASS, 0 errors

- [ ] **Step 2: 本地运行验证**

```bash
npm run dev
```

手动检查：
1. 首页显示新布局（标题/输入框/员工/场景/动态）
2. 员工名称显示为职能名称（热点分析师等），无旧昵称
3. 员工头像有微动效
4. 6个场景卡片点击后展开详情面板
5. 场景详情面板显示工作流步骤、输入表单、双按钮
6. 粒子背景正常渲染
7. 输入框发送跳转到对话中心

- [ ] **Step 3: 清理未使用的代码**

检查是否有旧的首页组件代码变为 dead code，移除不再使用的导入和组件。

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "chore: cleanup and verify phase 1 implementation

Remove unused imports, verify build passes, end-to-end check complete."
```
