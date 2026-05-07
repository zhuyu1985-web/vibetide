# A5 报告导出 Phase A — Design Spec

**Date:** 2026-05-07
**Status:** Spec finalized, awaiting implementation plan
**Belongs to:** Wave 1 of "新闻研究报告" overhaul（主 spec：[`docs/superpowers/specs/2026-05-04-news-research-overhaul-design.md`](./2026-05-04-news-research-overhaul-design.md) §4.6）
**Wave 1 sequence updated:** A1 → A2 → A2.5 → A3 → A4 → **A6（小研先做）→ A5（本 spec）**
**Phase scope:** 仅 Phase A（静态版互动 HTML + Word/Excel 一键导出）；Phase B 钻取增强留 Wave 2

---

## 1. Background

### 1.1 范围与目标

主 spec §4.6 定义 A5 = 研究任务/检索结果一键生成"互动 HTML 报告 + Word + Excel"三种形态。本 sub-spec 落实主 spec 留待细化的 4 项决策：

- Word 模板的字数 / 段落结构 / 表格样式
- Excel 各 sheet 的 column / 透视方式
- AI 生成段落的 prompt 与防错机制（数据描述错误的容忍度）
- 大文件下载的存储位置（Supabase Storage / 临时签名 URL）

并新增：
- 报告版本化策略（覆盖 / 版本化 / 快照）
- 检索结果 → 报告的入口（A4 末尾未决）
- AI 员工占位（A6 提前到 A5 之前）

### 1.2 已就绪的基线

- **`research_tasks` 表**（A3 shipped）= 研究任务/Mission 容器
- **`@e965/xlsx`**（A2.5 shipped）= Excel 生成栈
- **6 个 Recharts wrapper**（`src/components/charts/`：area / bar / donut / gauge / heat-curve / radar）= HTML 报告图表基础组件
- **A4 高级检索**（commits `3f1620e`-`bf5d1f4` shipped）= 入口 2 数据源 + searchSnapshot 协议复用
- **A6 小研 + research_drafter skill**（在 A5 前完工）= AI 段落生成的 employee/skill 接入点

### 1.2.1 新增依赖（A5 实施前必装）

- **`docx` npm lib**（MIT 许可）—— 程式构建 .docx 的核心；A5 Day 1 装包：`npm install docx`
  - **Chinese font caveat**：`docx` lib 不内嵌字体，仅在 .docx XML 里指定字体名（如"宋体"/"黑体"/"楷体"）。Word/WPS 渲染依赖客户机器有该字体。学术机器（Windows + Office）默认有这三种字体；macOS 客户需确认。如客户反馈缺字，回退到 Word 默认中文字体（"宋体"=SimSun 在所有 Windows 字体集都有；"黑体"=SimHei 同；楷体退回到 KaiTi 或 STKaiti）。
  - **TOC 验证**：实施 Day 1 装完包就跑 smoke test：构建 5 章节 .docx → Word 打开"右键 → 更新域" 验证 TOC 渲染正确。

### 1.2.2 缺失的 Recharts wrapper（A5 内部补建，不计入新依赖）

主 spec / 本 spec 引用了 4 种图表，但现有 6 个 wrapper 中只有 `bar-chart-card` 和 `area-chart-card` 直接可用。需新建：

- `horizontal-bar-chart-card.tsx`（区县分布用）—— 复用 `bar-chart-card` 改 `layout="vertical"` 即可，<10 行
- `line-chart-card.tsx`（时间趋势用）—— 同 `area-chart-card` 模板，去 fill area，<20 行

总成本 ~0.5 天，已包含在 A5 工期内（Day 5 报告页 client 时一并补）。

### 1.3 设计决策（brainstorming 答案）

| Q | 决策 | 理由 |
|---|---|---|
| Q1 入口 | b — 双入口（research_tasks + 高级检索） | 任务结构化场景 + 检索探索性场景互补，共享 searchSnapshot 协议 |
| Q2 生成时机 | b — Inngest 异步 + 前端 polling | 与现有 mission/inngest 模式同构，可关页面，错误能 retry |
| Q3 Word 技术 | b — `docx` npm lib（程式构建） | MIT 免费，无 native binding 商业许可问题，与 @e965/xlsx 栈一致 |
| Q4 文件存储 | b — Inngest 一并产出 + Supabase Storage + 签名 URL | 主 spec 既定路线，单次生成多次下载，签名 URL 友好分享 |
| Q5 Word 图表 | c — 不嵌图表 / 仅嵌数据表 | 学术论文体偏表格 + 文字；HTML/Excel 已覆盖图表诉求；实现极简 |
| Q6 版本化 | c — 默认覆盖 + 显式"另存为快照" | 学术写作迭代中间版本不重要，关键节点（"导师 ok 了"）才需归档 |
| Q7 AI 员工 | c — 把 A6 提前到 A5 之前 | 架构最干净，不跨 phase 迁移；persona "小研"专属 |

---

## 2. 双入口 + 数据流总览

### 2.1 数据流

