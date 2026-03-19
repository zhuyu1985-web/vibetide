# 全网搜索技能深化设计

## 需求背景

小雷（热点猎手）绑定的"全网搜索"技能当前仅通过 Google News / Bing News RSS feed 获取信息，存在四个核心问题：

1. **搜不全** — 只有新闻类结果，无法覆盖知乎、公众号、行业报告等非新闻内容
2. **看不深** — 只有 RSS 摘要，无法获取文章正文做深度分析
3. **追不到热点** — 只能从搜索结果被动聚类，无法主动感知全网热点
4. **不实时** — RSS 更新有延迟，无法反映分钟级热点变化

## 设计目标

将单一 `web_search` 工具升级为 3 个互相配合的工具，形成"搜索 → 验证 → 深读"的完整信息获取链路，让小雷能真正做到全网信息感知。

## 架构总览

```
┌──────────────────────────────────────────────────────┐
│                Agent (小雷 / 小策)                      │
│                                                        │
│  调用 3 个工具：                                         │
│  ├── web_search        全网搜索（增强版）                  │
│  ├── web_deep_read     网页正文深读（新增）                │
│  └── trending_topics   热榜主动发现（新增）                │
└──────────────────────────────────────────────────────┘
         │                │                │
         ▼                ▼                ▼
   ┌──────────┐    ┌──────────┐    ┌────────────────┐
   │ Tavily   │    │ Jina     │    │ 可配置热榜 API  │
   │ Search   │    │ Reader   │    │ (TopHub 等)    │
   │ API      │    │ API      │    │                │
   ├──────────┤    ├──────────┤    ├────────────────┤
   │ 降级:     │    │ 降级:     │    │ 降级:          │
   │ RSS 聚合  │    │ fetch +  │    │ cheerio 解析   │
   │ (现有逻辑) │    │ cheerio  │    │ 公开热榜页面    │
   └──────────┘    └──────────┘    └────────────────┘
```

## 工具详细设计

### 工具 1：`web_search`（增强现有）

**解决问题：** 搜不全

| 项 | 说明 |
|---|---|
| 主通道 | Tavily Search API (`search_depth: "advanced"`, `include_answer: true`) |
| 降级通道 | 保留现有 Google News + Bing News RSS 逻辑 |
| 切换逻辑 | 有 `TAVILY_API_KEY` → Tavily；无 → RSS |
| 搜索范围 | 中文互联网为主 |
| 新增参数 | `topic`: 可选，"general" / "news" / "finance"，透传 Tavily |
| 输出增强 | Tavily 结果自带 `answer`（AI 摘要）+ `content`（页面摘要） |

**输入 Schema：**

```typescript
{
  query: string;           // 搜索关键词
  timeRange?: "1h" | "24h" | "7d" | "30d" | "all";  // 默认 24h
  sources?: string[];      // 来源过滤
  maxResults?: number;     // 默认 8，最大 20
  topic?: "general" | "news" | "finance";  // 新增：搜索类型
}
```

**输出结构不变，** 保持与现有 `web_search` 输出兼容。

### 工具 2：`web_deep_read`（新增）

**解决问题：** 看不深

| 项 | 说明 |
|---|---|
| 用途 | Agent 对搜索结果中重要 URL 做正文抓取 + 内容提取 |
| 主通道 | Jina Reader API (`https://r.jina.ai/{url}`) |
| 降级通道 | 直接 fetch + cheerio 提取 `<article>` / `<main>` 正文 |
| 切换逻辑 | 有 `JINA_API_KEY` → Jina Reader；无 → cheerio |
| 调用场景 | Agent 自主判断搜索结果中哪些需要深读 |

**输入 Schema：**

```typescript
{
  url: string;             // 必填，要深读的网页 URL
  maxLength?: number;      // 可选，正文截断字数，默认 3000
}
```

**输出 Schema：**

```typescript
{
  title: string;           // 页面标题
  content: string;         // 提取的正文（Markdown）
  wordCount: number;       // 正文字数
  extractedAt: string;     // 抓取时间 ISO
  source: string;          // 域名
  success: boolean;
  error?: string;          // 失败原因
}
```

### 工具 3：`trending_topics`（新增）

**解决问题：** 追不到热点 + 不实时

