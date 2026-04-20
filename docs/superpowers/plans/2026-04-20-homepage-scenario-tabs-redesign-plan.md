# 首页场景 Tab 重构 + 主流场景 10 条落地 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `/home` 首页场景 tab 从"8 员工代号 + 自定义"改成"主流场景 + 8 职能 + 我的工作流"，并落地 10 个"主流场景"预设模板（9 条新增 + 1 条合并改名），让每张卡片都能在首页一键启动并跑到稿件产出。

**Architecture:**
- 加一列 `workflow_templates.is_featured boolean DEFAULT false`，10 条主流场景打 `is_featured=true` 同时保留 `owner_employee_id`（双重归类）
- DAL 新增 `listTemplatesForHomepageByTab(orgId, tab)` 统一接口，保留旧 `listTemplatesForHomepageByEmployee` 作 deprecated 别名
- UI 只加一个 `featured` tab 到 `TAB_ORDER` 最前，默认选中

**Tech Stack:** Next.js 16 App Router · Drizzle ORM + Supabase Postgres · Vitest · shadcn/ui Tabs · Framer Motion · 现有 30+ skill（仅复用不新造）

**Spec:** `docs/superpowers/specs/2026-04-20-homepage-scenario-tabs-redesign-design.md`

---

## 文件结构总览

| 文件 | 动作 | 责任 |
|---|---|---|
| `supabase/migrations/20260420000002_workflow_templates_is_featured.sql` | **Create** | 新增 `is_featured` 列 + 索引 |
| `src/db/schema/workflows.ts` | **Modify** (添加 1 行) | `workflowTemplates` 表定义加 `isFeatured` 列 |
| `src/lib/dal/workflow-templates.ts` | **Modify** | `BuiltinSeedInput` 加 `isFeatured`；`seedBuiltinTemplatesForOrg` 写入新列 |
| `src/db/seed-builtin-workflows.ts` | **Modify** (大) | `BuiltinWorkflowSeed` 加字段；追加 9 条新 seed；修改 `pub.feature_story_pipeline`；`toBuiltinSeedInput` 透传 |
| `src/lib/dal/workflow-templates-listing.ts` | **Modify** | 新增 `HomepageTabKey` type + `listTemplatesForHomepageByTab`；旧函数改为 deprecated 别名 |
| `src/lib/dal/__tests__/workflow-templates-listing.test.ts` | **Modify** | 追加 `listTemplatesForHomepageByTab` 新分支测试（featured / custom / employee） |
| `src/app/(dashboard)/home/page.tsx` | **Modify** | 并行 fetch 10 个 tab（多 `featured` 一路） |
| `src/components/home/scenario-grid.tsx` | **Modify** | `TAB_ORDER` 头部插入 `featured`；`defaultValue` 改为 `featured` |

**不动的文件：**
`WorkflowLaunchDialog` / `startMissionFromTemplate` action / `mission-executor` / `channels/gateway.ts` / `employees` 表 / 其他 26 条 seed（除 `pub.feature_story_pipeline`）/ 首页其他区块。

---

## Phase 1 — Schema + Migration + BuiltinSeedInput 扩展

### Task 1: Migration 文件（新增 `is_featured` 列）

**Files:**
- Create: `supabase/migrations/20260420000002_workflow_templates_is_featured.sql`

- [ ] **Step 1：写 migration SQL**

Create `supabase/migrations/20260420000002_workflow_templates_is_featured.sql`:

```sql
BEGIN;

-- 2026-04-20 homepage scenario tabs redesign —— 新增 is_featured 标识
-- 用途：首页"主流场景" tab 过滤（与 owner_employee_id 正交，双重归类）
ALTER TABLE workflow_templates
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

-- 部分索引：主流场景 tab 查询热路径（is_featured=true AND is_public=true）
CREATE INDEX IF NOT EXISTS idx_workflow_templates_featured
  ON workflow_templates(organization_id, is_featured)
  WHERE is_featured = true AND is_public = true;

COMMIT;
```

- [ ] **Step 2：commit migration**

```bash
git add supabase/migrations/20260420000002_workflow_templates_is_featured.sql
git commit -m "feat(db): 新增 workflow_templates.is_featured 列 + 部分索引"
```

---

### Task 2: Drizzle schema 对齐（新增 isFeatured 字段）

**Files:**
- Modify: `src/db/schema/workflows.ts` (at the block starting line 84 "2026-04-20 realignment")

- [ ] **Step 1：在 `workflowTemplates` 定义中插入 `isFeatured` 字段**

在 `src/db/schema/workflows.ts` 里找到这段：

```ts
  // 2026-04-20 realignment
  isPublic: boolean("is_public").notNull().default(true),
  ownerEmployeeId: text("owner_employee_id"),
  launchMode: text("launch_mode").notNull().default("form"),
  promptTemplate: text("prompt_template"),
```

在 `promptTemplate` 行后追加一行：

```ts
  // 2026-04-20 homepage scenario tabs — "主流场景" tab 过滤字段
  isFeatured: boolean("is_featured").notNull().default(false),
```

- [ ] **Step 2：运行 type check 确认 schema 自洽**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit
```
Expected: PASS（`WorkflowTemplateRow` 通过 `InferSelectModel` 自动带上 `isFeatured: boolean` 字段，现有代码不会因新增字段爆掉）

- [ ] **Step 3：commit**

```bash
git add src/db/schema/workflows.ts
git commit -m "feat(schema): workflowTemplates 加 isFeatured 列 + 类型同步"
```

---

### Task 3: BuiltinSeedInput 扩展 + seedBuiltinTemplatesForOrg 写入新列

**Files:**
- Modify: `src/lib/dal/workflow-templates.ts:322-437`

- [ ] **Step 1：给 `BuiltinSeedInput` 加 `isFeatured?` 字段**

在 `src/lib/dal/workflow-templates.ts` 里，找到 `BuiltinSeedInput` interface（约 322 行）。在 `promptTemplate?: string | null;` 后追加：

```ts
  /** 主流场景 tab 标记；默认 false。仅内置预设会设为 true。 */
  isFeatured?: boolean;
