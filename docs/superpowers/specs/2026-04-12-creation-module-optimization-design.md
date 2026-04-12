# 创作模块优化设计文档

> 日期: 2026-04-12
> 分支: feature/genspark-redesign-phase1
> 状态: 已确认，待实施

---

## 一、灵感池优化（4 项）

### 1.1 补页面标题

**现状**: `inspiration-client.tsx` 直接进入三栏布局，没有 PageHeader。其他页面（如同题对标）均有统一标题栏。

**方案**: 在灵感池页面顶部添加 `PageHeader` 组件。

- 标题: "灵感池"
- 副标题: "全网热点聚合 · AI 选题建议"
- 右侧 actions 区域保留刷新按钮（从侧栏移至标题栏更醒目）

**涉及文件**:
- `src/app/(dashboard)/inspiration/inspiration-client.tsx` — 在三栏布局外层包裹 PageHeader

### 1.2 用户主动输入灵感（右侧面板方案）

**现状**: 灵感池只展示抓取的热点，用户无法主动输入自己的灵感。

**方案**: 在右栏"编辑简报"面板底部增加固定输入区。

**交互流程**:
1. 右栏底部固定一个 textarea + 发送按钮（占约 120px 高度）
2. 用户输入灵感文本，点击发送
3. 调用新增 API `/api/inspiration/organize`，内部调用 AI agent（小策 xiaoce，内容策划技能）
4. 以消息气泡形式在输入框上方展示 AI 返回的结构化结果：
   - 选题标题（精炼后）
   - 内容摘要
   - 建议切入角度（2-3 个）
   - 关联热点（如果匹配到已有热点）
5. 支持多轮交互（用户追问/修改方向），对话历史为客户端 ephemeral 状态（`useState`），刷新页面后清空
6. 不影响上方已有的编辑简报、优先级分布、分类 TOP5、日历事件等内容

**涉及文件**:
- `src/app/(dashboard)/inspiration/inspiration-client.tsx` — EditorialBriefing 组件底部增加输入区 + 消息列表
- `src/app/api/inspiration/organize/route.ts` — 新增 SSE 流式 API，调用 agent execution
- `src/lib/agent/` — 复用现有 agent assembly + execution pipeline

### 1.3 已追踪热点明显标识

**现状**: 底部行末显示绿色小字"已追踪"（Eye icon + 11px 文字），不醒目。

**方案**: 双重视觉标识。
- 整行左侧增加 4px 蓝色竖条（border-left）
- 右上角显示蓝色"追踪中"徽章，带 Radar 图标 + pulse 动画
- 背景色微调为浅蓝 tint（`bg-blue-50/30`）

**涉及文件**:
- `src/app/(dashboard)/inspiration/inspiration-client.tsx` — TopicList 组件中 `isTracked` 条件渲染

### 1.4 刷新数据进度提示

**现状**: `triggerHotTopicCrawl()` 顺序抓取 10 个平台后一次性返回，UI 仅显示旋转图标 + "抓取中..."，等待 30s+ 无反馈。

**方案**: 改为 SSE 流式接口，逐平台汇报进度。

**后端**:
- 新增 `src/app/api/inspiration/crawl/route.ts`（POST, SSE via ReadableStream — POST 因为触发抓取是 mutation，前端用 `fetch()` + `getReader()` 消费而非 `EventSource`）
- 将 `triggerHotTopicCrawl` 的逻辑拆成逐平台执行，每完成一个平台发送一条 SSE event：
  ```
  data: {"platform":"微博","status":"done","current":1,"total":10,"found":28}
  data: {"platform":"百度","status":"done","current":2,"total":10,"found":15}
  ...
  data: {"status":"complete","newTopics":45,"updatedTopics":12}
  ```

**前端**:
- 侧栏"刷新数据"按钮点击后：
  - 顶部出现细条进度条（NProgress 风格，宽度 = current/total * 100%）
  - 按钮旁显示实时计数 "3/10 平台已完成"
  - 完成后自动 router.refresh()

**涉及文件**:
- `src/app/api/inspiration/crawl/route.ts` — 新增 SSE route
- `src/app/(dashboard)/inspiration/inspiration-client.tsx` — handleRefresh 改为 fetch + ReadableStream 消费
- `src/app/actions/hot-topics.ts` — 拆出 `crawlSinglePlatform()` 供 SSE route 调用