```
[入口 1] research_tasks 状态 = completed
      ↓ (任务详情页"生成报告"按钮)
      └─ 自动创建 research_reports row(status=pending)
[入口 2] 高级检索结果页"生成报告"按钮（命中 ≤500 时启用）
      ↓ (用户填报告标题 + 主题描述)
      └─ 手动创建 research_reports row(status=pending)
                      ↓
        Inngest 'research/report.generate' event 触发
                      ↓
       Inngest 7-step pipeline (异步, 30-90s)
                      ↓
        research_reports.status = ready
                      ↓
       前端 polling /api/research/reports/[id]
        - generating → 显示进度 + 阶段名 (currentStep)
        - ready → 渲染 HTML 报告 + 显示导出按钮
        - failed → 显示 errorMessage + retry 按钮
```

### 2.2 入口 UX 细节

**入口 1（research_tasks 完成触发）**：

- 任务详情页 `/research/tasks/[id]` 当 `status=completed` 后，顶部出现"生成报告"按钮
- 点击 → 弹"自定义报告标题"dialog（默认值 = `task.name`）→ 确认 → server action 创建 report → 启动 Inngest → 跳 `/research/reports/[id]`
- 如已生成过母版报告（`parentReportId=null AND researchTaskId=current AND isSnapshot=false`）：按钮变"重新生成 / 查看报告"双选

**入口 2（高级检索 → 生成报告）**：

- A4 高级模式结果区命中数 ≤ 500 时，启用顶部"生成报告"按钮（>500 disabled + tooltip "命中超 500，请缩小条件后再生成"）
- 点击 → 弹 dialog 输入：
  - 报告标题（必填）
  - 主题描述（可选，给 AI 写背景段提供线索；不填则 AI 自行根据 conditions 推断）
- 确认 → server action 复制 conditions + sidebarFilter + 当前页结果的所有 ID（≤500）入库 → Inngest 启动 → 跳 reports/[id]

**报告详情页 `/research/reports/[id]`**：

```
┌──────────────────────────────────────────────────────────────────┐
│ [报告标题]    [生成于 时间]   [Badge: 母版/快照]                  │
│ [导出 Word ▼] [导出 Excel] [重新生成] [另存为快照] [分享链接 ⓘ] │
├─────────────┬────────────────────────────────────────────────────┤
│ 目录树       │ [封面信息块 - GlassCard，5 行元数据]              │
│             │ ## 第一章 研究背景                                 │
│ ▶ 第一章 研究│   [AI 生成段落，markdown 渲染]                    │
│   背景       │                                                    │
│ ▼ 第二章 数据│ ## 第二章 数据来源与统计                          │
│   ├ 数据简报 │ ### 2.1 数据简报                                  │
│   ├ 媒体分布 │   [AI 润色段，markdown]                           │
│   ├ 区县分布 │ ### 2.2 媒体层级分布                              │
│   ├ 主题分布 │   [DataTable + Recharts BarChart]                 │
│   ├ 时间趋势 │ ### 2.3 区县分布                                  │
│ ▶ 第三章 研究│   [DataTable + Recharts HorizontalBarChart]       │
│   发现       │ ### 2.4 主题分布                                  │
│ ▶ 附录       │   [DataTable + Recharts DonutChart]               │
│             │ ### 2.5 时间趋势                                   │
│             │   [DataTable + Recharts LineChart]                 │
│             │ ## 第三章 研究发现                                 │
│             │   [AI 生成段落，markdown]                          │
│             │ ## 附录：数据来源详细列表                          │
│             │   [DataTable，500 行]                              │
└─────────────┴────────────────────────────────────────────────────┘
```

**交互细节**：

- 目录树用 sticky 左栏，章节锚点 `<a href="#section-X">`，点击平滑滚动
- 数据表每个表格右上角"复制到剪贴板"按钮（CSV 格式 paste 到 Excel）
- 图表 4 个 Recharts client islands；每图右上"下载 PNG"（Recharts 内置）
- "导出 Word ▼"V1 只有"完整版"，V2 加"无附录版"
- "分享链接"复制 `/research/reports/[id]`（仅 vibetide 内部用户）；非 vibetide 用户走文件签名 URL（24h 有效）
- AI fallback banner：报告顶部红黄色 banner "AI 段落降级，可重新生成" + 重试按钮（`aggregatesJson.isAiFallback=true` 时显示）
- 性能：Server Component 渲染骨架 + 数据 props；图表 4 个 client islands；附录 500 行普通 DOM 应该 OK，超时再加 virtualization

---

## 3. 数据模型

### 3.1 `research_reports` 表（新建）

`src/db/schema/research/reports.ts`：

