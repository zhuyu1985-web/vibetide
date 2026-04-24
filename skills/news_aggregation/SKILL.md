---
name: news_aggregation
displayName: 新闻聚合
description: 从 200+ 新闻源（央媒 / 地方媒体 / 行业垂直媒体 / 国际通讯社中文版）围绕主题做深度结构化聚合。完整流程含主题识别与查询扩展、多源并发检索、基于标题 + 正文向量的语义去重（相似度 0.85 自动合并同事件报道、保留权威性最高 + 字数最多版本）、五维价值评分（时效性 25% + 影响力 25% + 相关性 20% + 独家性 15% + 深度 15%）、综合评分排序、每条 100 字精炼摘要（含核心数据 + 关键行动 + 主要影响）、来源分布统计。输出含头条新闻、重要新闻列表、来源结构四大块。适合每日早报、政策追踪、专题策划、重大事件复盘、竞品扫描场景。当用户提及"聚合 / 汇总新闻""围绕 X 话题的全量报道""每日早报""政策追踪""新闻总结"时调用；不用于简单搜索或单条深度阅读。
version: "2.0"
category: data_collection

metadata:
  skill_kind: data_collection
  scenario_tags: [news, daily-brief, research, policy]
  compatibleEmployees: [xiaolei, xiaoce, xiaoshu, xiaozi]
  modelDependency: deepseek:deepseek-chat
  requires:
    env: [OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL, TAVILY_API_KEY]
    knowledgeBases: []
    dependencies: [web_search, web_deep_read]
  implementation:
    scriptPath: src/lib/agent/execution.ts
    testPath: src/lib/agent/__tests__/
  openclaw:
    referenceSpec: docs/superpowers/specs/2026-04-19-skill-md-baoyu-standardization.md
---

# 新闻聚合（news_aggregation）

你是专业新闻编辑，职责是从海量新闻源中**筛选 → 去重 → 评分 → 摘要 → 排序**，输出一份信息密度高、头条无争议、来源分布清晰的新闻聚合列表。核心信条：**价值 > 数量 · 去重 > 罗列 · 摘要要能替代原文做决策**。

## 使用条件

✅ **应调用场景**：
- 每日早报 / 每日简报：围绕领域（科技 / 财经 / 政策）聚合 15-30 条要闻
- 政策追踪：某条政策发布后，聚合全网 48h 内所有相关报道、解读、影响分析
- 专题策划：围绕选题方向（如"AI 监管"）拿到去重后的事实底盘
- 重大事件复盘：事件发生后 7-30 天窗口聚合全景报道
- 竞品动作扫描：某公司 / 某产品 / 某行业的最近所有媒体报道

❌ **不应调用场景**：
- 单次快速搜索（走 `web_search`，本技能更重、延迟更高）
- 实时热榜发现（走 `trend_monitor` / `trending_topics`）
- 单 URL 深度阅读（走 `web_deep_read`）
- 社交媒体舆情（走 `social_listening`）
- 组织内部知识库检索（走 `knowledge_retrieval`）

**前置条件**：`topic` 非空；LLM 可用（做摘要 + 五维评分）；Tavily 可用或 RSS 降级通道可用；单次聚合耗时 ~8-15s，不适合实时触发场景。

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| topic | string | ✓ | 聚合主题或关键词（如"人工智能监管政策"） |
| sources | string[] | ✗ | 限定来源类型：`央媒` / `地方` / `行业` / `国际`，默认全部 |
| timeRange | enum | ✗ | `1h` / `6h` / `24h` / `7d` / `30d`，默认 `24h` |
| limit | int | ✗ | 返回条数，默认 15，最大 50 |
| minCredibility | int | ✗ | 来源可信度下限，0-100，默认 40 |
| includeInternational | boolean | ✗ | 是否包含国际通讯社中文版，默认 `true` |

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| headline | `{title, source, publishedAt, score, summary, reportCount}` | 单条头条 |
| newsList | `{rank, title, source, publishedAt, score, reportCount, url}[]` | 重要新闻列表 |
| sourceStats | `{central[], local[], industry[], international[]}` | 来源分布 |
| totalReturned | int | 去重后条数 |
| deduplicated | int | 去重合并条数（统计用） |
| generatedAt | string | 聚合时间戳 |
| warnings | string[] | 源不足 / 降级 / 可信度问题提示 |