---

## 二、同题对比（4 项）

### 2.1 自有作品信息展示

**现状**: 同题对标页面没有自有作品入口，对标起点是搜索框。

**方案**: 在同题对标 Tab 中增加"我方作品"区域作为对标起点。

**数据来源**: `articles` 表，筛选 `status = 'published'` 或 `'review'`。

**展示内容**:
- 作品标题
- 发布时间 (`publishedAt`)
- 发布渠道（新增 `publishChannels` jsonb 字段）
- 传播数据（新增 `spreadData` jsonb 字段）：阅读量、点赞、转发、评论
- 状态标签

**对接扩展**: `spreadData` 预留从外部发布系统 API 同步的入口。当前阶段可手动录入或通过 server action 更新。

**对标关联**: 当用户选择一篇我方作品进入对标视图时，生成的 `benchmarkAnalyses` 记录通过 `sourceArticleId` 字段（uuid FK→articles）关联到该作品。这使得同一作品可以多次对标（不同时间点），也便于从作品详情页反查其对标报告。

**Schema 变更**:
```sql
ALTER TABLE articles ADD COLUMN publish_channels jsonb DEFAULT '[]';
ALTER TABLE articles ADD COLUMN spread_data jsonb DEFAULT '{}';
```

`spreadData` 结构:
```typescript
interface SpreadData {
  views?: number;
  likes?: number;
  shares?: number;
  comments?: number;
  lastSyncedAt?: string;
  source?: "manual" | "api_sync";
}
```

**涉及文件**:
- `src/db/schema/articles.ts` — 增加两个字段
- `src/lib/dal/benchmarking.ts` — 新增 `getPublishedArticlesForBenchmark(orgId)`
- `src/app/(dashboard)/benchmarking/benchmarking-client.tsx` — 同题对标 Tab 增加我方作品列表
- `src/lib/types.ts` — 增加 `BenchmarkArticleUI` 类型

### 2.2 全网报道情况 + AI 结构化总结

**现状**: 无。当前对标只有抽象评分雷达图。

**方案**: 选定我方作品或话题后，系统调用 Tavily 搜索全网报道，生成 AI 结构化总结。

**AI 总结结构** (存储在 `benchmarkAnalyses.aiSummary` 新增 jsonb 字段):
```typescript
interface BenchmarkAISummary {
  centralMediaReport: string;    // 官媒及央媒报道情况
  otherMediaReport: string;      // 其他媒体报道情况
  highlights: string;            // 报道亮点与创新点
  overallSummary: string;        // 整体报道总结
  sourceArticles: {              // 来源原文列表
    title: string;
    url: string;
    platform: string;
    mediaLevel: string;          // central/provincial/municipal/industry
    publishedAt?: string;
    excerpt?: string;
  }[];
  generatedAt: string;
}
```

**流程**:
1. 用户选择一篇我方作品 → 提取标题关键词
2. 调用 Tavily 搜索（`searchViaTavily`），获取全网相关报道
3. 由 LLM 根据搜索结果的来源 URL 和名称判断媒体级别（central/provincial/municipal/industry），而非 DB join（Tavily 结果不一定在 `monitoredPlatforms` 中）
4. 调用 LLM 生成四段式总结
5. 以面板形式展示，每条来源文章支持点击跳转原文

**对比视图** (`article-compare-view.tsx`):
- 选定我方作品 + 全网报道后，展示对比视图：
  - 左栏：竞品报道（标题、摘要、来源平台、媒体级别标签、发布时间、关键要点）
  - 右栏：我方报道（标题、摘要、发布时间、传播数据）
  - 下方：AI 差异分析面板（角度差异、深度差异、时效差异、遗漏要点）
- 保留现有雷达图作为辅助评分参考

**涉及文件**:
- `src/app/actions/benchmarking.ts` — 新增 `generateTopicReport(topicTitle)` action
- `src/app/api/benchmarking/report/route.ts` — SSE 流式返回 AI 总结（避免超时）
- `src/app/(dashboard)/benchmarking/topic-report-panel.tsx` — 新增 AI 总结面板组件
- `src/db/schema/benchmarking.ts` — `benchmarkAnalyses` 增加 `aiSummary` jsonb

### 2.3 同题全网报道文章列表

**现状**: `CrawlFeedList` 组件已有基本列表，但只在监控看板 Tab，不在同题对标 Tab。

