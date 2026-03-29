# 灵感池（Inspiration Pool）全面优化设计

> 为新闻编辑提供未读实时热点、日历灵感及深度创作辅助的智能选题平台

## 1. 目标与背景

### 目标用户
新闻编辑（各频道/领域），需要快速感知热点、筛选选题、获取创作灵感。

### 四大使用场景
1. **早班编前会** — 编辑上班后快速了解过夜期间发生了什么，挑选今天要跟进的选题
2. **全天值班监控** — 编辑全天开着灵感池，实时感知新热点出现，第一时间响应突发事件
3. **选题策划会** — 编辑团队定期开会，用灵感池作为选题讨论的数据支撑工具
4. **深度创作辅助** — 编辑确定选题后，获取更多创作素材、角度和参考

### 当前问题
- 信息消费效率低：P0/P1/P2 三级卡片布局信息密度不均，"快速扫描 → 决策"路径不清晰
- 无已读/未读状态追踪，编辑每次打开都要从头扫描
- AI 角度建议浅（仅 3 个短文本），缺少内容大纲、参考素材、竞品对比
- 缺少日历型/周期型灵感源（节赛会展）
- 无分类订阅，所有编辑看同一个池子
- 无实时更新提示，依赖手动刷新

---

## 2. 整体布局

采用**左右双面板**布局，固定在视口高度内（不出现页面级滚动）：

```
┌─────────────────────────────────────────────────────────────────┐
│  顶部栏（已有 Topbar）                                           │
├──────────────────────────────┬──────────────────────────────────┤
│                              │                                  │
│   智能信息流（左侧 ~45%）      │   灵感工作台（右侧 ~55%）         │
│                              │                                  │
│  ┌────────────────────────┐  │  ┌────────────────────────────┐  │
│  │ AI 变化摘要条（可折叠）  │  │  │ 选中热点的深度内容          │  │
│  └────────────────────────┘  │  │                            │  │
│  ┌────────────────────────┐  │  │ · 基础信息 + 热力曲线       │  │
│  │ 分类 Tab 栏             │  │  │ · AI 角度 + 大纲           │  │
│  │ 订阅频道 | 全部 | 日历   │  │  │ · 素材聚合                │  │
│  └────────────────────────┘  │  │ · 情感分析 + 竞品动态       │  │
│  ┌────────────────────────┐  │  │ · 操作按钮                 │  │
│  │ 热点列表（可滚动）       │  │  │                            │  │
│  │                        │  │  └────────────────────────────┘  │
│  │ · 未读标记 + 优先级标签  │  │                                  │
│  │ · 时间线分割线          │  │  （未选中时显示「编辑简报」）       │
│  │ · 新热点浮动条          │  │                                  │
│  └────────────────────────┘  │                                  │
│                              │                                  │
├──────────────────────────────┴──────────────────────────────────┤
│  底部：平台监控状态栏（10个平台在线状态 + 上次扫描时间）            │
└─────────────────────────────────────────────────────────────────┘
```

关键决策：
- 左右比例 45:55，左侧重扫描效率，右侧重内容深度
- 右侧**默认状态**（未选中任何热点时）展示升级版「编辑简报」
- 平台监控状态栏移到底部，作为一行紧凑的状态指示器（随 `triggerHotTopicCrawl()` 完成时刷新，不单独轮询）
- 整体锁定视口高度，左右面板各自独立滚动

---

## 3. 左侧 — 智能信息流

### 3.1 AI 变化摘要条

页面顶部的可折叠卡片，编辑打开灵感池时首先看到：

- 基于编辑的 `lastViewedAt` 时间戳计算 delta
- 展示内容：
  - 距上次查看的时间间隔
  - 新增热点数量及优先级分布（P0×N P1×N P2×N）
  - 重要变动（热度飙升、优先级升降）
  - 订阅频道动态
