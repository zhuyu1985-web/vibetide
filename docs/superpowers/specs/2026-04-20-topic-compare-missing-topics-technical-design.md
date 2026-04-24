# 同题对比 / 漏题筛查技术设计文档

> **日期：** 2026-04-20
> **状态：** 已确认
> **关联需求：** `docs/同题漏题模块_功能需求文档.md`
> **关联设计：** `2026-04-17-benchmarking-redesign-design.md`、`2026-04-18-unified-collection-module-design.md`
> **适用范围：** `topic-compare`、`missing-topics`、`benchmarking`、`data-collection`

---

## 1. 背景与目标

### 1.1 背景

创作者中心中的 **`同题对比`** 与 **`漏题筛查`** 已经完成了一轮 UX 重构与路由拆分，但底层数据链路仍处于 **新旧并存** 状态：

- `Collection Hub` 已经统一了热点/灵感池类采集；
- `benchmarking` 仍保留旧的 `platform_content` 直采与分析链路；
- `topic-compare` 已经能读取真实 `articles + platform_content + benchmark_analyses`，但仍带有 mock fallback；
- `missing-topics` 独立页面仍大量依赖静态 mock 数据，与数据库真实状态模型不一致；
- `missed_topics` 当前更像“分析结果表”，还不是完整的“线索处理表”。

因此，本设计文档的目标不是重写整个模块，而是：

1. 在现有 **Next.js App Router + DAL + Drizzle + Inngest + Collection Hub** 架构下，完成两个模块的数据链路收敛；
2. 让 `同题对比` 从“可演示”升级为“稳定可用”；
3. 让 `漏题筛查` 从“页面原型”升级为“真实业务模块”；
4. 在不破坏现有信息架构的前提下，补齐 **表结构、事件定义、接口契约、状态机、异常处理、性能策略**。

### 1.2 设计目标

- **目标一：统一数据入口**
  - 所有外部报道、热点线索、对标媒体内容优先进入 `Collection Hub`；
  - `collected_items` 作为统一采集事实源；
  - `platform_content`、`hot_topics`、`missed_topics`、`benchmark_analyses` 作为下游派生层。

- **目标二：清晰职责边界**
  - `同题对比`：以 **我方已发布作品** 为锚点，回看“别人如何报道”；
  - `漏题筛查`：以 **外部线索池** 为起点，判断“我方是否漏报”。

- **目标三：保持现有架构规范**
  - 页面读操作走 `DAL`；
  - 写操作走 `Server Action` 或 `API Route`；
  - 长耗时采集/分析走 `Inngest`；
  - AI 分析结果必须缓存落库；
  - 所有关键读写都必须包含 `organizationId` 隔离。

- **目标四：支持大规模处理**
  - 支持多源采集、增量分析、主题聚合、去重与预计算；
  - 允许在不增加页面复杂度的情况下承载更高的采集频率与线索量。

### 1.3 非目标

本期不做以下事项：

- 不新建独立搜索引擎或向量数据库；
- 不重做 `Collection Hub` UI；
- 不在本期引入新的第三方任务系统；
- 不全面重构 `benchmarking` 页面交互，仅补齐其作为数据提供方的职责；
- 不实现“竞品媒体后台配置中心”的完整 UI，仅预留数据模型与接入点。

---

## 2. 现状评估

### 2.1 `同题对比` 当前状态

#### 已具备能力

- 列表页 `topic-compare/page.tsx` 已可读取真实 `articles`；
- 详情页 `topic-compare/[id]/page.tsx` 已可读取真实：
  - `articles`
  - `platform_content`
  - `benchmark_analyses`
- `POST /api/topic-compare/generate-summary` 已支持：
  - SSE 流式输出；
  - 结果回写 `benchmark_analyses.aiSummary`；
  - `platform_content` 不足时 fallback 到 Tavily。
- `POST /api/benchmarking/interpret` 已支持单篇文章 AI 解读，并写回 `platform_content.aiInterpretation`。

#### 核心问题

1. **列表页与详情页都保留 mock fallback**，生产可用性不足；
2. **同题匹配仍以标题关键词 + `ILIKE` 为主**，误判与漏判风险较高；
3. **`benchmarkCount` 的统计口径不稳定**，当前依赖 `mediaScores` 而不是真实同题文章数；
4. **竞品媒体对标仍是“按平台级别分组”**，尚未升级为真正的竞品媒体能力；
5. **单篇 AI 解读接口缺少组织归属校验**，只校验了登录状态。