**方案**: 在同题对标视图中复用并增强 `CrawlFeedList`。

**列表字段**:
- 报道标题（可点击查看原文）
- 报道时间
- 报道作者/账号
- 来源平台
- 重要度评分
- 覆盖状态（已覆盖/未覆盖/部分覆盖）

**筛选**:
- 按平台筛选（复用 ComparisonFilterBar）
- 按时间范围筛选
- 按覆盖状态筛选

**AI 解读**:
- 每条文章右侧增加"AI 解读"按钮
- 点击后调用 LLM 对 `summary`/`body` 做要点解读
- 结果缓存到 `platformContent.aiInterpretation` 字段
- 以 popover 或展开行形式展示

**涉及文件**:
- `src/app/(dashboard)/benchmarking/benchmarking-client.tsx` — 同题对标 Tab 重构布局
- `src/app/(dashboard)/benchmarking/crawl-feed-list.tsx` — 增加 AI 解读按钮 + 展开区域
- `src/app/api/benchmarking/interpret/route.ts` — AI 解读 API route（POST），调用 LLM 并缓存结果。使用 API route 而非 server action 因为 LLM 调用可能较慢，API route 更易做超时控制
- `src/db/schema/benchmarking.ts` — `platformContent` 增加 `aiInterpretation` text（存储 markdown 格式的解读文本）

### 2.4 竞品媒体定向查看

**现状**: `PlatformStatusTree` 可按平台筛选，但无媒体级别标识。

**方案**: 增强媒体筛选，增加级别标识。

**媒体级别标识** (基于 `monitoredPlatforms.category`):
- `central` → 央媒（红色标签）
- `provincial` → 省媒（橙色标签）
- `municipal` → 市媒（蓝色标签）
- `industry` → 行业媒体（灰色标签）

**定向查看**:
- 在 PlatformStatusTree 中每个平台名旁显示级别标签
- 选中某个媒体单位后，列表筛选为该单位在同题下发布的所有作品
- 展示：标题、报道主体、发布时间
- 同样支持 AI 解读

**涉及文件**:
- `src/app/(dashboard)/benchmarking/platform-status-tree.tsx` — 增加级别标签渲染
- `src/app/(dashboard)/benchmarking/benchmarking-client.tsx` — 竞品定向筛选逻辑

---

## 三、漏题筛查（6 项）

### 3.1 线索库构建

**现状**: `missedTopics` 表只有基本字段，没有来源类型区分，没有原文 URL。

**方案**: 扩展线索来源，构建多源线索库。

**Schema 变更**:
```sql
-- 新增枚举
CREATE TYPE missed_topic_source_type AS ENUM ('social_hot', 'sentiment_event', 'benchmark_media');

ALTER TABLE missed_topics ADD COLUMN source_type missed_topic_source_type DEFAULT 'social_hot';
ALTER TABLE missed_topics ADD COLUMN source_url text;
ALTER TABLE missed_topics ADD COLUMN source_platform text;
```

**线索来源**:
1. `social_hot` — 社交媒体热点话题：从 `hotTopics` 表中识别我方未覆盖的高热度话题
2. `sentiment_event` — 舆情热点事件：预留对接外部舆情系统的 API 入口（webhook 或定时拉取）
3. `benchmark_media` — 对标账号/单位发布作品：从 `platformContent` 中 `coverageStatus = 'missed'` 的内容

**列表展示**:
- 线索标题
- 来源类型标识（彩色标签，见 3.5）
- 来源平台
- 发现时间
- 支持点击查看原文（跳转 `sourceUrl`）

**涉及文件**:
- `src/db/schema/benchmarking.ts` — missedTopics 增加字段
- `src/db/schema/enums.ts` — 新增 missedTopicSourceTypeEnum
- `src/lib/dal/benchmarking.ts` — 更新 getMissedTopics 返回新字段
- `src/lib/types.ts` — 更新 MissedTopic 类型

### 3.2 疑似漏题快速识别

**现状**: `autoGenerateAnalysisIfNeeded` 在页面加载时自动从 `platformContent` 生成漏题记录，但逻辑简单。

**方案**: 增强漏题识别逻辑，多源交叉比对。