| 项 | 说明 |
|---|---|
| 用途 | 主动聚合各平台实时热榜 |
| 主通道 | 可配置的第三方热榜聚合 API（通过环境变量指定） |
| 降级通道 | cheerio 解析公开热榜页面 |
| 切换逻辑 | 有 `TRENDING_API_URL` → API；无 → 降级 |
| 响应映射 | 通过 `TRENDING_RESPONSE_MAPPING` 环境变量配置 JSON 映射 |

**输入 Schema：**

```typescript
{
  platforms?: string[];    // 可选，过滤平台：weibo/zhihu/baidu/douyin/36kr
  limit?: number;          // 每个平台返回条数，默认 20
}
```

**输出 Schema：**

```typescript
{
  fetchedAt: string;
  platforms: string[];
  topics: {
    platform: string;      // 来源平台
    rank: number;          // 排名
    title: string;         // 话题标题
    heat: number | string; // 热度值
    url: string;           // 链接
    category?: string;     // 分类
  }[];
  crossPlatformTopics: {   // 跨平台同话题聚合
    title: string;
    platforms: string[];
    totalHeat: number;
    verified: boolean;     // Agent 可通过 web_search 验证后标记
  }[];
}
```

**响应映射配置格式（`TRENDING_RESPONSE_MAPPING`）：**

```json
{
  "dataPath": "data.items",
  "fields": {
    "platform": "source",
    "rank": "position",
    "title": "name",
    "heat": "hot_value",
    "url": "link",
    "category": "type"
  }
}
```

## 环境变量

```env
# 全网搜索 - Tavily Search API
TAVILY_API_KEY=tvly-...

# 网页深读 - Jina Reader API
JINA_API_KEY=jina_...

# 热榜聚合 - 可配置 API
TRENDING_API_URL=https://api.example.com/trending
TRENDING_API_KEY=...
TRENDING_RESPONSE_MAPPING={"dataPath":"data","fields":{"platform":"source","rank":"rank","title":"title","heat":"heat","url":"url","category":"category"}}
```

## Agent 典型工作流

```
trending_topics → 发现"某话题"正在多平台爆发
       ↓
web_search "某话题" → 搜索相关新闻和文章，交叉验证热点真实性
       ↓
web_deep_read top N URL → 深读核心文章正文
       ↓
输出：有数据支撑的热点分析报告
```

## 降级策略

| 工具 | 有 API Key | 无 API Key |
|---|---|---|
| `web_search` | Tavily API（全网页搜索） | RSS 聚合（仅新闻） |
| `web_deep_read` | Jina Reader（可靠提取） | fetch + cheerio（尽力提取） |
| `trending_topics` | 第三方聚合 API（实时） | cheerio 解析公开页面（有延迟） |

## 员工绑定

| 工具 | 绑定员工 |
|---|---|
| `web_search` | 小雷（已有）、小策（已有） |
| `web_deep_read` | 小雷、小策 |
| `trending_topics` | 小雷、小策 |

## 代码变更范围

| 文件 | 变更 |
|---|---|
| `src/lib/agent/tool-registry.ts` | 增强 `web_search`（Tavily 主通道 + RSS 降级）；新增 `web_deep_read`、`trending_topics` 实现 |
| `skills/web_search/SKILL.md` | 更新技能文档，覆盖三个工具的能力和执行流程 |
| `src/lib/constants.ts` | `BUILTIN_SKILLS` 更新版本描述；`READ_ONLY_TOOL_NAMES` 添加 `web_deep_read`、`trending_topics`；`EMPLOYEE_CORE_SKILLS` 小雷和小策添加新工具 |
| `.env.example` | 添加 `TAVILY_API_KEY`、`JINA_API_KEY`、`TRENDING_API_URL`、`TRENDING_API_KEY`、`TRENDING_RESPONSE_MAPPING` |
| `package.json` | 新增 `cheerio` 依赖 |

## 质量标准

| 维度 | 要求 |
|---|---|
| 降级可靠性 | 每个工具在无 API Key 时都有可用的降级方案，不会报错 |
| 错误隔离 | 单个数据源失败不影响其他数据源返回结果 |
| 超时控制 | 所有外部请求 8-10s 超时，避免阻塞 Agent 执行 |
| 输出兼容 | `web_search` 增强后输出结构保持向后兼容 |