### 2.2 `漏题筛查` 当前状态

#### 已具备能力（主要在 `benchmarking` 页内）

- `getMissedTopics()` 能读取真实 `missed_topics`；
- `linkMissedTopicToArticle()` 能将漏题关联到我方文章；
- `pushMissedTopicToExternal()` 能将漏题推送到外部系统；
- `GET /api/benchmarking/search-articles` 能支持关联搜索；
- `POST /api/missing-topics/generate-summary` 能对指定漏题流式生成 AI 总结与补报建议。

#### 未完成部分（独立模块）

- `missing-topics/page.tsx` 仍直接使用 mock 数据；
- `missing-topics/[id]/page.tsx` 仍构造假详情；
- `action-bar.tsx` 中关联、确认、排除、转选题、推送全部是 `TODO`；
- 独立页前端类型 `MissingTopicClue / MissingTopicDetail` 与 `missed_topics` 当前数据库状态不一致。

### 2.3 最关键的结构性问题

#### 问题一：统一采集底座尚未完全接入两个模块

- `hot_topics` 已通过 `collection/item.created -> hot-topic-bridge` 接入；
- `platform_content` 仍主要来自旧的 `benchmarking-crawl.ts`；
- `missed_topics` 当前是结果表，不是完整线索池；
- `sentiment_event` 这种舆情事件源目前没有正式接入适配器。

#### 问题二：`漏题筛查` 的状态模型前后不一致

当前数据库 `missed_topics.status` 使用：

- `missed`
- `tracking`
- `resolved`

而独立页 UI 期望使用：

- `covered`
- `suspected`
- `confirmed`
- `excluded`
- `pushed`

这种不一致会导致：

- DAL 很难提供统一视图模型；
- 操作按钮无法落地为真实状态迁移；
- 推送、排除、关联动作只能写在 mock 层。

---

## 3. 目标业务定义

## 3.1 `同题对比`

### 定义

`同题对比` 是一个 **以我方已发布作品为主键** 的回看分析模块，用于回答：

- 别人怎么报；
- 我们报得怎么样；
- 我们下一次该怎么优化。

### 用户主流程

1. 用户进入 `作品列表`；
2. 选择一篇我方作品；
3. 系统加载同题报道统计、全网文章列表、竞品媒体分组；
4. 如无缓存，则异步生成 AI 总结；
5. 用户查看主题级总结、单篇解读、竞品差异；
6. 用户可手动触发刷新数据或重新分析。

### 核心输入

- 我方作品：`articles`
- 外部报道：`platform_content`
- 分析缓存：`benchmark_analyses`

### 核心输出

- 主题级概览
- 报道列表
- 竞品媒体分组
- AI 主题总结
- 单篇 AI 解读

## 3.2 `漏题筛查`

### 定义

`漏题筛查` 是一个 **以外部线索为主键** 的覆盖缺口识别模块，用于回答：

- 我们是不是没报；
- 如果要补报，应该怎么报。

### 用户主流程

1. 外部线索进入线索池；
2. 系统自动进行去重、合并、覆盖比对与热度排序；
3. 用户查看疑似漏题列表；
4. 用户进入详情页查看原文与 AI 分析；
5. 用户执行：
   - 关联已有作品
   - 确认为漏题
   - 排除
   - 转为选题
   - 推送处置

### 核心输入

- 社媒热榜线索：`hot_topics` / `collected_items`
- 竞媒报道线索：`platform_content`
- 舆情事件线索：新增 webhook source -> `collected_items`
- 我方作品：`articles`

### 核心输出

- 线索列表与 KPI
- 漏题详情
- AI 全网总结
- 补充报道建议
- 处置动作与审计记录

---

## 4. 总体技术方案

## 4.1 总体原则

采用“**统一采集 + 领域派生 + 缓存分析**”模式。

```text
外部源 -> Collection Hub -> collected_items -> bridge/derive -> 领域表 -> DAL -> 页面
```

### 统一原则

- **采集事实源唯一**：`collected_items`
- **业务派生表职责清晰**：
  - `hot_topics`：热点实体
  - `platform_content`：外部报道实体
  - `missed_topics`：漏题线索与处置实体
  - `benchmark_analyses`：主题级对比分析缓存
- **展示模型不直接依赖采集原始字段**，统一经 `DAL` 输出
- **AI 结果只做增强，不是主数据源**

## 4.2 目标架构分工

### A. Collection Hub

负责：
- 抓取
- 去重
- 重试
- 日志
- 运行统计
- 统一事件派发