```

- [ ] **Step 2：在 `baseValues` 里写入 `isFeatured`**

找到 `seedBuiltinTemplatesForOrg` 里的 `baseValues` 对象（约 358 行），在 `promptTemplate: seed.promptTemplate ?? null,` 后追加：

```ts
      // 2026-04-20 homepage — "主流场景" tab 标识
      isFeatured: seed.isFeatured ?? false,
```

- [ ] **Step 3：在 `setOnConflict` 里写入 `isFeatured`**

找到 `setOnConflict` 对象（约 386 行），在 `promptTemplate: baseValues.promptTemplate,` 后追加：

```ts
      isFeatured: baseValues.isFeatured,
```

（语义：seed 即真相，每次 reseed 都会把 `is_featured` 重置为 seed 定义的值）

- [ ] **Step 4：type check**

```bash
npx tsc --noEmit
```
Expected: PASS

- [ ] **Step 5：commit**

```bash
git add src/lib/dal/workflow-templates.ts
git commit -m "feat(dal): BuiltinSeedInput 支持 isFeatured，seed upsert 写入新列"
```

---

## Phase 2 — Seed 追加（9 条新增 + 精品内容合并）

### Task 4: BuiltinWorkflowSeed 类型扩展

**Files:**
- Modify: `src/db/seed-builtin-workflows.ts:30-51`

- [ ] **Step 1：给 `BuiltinWorkflowSeed` interface 加 `isFeatured` 字段**

在 `src/db/seed-builtin-workflows.ts` 里找到 interface（约 30 行），在 `promptTemplate?: string;` 后追加：

```ts
  /** 主流场景 tab 标记；默认 false。 */
  isFeatured?: boolean;
```

- [ ] **Step 2：在 `toBuiltinSeedInput` 里透传**

找到 `toBuiltinSeedInput` 函数（约 1341 行），在 `promptTemplate: w.promptTemplate ?? null,` 后追加：

```ts
    // 2026-04-20 homepage
    isFeatured: w.isFeatured ?? false,