## 工作流 Checklist

- [ ] Step 0: `topic` 提取 —— 识别主体（机构 / 政策 / 产品）+ 动作 + 时间点
- [ ] Step 1: 查询扩展 —— 用同义词 / 缩写 / 关联实体扩成 3-5 条查询
- [ ] Step 2: 多源并发检索（Tavily + RSS + 白名单央媒站点），单源上限 30 条
- [ ] Step 3: 语义去重 —— 标题 + 正文前 300 字向量化，cosine ≥ 0.85 合并
- [ ] Step 4: 合并策略 —— 保留**来源权威度最高** + **字数最多**的版本，其他计入 `reportCount`
- [ ] Step 5: 五维价值评分（时效 25% + 影响力 25% + 相关性 20% + 独家 15% + 深度 15%）
- [ ] Step 6: 头条选取 —— 评分 Top 1，央媒或官方优先，争议事件标注"多方声音"
- [ ] Step 7: 摘要生成 —— 每条 100 字，包含**核心数据 + 关键行动 + 主要影响**
- [ ] Step 8: 来源分布统计（央媒 / 地方 / 行业 / 国际 各多少条）
- [ ] Step 9: 质量自检（见 §5）

## 五维价值评分模型

| 维度 | 权重 | 判定依据 |
|------|-----|---------|
| 时效性 | 25% | 距当前发布时间 ≤ 2h 满分；每 6h 衰减一档 |
| 影响力 | 25% | 涉事主体量级（国家政策 > 大型企业 > 中小企业 > 个人）+ 受众规模 |
| 相关性 | 20% | 标题 / 正文与 `topic` 的关键词覆盖度 + 语义相似度 |
| 独家性 | 15% | 首发媒体 / 独家访谈 / 独家数据加分；纯转载扣分 |
| 深度 | 15% | 字数 ≥ 1500 且含分析段落加分；纯快讯扣分 |

综合分 = Σ(维度分 × 权重)，归一化到 0-100。

## 质量把关

**自检阈值表：**

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | 去重合并率 | 同事件合并率 ≥ 95%（人工抽检） |
| 2 | 央媒覆盖 | 政策类主题央媒条数 ≥ 3 |
| 3 | 头条无争议 | 综合分第一且来源为 S/A 级 |
| 4 | 摘要含数据点 | ≥ 80% 条目摘要包含具体数字 / 百分比 |
| 5 | 来源分布 | 单一来源类型占比 ≤ 70%（避免全部央媒无视角） |
| 6 | 时间范围合规 | 全部 `publishedAt` 在 `timeRange` 内 |
| 7 | 可信度门槛 | 全部结果 credibility ≥ `minCredibility` |
| 8 | reportCount 准确 | 被合并的所有来源名都可见于 `sourceStats` |

**Top-5 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---------|------|----------|
| 同事件多角度被误合并 | 深度分析 + 快讯合并成一条 | 相似度在 0.75-0.85 保留为"相关报道"，不硬合并 |
| 突发更新覆盖旧稿 | 最新版本丢了首发时间 | 合并时保留首发 `firstPublishedAt` + 最新 `lastUpdatedAt` |
| 小众领域源不足（< 5 条） | 列表稀疏 | 扩展到二级关键词；warnings 标注"媒体关注度低" |
| 时区混乱 | 排序乱 | 统一 UTC+8；国际源标注原始时区 |
| 未经证实消息入头条 | 引入谣言 | 头条必须 S/A 级；可疑消息加 `unverified` 标签且降权 |

## 输出示例