```ts
import { pgTable, uuid, text, timestamp, jsonb, boolean, index, type AnyPgColumn } from "drizzle-orm/pg-core";
import { organizations, userProfiles } from "../users";
import { researchTasks } from "./research-tasks";

export const researchReports = pgTable(
  "research_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),

    // 来源
    sourceType: text("source_type").notNull(),          // "research_task" | "advanced_search"
    researchTaskId: uuid("research_task_id")
      .references(() => researchTasks.id, { onDelete: "set null" }), // 入口 1 时填；任务删后保留报告，研究痕迹不丢
    searchSnapshot: jsonb("search_snapshot").notNull(), // 见 §3.2 SearchSnapshot

    // 元数据
    title: text("title").notNull(),
    topicDescription: text("topic_description"),        // 入口 2 用户输入；入口 1 从 task 推导

    // 内容
    reportHtml: text("report_html"),                    // status=ready 时填
    aggregatesJson: jsonb("aggregates_json"),           // 各维度聚合结果 + isAiFallback

    // 文件
    wordFileUrl: text("word_file_url"),                 // Supabase Storage 签名 URL
    excelFileUrl: text("excel_file_url"),
    fileExpiresAt: timestamp("file_expires_at", { withTimezone: true }),  // 签名 URL 失效时间，过期重签

    // 快照（Q6=c：默认覆盖 + 显式快照）
    parentReportId: uuid("parent_report_id")
      .references((): AnyPgColumn => researchReports.id, { onDelete: "cascade" }), // self-FK；母版删 → 快照级联删
    isSnapshot: boolean("is_snapshot").notNull().default(false),
    snapshotName: text("snapshot_name"),                // 用户命名："导师 v1 反馈版"

    // 状态机
    status: text("status").notNull().default("pending"),  // pending/generating/ready/failed
    currentStep: text("current_step"),                    // "数据聚合" | "小研撰写中" | "渲染 HTML" | "生成 Word" | "生成 Excel" | null
    errorMessage: text("error_message"),

    // 审计
    generatedBy: uuid("generated_by")
      .references(() => userProfiles.id, { onDelete: "set null" }),  // 生成者删除后保留报告
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    orgIdx: index("research_reports_org_idx").on(t.organizationId, t.createdAt),
    taskIdx: index("research_reports_task_idx").on(t.researchTaskId),
    parentIdx: index("research_reports_parent_idx").on(t.parentReportId),
  }),
);
```

**FK onDelete 策略**：
- `organizationId` cascade — org 删除则报告级联删（多租户标准做法）
- `researchTaskId` set null — 任务删除后报告保留（研究痕迹），但报告不能再"重新生成"（searchSnapshot 已反规范化保留入参，但为了避免误以为还能跑回任务，UI 显示"任务已删除"banner + 禁用重新生成按钮）
- `parentReportId` cascade — 母版删除时所有快照一同删除（快照存在意义就是绑母版历史）
- `generatedBy` set null — 用户删除/离职后报告保留，仅丢失审计署名

### 3.2 `searchSnapshot` jsonb shape（discriminated union）

```ts
type SearchSnapshot =
  | {
      kind: "research_task";
      taskId: string;
      // 反规范化任务入参（任务被删后报告仍可重生）
      timeRange: { start: string; end: string };  // ISO timestamps
      topicIds: string[];
      districtIds: string[];
      mediaTiers: string[];
      hitItemIds: string[];   // 命中文章 collected_items.id 列表（≤500，超过抛错）
    }
  | {
      kind: "advanced_search";
      conditions: AdvancedSearchCondition[];  // 复用 A4 类型
      sidebarFilter: SidebarFilter;
      hitItemIds: string[];                    // ≤500
      capturedAt: string;                      // ISO timestamp
    };
```

**500 条上限设计依据**：
- 学术研究单份报告 100-300 条最常见
- 500 是防呆兜底（Word 附录 500 行表格 + Excel 明细 500 行的可视性边界）
- jsonb 序列化体积：500 个 UUID ≈ 18 KB / row，远低于 jsonb TOAST 触发线
- 超过则前端报"命中数据过多，请缩小范围"

**hitItemIds 部分被删除的处理**（数据漂移）：
重新生成时 `WHERE id = ANY(hitItemIds)` 查询会返回 ≤ N 条（部分 ID 已不存在）。处理策略：
- 全部删除（返回 0 条）→ status=failed，errorMessage="命中数据已被全部删除，无法重生报告"
- 部分删除（返回 1 ≤ M < N）→ 继续生成，但聚合 + AI 段落基于实际剩余数据；漂移提示位置：
  - **HTML 报告顶部 info banner**：`原报告 N 条数据，重生时检测到 M 条仍存在（{N-M} 条已删除）`
  - **Word 封面"数据范围"行**追加：`(原报告 N 条，重生时 M 条仍存在)`
  - **Excel 不加提示**：明细 sheet 行数已隐含告知，不重复
- 全部保留（返回 N）→ 正常生成，无 banner

### 3.3 `aggregatesJson` shape

```ts
type AggregatesJson = {
  mediaTierDistribution: Array<{ tier: string; count: number; percentage: number; topMediaNames: string[] }>;
  districtDistribution: Array<{ districtId: string; districtName: string; count: number; percentage: number; topTopics: string[] }>;
  topicDistribution: Array<{ topicId: string; topicName: string; count: number; percentage: number; topDistricts: string[]; topMedia: string[] }>;
  dailyTrend: Array<{ date: string; count: number; cumulative: number }>;
  crossPivots?: {
    topicByDistrict?: Array<{ topicId: string; districtId: string; count: number }>;
    topicByTier?: Array<{ topicId: string; tier: string; count: number }>;
  };
  hitCount: number;
  isAiFallback: boolean;  // step 3 LLM 失败降级标记
  generatedAt: string;
};
```

---

## 4. Inngest 7-step pipeline

### 4.1 流程

事件名：`research/report.generate`，payload `{ reportId, organizationId }`。
Inngest function id：`research-report-generate`。