```

- [ ] **Step 3：type check + commit**

```bash
npx tsc --noEmit
git add src/db/seed-builtin-workflows.ts
git commit -m "feat(seed): BuiltinWorkflowSeed 支持 isFeatured 字段透传"
```

---

### Task 5: 修改 `pub.feature_story_pipeline`（合并精品内容）

**Files:**
- Modify: `src/db/seed-builtin-workflows.ts`（找到 `slug: "pub.feature_story_pipeline"` 那条）

- [ ] **Step 1：改名 / Owner / Team / AppChannel / Featured**

在 `src/db/seed-builtin-workflows.ts` 里找到 `slug: "pub.feature_story_pipeline"` 这条 seed。做以下**精确修改**（保留 slug / launchMode / inputFields / systemInstruction / promptTemplate / steps 不变）：

| 字段 | 原值 | 新值 |
|---|---|---|
| `name` | `"特稿生产线"` | `"精品内容（深度大稿）"` |
| `description` | `"重大特稿的从调研到合规的完整生产链路，支持多档深度。"` | `"重大热点或指定选题的 6 人协同深度大稿生产，覆盖调研→撰写→核查→合规全链路，发布到 APP 首页精品内容栏目。"` |
| `ownerEmployeeId` | `null` | `"xiaowen"` |
| `defaultTeam` | `["xiaolei", "xiaowen", "xiaozi", "xiaoshen"]` | `["xiaolei", "xiaoce", "xiaozi", "xiaowen", "xiaoshen", "xiaofa"]` |
| `appChannelSlug` | `"app_news"` | `"app_home"` |
| 新增 | — | `isFeatured: true,`（放在 `appChannelSlug` 后） |

- [ ] **Step 2：type check**

```bash
npx tsc --noEmit
```
Expected: PASS

- [ ] **Step 3：commit**

```bash
git add src/db/seed-builtin-workflows.ts
git commit -m "feat(seed): 合并精品内容到 pub.feature_story_pipeline（改名 + 6 人固定 + app_home + featured）"
```

---

### Task 6: 追加 `daily_ai_news` + `tech_weekly` + `daily_politics`（3 条）

**Files:**
- Modify: `src/db/seed-builtin-workflows.ts`（在 `pub.incident_rapid_response` 之后、数组 `]` 闭合之前追加）

- [ ] **Step 1：在数组末尾追加 3 条 seed**

在 `pub.incident_rapid_response` seed 的 `},` 之后（数组末尾 `];` 之前）追加：

```ts
  // ════════════════════════════════════════════════════════════════════════
  // 主流场景 · 10 条（isFeatured=true，双重归类：owner tab + featured tab）
  // 对应 spec: 2026-04-20-homepage-scenario-tabs-redesign-design.md §5
  // ════════════════════════════════════════════════════════════════════════

  {
    slug: "daily_ai_news",
    name: "每日 AI 资讯",
    description: "从热点发现匹配今日 AI 资讯，聚合多源、逐条摘要，合并成稿，发布到 APP 每日 AI 资讯栏目。",
    icon: "sparkles",
    category: "news",
    ownerEmployeeId: "xiaolei",
    defaultTeam: ["xiaolei", "xiaozi", "xiaofa"],
    appChannelSlug: "app_news",
    isFeatured: true,
    launchMode: "form",
    inputFields: [
      {
        name: "focus_subdomain",
        label: "AI 子方向",
        type: "select",
        required: false,
        defaultValue: "all",
        options: [
          { value: "all", label: "全部 AI" },
          { value: "llm", label: "大模型" },
          { value: "agent", label: "智能体" },
          { value: "hardware", label: "AI 硬件" },
          { value: "policy", label: "AI 政策" },
        ],
      },
      {
        name: "item_count",
        label: "条目数",
        type: "number",
        required: false,
        defaultValue: 8,
        validation: { min: 3, max: 20 },
      },
    ],
    systemInstruction:
      "聚焦今日 AI（{{focus_subdomain}}）资讯，挑选 Top {{item_count}} 条代表性新闻，每条产出 80-120 字概要（事实 + 影响），最后合并为一篇《每日 AI 资讯》稿件，含导语 / 分条目列表 / 收尾观察。",
    promptTemplate:
      "检索并聚合今日 AI 资讯（聚焦 {{focus_subdomain}}），挑选 Top {{item_count}} 条，每条 80-120 字摘要，合并为可直发稿件。",
    steps: [
      step(1, "AI 热榜扫描", "trending_topics", "热榜聚合", "perception", "fetch"),
      step(2, "多源 AI 资讯聚合", "news_aggregation", "新闻聚合", "perception", "aggregate"),
      step(3, "全网深度搜索", "web_search", "全网搜索", "perception", "search"),
      step(4, "逐条摘要生成", "summary_generate", "摘要生成", "generation", "summary"),
      step(5, "合并成稿", "content_generate", "内容生成", "generation", "write"),
    ],
  },

  {
    slug: "tech_weekly",
    name: "科技周报（深度长文）",
    description: "围绕指定科技主题范围产出一篇深度长文周报，含趋势洞察、数据支撑与多方观点。",
    icon: "newspaper",
    category: "deep",
    ownerEmployeeId: "xiaowen",
    defaultTeam: ["xiaowen", "xiaoce", "xiaozi"],
    appChannelSlug: "app_news",
    isFeatured: true,
    launchMode: "form",
    inputFields: [
      {
        name: "topic_scope",
        label: "主题范围",
        type: "text",
        required: true,
        placeholder: "如：大模型应用 / 半导体产业链 / 机器人产业",
      },
      {
        name: "week_range",
        label: "周期范围",
        type: "daterange",
        required: false,
      },
      {
        name: "word_count",
        label: "目标字数",
        type: "number",
        required: false,
        defaultValue: 4500,
        validation: { min: 2500, max: 10000 },
      },
      {
        name: "depth_level",
        label: "深度档位",
        type: "select",
        required: false,
        defaultValue: "standard",
        options: [
          { value: "light", label: "轻度速览" },
          { value: "standard", label: "标准深度" },
          { value: "heavy", label: "重度研报" },
        ],
      },
    ],
    systemInstruction:
      "产出一篇围绕「{{topic_scope}}」（覆盖周期 {{week_range}}）的科技周报深度长文，目标 {{word_count}} 字，档位 {{depth_level}}。结构：1) 本周关键事件速览 2) 趋势主题归纳（2-3 条）3) 多方观点 4) 数据支撑 5) 下周看点。",
    promptTemplate:
      "写一篇「{{topic_scope}}」科技周报深度长文（{{week_range}}，{{word_count}} 字，{{depth_level}}）。",
    steps: [
      step(1, "主题背景调研", "web_search", "全网搜索", "perception", "research"),
      step(2, "周度热点聚合", "news_aggregation", "新闻聚合", "perception", "aggregate"),
      step(3, "同业对标参考", "case_reference", "案例参考", "analysis", "case"),
      step(4, "深度周报撰写", "content_generate", "内容生成", "generation", "write"),
      step(5, "成稿质量复核", "quality_review", "质量审核", "management", "review"),
    ],
  },

  {
    slug: "daily_politics",
    name: "每日时政热点",
    description: "按区域 / 紧急程度聚合每日时政热点，经事实核查与合规扫描后产出可发布的时政稿件。",
    icon: "landmark",
    category: "news",
    ownerEmployeeId: "xiaolei",
    defaultTeam: ["xiaolei", "xiaowen", "xiaoshen"],
    appChannelSlug: "app_politics",
    isFeatured: true,
    launchMode: "form",
    inputFields: [
      {
        name: "region",
        label: "关注区域",
        type: "select",
        required: true,
        defaultValue: "national",
        options: [
          { value: "national", label: "全国" },
          { value: "sichuan", label: "四川" },
          { value: "chengdu", label: "成都" },
          { value: "international", label: "国际" },
        ],
      },
      {
        name: "urgency_level",
        label: "紧急程度",
        type: "select",
        required: false,
        defaultValue: "normal",
        options: [
          { value: "urgent", label: "紧急（优先发布）" },
          { value: "normal", label: "常规" },
        ],
      },
      {
        name: "item_count",
        label: "条目数",
        type: "number",
        required: false,
        defaultValue: 5,
        validation: { min: 1, max: 10 },
      },
    ],
    systemInstruction:
      "产出 {{region}} 区域的每日时政热点（紧急程度 {{urgency_level}}），{{item_count}} 条。每条含：1) 100 字内事实摘要 2) 政策背景一句话 3) 影响与走向。全文必经事实核查与合规扫描。",
    promptTemplate:
      "为 {{region}} 产出 {{item_count}} 条每日时政热点（{{urgency_level}}），含核查与合规。",
    steps: [
      step(1, "时政信源聚合", "news_aggregation", "新闻聚合", "perception", "aggregate"),
      step(2, "多源全网搜索", "web_search", "全网搜索", "perception", "search"),
      step(3, "事实核查", "fact_check", "事实核查", "management", "verify"),
      step(4, "时政稿件撰写", "content_generate", "内容生成", "generation", "write"),
      step(5, "合规审查", "compliance_check", "合规审核", "management", "compliance"),
    ],
  },