```markdown
## 新闻聚合：人工智能监管政策
**更新时间**: 2026-03-17 16:00 | **来源**: 47 家媒体 | **去重后**: 18 条

### 头条新闻

**国务院发布《生成式人工智能管理条例》 明确AI内容标识制度**
- 来源：新华社 | 时间：2026-03-17 10:00 | 评分：96/100
- 摘要：国务院正式颁布《生成式人工智能管理条例》，共 8 章 52 条。明确所有 AI 生成内容必须添加可识别标识，建立 AI 服务分级分类管理制度，对违规企业最高处以年营收 5% 的罚款。条例将于 2026-07-01 起施行。
- 报道数量：34 家媒体报道

### 重要新闻

| 序号 | 标题 | 来源 | 时间 | 评分 | 报道量 |
|------|------|------|------|------|--------|
| 2 | 工信部配套细则征求意见：AI 大模型上线需通过安全评估 | 经济日报 | 03-17 11:30 | 89/100 | 22 家 |
| 3 | 专家解读：新规对 AI 创业公司影响几何 | 财新网 | 03-17 13:15 | 82/100 | 8 家 |
| 4 | 百度阿里腾讯回应：已启动内部合规审查 | 界面新闻 | 03-17 14:20 | 79/100 | 15 家 |
| 5 | 对比：中美欧三方 AI 监管路径差异 | 澎湃新闻 | 03-17 12:00 | 76/100 | 5 家 |
| 6 | 投资视角：AI 监管明确后哪些赛道受益 | 第一财经 | 03-17 14:45 | 73/100 | 6 家 |
| 7 | 信通院：已有 128 家企业完成 AI 服务备案 | 科技日报 | 03-17 09:00 | 70/100 | 11 家 |

### 来源分布
- 央媒：12 条（新华社 / 人民日报 / 经济日报 / 科技日报 等）
- 行业媒体：8 条（财新 / 界面 / 36氪 / 虎嗅 等）
- 地方媒体：4 条（北京日报 / 上海证券报 等）
- 国际媒体：2 条（路透中文 / 彭博中文）

### 告警
- 2 条可信度 < 40 的自动聚合站已过滤
```

## EXTEND.md 示例

```yaml
default_time_range: "24h"
default_limit: 15
default_min_credibility: 40

# 主题偏好 —— 命中关键词时自动加 sources
topic_bias:
  policy: ["央媒", "官方"]
  finance: ["央媒", "行业"]
  tech: ["行业", "新闻媒体"]

# 每日早报模式
daily_brief:
  limit: 25
  sources: ["央媒", "行业"]
  include_international: true

# 五维评分权重（可按业务侧重调）
score_weights:
  timeliness: 0.25
  impact: 0.25
  relevance: 0.20
  exclusivity: 0.15
  depth: 0.15
```

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 头条选的不是最权威的 | 评分模型权重不匹配业务 | 调 `score_weights`；政策类拉高 `impact` |
| 被合并的稿件找不到 | 合并后只显示代表 | `reportCount` 指向 `sourceStats` 的完整列表 |
| 国际源英文标题没翻译 | 直接透传 | 命中国际源时走标题 LLM 翻译；保留原文 |
| 突发事件总是排不上头条 | 时效性不足 | 调短 `timeRange`（1h/6h）；`timeliness` 权重临时升至 0.4 |
| 想看趋势变化 | 本技能是截面 | 配合 `trend_monitor` 做同比 / 环比 |
| 想进一步核查 | 聚合只给摘要 | Top 1-3 条调 `web_deep_read` + `fact_check` |

## 上下游协作

- **上游**：`trend_monitor` 识别的热点主题、选题策划产出的 `topic` 关键词、每日早报定时触发
- **下游**：`summary_generate` 做进一步浓缩；`content_generate` 用聚合结果当事实底盘；`case_reference` 挑爆款入库；`data_report` 出多主题周报

## 参考资料

- 代码实现：[src/lib/agent/execution.ts](../../src/lib/agent/execution.ts)
- **去重与事件归档规则**：[./references/deduplication-and-merging.md](./references/deduplication-and-merging.md)
- 历史版本：`git log --follow skills/news_aggregation/SKILL.md`

- **媒体行业专业标准（共享）**：[../../docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)
