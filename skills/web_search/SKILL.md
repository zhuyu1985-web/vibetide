---
name: web_search
displayName: 全网搜索
description: 面向新闻策划、热点追踪、事实核查、竞品调研四大场景的实时全网检索能力。通过 Tavily API 进行跨全网精准搜索，Tavily 不可用时自动降级到 Google News / Bing News RSS 聚合通道，保证检索链路不中断。对召回结果做 URL 规范化去重、标题相似度合并、来源六级可信度分级（央媒 / 官方 / 行业垂直 / 主流新闻 / 社交 UGC / 营销水军）、时效性+权威性+关键词匹配度综合排序，并对高频标题做热点聚类。支持按时间范围（1h / 24h / 7d / 30d）、来源类型、黑名单域、话题类型（general / news / finance）多维筛选。当用户提及"搜一下""查最新""某话题全网怎么说""最近有什么动态""找相关报道"等关键词时调用；不用于单 URL 正文抓取或平台热榜主动发现。
version: "3.2"
category: data_collection

metadata:
  skill_kind: data_collection
  scenario_tags: [hot-topic, research, fact-check, competitor]
  compatibleEmployees: [xiaolei, xiaoce, xiaowen, xiaoshen, xiaozi]
  modelDependency: none
  requires:
    env: [TAVILY_API_KEY]
    knowledgeBases: []
    dependencies: [web_deep_read]
  implementation:
    scriptPath: src/lib/agent/tools/web-search.ts
    testPath: src/lib/agent/__tests__/
  openclaw:
    referenceSpec: docs/superpowers/specs/2026-04-19-skill-md-baoyu-standardization.md
---

# 全网搜索（web_search）

你是实时信息检索专家，负责在最新、最全、最权威三个维度做平衡，为新闻策划、热点追踪、事实核查、竞品分析提供结构化的全网检索结果。核心信条：**来源可信度 > 结果数量**——宁可少而精，不要多而杂。

## 使用条件

✅ **应调用场景**：
- 热点验证：拿到热榜话题后，全网搜索看有没有主流媒体跟进报道
- 话题追踪：某个具体事件 / 政策 / 公司动态的最新进展
- 事实核查：验证数据、专家言论、公司声明是否真实
- 竞品调研：搜索竞品账号 / 竞品内容 / 行业动态
- 选题灵感：围绕一个关键词扫描最近 24-48h 有没有可做的切口

❌ **不应调用场景**：
- 已经拿到具体 URL 要读完整正文 → `web_deep_read`
- 想看各平台实时热榜 → `trending_topics`
- 想从组织内部知识库检索 → `knowledge_retrieval`
- 想从组织媒资库检索 → `media_search`
- 需要结构化去重新闻列表 → `news_aggregation`（更专业的聚合与评分）

**前置条件**：
- 优先使用 `TAVILY_API_KEY`（通用 / news / finance 三种 topic）；未配置时降级为 Google News / Bing News RSS
- 单次调用 `maxResults` 默认 8，最大 20，超过应拆多次调用
- `timeRange` 默认 24h，追热点推荐 1h / 6h，做背景调研用 7d / 30d

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| query | string | ✓ | 搜索词 / 自然语言问题 / 主题方向（中英文皆可） |
| timeRange | enum | ✗ | `1h` / `24h` / `7d` / `30d` / `all`，默认 `24h` |
| sources | string[] | ✗ | 来源过滤：`央媒` / `官方` / `行业媒体` / `新闻媒体` / `社交` |
| maxResults | int | ✗ | 返回条数，默认 8，最大 20 |
| topic | enum | ✗ | `general` / `news` / `finance`（仅 Tavily 通道） |
| excludeDomains | string[] | ✗ | 黑名单域名，过滤劣质站点 |

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| summary | string | 查询摘要 + 核心结论（60-120 字） |
| generatedAt | string | ISO 时间戳 |
| channel | enum | `tavily` / `rss` |
| returnedCount | int | 实际返回条数（去重后） |
| hotTopics | `{topic, level, representativeTitle, sources[]}[]` | 从多条结果聚类的热点主题 |
| results | `{title, snippet, url, source, sourceType, credibility, publishedAt, score}[]` | 详细结果列表 |
| warnings | string[] | 降级 / 限流 / 超时提示 |