```

- [ ] **Step 2：type check**

```bash
npx tsc --noEmit
```
Expected: PASS

- [ ] **Step 3：commit**

```bash
git add src/db/seed-builtin-workflows.ts
git commit -m "feat(seed): 追加主流场景 daily_ai_news / tech_weekly / daily_politics"
```

---

### Task 7: 追加 `daily_podcast` + `daily_tandian` + `daily_chuanchao`（3 条）

**Files:**
- Modify: `src/db/seed-builtin-workflows.ts`（接 Task 6 末尾继续追加）

- [ ] **Step 1：在 `daily_politics` seed 之后追加 3 条**

```ts
  {
    slug: "daily_podcast",
    name: "每日热点播客",
    description: "自动锁定今日热点，输出 1-3 集播客脚本（开场 / 主讲 / 互动 / 收尾），可发送至 AIGC 播客加工。",
    icon: "mic",
    category: "podcast",
    ownerEmployeeId: "xiaowen",
    defaultTeam: ["xiaowen", "xiaolei", "xiaojian"],
    appChannelSlug: "app_livelihood_podcast",
    isFeatured: true,
    launchMode: "direct",
    inputFields: [],
    systemInstruction:
      "从今日热榜挑选 1-3 个适合播客节奏的选题，每个输出一集播客脚本。结构：开场钩子（30 秒）/ 主讲（6-8 分钟，口语化）/ 互动问答（2-3 个）/ 收尾金句。末尾给出音频节奏建议（BPM / 音乐风格）。",
    promptTemplate:
      "基于今日热榜生成 1-3 集每日热点播客脚本，含 4 段结构与音频节奏建议。",
    steps: [
      step(1, "今日热榜扫描", "trending_topics", "热榜聚合", "perception", "fetch"),
      step(2, "选题价值评分", "heat_scoring", "热度评分", "analysis", "score"),
      step(3, "播客脚本撰写", "content_generate", "内容生成", "generation", "write"),
      step(4, "音频节奏规划", "audio_plan", "音频规划", "generation", "audio"),
    ],
  },

  {
    slug: "daily_tandian",
    name: "每日探店",
    description: "按城市 + 店型生成 6 阶段探店脚本 + 图文稿件，含广告法合规扫描。",
    icon: "map-pin",
    category: "livelihood",
    ownerEmployeeId: "xiaojian",
    defaultTeam: ["xiaojian", "xiaowen", "xiaoshen"],
    appChannelSlug: "app_livelihood_tandian",
    isFeatured: true,
    launchMode: "form",
    inputFields: [
      {
        name: "city",
        label: "城市",
        type: "select",
        required: true,
        defaultValue: "成都",
        options: ["成都", "重庆", "深圳", "广州", "上海", "北京", "杭州", "武汉"],
      },
      {
        name: "shop_type",
        label: "店型",
        type: "select",
        required: true,
        defaultValue: "餐饮",
        options: ["餐饮", "茶饮", "咖啡", "烘焙", "美妆", "亲子", "夜生活"],
      },
      {
        name: "shop_name",
        label: "具体门店",
        type: "text",
        required: false,
        placeholder: "留空则由系统在该城市 × 店型中挑选热门店",
      },
    ],
    systemInstruction:
      "为 {{city}} 的 {{shop_type}}（具体门店：{{shop_name}}）产出"每日探店"。视频脚本必须含 6 阶段：到店 / 环境 / 招牌菜 / 试吃 / 服务 / 回味，每段标注时长与景别。配套图文稿 600-900 字。全文经广告法极限词扫描。",
    promptTemplate:
      "为 {{city}} 的 {{shop_type}}（{{shop_name}}）产出 6 阶段探店脚本 + 图文 + 合规扫描。",
    steps: [
      step(1, "门店信息检索", "web_search", "全网搜索", "perception", "search"),
      step(2, "本地口碑聚合", "social_listening", "社交舆情", "perception", "listen"),
      step(3, "探店脚本生成（6 阶段）", "video_edit_plan", "视频剪辑规划", "generation", "plan"),
      step(4, "图文稿撰写", "content_generate", "内容生成", "generation", "write"),
      step(5, "广告法合规扫描", "compliance_check", "合规审核", "management", "compliance"),
    ],
  },

  {
    slug: "daily_chuanchao",
    name: "每日川超战报",
    description: "通过热点检索匹配近期川超热门比赛，输出赛事简介 / 进球集锦 / 赛前花絮 / 赛后影响的图文新闻。",
    icon: "trophy",
    category: "news",
    ownerEmployeeId: "xiaolei",
    defaultTeam: ["xiaolei", "xiaozi", "xiaowen"],
    appChannelSlug: "app_sports",
    isFeatured: true,
    launchMode: "direct",
    inputFields: [],
    systemInstruction:
      "检索近期川超热门比赛（优先最近 3 天），挑选 1-2 场重点赛事。每场产出：1) 赛事简介（对阵 / 比分 / 关键时刻）2) 进球集锦要点（含时间点）3) 赛前准备 / 花絮 4) 赛后影响（积分 / 舆情）。图文可直发体育频道。",
    promptTemplate:
      "检索近期川超热门比赛，产出每日川超战报（4 段结构图文）。",
    steps: [
      step(1, "川超赛事热点扫描", "trending_topics", "热榜聚合", "perception", "fetch"),
      step(2, "赛事信息深读", "web_deep_read", "网页深读", "perception", "crawl"),
      step(3, "同类赛事案例参考", "case_reference", "案例参考", "analysis", "case"),
      step(4, "战报图文撰写", "content_generate", "内容生成", "generation", "write"),
    ],
  },