- 点击折叠后变成一行摘要："距上次 3h，+5 新热点"
- 提供「一键全部已读」按钮：标记**当前 tab 下所有可见热点**为已读（如在"我的订阅"tab 则只标记订阅分类热点，在"全部热点"tab 则标记全部）

### 3.2 分类 Tab 栏

```
[ 我的订阅(8) ] [ 全部热点(47) ] [ 日历灵感(3) ]    ⚙️ 管理订阅
```

- **我的订阅** — 只显示编辑订阅分类的热点，默认选中
- **全部热点** — 显示全部，订阅分类的条目带高亮标记
- **日历灵感** — 展示即将到来的节赛会展事件
- 每个 tab 后面的数字是**未读计数**（仅统计未读热点，不含已读；「一键全部已读」和逐条点击后实时更新）
- ⚙️ 管理订阅：弹出 Sheet 管理订阅配置

### 3.3 热点列表项

每条热点在列表中的展示信息：
- 左侧未读圆点（`●`），已读后消失
- 一行徽章：优先级（P0 红/P1 橙/P2 灰）、热度分数、趋势箭头、分类标签
- 标题（加粗，未读时更醒目）
- AI 摘要（1-2行，溢出截断）
- 底部：来源平台图标 + 发现时间 + 角度建议数量
- 点击整行 → 右侧工作台加载详情，同时标记该热点为已读
- 选中状态用左侧边框高亮；切换 tab 时清除选中状态

**「全部热点」tab 中的订阅高亮规则：**
- 订阅分类的标签使用实心背景色（accent），非订阅为描边/灰色
- 排序规则：**优先级 > 订阅优先 > 热度分数**，即同优先级内订阅内容排在前面

### 3.4 时间线分割线

```
──────── 上次查看到这里 · 3小时前 ────────
```

- 插入在列表中，区分新旧内容
- 新内容在上方，旧内容在下方
- 位置固定（不随已读变化实时移动），基于打开页面时的 `lastViewedAt` 计算

### 3.5 新热点浮动条

```
┌──────────────────────────────┐
│  ↑ 发现 3 条新热点，点击查看   │
└──────────────────────────────┘
```

- 固定在左侧列表顶部
- 点击后滚动到顶部并加载新内容
- 不自动刷新，避免打断编辑正在浏览的内容
- 轮询机制：每 60 秒调用轮询接口，编辑离开页面时停止轮询（`visibilitychange` 事件），页面重新可见时立即触发一次
- **轮询 API**：`GET /api/inspiration/new-topics?since={ISO8601}`
  - 需要认证（requireAuth）
  - 响应：`{ count: number, maxPriority: "P0"|"P1"|"P2"|null }`
  - 错误/超时时静默忽略，下次轮询重试

---

## 4. 右侧 — 灵感工作台

### 4.1 默认状态：编辑简报

编辑刚进入页面、还没点击任何热点时展示。数据来源：AI 全局摘要由 `getEditorialMeeting()` 计算（基于热点数据聚合 + AI 文本生成），图表为前端聚合渲染，日历预告由 `getCalendarEvents()` 提供。

- AI 全局摘要（今日热点全景，平台覆盖情况，重点关注建议）
- 优先级分布可视化（P0/P1/P2 条形图）
- 分类热度 TOP 5 排行
- 今日日历灵感预告（展示未来 3 天的事件）
- 「一键追踪全部 P0」操作按钮 → 批量创建任务进入 AI 任务中心

### 4.2 选中热点后：深度灵感面板

点击左侧某条热点后，右侧切换为该热点的详情，从上到下包含：

**① 基础信息区**
- 优先级、分类、热度分数、趋势标签
- 标题（完整）
- 发现时间 + 来源平台列表

**② 热力趋势图**
- 复用现有 HeatCurveChart 组件，展示过去 48 个时间点的热度曲线