完整 Zod Schema 见 [src/lib/agent/tools/web-search.ts](../../src/lib/agent/tools/web-search.ts) 导出。

## 工作流 Checklist

- [ ] Step 0: `query` 非空校验 + 长度限制（≤ 150 字符）
- [ ] Step 1: 意图识别 —— 判断是「找最新动态」「热点聚类」还是「具体事实情报」
- [ ] Step 2: 选通道 —— Tavily 优先；配额不足 / 超时 → Google / Bing News RSS
- [ ] Step 3: 多源并发检索（Tavily 单次；RSS 可并发 3 源）
- [ ] Step 4: 结果去重 —— 基于 URL 规范化 + 标题 80% 相似度合并
- [ ] Step 5: 来源分级 + 可信度打分（见 §5）
- [ ] Step 6: 热点聚类 —— 标题 Jaccard 相似 > 0.4 聚为一组，≥ 3 组视为"热点"
- [ ] Step 7: 时效性 / 相关性 / 来源权威性综合排序
- [ ] Step 8: 摘要生成 —— 对 Top N 结果的 snippet 合成 60-120 字总结
- [ ] Step 9: 失败兜底 —— 所有通道失效时返回空 results + 明确 warnings

## 来源分级 / 可信度

| 级别 | 域名范例 | 可信度 | 用途 |
|------|---------|-------|------|
| S · 央媒 | `xinhuanet` / `people.cn` / `cctv` / `gov.cn` | 95-100 | 政策 / 权威事实 |
| A · 官方 | 企业官网 / 官方公告 / 交易所披露 | 90-95 | 公司声明 |
| B · 行业垂直 | `caixin` / `36kr` / `huxiu` / `tmtpost` | 80-90 | 行业分析 |
| C · 主流新闻 | `thepaper` / `jiemian` / `yicai` | 70-85 | 快讯 / 快评 |
| D · 社交 / UGC | 知乎专栏 / 微博长文 / 公众号 | 40-70 | 观点 / 补充 |
| F · 营销 / 水军 | 自动聚合站 / 纯 SEO 站 | < 40 | **降权或过滤** |

**排序权重**：来源分级 40% + 时效性 30% + 关键词匹配 20% + 跨源出现次数 10%。

## 质量把关

**自检阈值表：**

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | 结果去重率 | 相似度 > 0.8 的必须合并 |
| 2 | 央媒 / 官方占比 | 政策类查询 ≥ 30% |
| 3 | 时效性 | `1h` / `24h` 模式下首条 `publishedAt` 在窗口内 |
| 4 | 摘要长度 | 60-120 字，含数据点或主体行动 |
| 5 | URL 合法 | 100% `http://` 或 `https://` |
| 6 | 热点聚类 | ≥ 3 条同主题才报 hotTopic |
| 7 | 营销站过滤 | 黑名单域 100% 剔除 |

**Top-5 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---------|------|----------|
| 营销软文混入 | 返回含 "代写 / 代发" 的 SEO 农场站 | 维护 excludeDomains 黑名单；credibility < 40 自动丢弃 |
| 时间范围失效 | `timeRange=1h` 却返回前年结果 | Tavily 的 `days` 参数校准；RSS 通道本地过滤 |
| 标题雷同合并不足 | 相同话题 5 条并列 | 标题去标点 + Jaccard；命中阈值强制合并 |
| 关键词过泛 | `query="AI"` 返回一锅粥 | 自动扩展"最新 / 发布 / 政策"等时效词 |
| 外文结果占比过高 | 中文查询返回大量英文新闻 | Tavily 通道加 `lang=zh-CN`；RSS 用中文源 |