```

- [ ] **Step 2：type check**

```bash
npx tsc --noEmit
```
Expected: PASS

- [ ] **Step 3：commit**

```bash
git add src/db/seed-builtin-workflows.ts
git commit -m "feat(seed): 追加主流场景 daily_podcast / daily_tandian / daily_chuanchao"
```

---

### Task 8: 追加 `zhongcao_daily` + `local_news` + `national_hotspot`（3 条）

**Files:**
- Modify: `src/db/seed-builtin-workflows.ts`（接 Task 7 末尾）

- [ ] **Step 1：在 `daily_chuanchao` seed 之后追加 3 条**

```ts
  {
    slug: "zhongcao_daily",
    name: "种草日更",
    description: "针对指定平台产出种草内容（含广告法极限词扫描），经合规审核后可一键分发到 APP 种草栏目。",
    icon: "sprout",
    category: "social",
    ownerEmployeeId: "xiaowen",
    defaultTeam: ["xiaowen", "xiaoshen", "xiaofa"],
    appChannelSlug: "app_livelihood_zhongcao",
    isFeatured: true,
    launchMode: "form",
    inputFields: [
      {
        name: "platform",
        label: "目标平台",
        type: "select",
        required: true,
        defaultValue: "xiaohongshu",
        options: [
          { value: "xiaohongshu", label: "小红书" },
          { value: "douyin", label: "抖音" },
          { value: "bilibili", label: "B 站" },
          { value: "video_channel", label: "视频号" },
        ],
      },
      {
        name: "product_type",
        label: "种草品类",
        type: "text",
        required: true,
        placeholder: "如：平价彩妆 / 3C 数码 / 儿童图书",
      },
      {
        name: "post_count",
        label: "条目数",
        type: "number",
        required: false,
        defaultValue: 3,
        validation: { min: 1, max: 8 },
      },
    ],
    systemInstruction:
      "为 {{platform}} 产出 {{post_count}} 条关于「{{product_type}}」的种草内容。每条含：1) 钩子标题 2) 3-5 段种草正文（痛点 / 体验 / 对比 / 推荐理由）3) 推荐 tag 4) 发布时段建议。全文经广告法极限词扫描。",
    promptTemplate:
      "为 {{platform}} 产出 {{post_count}} 条「{{product_type}}」种草，含合规扫描与发布策略。",
    steps: [
      step(1, "平台趋势扫描", "trending_topics", "热榜聚合", "perception", "fetch"),
      step(2, "种草脚本生成", "zhongcao_script", "种草脚本", "generation", "script"),
      step(3, "广告法合规扫描", "compliance_check", "合规审核", "management", "compliance"),
      step(4, "发布策略生成", "publish_strategy", "发布策略", "management", "strategy"),
    ],
  },

  {
    slug: "local_news",
    name: "本地新闻",
    description: "按本地区域 + 范围匹配全网与内部数据源内容，多篇改写后产出本地新闻稿件。",
    icon: "map",
    category: "news",
    ownerEmployeeId: "xiaoce",
    defaultTeam: ["xiaoce", "xiaolei", "xiaowen"],
    appChannelSlug: "app_news",
    isFeatured: true,
    launchMode: "form",
    inputFields: [
      {
        name: "region",
        label: "本地区域",
        type: "text",
        required: true,
        defaultValue: "成都",
        placeholder: "如：成都 / 成都·武侯区",
      },
      {
        name: "topic_scope",
        label: "新闻范围",
        type: "multiselect",
        required: true,
        options: [
          { value: "food", label: "美食" },
          { value: "travel", label: "旅游" },
          { value: "livelihood", label: "民生" },
          { value: "culture", label: "文化" },
          { value: "transport", label: "交通" },
        ],
      },
      {
        name: "article_count",
        label: "产出条数",
        type: "number",
        required: false,
        defaultValue: 3,
        validation: { min: 1, max: 6 },
      },
    ],
    systemInstruction:
      "围绕 {{region}} 在 {{topic_scope}} 范围的本地新闻，通过全网检索 + 内部数据源匹配素材，产出 {{article_count}} 篇改写稿件。每篇：1) 本地化标题 2) 800-1500 字正文（含本地视角）3) 引用信源标注。",
    promptTemplate:
      "为 {{region}} 产出 {{article_count}} 篇 {{topic_scope}} 范围的本地新闻改写稿。",
    steps: [
      step(1, "本地新闻聚合", "news_aggregation", "新闻聚合", "perception", "aggregate"),
      step(2, "全网搜索补充", "web_search", "全网搜索", "perception", "search"),
      step(3, "多源素材改写", "style_rewrite", "风格改写", "generation", "rewrite"),
      step(4, "本地新闻成稿", "content_generate", "内容生成", "generation", "write"),
    ],
  },

  {
    slug: "national_hotspot",
    name: "全国热点图文",
    description: "输入关注的热点范围（苏超 / AI 发展 / ...），通过全网检索 + 数据源匹配，多篇内容改写输出全国热点图文。",
    icon: "flame",
    category: "news",
    ownerEmployeeId: "xiaolei",
    defaultTeam: ["xiaolei", "xiaozi", "xiaowen"],
    appChannelSlug: "app_news",
    isFeatured: true,
    launchMode: "form",
    inputFields: [
      {
        name: "topic_range",
        label: "热点范围",
        type: "text",
        required: true,
        placeholder: "如：苏超 / AI 发展 / 新能源政策",
      },
      {
        name: "article_count",
        label: "产出条数",
        type: "number",
        required: false,
        defaultValue: 3,
        validation: { min: 1, max: 6 },
      },
      {
        name: "rewrite_tone",
        label: "改写风格",
        type: "select",
        required: false,
        defaultValue: "news_standard",
        options: [
          { value: "news_standard", label: "标准新闻" },
          { value: "serious", label: "严肃权威" },
          { value: "casual", label: "轻松叙事" },
        ],
      },
    ],
    systemInstruction:
      "围绕「{{topic_range}}」做全网热点匹配（外网检索 + 内部数据源），产出 {{article_count}} 篇 {{rewrite_tone}} 风格的改写稿件，每篇 600-1200 字。含：钩子标题 / 事实回顾 / 多方观点 / 延伸阅读。",
    promptTemplate:
      "为「{{topic_range}}」产出 {{article_count}} 篇全国热点图文（{{rewrite_tone}}）。",
    steps: [
      step(1, "全网热点扫描", "trending_topics", "热榜聚合", "perception", "fetch"),
      step(2, "多源新闻聚合", "news_aggregation", "新闻聚合", "perception", "aggregate"),
      step(3, "多篇素材改写", "style_rewrite", "风格改写", "generation", "rewrite"),
      step(4, "热点图文成稿", "content_generate", "内容生成", "generation", "write"),
    ],
  },
```

- [ ] **Step 2：type check + build**

```bash
npx tsc --noEmit
npm run build
```
Both expected: PASS

- [ ] **Step 3：commit**

```bash
git add src/db/seed-builtin-workflows.ts
git commit -m "feat(seed): 追加主流场景 zhongcao_daily / local_news / national_hotspot（10 条齐）"
```

---

## Phase 3 — DAL 扩展

### Task 9: 新增 `listTemplatesForHomepageByTab` + 保留旧函数别名

**Files:**
- Modify: `src/lib/dal/workflow-templates-listing.ts:119-138`

- [ ] **Step 1：写 failing test — featured / custom / employee 三分支**

在 `src/lib/dal/__tests__/workflow-templates-listing.test.ts` 顶部 import 后追加：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  pickDefaultHotTopicTemplate,
  listTemplatesForHomepageByTab,
  type HomepageTabKey,
} from "@/lib/dal/workflow-templates-listing";
```