**③ AI 创作角度（核心新增）**
- 每个热点 3 个角度建议
- 每个角度可展开查看完整大纲：
  - 4-5 个内容要点
  - 建议篇幅（如 "2000-3000字"）
  - 内容风格（如 "适合深度报道" / "适合快讯"）
- 角度和大纲由 AI enrichment 管线生成并持久化

**④ 素材聚合（核心新增）**
- **相关报道**：同主题的其他媒体报道（标题 + 来源 + 时间）
- **可引用数据**：AI 提取的相关数据点（带来源标注）
- **热门评论观点**：各平台的高赞评论摘要

**⑤ 舆情分析**
- 正面/中立/负面情感占比条形图（复用现有组件）

**⑥ 竞品动态**
- 其他媒体对该话题的响应（已发布/正在跟进/未响应）

**⑦ 操作按钮**
- 「启动追踪」— 创建任务进入 AI 任务中心
- 「加入选题策划会素材」— 收藏到个人选题清单

---

## 5. 日历灵感系统

### 5.1 日历灵感 Tab 视图

点击左侧分类栏的「日历灵感」tab 后，列表区域切换为日历事件视图：
- 按时间分组展示：今天 → 明天 → 本周 → 下周 → 未来 30 天
- 每个事件显示：emoji 图标、名称、分类、事件类型、日期、AI 角度建议摘要
- 顶部提供「＋ 添加事件」按钮

### 5.2 事件数据模型

每个日历事件包含：
- **名称**、**分类**（复用 11 个标准分类）
- **事件类型**（enum）：节日(festival)、赛事(competition)、会议(conference)、展会(exhibition)、发布会(launch)、纪念日(memorial)
- **时间**：起止日期 + 是否全天
- **周期**：一次性(once) / 每年固定(yearly) / 自定义(custom)
- **来源**：系统内置(builtin) / 编辑手动(manual) / AI 发现(ai_discovered)
- **状态**：已确认(confirmed) / 待审核(pending_review)（AI 发现的需要编辑确认）
- **AI 建议**：系统自动为每个事件生成 2-3 个选题角度
- **提前提醒天数**：默认提前 3 天出现在灵感池，编辑可在事件详情中按事件自定义

### 5.3 三个数据来源

**① 系统内置（~100+ 事件）**
- 法定节假日、二十四节气、国际日
- 重大体育赛事（世界杯、奥运会等）
- 知名展会（CES、进博会、广交会、MWC 等）
- 存储为种子数据，每年自动推进日期

**② 编辑手动添加**
- 点击「＋ 添加事件」打开 Sheet 表单
- 填写：名称、分类、事件类型、日期、是否周期、备注
- 保存后通过 `hot-topic-enrichment.ts` 管线异步生成 AI 选题角度建议（复用相同 prompt 模板，传入事件上下文而非热点上下文）

**③ AI 自动发现**
- 在 `hot-topic-enrichment.ts` 管线中增加"日历事件识别"步骤：分析热点标题是否包含即将到来的事件信号（如"倒计时"、"即将开幕"、"X月X日举办"等）
- 识别到的候选事件写入 `calendar_events` 表，`source: "ai_discovered"`，`status: "pending_review"`
- 编辑在日历灵感 Tab 中确认后 `status` 更新为 `"confirmed"`，拒绝则标记为 `"confirmed"` + soft delete（避免重复发现）

### 5.4 与热点列表的联动

- 日历事件在临近日期（提前 N 天）时，自动在「我的订阅」和「全部热点」tab 中以特殊卡片样式出现
- 点击日历事件卡片 → 右侧工作台展示该事件的深度创作灵感

---

## 6. 分类订阅与个性化

### 6.1 订阅管理

点击分类 Tab 栏右侧的 ⚙️ 按钮，弹出 Sheet：
- 内容分类多选（11 个标准分类）
- 日历事件类型多选（6 个事件类型）
- 订阅配置存储在用户级别（绑定 user_profile），每用户每组织一条记录（unique 约束 `userId + organizationId`）
- 支持同时订阅多个分类
- 并发更新采用 last-write-wins 策略，客户端保存时做 debounce