### B. Benchmarking Derivation Layer

负责：
- 将外部报道从 `collected_items` 派生到 `platform_content`
- 将热点从 `collected_items` 派生到 `hot_topics`
- 将线索归并/识别为 `missed_topics`

### C. Analysis Layer

负责：
- 主题级 AI 总结
- 单篇文章 AI 解读
- 覆盖缺口判断
- 补报建议生成

### D. Experience Layer

负责：
- `topic-compare` 页面与详情页
- `missing-topics` 列表页与详情页
- `benchmarking` 页面作为过渡期的监控与运营入口

---

## 5. 数据源设计

## 5.1 数据源矩阵

| 业务能力 | 来源 | 当前状态 | 目标状态 |
|------|------|------|------|
| 我方作品 | `articles` | 已真实接入 | 保持 |
| 社媒热榜 | `tophub -> collected_items -> hot_topics` | 已接入 | 保持并增加漏题消费 |
| 对标媒体内容 | `benchmarking-crawl -> platform_content` | 旧链路 | 迁移到 `Collection Hub -> platform_content bridge` |
| RSS/站点列表/单 URL | `Collection Hub` adapters | 已具备能力 | 作为外部报道标准入口 |
| 舆情热点事件 | 暂无正式 adapter | 缺失 | 新增 webhook/event 型 source |
| AI 分析缓存 | `benchmark_analyses.aiSummary` / `platform_content.aiInterpretation` / `missed_topics.aiSummary` | 已部分落地 | 全量复用 |

## 5.2 数据流拆分

### 5.2.1 同题对比数据流

```text
articles(我方作品)
    +
platform_content(外部报道)
    -> topic matching / topic cluster
    -> benchmark_analyses
    -> topic-compare DAL
```

### 5.2.2 漏题筛查数据流

```text
hot_topics / platform_content / sentiment events
    -> clue merge / dedupe / coverage check
    -> missed_topics
    -> missing-topics DAL
```

---

## 6. 数据模型设计

## 6.1 `platform_content` 扩展

### 目标

让 `platform_content` 不再只是“旧采集模块产物”，而成为 **Collection Hub 的标准外部报道表**。

### 新增字段

建议新增：

- `collectedItemId: uuid | null`
  - 对应 `collected_items.id`
  - 用于回溯采集来源与去重轨迹
- `topicKey: text | null`
  - 用于主题聚类与快速匹配
- `topicClusterId: uuid | null`
  - 用于将多篇同题报道归并到一个主题簇
- `sourceType: text | null`
  - 如 `rss` / `list_scraper` / `tavily` / `tophub_derived`
- `sourceChannelSnapshot: text | null`
  - 首抓渠道快照，便于页面展示

### 索引建议

- `(organization_id, crawled_at desc)`
- `(organization_id, platform_id, crawled_at desc)`
- `(organization_id, coverage_status)`
- `(content_hash)`
- `title` trigram
- `summary` trigram
- `topics` GIN
- `(organization_id, topic_key)`
- `(organization_id, topic_cluster_id)`

## 6.2 `benchmark_analyses` 扩展

### 目标

让 `benchmark_analyses` 从“AI 总结表”升级为“主题级缓存与聚合表”。

### 新增字段

建议新增：

- `topicKey: text | null`
- `topicClusterId: uuid | null`
- `matchedReportCount: integer`
- `centralReportCount: integer`
- `provincialReportCount: integer`
- `otherReportCount: integer`
- `latestMatchedAt: timestamptz | null`
- `summarySource: text | null`
  - `platform_content` / `tavily`
- `summaryVersion: integer`
- `expiresAt: timestamptz | null`

### 用途

- 列表页直接取 `matchedReportCount`，不再依赖 `mediaScores.length`
- 详情页优先命中缓存
- 支持“缓存过期自动重算”

## 6.3 `missed_topics` 重构

### 目标

让 `missed_topics` 从“漏题结果表”升级为“线索处理表 + 处置状态表”。

### 当前问题

当前字段缺少：

- 多源证据
- 覆盖判断依据
- 排除理由
- 推送状态拆分
- 操作审计关联

### 推荐新增字段