在文件末尾追加：

```ts
// Mock db — capture the final WHERE conditions to assert the branch logic.
vi.mock("@/db", () => {
  const rows: WorkflowTemplateRow[] = [];
  const whereCalls: unknown[] = [];
  const chain = {
    select: () => chain,
    from: () => chain,
    where: (cond: unknown) => {
      whereCalls.push(cond);
      return chain;
    },
    orderBy: () => Promise.resolve(rows),
  };
  return {
    db: chain,
    __reset: () => {
      rows.length = 0;
      whereCalls.length = 0;
    },
    __whereCalls: whereCalls,
    __pushRow: (r: WorkflowTemplateRow) => rows.push(r),
  };
});

describe("listTemplatesForHomepageByTab", () => {
  it("featured tab：按 isFeatured + isPublic 过滤", async () => {
    const result = await listTemplatesForHomepageByTab(
      "org1",
      "featured" satisfies HomepageTabKey,
    );
    expect(result).toEqual([]);
    // 只能验证调用不抛错 + 返回空数组；分支覆盖靠手工 review SQL
  });

  it("custom tab：按 isBuiltin=false + isPublic 过滤", async () => {
    const result = await listTemplatesForHomepageByTab("org1", "custom");
    expect(result).toEqual([]);
  });

  it("employeeId tab：按 ownerEmployeeId + isPublic 过滤", async () => {
    const result = await listTemplatesForHomepageByTab("org1", "xiaolei");
    expect(result).toEqual([]);
  });
});
```

**Note：** 这三个测试只能验证"函数可调用且不抛错"，DB 分支条件验证靠 build + 手工 review。这是因为现有测试架构（`pickDefaultHotTopicTemplate` 是纯函数）没给 DB 层的 mock 工具。深度测试留给后续 integration test，本期不加。

- [ ] **Step 2：运行测试验证 FAIL（函数还不存在）**

```bash
npx vitest run src/lib/dal/__tests__/workflow-templates-listing.test.ts 2>&1 | tail -20
```
Expected: FAIL — `listTemplatesForHomepageByTab is not a function` 或 type import error

- [ ] **Step 3：实现 `listTemplatesForHomepageByTab`**

在 `src/lib/dal/workflow-templates-listing.ts` 里，在文件头部 `import` 后加（若 `EmployeeId` 已 import 则跳过）：

```ts
// 已有：import type { EmployeeId } from "@/lib/constants";
```

在 `listTemplatesForHomepageByEmployee` 函数**上方**插入：

```ts
/**
 * Homepage "10-tab" grid tab key union.
 *
 * - `"featured"` —— 主流场景 tab（新增）
 * - `EmployeeId` —— 8 员工职能 tab（xiaolei / xiaoce / ... / xiaoshu）
 * - `"custom"` —— 我的工作流 tab
 */
export type HomepageTabKey = "featured" | EmployeeId | "custom";

/**
 * Unified homepage-grid query. 替代原 `listTemplatesForHomepageByEmployee`。
 *
 * - `"featured"`：`is_featured=true AND is_public=true`（主流场景 tab）
 * - `"custom"`：`is_builtin=false AND is_public=true`（我的工作流 tab）
 * - EmployeeId：`owner_employee_id=<id> AND is_public=true`（职能 tab）
 *
 * 所有分支都附加 `organization_id=<orgId>` + `orderBy(asc(createdAt))`。
 */
export async function listTemplatesForHomepageByTab(
  orgId: string,
  tab: HomepageTabKey,
): Promise<WorkflowTemplateRow[]> {
  const conds: SQL[] = [
    eq(workflowTemplates.organizationId, orgId),
    eq(workflowTemplates.isPublic, true),
  ];

  if (tab === "featured") {
    conds.push(eq(workflowTemplates.isFeatured, true));
  } else if (tab === "custom") {
    conds.push(eq(workflowTemplates.isBuiltin, false));
  } else {
    // tab is EmployeeId
    conds.push(eq(workflowTemplates.ownerEmployeeId, tab));
  }

  const rows = await db
    .select()
    .from(workflowTemplates)
    .where(and(...conds))
    .orderBy(asc(workflowTemplates.createdAt));
  return rows as WorkflowTemplateRow[];
}
```

然后把原 `listTemplatesForHomepageByEmployee` 重写为新函数的 **deprecated 别名**（不删除，避免其他调用点爆炸）：

```ts
/**
 * @deprecated 2026-04-20 首页 tab 重构 —— 请改用 `listTemplatesForHomepageByTab`。
 * 保留别名是为了不破坏 `/home/page.tsx` 以外可能存在的调用点。
 */
export async function listTemplatesForHomepageByEmployee(
  orgId: string,
  employeeId: EmployeeId | null,
): Promise<WorkflowTemplateRow[]> {
  return listTemplatesForHomepageByTab(orgId, employeeId ?? "custom");
}
```

- [ ] **Step 4：运行测试验证 PASS**

```bash
npx vitest run src/lib/dal/__tests__/workflow-templates-listing.test.ts 2>&1 | tail -20
```
Expected: All 7 tests PASS（4 旧 + 3 新）

- [ ] **Step 5：type check**

```bash
npx tsc --noEmit
```
Expected: PASS