```
事件触发
  │
  ▼
Step 1  load-and-aggregate         (~3s, 1 SQL roundtrip)
  ├─ 读 research_reports.searchSnapshot
  ├─ 按 hitItemIds 拉 collected_items + leftJoin outlet/topic/district 标注
  ├─ 同事务 SQL group-by 跑 4 维聚合：主题 / 区县 / 媒体分级 / 时间趋势(日)
  └─ 写 aggregatesJson + currentStep="数据聚合"
  │
  ▼
Step 2  render-template-text       (~50ms, pure JS)
  ├─ 模板插值生成"数据简报"plain text 草稿（含 X / Y / Top 3 等具体数字）
  └─ 缓存到 step state（不入库，给 step 3 用）
  │
  ▼
Step 3  ai-generate-paragraphs     (~30-50s, 1-2 LLM call)
  ├─ currentStep="小研撰写中"
  ├─ 单次调用小研：3 段一次性输出（背景 + 数据简报润色 + 研究发现）
  │   ├─ system: 7-layer prompt (xiaoyan + research_drafter skill)
  │   ├─ user: { task_meta, aggregates, template_brief, sample_titles }
  │   └─ output: ReportParagraphsSchema (zod)
  ├─ 用 generateObject + zod schema 强约束输出结构
  ├─ 失败兜底（重试 3 次后）→ 降级用 template_brief 原文 + 默认背景/结论模板 + 标 isAiFallback=true
  └─ 写各段 fragment 到 step state
  │
  ▼
Step 4  render-html                (~100ms)
  ├─ currentStep="渲染 HTML"
  ├─ 拼接最终 HTML：封面 + 5 章 + 附录
  ├─ 图表用 `<ChartPlaceholder data-type="bar" data-source="topic_dist" />` 占位（详情页 client component 替换）
  └─ 写 research_reports.reportHtml
  │
  ▼
Step 5  generate-word              (~5-15s, docx lib)         // 与 Step 6 并行
  ├─ currentStep="生成 Word"
  ├─ 用 `docx` lib 程式构建 .docx Buffer
  ├─ 上传 Supabase Storage `research-reports/{org}/{reportId}/report.docx`
  └─ 拿签名 URL（24h 有效）→ 写 wordFileUrl + fileExpiresAt
  │
  ▼
Step 6  generate-excel             (~3-8s, @e965/xlsx)        // 与 Step 5 并行
  ├─ currentStep="生成 Excel"
  ├─ 5 sheet：明细 / 主题透视 / 区县透视 / 媒体层级透视 / 图表数据
  ├─ 上传 Supabase Storage `research-reports/{org}/{reportId}/report.xlsx`
  └─ 写 excelFileUrl
  │
  ▼
Step 7  finalize                   (~50ms)
  ├─ status="ready", completedAt=now()
  ├─ currentStep=null
  └─ 发站内通知给 generatedBy 用户："研究报告 [title] 已生成"
```

总工时：~40-90s（取决于 LLM 速度）。Inngest 默认 step timeout 30 min。

### 4.2 错误处理 + 降级

| 故障点 | 重试策略 | 降级 | UI 反馈 |
|---|---|---|---|
| Step 1 数据加载（DB 故障） | Inngest 自动 3 次（指数退避） | 无 | status=failed, errorMessage="数据加载失败" + 重试按钮 |
| Step 1 hitItemIds 全部已删除 | 不重试 | 无 | status=failed, errorMessage="命中数据已被删除" |
| Step 2 模板插值（不会失败，纯 JS） | — | — | — |
| Step 3 LLM 调用超时 / 模型限流 | Inngest 3 次 | 第 3 次仍失败 → 降级写 plain text 数据简报 + 默认背景 / 结论模板 + isAiFallback=true | status=ready (with banner "AI 段落降级，可重新生成") |
| Step 3 LLM 输出 schema 不匹配 | 重试 1 次（重新 prompt） | 第 2 次仍失败 → 同上降级 | 同上 |
| Step 5/6 文件生成失败 | Inngest 3 次 | 3 次仍失败 → status=ready 但 wordFileUrl/excelFileUrl=null | 主报告可看；导出按钮 disabled + tooltip "Word 生成失败，重新生成" |
| Supabase Storage upload 失败 | Inngest 3 次 | 3 次仍失败 → 同上 | 同上 |

**核心原则**：HTML 报告（核心交付物）一定生成成功（status=ready 必须），Word/Excel 是辅助附件，失败不阻塞主流程。

### 4.3 重试与重新生成

- **用户手动 retry（status=failed）**：点击"重试"按钮 → 重新发 `research/report.generate` 事件，同 reportId
- **Inngest 自动 retry**：每 step 3 次默认
- **用户重新生成（status=ready）**：母版报告就地覆盖（清 reportHtml/aggregatesJson/files，重发事件）；快照报告（`isSnapshot=true`）禁用"重新生成"按钮
- **签名 URL 过期重签**：用户点导出 → server action 检查 `fileExpiresAt < now() + 1h` → 是则去 Supabase Storage 重签 24h URL → 更新 DB → 返回新 URL

### 4.4 并发安全

- `research_reports.status='generating'` 时不允许再发 `research/report.generate`（前端按钮 disabled + server action assert）
- Inngest event 自带 `idempotencyKey: reportId + version`，重复事件去重