**识别规则**:
1. `platformContent` 中 `coverageStatus = 'missed'` 或 `'partially_covered'` 且 `platformContent.importance >= 60` → 创建 `missedTopics` 记录，`heatScore` 取自 `platformContent.importance`
2. `hotTopics` 中 `priority = 'P0'` 且在 `articles` 表中无标题匹配 → 创建 `missedTopics` 记录（`sourceType = 'social_hot'`），`heatScore` 取自 `hotTopics.heatScore`
3. 漏题列表默认按 `missedTopics.heatScore` 降序排列
4. `missedTopics.heatScore >= 80` 的条目标红醒目展示

> 注：`platformContent` 使用 `importance` 字段，`missedTopics` 使用 `heatScore` 字段。创建漏题时将来源表的分数映射到 `heatScore`。

**涉及文件**:
- `src/lib/dal/benchmarking.ts` — 增强 autoGenerateAnalysisIfNeeded，增加 hotTopics 交叉比对
- `src/app/(dashboard)/benchmarking/benchmarking-client.tsx` — 漏题列表排序和样式

### 3.3 漏题原文详情 + AI 全网报道总结

**现状**: 漏题列表只有标题和基础信息，无详情展开，无 AI 总结。

**方案**: 点击漏题进入详情面板 + 一键 AI 检索。

**详情面板**:
- 展开显示原文内容（`summary`，如有 `sourceUrl` 则提供"查看原文"链接）
- 竞品已发列表（`competitors` 字段）
- 热度评分、分类信息

**一键 AI 检索**:
- 按钮"AI 全网报道总结"
- 调用 Tavily 搜索 + LLM 总结（复用 2.2 的 `generateTopicReport` 逻辑）
- 返回与 2.2 相同格式的结构化总结：
  - 官媒及央媒报道情况
  - 其他媒体报道情况
  - 报道亮点创新点
  - 整体报道总结
  - 来源原文列表（支持点击跳转）
- 结果缓存到 `missedTopics.aiSummary` jsonb 字段

**Schema 变更**:
```sql
ALTER TABLE missed_topics ADD COLUMN ai_summary jsonb;
```

**涉及文件**:
- `src/app/(dashboard)/benchmarking/benchmarking-client.tsx` — 漏题列表增加展开详情
- `src/app/(dashboard)/benchmarking/missed-topic-detail.tsx` — 新增详情面板组件
- `src/app/actions/benchmarking.ts` — 新增 `generateMissedTopicReport(topicId)` action
- `src/db/schema/benchmarking.ts` — missedTopics 增加 aiSummary

### 3.4 手动自有作品查询（修正漏题）

**现状**: 无。漏题一旦标记就无法修正。

**方案**: 漏题详情面板增加"关联自有作品"操作。

**交互流程**:
1. 漏题详情面板显示"关联自有作品"按钮
2. 点击弹出搜索对话框，输入关键词搜索 `articles` 表（标题模糊匹配）
3. 搜索结果列表展示：标题、发布时间、状态
4. 用户选中一篇 → 将漏题 `status` 改为 `resolved`，记录 `matchedArticleId`
5. 列表中该条漏题显示"已关联"标识 + 关联的文章标题

**Schema 变更**:
```sql
ALTER TABLE missed_topics ADD COLUMN matched_article_id uuid REFERENCES articles(id);
```

**涉及文件**:
- `src/app/(dashboard)/benchmarking/missed-topic-detail.tsx` — 增加关联操作
- `src/app/actions/benchmarking.ts` — 新增 `linkMissedTopicToArticle(topicId, articleId)` action
- `src/lib/dal/benchmarking.ts` — 新增 `searchArticlesForLinking(orgId, query)` DAL 函数

### 3.5 漏题来源标识

**现状**: 无来源类型区分。

**方案**: 基于 `sourceType` 字段渲染不同颜色标签。

| sourceType | 标签文字 | 颜色 |
|---|---|---|
| `social_hot` | 社媒热榜 | 橙色 (orange) |
| `sentiment_event` | 舆情事件 | 红色 (red) |
| `benchmark_media` | 对标媒体 | 蓝色 (blue) |

- 对标媒体来源额外显示媒体级别标识（央媒/省媒/市媒/行业，同 2.4 颜色体系）

**涉及文件**:
- `src/app/(dashboard)/benchmarking/benchmarking-client.tsx` — 漏题列表渲染标签

### 3.6 确认漏题推送至三方系统

**现状**: 无推送功能。

**方案**: 确认的漏题支持一键推送到配置的三方系统。