- [ ] **Step 6：grep 确认其他调用点仍可用**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && grep -rn "listTemplatesForHomepageByEmployee" --include="*.ts" --include="*.tsx"
```
Expected: 2-3 个调用点（`/home/page.tsx`、测试文件、自身 export），都能通过 deprecated 别名工作

- [ ] **Step 7：commit**

```bash
git add src/lib/dal/workflow-templates-listing.ts src/lib/dal/__tests__/workflow-templates-listing.test.ts
git commit -m "feat(dal): 新增 listTemplatesForHomepageByTab 支持 featured tab；旧函数保留为别名"
```

---

## Phase 4 — UI 层

### Task 10: `/home/page.tsx` 并行 fetch 10 个 tab

**Files:**
- Modify: `src/app/(dashboard)/home/page.tsx:9, 20-29, 105-131`

- [ ] **Step 1：替换 import**

把第 9 行：

```ts
import { listTemplatesForHomepageByEmployee } from "@/lib/dal/workflow-templates-listing";
```

改为：

```ts
import {
  listTemplatesForHomepageByTab,
  type HomepageTabKey,
} from "@/lib/dal/workflow-templates-listing";
```

- [ ] **Step 2：替换 `EMPLOYEE_TAB_IDS` → `HOMEPAGE_TAB_KEYS`**

把 20-29 行：

```ts
const EMPLOYEE_TAB_IDS: EmployeeId[] = [
  "xiaolei",
  "xiaoce",
  "xiaozi",
  "xiaowen",
  "xiaojian",
  "xiaoshen",
  "xiaofa",
  "xiaoshu",
];
```

改为：

```ts
// Task 10 — Homepage "主流场景 + 8 职能 + 我的工作流" = 10 tab，
// 全部并行 fetch 以支持 tab 无感切换。
const HOMEPAGE_TAB_KEYS: HomepageTabKey[] = [
  "featured",
  "xiaolei",
  "xiaoce",
  "xiaozi",
  "xiaowen",
  "xiaojian",
  "xiaoshen",
  "xiaofa",
  "xiaoshu",
  "custom",
];
```

- [ ] **Step 3：替换并行 fetch 块**

把 105-131 行（`if (orgId) { try { ... const [byEmployee, customList] = ... } catch {} }`）整块替换为：

```ts
      // Task 10 — 并行 fetch 10 个 tab 的 workflow_templates。
      if (orgId) {
        try {
          const results = await Promise.all(
            HOMEPAGE_TAB_KEYS.map((key) =>
              listTemplatesForHomepageByTab(orgId, key),
            ),
          );
          templatesByTab = Object.fromEntries(
            HOMEPAGE_TAB_KEYS.map((key, i) => [key, results[i]]),
          );
        } catch {
          // Graceful degradation — fall through with an empty tab map.
        }
      }
```

- [ ] **Step 4：删除不再使用的 EmployeeId import（如果不再引用）**

检查第 12 行的 `import type { EmployeeId } from "@/lib/constants";`。如果文件其他地方还用 `EmployeeId` 就保留，否则删除。（可以直接让 tsc 报 unused 再删。）

```bash
npx tsc --noEmit
```

- [ ] **Step 5：build 验证**

```bash
npm run build 2>&1 | tail -40
```
Expected: 无 type / 编译错误

- [ ] **Step 6：commit**

```bash
git add src/app/(dashboard)/home/page.tsx
git commit -m "feat(home): page.tsx 并行 fetch 10 个 tab（featured + 8 职能 + custom）"
```

---

### Task 11: `scenario-grid.tsx` 添加 `featured` tab 到最前

**Files:**
- Modify: `src/components/home/scenario-grid.tsx:26, 52-67, 166`

- [ ] **Step 1：补 import**

第 26 行之后加：

```ts
import type { HomepageTabKey } from "@/lib/dal/workflow-templates-listing";
```

- [ ] **Step 2：把 `TabDef.key` 类型收紧**

把 52-55 行：

```ts
interface TabDef {
  key: string;
  label: string;
}
```

改为：

```ts
interface TabDef {
  key: HomepageTabKey;
  label: string;
}
```

- [ ] **Step 3：`TAB_ORDER` 头部插入 `featured`**

把 57-67 行：

```ts
const TAB_ORDER: TabDef[] = [
  { key: "xiaolei", label: "热点分析" },
  ...
];
```

改为：

```ts
const TAB_ORDER: TabDef[] = [
  { key: "featured", label: "主流场景" },
  { key: "xiaolei", label: "热点分析" },
  { key: "xiaoce", label: "选题策划" },
  { key: "xiaozi", label: "素材研究" },
  { key: "xiaowen", label: "内容创作" },
  { key: "xiaojian", label: "视频脚本" },
  { key: "xiaoshen", label: "质量审核" },
  { key: "xiaofa", label: "渠道运营" },
  { key: "xiaoshu", label: "数据分析" },
  { key: "custom", label: "我的工作流" },
];
```

- [ ] **Step 4：`defaultValue` 改为 `featured`**

把第 166 行：

```tsx
<Tabs defaultValue="xiaolei" className="w-full">
```

改为：

```tsx
<Tabs defaultValue="featured" className="w-full">
```

- [ ] **Step 5：空态文案兼容**

检查 179-189 行空态渲染。当前逻辑：

```tsx
{tab.key === "custom"
  ? "还没有自定义工作流"
  : `${tab.label} 暂无预设工作流`}
```

这个对 `featured` tab 也合理（"主流场景 暂无预设工作流"）。**不改**。

- [ ] **Step 6：type check + build**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -40
```
Both expected: PASS

- [ ] **Step 7：commit**

```bash
git add src/components/home/scenario-grid.tsx
git commit -m "feat(home): scenario-grid 头部加"主流场景"tab + 默认选中"
```

---

## Phase 5 — 验证 & seed 执行

### Task 12: Migration + Seed 执行

**Files:**
- 无文件变更，纯命令执行