## 输出示例

```markdown
## 全网搜索摘要

- 查询：国务院 生成式AI管理条例
- 检索时间：2026-03-17 14:50
- 通道：tavily
- 结果数：8
- 核心结论：国务院 3 月 17 日正式颁布《生成式人工智能管理条例》，共 8 章 52 条，明确 AI 生成内容强制标识，2026-07-01 施行。主流央媒及财经媒体已全面跟进。

## 热点话题

1. **AI 生成内容强制标识**（高）
   - 代表标题：国务院：AI 生成内容必须添加可识别标识
   - 关联来源：新华社 / 人民日报 / 经济日报 / 财新

2. **AI 服务分级分类**（中）
   - 代表标题：条例配套细则：AI 大模型上线需通过安全评估
   - 关联来源：经济日报 / 科技日报

## 详细结果

### 1. 国务院发布《生成式人工智能管理条例》
- 来源：新华社（S · 央媒 / 98）
- 发布时间：2026-03-17 10:00
- 摘要：国务院正式颁布《生成式人工智能管理条例》……
- 链接：https://xinhuanet.com/...

### 2. 专家解读：新规对 AI 创业公司影响
- 来源：财新网（B · 行业垂直 / 85）
- 发布时间：2026-03-17 13:15
- 摘要：……
- 链接：https://caixin.com/...

## 告警 / 备注

- Tavily 返回 8 条，其中 2 条相似度 > 0.8 合并
- 黑名单剔除 1 条自动聚合站
```

## EXTEND.md 示例

```yaml
default_time_range: "24h"
default_max_results: 8
default_topic: "news"

# 来源黑名单（低质聚合站 / 内容农场）
exclude_domains:
  - "example-seo-farm.com"
  - "auto-news-aggregator.cn"

# 领域偏好（query 命中关键词时自动加 sources 过滤）
domain_bias:
  finance: ["央媒", "官方", "行业媒体"]
  tech: ["行业媒体", "新闻媒体"]
  entertainment: ["新闻媒体", "社交"]

# 可信度硬门槛
min_credibility: 40
```

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 返回的都是几天前的老新闻 | `timeRange` 默认 24h 但站点时间标错 | 强制按 `publishedAt` 过滤；无时间戳一律置后 |
| Tavily 配额耗尽 | 当月额度用完 | 自动降级 RSS；warnings 提醒运营提额 |
| 结果太少 (< 3) | 查询过窄 / 英文词中文市场少 | 放宽 `timeRange` 到 7d；`sources` 置空再搜 |
| 返回的标题和 snippet 语言不一致 | 多语站点返回翻译版 | 识别主语言做过滤；支持指定 `lang` |
| 专业数据点要精确原文 | 搜索结果 snippet 太短 | Top 2 结果再调 `web_deep_read` 抓完整正文 |
| 想要结构化新闻聚合 | 本技能更偏"快速扫" | 走 `news_aggregation`（去重 + 价值评分更专业） |

## 上下游协作

- **上游**：`trend_monitor` 输出的热点关键词、人工粘贴的话题、选题策划的选题草稿
- **下游**：`web_deep_read` 对 Top 结果抓完整正文；`news_aggregation` 做结构化聚合；`fact_check` 基于命中结果核查；`content_generate` 用搜到的 snippet 做背景；`case_reference` 挑爆款入库

## 参考资料

- 代码实现：[src/lib/agent/tools/web-search.ts](../../src/lib/agent/tools/web-search.ts)（Tavily + RSS 双通道）
- Tavily 文档：<https://tavily.com/docs> —— `/search` 端点，支持 topic / time_range / exclude_domains
- 历史版本：`git log --follow skills/web_search/SKILL.md`

- **媒体行业专业标准（共享）**：[../../docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)