---

## 5. 三种导出形态详细规范

### 5.1 Word 体例（`docx` lib 程式构建）

学术报告论文体，A4 / 宋体小四号正文 / 黑体三号章节标题 / 1.5 倍行距 / 标准页边距。

```
[封面页]
  └─ 居中布局：
      • 标题（黑体二号）：{report.title}
      • 副标题（楷体小三）："—— 基于 {timeRangeStart} 至 {timeRangeEnd} 数据"
      • 5 行元数据（宋体小四，居中）：
        - 研究主题：{topicDescription || 任务名称}
        - 时间范围：{timeRangeStart.format} 至 {timeRangeEnd.format}
        - 数据范围：{districtCount} 个区县 / {topicCount} 个主题 / 命中 {hitCount} 条报道
        - 数据来源：基于互联网公开报道采集
        - 生成时间：{completedAt.format} / 系统：vibetide 新闻研究模块

[目录页]                            ← docx lib 自动生成 TOC（基于 Heading 1-3 样式）

[第一章 研究背景]                    ← Heading 1
  AI 生成 1-2 段，约 300-500 字

[第二章 数据来源与统计]              ← Heading 1

  2.1 数据简报                      ← Heading 2
      AI 润色后 1 段，约 200-300 字（基于模板插值 + 小研改写）

  2.2 媒体层级分布                  ← Heading 2
      [Word Table，4 列：层级 / 报道数 / 占比 / Top3 媒体]
      （5 行：央级 / 省级 / 地市级 / 行业 / 自媒体；空层级也列出，0 条）

  2.3 区县分布                      ← Heading 2
      [Word Table，4 列：区县 / 报道数 / 占比 / Top3 主题]
      （只列报道数 ≥ 1 的区县；按报道数降序）

  2.4 主题分布                      ← Heading 2
      [Word Table，4 列：主题 / 报道数 / 占比 / Top3 区县]
      （所有 16 个主题都列出；按报道数降序）

  2.5 时间趋势                      ← Heading 2
      [Word Table，3 列：日期 / 报道数 / 累计]
      （按 ISO 日期升序）

[第三章 研究发现]                    ← Heading 1
  AI 生成 3-5 段，约 800-1500 字

[附录：数据来源详细列表]              ← Heading 1
  [Word Table，6 列：序号 / 标题 / 媒体 / 层级 / 区县 / 发布时间]
  （≤500 行，按发布时间升序）
```

**docx lib 实现要点**：

- `Document.styles.paragraphStyles` 定义 5 个样式：Title / Subtitle / Heading1 / Heading2 / Normal
- 表格用 `Table + TableRow + TableCell`，单元格 padding / 边框 / 表头加粗
- TOC 用 `TableOfContents` 配置 hyperlink=true + heading style range 收集 Heading 1 至 Heading 3（具体参数 `headingStyleRange` 取 `"1 3"` 形式）—— Word 打开后自动渲染（首次需"右键 → 更新域"）
- 文件大小预估：500 行附录 + 全报告 ≈ 50-150 KB

### 5.2 HTML 报告页面

参见 §2.2 报告详情页布局。

**关键交互细节**：

- **章节锚点**：`<section id="chapter1">` / `<section id="chapter2_1">` 等（id 用驼峰或下划线分隔，不用连字符避免与可能的模型 slug 工具误判）
- **数据表"复制 CSV"按钮**：客户端 navigator.clipboard.writeText(csvString)
- **图表 PNG 下载**：用 Recharts `<ResponsiveContainer>` 包裹，提供 `<button>` 触发 toBlob → download
- **导出 Word/Excel 按钮**：点击 → server action `getReportSignedUrl(reportId, "word"|"excel")` → 检查/重签 → 返回 URL → `window.open(url)` 或 `<a download>`
- **重新生成按钮**：点击 → 二次确认 dialog（母版才显示） → server action `regenerateReport(reportId)`
- **另存为快照按钮**：点击 → dialog 输入 snapshotName → server action `saveAsSnapshot(reportId, snapshotName)` → 复制 row（parentReportId=母版 id, isSnapshot=true）
- **AI fallback banner**：`aggregatesJson.isAiFallback === true` 时显示

### 5.3 Excel 5-sheet 结构（`@e965/xlsx`）

| Sheet | 列 | 行数 | 备注 |
|---|---|---|---|
| **明细** | 序号 / 标题 / 媒体名 / 媒体分级 / 区域 / 命中区县 / 命中主题 / 发布时间 / 采集时间 / 原文 URL / 内容类型 | 命中数（≤500） | 命中区县 / 主题用顿号分隔多值；URL 用 Excel hyperlink |
| **分主题透视** | 主题名 / 报道数 / 占比% / 平均媒体分级 / Top3 区县 / Top3 媒体 | 16 主题 | 占比保留 1 位小数；空主题也列出（0 条） |
| **分区县透视** | 区县名 / 报道数 / 占比% / Top3 主题 / Top3 媒体 | 命中区县（按报道数降序） | 仅列报道数 ≥1 的区县 |
| **分媒体层级透视** | 层级 / 报道数 / 占比% / Top3 媒体 / Top3 主题 | 5 层级 | 包含"未分类"层级 |
| **图表数据** | 多 block 拼接：<br>**Block A** 时间趋势：日期 / 报道数 / 累计<br>**Block B** 主题分布：主题 / 数量<br>**Block C** 区县分布：区县 / 数量 | A 按时间窗天数；B 16 行；C 命中区县数 | 客户能直接选 Block 区域做趋势图/饼图；与 HTML 图表数据源 1:1 一致 |