### 6.2 首次使用引导

新用户第一次进入灵感池时：
- 弹出引导弹窗："选择你关注的内容领域"
- 展示分类多选
- 可跳过（默认显示全部）
- 选择后直接保存，进入正常页面

---

## 7. 数据层变更

### 7.1 新增表

**`user_topic_subscriptions`** — 用户订阅配置
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID, PK | |
| userId | FK → user_profiles | |
| organizationId | FK → organizations | |
| subscribedCategories | JSONB | 如 `["科技","时政"]` |
| subscribedEventTypes | JSONB | 如 `["节日","发布会"]` |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**`user_topic_reads`** — 已读状态追踪（每用户每组织一条记录）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID, PK | |
| userId | FK → user_profiles | |
| organizationId | FK → organizations | |
| lastViewedAt | timestamp | 每次打开灵感池时更新 |
| readTopicIds | JSONB | 已读热点 ID 数组，如 `["uuid1","uuid2"]` |
| updatedAt | timestamp | |

- **唯一约束**：`unique(userId, organizationId)`，每用户每组织仅一条记录
- **已读判断逻辑**：热点 `id` 存在于 `readTopicIds` 数组中 → 已读；不存在 → 未读
- **标记已读**：`markAsRead(topicIds)` 将新 ID 追加到 `readTopicIds` 数组（使用 Drizzle 的 JSONB `||` 操作符合并，去重）
- **一键全部已读**：将当前 tab 可见的所有热点 ID 批量追加到 `readTopicIds`
- **数据清理**：`readTopicIds` 中超过 7 天的热点 ID 在每次写入时自动清理（与 hot_topics 的 discoveredAt 比对），防止数组无限增长

**`calendar_events`** — 日历灵感事件
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID, PK | |
| organizationId | FK → organizations | |
| name | text | 事件名称 |
| category | text | 复用 11 个标准分类 |
| eventType | enum | festival, competition, conference, exhibition, launch, memorial |
| startDate | date | 开始日期 |
| endDate | date | 结束日期 |
| isAllDay | boolean | 默认 true |
| recurrence | enum | once, yearly, custom |
| source | enum | builtin, manual, ai_discovered |
| status | enum | confirmed, pending_review |
| aiAngles | JSONB | AI 生成的角度建议数组 |
| reminderDaysBefore | integer | 默认 3 |
| createdBy | FK → user_profiles, nullable | 系统内置则为 null |
| createdAt | timestamp | |
| updatedAt | timestamp | |

### 7.2 现有表扩展

**`hot_topics` 新增字段：**
| 字段 | 类型 | 说明 |
|------|------|------|
| enrichedOutlines | JSONB | 角度大纲数组，见下方类型定义 |
| relatedMaterials | JSONB | 素材聚合数组，见下方类型定义 |

**`enrichedOutlines` 类型定义：**
```typescript
Array<{
  angle: string          // 角度名称，如 "技术突破深度解读"
  points: string[]       // 4-5 个内容要点
  wordCount: string      // 建议篇幅，如 "2000-3000"
  style: string          // 内容风格，如 "deep_report" | "quick_news" | "opinion" | "data_analysis"
}>
```

**`relatedMaterials` 类型定义：**
```typescript
Array<{
  type: "report" | "data" | "comment"  // 相关报道 | 可引用数据 | 热门评论
  title: string                         // 素材标题/摘要
  source: string                        // 来源（媒体名/平台名）
  url?: string                          // 原文链接（可选）
  snippet: string                       // 内容片段
}>
```

**素材聚合数据来源**：在 `hot-topic-enrichment.ts` AI enrichment 阶段生成。AI 基于热点标题和摘要，生成结构化的相关报道线索、数据点和评论观点。数据为 AI 推理生成（非实时爬取），持久化到 `relatedMaterials` 字段，与热点一起返回给前端。