- `collectedItemId: uuid | null`
- `primaryEvidenceId: uuid | null`
- `evidenceItemIds: jsonb`
- `topicKey: text | null`
- `clueFingerprint: text | null`
- `sourceDetail: text | null`
- `contentSummary: text | null`
- `contentLength: integer | null`
- `isMultiSource: boolean`
- `reportedBy: jsonb`
- `matchedScore: real | null`
- `matchedArticleTitleSnapshot: text | null`
- `excludedReasonCode: text | null`
- `excludedReasonText: text | null`
- `confirmedBy: uuid | null`
- `confirmedAt: timestamptz | null`
- `pushStatus: text`
- `pushPayload: jsonb | null`
- `pushErrorMessage: text | null`
- `scoreBreakdown: jsonb | null`

### 状态设计

不建议继续把所有语义都塞进一个 `status` 字段。

推荐拆成两个维度：

#### 维度一：覆盖判断 `coverageDecision`

- `covered`
- `suspected`
- `confirmed`
- `excluded`

#### 维度二：推送状态 `pushStatus`

- `not_pushed`
- `pushed`
- `push_failed`

### 向前兼容策略

为了兼容现有代码，可以分两步：

#### Phase A（兼容过渡）
- 保留 `status`
- 新增 `coverageDecision` 与 `pushStatus`
- DAL 层将旧状态映射到新 UI 状态

#### Phase B（收口）
- 页面、Action、API 全部切到新字段
- 最终废弃旧 `status` 或将其降级为只读兼容字段

### 推荐映射

| 旧 `status` | 新 `coverageDecision` |
|------|------|
| `missed` | `suspected` |
| `tracking` | `confirmed` |
| `resolved` + 有 `matchedArticleId` | `covered` |
| `resolved` + 无 `matchedArticleId` | `confirmed` |

## 6.4 `competitors` / 竞品媒体配置

当前 `competitorGroups` 只是按 `monitoredPlatforms.category` 分级分组，不是真正竞品媒体能力。

建议后续扩展：

- 复用或扩展 `monitored_platforms`
- 增加字段：
  - `isCompetitor`
  - `competitorLevel`
  - `priority`
  - `officialAccounts`

本期先不强依赖新表，但 `DAL` 层的分组逻辑要预留这些字段。

---

## 7. 事件与异步编排设计

## 7.1 保留事件

继续复用：

- `collection/source.run-requested`
- `collection/item.created`
- `benchmarking/content-detected`
- `hot-topics/enrich-requested`

## 7.2 新增事件

### 事件一：`benchmarking/content-derived`

**用途：** 从 `collected_items` 成功派生到 `platform_content` 后，通知分析层做覆盖判断和主题聚合。

**Payload：**

```json
{
  "organizationId": "string",
  "platformContentIds": ["string"],
  "sourceId": "string",
  "runId": "string",
  "trigger": "manual|cron|event"
}
```

### 事件二：`missing-topics/clue-detected`

**用途：** 当热点/竞媒/舆情事件被识别为可疑线索时，触发漏题识别。

**Payload：**

```json
{
  "organizationId": "string",
  "clueType": "social_hot|benchmark_media|sentiment_event",
  "evidenceIds": ["string"],
  "topicKey": "string"
}
```

### 事件三：`missing-topics/push-requested`

**用途：** 对确认漏题发起异步推送，避免页面阻塞外部 webhook。

**Payload：**

```json
{
  "organizationId": "string",
  "topicId": "string",
  "channels": ["string"],
  "requestedBy": "string",
  "includeAiSummary": true
}
```

### 事件四：`topic-compare/refresh-requested`

**用途：** 主动刷新某个作品的同题数据，可触发重抓或重分析。

**Payload：**

```json
{
  "organizationId": "string",
  "articleId": "string",
  "recrawl": false,
  "requestedBy": "string"
}
```

## 7.3 新增异步函数

### A. `collection-benchmarking-bridge`

**触发：** `collection/item.created`

**条件：** `targetModules` 包含 `benchmarking`

**职责：**
- 读取 `collected_items`
- 做外部报道字段映射
- upsert 到 `platform_content`
- 建立 `collectedItemId`
- 派发 `benchmarking/content-derived`

### B. `missing-topic-detector`

**触发：** `benchmarking/content-derived`、`collection/item.created`

**职责：**
- 将热点、竞媒内容、舆情事件统一转成线索
- 生成/更新 `missed_topics`
- 计算热度、时效、多源权重
- 与 `articles` 做覆盖比对

### C. `topic-compare-refresh`

**触发：** `topic-compare/refresh-requested`

**职责：**
- 重新聚合同题文章
- 更新 `benchmark_analyses` 的统计字段
- 按需重算 AI 总结

### D. `missing-topics-push`

**触发：** `missing-topics/push-requested`