**实现要点**：

- 每 sheet header row 加粗 + 浅灰背景（worksheet style）
- 主题/区县名长度 unicode CJK 字符 = 2 visual width，列宽自适应（`!cols` autofit）
- 文件大小预估：500 明细 + 4 透视 sheet ≈ 30-100 KB

---

## 6. AI prompt 设计

### 6.1 调用接口

Inngest `research/report-generate` Step 3 通过 agent assembly 调小研。employee=`xiaoyan`，skill=`research_drafter`。

**与既有 7-layer agent 系统的接入方式**：
- vibetide 既有 `src/lib/agent/assembly.ts` + `src/lib/agent/execution.ts` 是为 chat / scenario routing 设计的，输出是 streaming text + tool calls
- A5 需要的是 **structured object 输出**（zod schema 强约束），适配方式：
  - 沿用 `assembly.ts:assembleSystemPrompt(employeeId, skillId, ...)` 拿到 7-layer system prompt 字符串
  - 沿用 `model-router.ts:routeModel({employeeId, skillId})` 选模型
  - **不**走 `execution.ts`（streaming + tool loop），改直接调 `generateObject({system, prompt, schema})`
  - 即：复用 prompt 装配 + 模型路由，绕过 streaming/tool loop 执行层
- 这样保证 persona/skill/记忆等 7-layer 内容仍生效，又能用 zod schema 强约束输出

### 6.2 输入 payload（user message structured）

```ts
{
  task_meta: {
    title, topic_description,
    time_range: { start, end },
    districts: [{ name, count }],
    topics: [{ name, count }],
    media_tiers: [{ tier, count }],
    hit_count: 200,
  },
  aggregates: {
    media_tier_distribution: [...],
    district_distribution: [...],
    topic_distribution: [...],
    daily_trend: [{ date, count }],
    cross_pivots: { topic_x_district, topic_x_tier },
  },
  template_brief: "在 2025-06 至 2025-08 内，全网共发布重庆 39 个区县相关报道 200 条 ...",
  sample_titles: ["...", "...", "..."],  // 5 条命中文章标题摘要
}
```

### 6.3 输出 schema（zod 严格约束）

```ts
const ReportParagraphsSchema = z.object({
  background: z.string()
    .min(200).max(700)
    .describe("第一章 研究背景，1-2 段，约 300-500 字。围绕 task_meta 写主题/时间窗/区域意义"),
  brief_rewrite: z.string()
    .min(150).max(500)
    .describe("第二章 2.1 数据简报润色版，1 段，约 200-300 字。基于 template_brief 学术体改写，必须保留所有具体数字"),
  conclusions: z.string()
    .min(500).max(2000)
    .describe("第三章 研究发现，3-5 段，约 800-1500 字。基于 aggregates 数据特征写结论，每段一个观点，必须有数据引用"),
});

// AI SDK v6: 用 generateText + Output.object() 拿结构化输出（v6 移除了 generateObject）
import { generateText, Output } from "ai";
import { assembleAgent } from "@/lib/agent/assembly";

const agent = await assembleAgent("xiaoyan", undefined, {
  skillOverrides: ["report_drafter"],
  organizationId: orgId,
});

const { output } = await generateText({
  model: agent.model,
  system: agent.systemPrompt,
  prompt: JSON.stringify(payload),
  output: Output.object({ schema: ReportParagraphsSchema }),
  temperature: 0.3,
  maxOutputTokens: 4000,
});

// output 即 ReportParagraphsSchema 解析后的结构（注意 v6 是 result.output 而非 result.object）
```

> **AI SDK v6 迁移备注**：本 spec 早先版本写的 `generateObject` 已在 2026-05-07 修订为 `generateText + Output.object()`（项目运行 AI SDK v6，`generateObject` 已被移除）。三段输出 schema 不变，迁移影响仅限 import + 调用语法 + 结果属性名（`result.object` → `result.output`）。

### 6.4 `research_drafter` skill prompt（A6 入库到 skills 表，A5 通过 employee_skills 关联）

```
身份：你是新闻研究员小研，为西南政法大学新闻学院输出学术研究报告段落。

风格约束：
- 学术中性、第三人称、不用感叹号
- 句式偏书面化，避免"互联网风"措辞（不写"刷屏"、"火爆"、"出圈"、"赛道"等爆款词）
- 数据引用必须给具体数字（"X 条"、"占 Y%"），不写"大量"、"很多"
- 结论必须基于 aggregates 字段，不臆造未提供的数据

禁止行为：
- 不写"AI 生成"、"作为大语言模型"等元元词
- 不臆造引文 / 来源 / 学者名 / 文献
- 不写未在 task_meta / aggregates 中提供的统计
- 不带主观立场（"我认为"、"应当"），改"数据显示"、"结果表明"

每个段落要求：
- background：开篇定义研究背景（主题意义、时间窗、区域定位），1-2 段
- brief_rewrite：保留 template_brief 全部数字，调整句式让其学术化
- conclusions：每段一个核心观点（如：层级分布特征 / 区县报道密度差异 / 主题热度分化 / 时间趋势特征），结尾可选留下"研究展望"段
```