### 7.3 DAL 变更

| 函数 | 变更类型 | 说明 |
|------|---------|------|
| `getInspirationTopics(orgId, userId)` | 修改 | 增加 userId 参数，返回附带 isRead 字段 |
| `getUserSubscriptions(userId)` | 新增 | 返回订阅配置 |
| `markTopicsAsRead(userId, topicIds)` | 新增 | 更新已读状态 |
| `updateLastViewedAt(userId)` | 新增 | 更新最后查看时间 |
| `getCalendarEvents(orgId, dateRange)` | 新增 | 查询日期范围内的事件 |
| `getNewTopicsSince(orgId, since)` | 新增 | 轮询用，返回新增数量和最高优先级 |
| `getEditorialMeeting(topics, monitors, lastViewedAt)` | 修改 | 增加 lastViewedAt 参数，生成变化 delta 摘要 |

### 7.4 Server Actions 变更

| 函数 | 变更类型 | 说明 |
|------|---------|------|
| `updateSubscriptions(categories, eventTypes)` | 新增 | 保存订阅 |
| `markAsRead(topicIds)` | 新增 | 标记已读 |
| `markAllAsRead()` | 新增 | 一键全部已读 |
| `createCalendarEvent(data)` | 新增 | 手动添加日历事件 |
| `confirmCalendarEvent(eventId)` | 新增 | 确认 AI 发现的事件 |
| `rejectCalendarEvent(eventId)` | 新增 | 拒绝 AI 发现的事件 |
| `triggerHotTopicCrawl()` | 修改 | enrichment 增加大纲和素材聚合生成 |

### 7.5 AI Enrichment 管线扩展

修改文件：`src/inngest/functions/hot-topic-enrichment.ts`

当前 enrichment 生成：category, summary, trend, angles, sentiment

**新增 3 个生成步骤**（在现有步骤之后，同一个 Inngest function 内）：

**① 角度大纲生成**
- 输入：热点 title, category, summary, 现有 angles
- 输出：`enrichedOutlines` JSONB（每个 angle 扩展为 `{ angle, points[], wordCount, style }`）
- 持久化到 `hot_topics.enrichedOutlines`

**② 素材聚合生成**
- 输入：热点 title, summary, category, platforms
- 输出：`relatedMaterials` JSONB（AI 推理生成相关报道线索、数据点、评论观点）
- 持久化到 `hot_topics.relatedMaterials`
- 注意：这些素材是 AI 基于上下文推理生成的结构化建议，非实时网页爬取

**③ 日历事件识别**
- 输入：热点 title, summary
- 判断：标题是否包含事件信号词（"倒计时"、"即将开幕"、"X月X日举办"、"第N届"等）
- 如果识别到候选事件：写入 `calendar_events` 表（`source: "ai_discovered"`, `status: "pending_review"`）
- 同时为候选事件生成 2-3 个 AI 角度建议，存入 `aiAngles` 字段

**日历事件 AI 角度生成**（也在同一管线中）：
- 手动创建的日历事件保存后，触发 `hot-topics/enrich-requested` 事件（附带 `calendarEventId`）
- enrichment 管线检测到 `calendarEventId` 时，走日历事件角度生成分支（prompt 模板与热点不同，侧重事件背景、历史数据、预热选题）

### 7.6 SQL 迁移

迁移脚本通过 Drizzle ORM 的 `npm run db:generate` 生成，确保：
- 字段类型、外键约束、默认值、枚举定义完整
- 新增表的 `unique` 约束正确（`user_topic_reads` 和 `user_topic_subscriptions` 的 userId+orgId）
- JSONB 字段有合理的默认值（`default '[]'`）
- 执行 `npm run db:push` 前先在本地验证 schema 无误

---

## 8. 跨模块联动

### 8.1 启动追踪 → AI 任务中心