**职责：**
- 调用外部推送渠道
- 更新 `pushStatus`
- 记录失败原因

---

## 8. 关键处理流程设计

## 8.1 `同题对比` 流程

### 流程 A：列表页数据生成

1. 从 `articles` 读取组织下已发布作品；
2. 关联 `benchmark_analyses` 获取：
   - `matchedReportCount`
   - `hasAnalysis`
   - `lastAnalyzedAt`
3. 输出 `TopicCompareArticle[]`；
4. 无真实数据时在生产环境不再 fallback 到 mock，而是返回空状态。

### 流程 B：详情页数据生成

1. 根据 `articleId + organizationId` 读取我方作品；
2. 优先按 `sourceArticleId` / `topicClusterId` / `topicKey` 读取 `benchmark_analyses`；
3. 读取同主题 `platform_content`；
4. 计算统计卡片；
5. 若 `aiSummary` 缓存未命中或过期，则前端触发 SSE 分析接口。

### 流程 C：AI 总结生成

1. 尝试从 `platform_content` 组织上下文；
2. 若本地上下文不足，再 fallback 到 Tavily；
3. 流式输出 `partial`；
4. 落库至 `benchmark_analyses.aiSummary`；
5. 同步回写：
   - `summarySource`
   - `summaryVersion`
   - `expiresAt`

### 流程 D：单篇文章解读

1. 校验 `contentId` 属于当前组织；
2. 若 `aiInterpretation` 已存在，则直接返回；
3. 否则调用模型生成；
4. 回写 `platform_content.aiInterpretation`。

## 8.2 `漏题筛查` 流程

### 流程 A：线索生成

来源包括：

- `hot_topics` 派生的热点线索
- `platform_content` 派生的竞媒线索
- webhook 写入的 `sentiment_event` 线索

处理步骤：

1. 提取 `topicKey` / `clueFingerprint`
2. 合并同题线索
3. 计算热度分值与时效衰减
4. 标记 `isMultiSource`
5. 生成/更新 `missed_topics`

### 流程 B：覆盖比对

1. 读取同组织 `articles`
2. 匹配口径：
   - 标题 trigram
   - 关键词 overlap
   - 时间窗
   - 必要时正文摘要相似度
3. 输出：
   - `matchedScore`
   - `matchedArticleId`
   - `coverageDecision`

### 流程 C：详情页 AI 分析

1. 以 `missed_topics` 的标题与摘要加载本地 `platform_content`；
2. 若命中本地内容，则基于本地上下文生成；
3. 否则 fallback 到 Tavily；
4. 输出：
   - 四块全网报道总结
   - 一块补报建议
5. 回写 `missed_topics.aiSummary`

### 流程 D：人工处置

#### 关联已有作品
- 输入：`topicId + articleId`
- 效果：
  - 更新 `matchedArticleId`
  - 更新 `coverageDecision = covered`
  - 写审计日志

#### 确认为漏题
- 输入：`topicId`
- 效果：
  - 更新 `coverageDecision = confirmed`
  - 回写操作人和时间

#### 排除
- 输入：`topicId + reasonCode + reasonText?`
- 效果：
  - 更新 `coverageDecision = excluded`
  - 记录排除原因

#### 转为选题
- 输入：`topicId`
- 效果：
  - 调用工作流/任务系统生成选题草稿
  - 在 `missed_topics` 上记录目标对象 id

#### 推送处置
- 输入：`topicId + channels + includeAiSummary`
- 效果：
  - 异步触发推送
  - 更新 `pushStatus`
  - 记录推送结果

---

## 9. 接口与 Action 契约

## 9.1 `同题对比`

### 9.1.1 `POST /api/topic-compare/generate-summary`

**输入：**

```json
{
  "articleId": "uuid",
  "forceRefresh": false
}
```

**输出：** SSE

- `status`
- `partial`
- `done`
- `error`

**错误：**
- `400`：缺少参数 / 非法 `articleId`
- `401`：未登录
- `404`：作品不存在或无权访问
- `502`：外部搜索失败

### 9.1.2 `POST /api/benchmarking/interpret`

**输入：**

```json
{
  "contentId": "uuid",
  "articleId": "uuid?"
}
```

**输出：**

```json
{
  "interpretation": "string"
}
```

**要求：**
- 必须校验 `platform_content.organizationId`
- 缓存命中直接返回

### 9.1.3 `refreshTopicCompare(articleId)`

**类型：** `Server Action`

**输入：**

```ts
{
  articleId: string;
  recrawl?: boolean;
}
```