### 6.5 降级路径（LLM 调用 3 次仍失败）

- `background` → 默认模板："本研究聚焦{topic_description}相关报道，基于{time_range}时间窗内{district_count}个区县共{hit_count}条公开报道，分析其分布特征与传播规律。"
- `brief_rewrite` → 直接用 template_brief 原文
- `conclusions` → 默认模板："数据显示，主题分布上{top_topic}最为突出（{top_topic_count}条，{top_topic_pct}%）；区县分布上{top_district}报道最多（{top_district_count}条）；时间趋势上{trend_summary}。"
- 设 `aggregatesJson.isAiFallback=true`，HTML/Word 顶部加红黄 banner 提示

---

## 7. 文件结构

### 7.1 新建（13 文件 + 测试）

| 文件 | 责任 |
|---|---|
| `src/db/schema/research/reports.ts` | researchReports 表 schema |
| `src/lib/dal/research/reports.ts` | reports CRUD：create / get / listByTask / listByOrg / updateStatus / softDelete |
| `src/lib/research/report-aggregator.ts` | 4 维聚合 SQL（group-by 计算） |
| `src/lib/research/report-template.ts` | 数据简报段模板插值 |
| `src/lib/research/report-prompts.ts` | AI prompt 构造 + zod schema + 降级模板 |
| `src/lib/research/report-html-renderer.tsx` | 拼 HTML（pure function 返 string） |
| `src/lib/research/report-word-builder.ts` | docx lib 程式构建 .docx Buffer |
| `src/lib/research/report-excel-builder.ts` | @e965/xlsx 5-sheet 构建 |
| `src/lib/research/report-storage.ts` | Supabase Storage upload + 签名 URL + 重签 |
| `src/inngest/functions/research/report-generate.ts` | 7-step Inngest pipeline（沿用 A3 已有 `src/inngest/functions/research/` 目录约定）|
| `src/app/(dashboard)/research/reports/[id]/page.tsx` | 报告详情页（Server Component） |
| `src/app/(dashboard)/research/reports/[id]/report-client.tsx` | 客户端交互（polling / 导出按钮 / 快照 dialog） |
| `src/app/actions/research/reports.ts` | server action：createReport / regenerate / saveAsSnapshot / getSignedUrl / deleteReport（**所有 action 头都要 `const { organizationId, userId } = await requirePermission(PERMISSIONS.MENU_RESEARCH);`，与 A4 / A3 既有 actions 同模式**；getSignedUrl 额外校验 report.organizationId === requestor.organizationId 防越权） |

**测试（4 文件 + Inngest 集成测）**：

- `src/lib/dal/research/__tests__/reports.test.ts`
- `src/lib/research/__tests__/report-aggregator.test.ts`
- `src/lib/research/__tests__/report-template.test.ts`
- `src/lib/research/__tests__/report-prompts.test.ts`
- `src/lib/research/__tests__/report-word-builder.test.ts`
- `src/lib/research/__tests__/report-excel-builder.test.ts`
- `src/inngest/functions/__tests__/research-report-generate.test.ts`

### 7.2 修改（5 文件）

| 文件 | 改动 |
|---|---|
| `src/db/schema/research/index.ts` | export `./reports` |
| `src/inngest/index.ts` | 注册 `researchReportGenerate` function（function id 命名 `research/report-generate`，trigger event `research/report.generate`）|
| `src/app/(dashboard)/research/tasks/[id]/page.tsx`（如已存在）或新建任务详情页 | 顶部加"生成报告"按钮 |
| `src/app/(dashboard)/research/search-workbench-client.tsx` | 高级模式 ≤500 命中时启用顶部"生成报告"按钮 |
| `src/lib/agent/skills/`（A6 ship 后）| `research_drafter` skill 入库；A5 ship 时 stub 注册，A6 ship 时补完整 prompt |

---

## 8. 工期估算（10 天）

**前置（Day 0，30 分钟）**：
- `npm install docx` 装包；docx smoke test（构建空 Document → Word 打开 OK）
- 在 Supabase（self-hosted）后台创建 private bucket `research-reports`（bucket policy = service-role-only，不开 public read；签名 URL 是唯一外部访问路径）
- 验证 `xiaoyan` employee + `research_drafter` skill 已 seed（A6 ship 后跑 `npm run db:seed` 一遍验）

| Day | 任务 |
|---|---|
| 1 | schema + DAL + migration（dev：`npm run db:push`；prod：`npm run db:generate` 出 SQL → review → `npm run db:migrate` 应用） |
| 2 | report-aggregator（4 维聚合 SQL）+ TDD 单测 |
| 3 | report-template + report-prompts（zod schema + 降级模板）+ TDD 单测 |
| 4 | Inngest 7-step pipeline 骨架（不含 docx/xlsx），Step 1-4 串通；HTML renderer 基础 |
| 5 | report-detail page (Server Component) + report-client (polling + 状态机) |
| 6 | report-word-builder + Supabase Storage upload + 签名 URL；Step 5 接入 |
| 7 | report-excel-builder；Step 6 接入；并行测试 |
| 8 | 双入口 UX：research_tasks 详情页"生成报告"按钮 + 高级检索"生成报告"按钮 + 标题/主题描述 dialog |
| 9 | 快照功能（"另存为快照"按钮 + 快照列表 + parentReportId 关系）+ AI fallback banner + retry UI |
| 10 | 错误路径补齐 + tsc/lint/build / 测试集回归 / 浏览器手动验收 / 微调 prompt 措辞 |