- [ ] **Step 1：应用 migration**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npm run db:push
```
Expected: 看到 `ALTER TABLE workflow_templates ADD COLUMN is_featured ...` 应用成功

验证列存在：

```bash
# 用 db:studio 或直接查 supabase
psql "$DATABASE_URL" -c "\d workflow_templates" 2>&1 | grep is_featured
```
Expected: `is_featured | boolean | not null default false`

- [ ] **Step 2：重新 seed**

```bash
npm run db:seed 2>&1 | tail -40
```
Expected:
- 无错误
- 日志里能看到 "seedBuiltinTemplatesForOrg" 被调用
- 无 "name collision with legacy row" 警告（新增的 9 条 slug 都是全新的，不会撞车）

- [ ] **Step 3：验证 DB 数据**

```bash
psql "$DATABASE_URL" -c "SELECT legacy_scenario_key, name, is_featured, owner_employee_id, app_channel_slug FROM workflow_templates WHERE is_featured = true ORDER BY legacy_scenario_key;"
```

Expected: 返回 10 条：
```
 daily_ai_news                | 每日 AI 资讯             | t | xiaolei  | app_news
 daily_chuanchao              | 每日川超战报             | t | xiaolei  | app_sports
 daily_podcast                | 每日热点播客             | t | xiaowen  | app_livelihood_podcast
 daily_politics               | 每日时政热点             | t | xiaolei  | app_politics
 daily_tandian                | 每日探店                 | t | xiaojian | app_livelihood_tandian
 local_news                   | 本地新闻                 | t | xiaoce   | app_news
 national_hotspot             | 全国热点图文             | t | xiaolei  | app_news
 pub.feature_story_pipeline   | 精品内容（深度大稿）     | t | xiaowen  | app_home
 tech_weekly                  | 科技周报（深度长文）     | t | xiaowen  | app_news
 zhongcao_daily               | 种草日更                 | t | xiaowen  | app_livelihood_zhongcao
```

**如果 `pub.feature_story_pipeline` 未更新为新 name（仍是"特稿生产线"）**：Task 5 的修改未命中，回到 Task 5 检查并重 seed。

- [ ] **Step 4：commit（纯记录点，无文件变更）**

跳过 commit（无新变更）。

---

### Task 13: 手工验证首页

**Files:**
- 无文件变更

- [ ] **Step 1：启动 dev server**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npm run dev
```

（通常跑在 http://localhost:3000）

- [ ] **Step 2：浏览器访问 `/home` 并验证**

用 agent-browser 或手动浏览器，依次确认：

- [ ] 场景快捷启动区域有 **10 个 tab**：主流场景 / 热点分析 / 选题策划 / 素材研究 / 内容创作 / 视频脚本 / 质量审核 / 渠道运营 / 数据分析 / 我的工作流
- [ ] 默认选中 **"主流场景"**，显示 **10 张卡片**（daily_ai_news ... 精品内容）
- [ ] 切到 **"热点分析"** 显示 xiaolei 下所有模板（原 3 条 + daily_ai_news + daily_politics + daily_chuanchao + national_hotspot = 7 条）
- [ ] 切到 **"内容创作"** 显示 xiaowen 下所有模板（原 2 条 + tech_weekly + daily_podcast + zhongcao_daily + pub.feature_story_pipeline = 6 条）
- [ ] 切到 **"视频脚本"** 显示 xiaojian 下所有模板（原 3 条 + daily_tandian = 4 条）
- [ ] 切到 **"选题策划"** 显示 xiaoce 下所有模板（原 3 条 + local_news = 4 条）
- [ ] 其他职能 tab 数量与旧版一致
- [ ] **"我的工作流"** tab 数据与旧版一致

- [ ] **Step 3：跑通一条新 scenario**

- [ ] 在"主流场景" tab 点击 **"每日探店"** 卡片 → 弹出启动对话框
- [ ] 填城市 = "成都"，店型 = "餐饮"，门店名 = 留空 → 点"启动"
- [ ] 跳转到 `/missions/<id>` → 看到 mission 页面，steps 能初始化
- [ ] 等 1-2 分钟，观察 mission 至少走到"门店信息检索"步骤（不要求跑完整条链路，只要能进入 running 状态即可）

如果卡在 pending 超过 3 分钟 → 检查 Inngest dev server 是否启动 (`npx inngest-cli dev` 或 `npm run inngest:dev`)，但如果本地 Inngest 未启动这是已知问题（不阻塞本 task 交付）。

- [ ] **Step 4：验证"direct" launchMode 场景**

- [ ] 点击 **"每日川超战报"** 或 **"每日热点播客"**（两者都是 `launchMode: "direct"`）
- [ ] 预期：不弹对话框，直接创建 mission 并跳转

---

### Task 14: 关闭 plan 任务 + 打 checkpoint commit

- [ ] **Step 1：最终 build + type check**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -40
```
Both expected: PASS

- [ ] **Step 2：测试全集跑一遍**

```bash
npx vitest run src/lib/dal/__tests__/ 2>&1 | tail -20
```
Expected: 全 pass

- [ ] **Step 3：打 checkpoint**

如果一切绿，此时历史上应有约 10 个 commit（Phase 1 的 3 个 + Phase 2 的 5 个 + Phase 3 的 1 个 + Phase 4 的 2 个）。可以选择是否打一个 checkpoint tag：

```bash
# 可选
git log --oneline -n 15
```

- [ ] **Step 4：push**

```bash
git push origin main
```

---

## 总结

| Phase | Task 数 | 预计 commits | 主要风险 |
|---|---|---|---|
| 1 Schema | 3 | 3 | 低 — 新列默认 false 非破坏 |
| 2 Seed | 5 | 5 | 中 — seed 量大，小心复制粘贴拼写 |
| 3 DAL | 1 | 1 | 低 — 新函数 + 旧别名 |
| 4 UI | 2 | 2 | 低 — 只加 tab + 换 default |
| 5 验证 | 3 | 0 | 中 — DB 实际数据 + 手工浏览器验证 |

**回滚策略**（若发现重大问题）：

```bash
# 代码回滚
git revert HEAD~10..HEAD  # 按实际 commit 数调整

# DB 回滚（可选，新列保留也不影响）
psql "$DATABASE_URL" -c "ALTER TABLE workflow_templates DROP COLUMN is_featured;"
psql "$DATABASE_URL" -c "DELETE FROM workflow_templates WHERE legacy_scenario_key IN ('daily_ai_news','tech_weekly','daily_politics','daily_podcast','daily_tandian','daily_chuanchao','zhongcao_daily','local_news','national_hotspot');"
# pub.feature_story_pipeline 字段可手工改回或留新值（不影响功能）
```

**单分支原则**：所有 commit 直接落 `main`，不开 feature 分支（CLAUDE.md 强制）。