**输出：**

```ts
{
  success: boolean;
  matchedCount?: number;
  refreshedAt?: string;
  error?: string;
}
```

## 9.2 `漏题筛查`

### 9.2.1 `listMissingTopics(filters)`

**类型：** `DAL`

**输入：**

```ts
{
  from?: string;
  to?: string;
  sourceTypes?: Array<"social_hot" | "sentiment_event" | "benchmark_media">;
  coverageDecisions?: Array<"covered" | "suspected" | "confirmed" | "excluded">;
  pushStatuses?: Array<"not_pushed" | "pushed" | "push_failed">;
  minHeatScore?: number;
  keyword?: string;
  page?: number;
  pageSize?: number;
}
```

**输出：**

```ts
{
  items: MissingTopicClue[];
  total: number;
  kpis: MissingTopicKPIs;
}
```

### 9.2.2 `POST /api/missing-topics/generate-summary`

**输入：**

```json
{
  "topicId": "uuid?",
  "topicTitle": "string",
  "contentSummary": "string?",
  "forceRefresh": false
}
```

**输出：** SSE

- `status`
- `partial`
- `done`
- `error`

### 9.2.3 `confirmMissedTopic()`

**类型：** `Server Action`

**输入：**

```ts
{
  topicId: string;
  note?: string;
}
```

**输出：**

```ts
{
  success: boolean;
  coverageDecision?: "confirmed";
  confirmedAt?: string;
  error?: string;
}
```

### 9.2.4 `excludeMissedTopic()`

**输入：**

```ts
{
  topicId: string;
  reasonCode: string;
  reasonText?: string;
}
```

**输出：**

```ts
{
  success: boolean;
  coverageDecision?: "excluded";
  error?: string;
}
```

### 9.2.5 `linkMissedTopicToArticle()`

**输入：**

```ts
{
  topicId: string;
  articleId: string;
}
```

**输出：**

```ts
{
  success: boolean;
  coverageDecision?: "covered";
  linkedArticleId?: string;
  error?: string;
}
```

### 9.2.6 `convertMissedTopicToTopic()`

**输入：**

```ts
{
  topicId: string;
  workflowTemplateId?: string;
  assigneeId?: string;
}
```

**输出：**

```ts
{
  success: boolean;
  draftId?: string;
  error?: string;
}
```

### 9.2.7 `pushMissedTopic()`

**输入：**

```ts
{
  topicId: string;
  channels: string[];
  receivers?: string[];
  includeAiSummary?: boolean;
  urgency?: "normal" | "high" | "critical";
}
```

**输出：**

```ts
{
  success: boolean;
  pushStatus?: "pushed" | "push_failed";
  pushedAt?: string;
  error?: string;
}
```

---

## 10. 状态机设计

## 10.1 `同题对比` 分析状态

建议由 `benchmark_analyses` 推导，不强行新增单独状态枚举：

- **未分析**：无 `benchmark_analyses` 记录
- **已分析**：有记录且 `aiSummary` 非空
- **缓存过期**：`expiresAt < now`
- **刷新中**：由前端轮询 job 或 SSE 状态体现

## 10.2 `漏题筛查` 状态机

### 主状态：`coverageDecision`

```text
suspected -> confirmed -> pushed
suspected -> covered
suspected -> excluded
confirmed -> covered
confirmed -> excluded
confirmed -> pushed
```

### 约束

- `covered` 表示已确认我方有对应作品，不再允许继续推送；
- `excluded` 表示人工排除，不再进入默认疑似列表；
- `pushed` 应由 `coverageDecision in (suspected, confirmed)` + `pushStatus = pushed` 推导，不建议与 `covered/excluded` 混为一体；
- 前端展示状态可由 DAL 统一映射。

### 推荐 UI 映射

| `coverageDecision` | `pushStatus` | UI 状态 |
|------|------|------|
| `covered` | 任意 | `covered` |
| `suspected` | `not_pushed` | `suspected` |
| `confirmed` | `not_pushed` | `confirmed` |
| `confirmed` | `pushed` | `pushed` |
| `suspected` | `pushed` | `pushed` |
| `excluded` | 任意 | `excluded` |

---

## 11. 异常处理设计

## 11.1 通用原则

- 页面展示与 AI 分析解耦；
- 采集失败不应阻塞已落库数据展示；
- 外部服务错误必须留下可追踪日志；
- 所有写接口返回结构化错误，不直接把底层异常抛给前端。

## 11.2 采集异常