灵感池最核心的出口动作。**扩展现有** `startTopicMission()` 函数（位于 `src/app/actions/hot-topics.ts`），在现有签名基础上增加可选的 `selectedAngle` 参数：

1. 编辑点击「启动追踪」
2. 调用 `startTopicMission(topicId, selectedAngle?)`
3. 创建 Mission 记录（扩展现有 sourceContext）：
   - `sourceModule: "inspiration"`
   - `sourceContext`: 在现有字段（title, heatScore, platforms）基础上新增：
     - `selectedAngle?: string` — 编辑选中的角度名称
     - `selectedOutline?: string[]` — 该角度的大纲要点
   - `scenario`: P0 → `"breaking_news"`（快讯模式），P1/P2 → `"deep_report"`（深度模式）—— 沿用现有逻辑
4. 进入 AI 任务中心，Leader 自动分解子任务（素材采集 → 内容撰写 → 质量审核 → 渠道分发）
5. 灵感池内该热点状态变为「已追踪」，显示任务进度链接（复用现有 `missionId` 关联）

如果编辑未选择角度直接追踪，则不传 `selectedAngle`，沿用现有行为。「一键追踪全部 P0」批量执行以上流程，每条热点使用默认角度（第一个 AI 建议角度）。

### 8.2 加入选题策划会素材

将热点信息保存到编辑个人的收藏列表，编前会时可以打开收藏列表作为讨论素材。轻量实现，不需要复杂协作机制。

---

## 9. 页面初始化流程

```
编辑打开灵感池
    │
    ├→ 并行请求：
    │   · getInspirationTopics(orgId, userId) — 热点 + 已读状态
    │   · getUserSubscriptions(userId) — 订阅配置
    │   · getCalendarEvents(orgId, next30days) — 日历事件
    │   · getPlatformMonitors(orgId) — 平台状态
    │
    ├→ 计算 AI 变化摘要（基于 lastViewedAt 的 delta）
    │
    ├→ 更新 lastViewedAt 为当前时间
    │
    └→ 渲染：摘要条 + 默认tab(我的订阅) + 右侧编辑简报
```

首次使用时弹出引导弹窗让编辑选择订阅分类。

---

## 10. 涉及文件清单

### 需要重写
- `src/app/(dashboard)/inspiration/inspiration-client.tsx` — 从 P0/P1/P2 布局重构为双面板
- `src/app/(dashboard)/inspiration/page.tsx` — 数据获取逻辑调整

### 需要新增
- `src/db/schema/calendar-events.ts` — 日历事件表
- `src/db/schema/user-topic-subscriptions.ts` — 用户订阅表
- `src/db/schema/user-topic-reads.ts` — 已读状态表
- `src/lib/dal/calendar-events.ts` — 日历事件查询
- `src/lib/dal/topic-subscriptions.ts` — 订阅查询
- `src/lib/dal/topic-reads.ts` — 已读状态查询
- `src/app/actions/calendar-events.ts` — 日历事件 actions
- `src/app/actions/topic-subscriptions.ts` — 订阅 actions
- `src/app/actions/topic-reads.ts` — 已读状态 actions
- `src/app/api/inspiration/new-topics/route.ts` — 轮询接口
- `src/data/calendar-seed.ts` — 内置日历事件种子数据

### 需要修改
- `src/db/schema/hot-topics.ts` — 新增 enrichedOutlines, relatedMaterials 字段
- `src/db/schema/enums.ts` — 新增 eventType, recurrence, calendarSource, calendarStatus 枚举
- `src/lib/dal/hot-topics.ts` — getInspirationTopics 增加 userId/isRead，getEditorialMeeting 增加 delta
- `src/app/actions/hot-topics.ts` — enrichment 扩展
- `src/inngest/functions/hot-topic-enrichment.ts` — 增加大纲、素材、日历事件识别
- `src/lib/types.ts` — 新增/修改类型定义
- `supabase/migrations/` — Drizzle 生成的迁移脚本