合计 7-10 天（依赖 LLM 调试时长）。

---

## 9. 测试策略

| 测试类型 | 文件 | case 数 | 验证内容 |
|---|---|---|---|
| **DAL 单测** | `__tests__/reports.test.ts` | 5 | create / get / listByTask / status transition / 跨 org 隔离 |
| **聚合 SQL 单测** | `__tests__/report-aggregator.test.ts` | 6 | 主题分布 / 区县分布 / 媒体分级分布 / 时间趋势 / cross-pivot / 空数据兜底 |
| **模板插值单测** | `__tests__/report-template.test.ts` | 3 | 完整数据 / 缺字段 / 数字格式化 |
| **AI prompt schema 单测** | `__tests__/report-prompts.test.ts` | 3 | zod schema 验证通过 / 字数下限失败 / 降级模板填充 |
| **Word builder 单测** | `__tests__/report-word-builder.test.ts` | 3 | 章节计数 / 表格行数 / 文件 buffer 非空 |
| **Excel builder 单测** | `__tests__/report-excel-builder.test.ts` | 3 | 5 sheet 名称 / 各 sheet 列数 / 数据 cell 写入正确 |
| **Inngest function 集成测** | `__tests__/research-report-generate.test.ts` | 2 | 全流程跑一次（mock LLM）/ Step 3 失败降级 |

合计 25 case。LLM 调用在测试中 mock（不实际打 API）；Supabase Storage upload 用 in-memory mock。

---

## 10. 边界 / 已知不做

### 10.1 明确不在 A5 范围（Wave 2 + 后续）

- Phase B 钻取（图表点击下钻 / 数据筛选联动 / 自定义报告章节）→ Wave 2
- 客户自定义 Word 模板（docxtemplater 路线）→ 客户反馈后决定
- 多语言（英文报告）→ Wave 2 国际化时
- 报告 PDF 导出 → 客户反馈后决定
- 报告评论 / 评分 / 协作编辑系统 → Wave 2
- 跨任务对比报告（多研究任务合并对比）→ Wave 2
- 自动定时报告（每周 / 每月 cron 自动生成）→ Wave 2
- 报告 SEO / 公开页面 / 检索引擎 indexed → 不做（账号登录访问）
- HTML 报告 PWA 离线访问 → 不做
- 检索快照超过 500 条命中 → 不做（前端硬限制 + 提示用户缩小范围）

### 10.2 A5 范围内但延后到 Phase A 后期（如时间紧张可砍）

- "导出 Word ▼"下拉里"无附录版"选项 → V2
- HTML 报告附录虚拟滚动（500 行 DataTable 普通 DOM 撑不住时）→ 性能验证后再加
- 重新生成时的二次确认 dialog → 默认信任用户点击
- 站内通知集成（报告完成时）→ V2 通知中心成熟后接入

---

## 11. 后续依赖

### 11.1 A6 依赖

A5 实施假设 A6 已完成：

- `xiaoyan` 员工已在 `EMPLOYEE_META` 注册（`src/lib/constants.ts`）
- `xiaoyan` 已在所有 org 自动 seed 到 `ai_employees` 表
- `research_drafter` skill 已入库（`skills` 表）
- `xiaoyan` 已绑定 `research_drafter` skill（`employee_skills` 表）
- `xiaoyan` 头像资源已就位（避免报告页"由小研生成"显示空头像）

如 A6 未完成 A5 不能 ship；为 A6 留 4-6 天工期。

### 11.2 主 spec 修订

实施 A5 前需 follow-up commit 修订 [`docs/superpowers/specs/2026-05-04-news-research-overhaul-design.md`](./2026-05-04-news-research-overhaul-design.md)：

- §156 行序更新为 `A1 → A2 → A2.5 → A3 → A4 → A6 → A5`
- §4.6 添加 cross-link 到本 sub-spec
- §4.7（A6 章节）添加 cross-link 到 A6 sub-spec（待 A6 brainstorm 后补）

---

## 12. 已采纳的设计原则

- **HTML 报告必生成成功**（核心交付物），Word/Excel 失败不阻塞主流程
- **AI 段落降级而非错误**（保证 status=ready 必达），降级时 banner 提示用户可重新生成
- **数据快照而非引用**（hitItemIds 入 jsonb，研究任务被删后报告仍可重生）
- **签名 URL 按需重签**（24h 有效，临过期 1h 内访问自动重签 24h）
- **覆盖默认 + 显式快照**（学术写作场景：中间版本不重要，关键节点才归档）
- **聚合用 SQL，文字用 AI，数字用模板**（主 spec 既定原则：AI 不算数）
- **employee/skill 系统走通**（A5 经过完整 7-layer prompt assembly + zod 输出约束，不绕开 vibetide 既有架构）