### 场景
- 目标源 429/503
- RSS/XML 解析失败
- Jina 正文过短
- Tavily 查询超时

### 处理
- 记录到 `collection_logs`
- 更新 `collection_runs.status = partial/failed`
- 页面监控面板通过 `collection_runs + collection_logs` 展示
- bridge 层不对失败 item 重复派发事件

## 11.3 同题匹配异常

### 场景
- 本地 `platform_content` 不足
- 关键词提取为空
- 无法确定主题簇

### 处理
- 返回空上下文
- 可选 fallback 到 Tavily
- 在 `benchmark_analyses.summarySource` 标记 `tavily`
- 避免把 fallback 结果混入本地统计口径

## 11.4 漏题判断异常

### 场景
- 与 `articles` 的匹配失败
- 语义匹配分数缺失
- 线索合并冲突

### 处理
- 默认降级为 `suspected`
- 记录 `scoreBreakdown.error`
- 允许人工确认修正

## 11.5 推送异常

### 场景
- webhook 未配置
- 外部系统 4xx/5xx
- 超时

### 处理
- 更新 `pushStatus = push_failed`
- 回写 `pushErrorMessage`
- 支持用户在详情页重新触发推送

## 11.6 权限与归属异常

### 要求

以下接口都必须同时校验：

- 当前用户已登录
- 目标记录属于当前 `organizationId`

必须补齐校验的位置：

- `/api/benchmarking/interpret`
- `/api/benchmarking/search-articles`
- `/api/topic-compare/generate-summary` 的持久化分支
- `/api/missing-topics/generate-summary` 的持久化分支
- 所有 `missed_topics` 写操作

---

## 12. 性能优化设计

## 12.1 查询优化

### `topic-compare`

- 详情页优先按 `topicClusterId/topicKey` 查询，减少 `ILIKE`；
- `matchedReportCount` 改为预聚合字段；
- 主题级统计与 AI 总结分离缓存；
- 单篇文章解读按 `contentId` 落库缓存。

### `missing-topics`

- 列表页走分页 DAL，不一次性全拉；
- KPI 与列表查询拆开；
- 按时间范围 + 状态 + 来源建立组合索引；
- 详情页的相关报道上下文限制在最近 `N` 条。

## 12.2 写入优化

- `platform_content` bridge 使用批量 upsert；
- `missed_topics` 的线索合并以 `clueFingerprint` 做幂等；
- `benchmark_analyses` 的统计字段与 AI 总结分开更新；
- 仅对新增或显著变化的主题触发 AI 分析。

## 12.3 算法优化

### 当前问题

仓库中多处对比评分依赖 `Math.random()`，仅适用于 demo。

### 本期建议

改为确定性评分：

- 维度：
  - 来源级别
  - 发布时间差
  - 文本长度
  - 引用信息密度
  - 主题覆盖广度
  - 已覆盖/未覆盖
- 输出：
  - `importance`
  - `coverageScore`
  - `referenceValue`
  - `urgency`

## 12.4 增量与缓存策略

- `benchmark_analyses.expiresAt` 默认 2 小时；
- `platform_content.aiInterpretation` 永久缓存，允许手动刷新；
- `missed_topics.aiSummary` 默认 2 小时；
- 仅对：
  - 新增线索
  - 新增外部报道
  - 用户手动刷新
  触发重算。

---

## 13. 页面与 DAL 落地建议

## 13.1 `topic-compare`

### 列表页改造

- 保留 `getTopicCompareArticles()` 作为入口；
- 增加字段：
  - `lastAnalyzedAt`
  - `summaryExpired`
  - `matchedReportCount`
- 生产环境去掉 mock fallback；
- 开发环境可通过显式 flag 开启 demo 数据。

### 详情页改造

- `getTopicCompareDetail()` 改为优先读取：
  - `benchmark_analyses` 聚合字段
  - `topicKey/topicClusterId` 关联内容
- `reports` 输出中增加：
  - `contentId`
  - `collectedItemId`
  - `sourceType`
- `competitorGroups` 预留 `competitorPriority`。

## 13.2 `missing-topics`

### 列表页改造

新增 `DAL`：
- `listMissingTopicClues()`
- `getMissingTopicKpis()`

替换当前：
- `missingTopicClues`
- `missingTopicKPIs`

### 详情页改造

新增 `DAL`：
- `getMissingTopicDetail(topicId, orgId)`

负责组装：
- 线索标题、来源标签、原文摘要、来源列表
- `reportedBy`
- `linkedArticle`
- `aiAnalysis`
- `pushStatus`
- `audit trail`（如本期来得及）