**Schema 变更**:
```sql
ALTER TABLE missed_topics ADD COLUMN pushed_at timestamptz;
ALTER TABLE missed_topics ADD COLUMN pushed_to_system text;
```

**推送机制**:
- 漏题详情面板增加"推送"按钮
- 推送目标通过环境变量或数据库配置（预留）：
  - `MISSED_TOPIC_WEBHOOK_URL` — 第三方系统 webhook 地址
- 推送 payload: `{ title, priority, heatScore, sourceUrl, competitors, category, sourceType }`
- 仅在 webhook 返回 2xx 时更新 `pushedAt` 和 `pushedToSystem`；非 2xx 响应或超时（10s）视为推送失败，向用户 toast 提示错误信息，不更新字段
- 列表中已推送的条目显示"已推送"灰色标识，避免重复推送

**涉及文件**:
- `src/app/actions/benchmarking.ts` — 新增 `pushMissedTopicToExternal(topicId)` action
- `src/app/(dashboard)/benchmarking/missed-topic-detail.tsx` — 推送按钮
- `src/db/schema/benchmarking.ts` — missedTopics 增加推送字段

---

## 四、Schema 变更汇总

| 表 | 字段 | 类型 | 说明 |
|----|------|------|------|
| `articles` | `publish_channels` | jsonb | 发布渠道列表 |
| `articles` | `spread_data` | jsonb | 传播数据（阅读/点赞/转发/评论） |
| `missed_topics` | `source_type` | enum | social_hot / sentiment_event / benchmark_media |
| `missed_topics` | `source_url` | text | 原文链接 |
| `missed_topics` | `source_platform` | text | 来源平台名称 |
| `missed_topics` | `matched_article_id` | uuid FK→articles | 关联的自有作品 |
| `missed_topics` | `ai_summary` | jsonb | AI 全网报道总结缓存 |
| `missed_topics` | `pushed_at` | timestamptz | 推送时间 |
| `missed_topics` | `pushed_to_system` | text | 推送目标系统 |
| `platform_content` | `ai_interpretation` | text | AI 解读内容缓存 |
| `benchmark_analyses` | `ai_summary` | jsonb | AI 结构化总结 |
| `benchmark_analyses` | `source_article_id` | uuid FK→articles | 关联的自有作品 |
| `enums` | `missedTopicSourceTypeEnum` | enum | 新增枚举 |

---

## 五、新增文件清单

| 文件路径 | 类型 | 说明 |
|----------|------|------|
| `src/app/api/inspiration/crawl/route.ts` | API Route (SSE) | 流式热点抓取进度 |
| `src/app/api/inspiration/organize/route.ts` | API Route (SSE) | 灵感整理 AI 流式接口 |
| `src/app/api/benchmarking/report/route.ts` | API Route (SSE) | AI 全网报道总结流式接口 |
| `src/app/api/benchmarking/interpret/route.ts` | API Route | 文章 AI 解读接口 |
| `src/app/(dashboard)/benchmarking/topic-report-panel.tsx` | Component | AI 结构化总结面板 |
| `src/app/(dashboard)/benchmarking/missed-topic-detail.tsx` | Component | 漏题详情面板 |
| `src/app/(dashboard)/benchmarking/article-compare-view.tsx` | Component | 我方 vs 竞品对比视图 |

---

## 六、实施优先级建议

**Phase 1 — 灵感池优化**（影响面小，独立可交付）
1. 补 PageHeader
2. 已追踪标识增强
3. 刷新进度条（SSE）
4. 用户输入灵感（右侧面板）

**Phase 2 — 同题对标基础**（依赖数据）
5. 监控看板自动填充数据 — 在 `initializeDefaultPlatforms` 创建平台后自动调用 `crawlPlatformDirect` 触发首次抓取；在看板头部增加"立即抓取"按钮供手动触发
6. 自有作品展示 + Schema 变更
7. 同题全网报道文章列表 + 筛选
8. 竞品媒体级别标识

**Phase 3 — AI 深度功能**
9. AI 全网报道总结（同题对比 + 漏题共用）
10. 文章 AI 解读
11. 竞品定向查看 + AI 解读

**Phase 4 — 漏题筛查增强**
12. 线索库多源构建 + 来源标识
13. 疑似漏题识别增强
14. 漏题详情 + 手动关联作品
15. 推送至三方系统