### `action-bar.tsx` 改造

把当前 `TODO` 全部切到真实动作：

- `关联已有作品` -> `linkMissedTopicToArticle`
- `确认为漏题` -> `confirmMissedTopic`
- `排除` -> `excludeMissedTopic`
- `转为选题` -> `convertMissedTopicToTopic`
- `推送处置` -> `pushMissedTopic`

---

## 14. 分阶段实施计划

## Phase 1：数据模型收敛（必做）

### 目标
让后续功能补全建立在正确的数据模型之上。

### 任务
1. 为 `platform_content` 增加 `collectedItemId/topicKey/topicClusterId`；
2. 为 `benchmark_analyses` 增加统计缓存字段；
3. 为 `missed_topics` 增加 `coverageDecision/pushStatus/evidence` 相关字段；
4. 新增必要索引；
5. 编写旧状态迁移脚本。

## Phase 2：`Collection Hub` 接入 `benchmarking`（必做）

### 目标
把外部报道采集从旧链路迁到统一采集底座。

### 任务
1. 新建 `collection-benchmarking-bridge`；
2. 建立 `collected_items -> platform_content` 映射；
3. 将 `benchmarking/content-detected` 改为消费 bridge 后的标准事件；
4. 保留旧 `benchmarking-crawl` 作为兼容入口，逐步降级。

## Phase 3：`同题对比` 正式化（高优先级）

### 目标
移除 mock 依赖，让页面完全走真实链路。

### 任务
1. 列表页改真实统计口径；
2. 详情页改为主题键/主题簇查询；
3. 补齐文章解读接口组织校验；
4. 引入缓存过期与手动刷新；
5. 关闭生产 mock fallback。

## Phase 4：`漏题筛查` 页面落地（高优先级）

### 目标
让 `/missing-topics` 成为真实业务模块。

### 任务
1. 实现 `listMissingTopicClues/getMissingTopicKpis/getMissingTopicDetail`；
2. 替换列表页与详情页 mock；
3. 落地 5 个处置动作；
4. 支持 AI 分析结果持久化与重用。

## Phase 5：精度与性能优化（中优先级）

### 目标
提高匹配准确率与处理吞吐。

### 任务
1. 引入 `topicKey/topicClusterId`；
2. 补 trigram 索引；
3. 只对增量数据做重算；
4. 去除 `Math.random()` demo 评分逻辑；
5. 增加运营监控指标。

---

## 15. 验收标准

## 15.1 `同题对比`

- 列表页在生产环境不再依赖 mock；
- `benchmarkCount` 与真实同题文章数一致；
- 详情页能在本地 `platform_content` 充足时不依赖 Tavily；
- 单篇 AI 解读命中缓存时不重复调用模型；
- 所有接口都校验组织归属。

## 15.2 `漏题筛查`

- `/missing-topics` 列表页与详情页全部使用真实数据；
- 线索状态与数据库状态可一一映射；
- 5 个操作按钮全部可用；
- AI 分析结果可缓存复用；
- 推送失败后能重试并展示原因。

## 15.3 采集与派生

- 新增外部报道能进入 `collected_items`；
- 具备 `benchmarking` 目标模块的内容能自动派生到 `platform_content`；
- 社媒热点与竞媒内容都能进入漏题识别链路；
- 运行日志、错误日志可在监控页查看。

---

## 16. 最终决策摘要

1. **`collected_items` 作为统一采集事实源**，不再让 `同题对比` 与 `漏题筛查` 继续各维护一套采集逻辑；
2. **`platform_content` 继续作为同题对比的外部报道表**，但来源改为 `Collection Hub bridge`；
3. **`missed_topics` 重构为完整线索处理表**，拆分覆盖判断与推送状态；
4. **`topic-compare` 先正式化，`missing-topics` 再补完页面与动作**；
5. **性能优化优先走“索引 + 增量 + 缓存 + 预聚合”**，不在本期引入额外基础设施。

---

## 17. 建议的下一步执行顺序

如果进入实施阶段，建议按以下顺序推进：

1. **数据库迁移设计**
   - `platform_content`
   - `benchmark_analyses`
   - `missed_topics`
2. **新增 bridge 与事件函数**
3. **补齐 `missing-topics` 的 DAL 与 Action**
4. **替换独立页 mock**
5. **收口 `topic-compare` 的 fallback 与统计口径**
6. **最后清理旧 `benchmarking` 内联 demo 逻辑**
