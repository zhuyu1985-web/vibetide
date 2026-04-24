---
name: trending_topics
displayName: 热榜聚合（多平台实时版）
description: 聚合微博/百度/抖音/知乎/36Kr/哔哩哔哩/小红书/头条/微信等 10+ 主流平台实时热榜数据。识别跨平台同话题、去重合并、按综合热度排序。支持按平台过滤、时间窗口回溯、话题分类聚合。是热点发现 / 选题策划 / 种草文案的上游原料源。
category: data_collection
version: "3.0"

metadata:
  skill_kind: perception
  scenario_tags: [all_perception]
  compatibleEmployees: [xiaolei, xiaoce]
  modelDependency: none
  requires:
    env: [TRENDING_API_URL, TRENDING_API_KEY, TRENDING_RESPONSE_MAPPING]
    knowledgeBases: []
    dependencies: []
  implementation:
    scriptPath: src/lib/agent/tools/trending-topics.ts
    testPath: src/lib/agent/__tests__/

inputSchema:
  platforms: 平台过滤数组
  limit: 每平台返回条数
  timeWindowHours: 时间窗口（回溯N小时）
  categoryFilter: 类别过滤（科技/财经/娱乐/体育/时政/民生）
outputSchema:
  topics: 热榜数据（含 platform / rank / title / heat / url / category / discoveredAt）
  crossPlatformTopics: 跨平台聚合话题
  fetchedAt: 抓取时间戳
  coverage: 平台覆盖统计
runtimeConfig:
  type: api_call
  avgLatencyMs: 3000
  maxConcurrency: 3
compatibleRoles:
  - trending_scout
  - content_strategist
---

# 热榜聚合（trending_topics）

## 1. 使用条件

**应调用场景**：
- 每日热点简报（`daily_ai_brief` / `national_daily_brief`）的原料聚合
- 选题策划师（xiaoce）每日选题会的上游输入
- 种草 / 探店场景的热门话题发现
- 舆情监控 / 危机公关响应
- 同题漏题对标分析

**不应调用场景**：
- 单一平台搜索（走 `web_search` / `social_listening`）
- 深度话题调研（走 `web_deep_read`）
- 历史数据回溯超过 24 小时（热榜 API 通常只保留实时数据）

**前置条件**：
- `TRENDING_API_URL` + `TRENDING_API_KEY` 配置
- `TRENDING_RESPONSE_MAPPING` JSON 映射字段已定义
- 网络可达第三方热榜聚合服务

## 2. 支持的平台（2026 年 4 月清单）

| 平台 | 官方域名 | 热榜性质 | 更新频率 | 典型用途 |
|------|---------|---------|---------|---------|
| 微博 | weibo.com | 热搜榜 | 1 分钟 | 时政 / 娱乐 / 社会 |
| 百度 | baidu.com | 实时热点 | 10 分钟 | 综合 / 搜索热词 |
| 抖音 | douyin.com | 热搜榜 | 5 分钟 | 短视频话题 / 明星 |
| 今日头条 | toutiao.com | 热搜榜 | 1 分钟 | 资讯综合 |
| 知乎 | zhihu.com | 热榜 | 10 分钟 | 知识 / 科技 / 讨论 |
| 36Kr | 36kr.com | 热榜 | 30 分钟 | 创投 / 科技 |
| 哔哩哔哩 | bilibili.com | 全站日榜 | 1 天 | 二次元 / 游戏 / UP 主 |
| 小红书 | xiaohongshu.com | 热搜 | 1 小时 | 美妆 / 时尚 / 生活 |
| 澎湃 | thepaper.cn | 热榜 | 30 分钟 | 时政深度 |
| 微信 | weixin.qq.com | 24h 热文 | 1 小时 | 公众号阅读 |

## 3. 工作流 Checklist

- [ ] **Step 1**：按 `platforms` 参数构建并发 fetch 请求（默认全部 10 平台）
- [ ] **Step 2**：执行 Promise.all 并行抓取（`maxConcurrency=3` 节流）
- [ ] **Step 3**：响应字段按 `TRENDING_RESPONSE_MAPPING` 归一化为统一 schema
- [ ] **Step 4**：跨平台话题相似度匹配（标题 embedding + 关键词交集）
- [ ] **Step 5**：同话题合并，累加热度，记录覆盖平台列表
- [ ] **Step 6**：按综合热度降序输出 Top N
- [ ] **Step 7**：按 `categoryFilter` 过滤（如只要科技类）
- [ ] **Step 8**：写入 `hot_topics` 表（若 organizationId 上下文存在）

## 4. 跨平台话题识别算法

### 4.1 匹配维度

两个话题是否「同一事件」的 3 维判断：

1. **标题相似度**（权重 50%）
   - 计算两个标题的余弦相似度（字符 n-gram 或 embedding）
   - 阈值 ≥ 0.75 判定为同话题

2. **关键词交集**（权重 30%）
   - 提取每个标题的 Top 3 关键词
   - Jaccard 相似度 ≥ 0.5 判定为同话题

3. **时间窗口**（权重 20%）
   - 两个话题发布时间差 ≤ 2 小时
   - 超过 6 小时自动判定为「独立事件」

### 4.2 合并策略

匹配成功后：
- **标题**：取第一出现的平台标题（通常最早）
- **热度**：累加所有平台的 log-scaled heat
- **排名**：取各平台排名的加权平均（平台权重见 §5）
- **URL**：保留所有平台的 URL 数组
- **发现时间**：取最早的 discoveredAt

### 4.3 不要合并的情况

- 相似度 < 0.6：独立话题
- 话题被明显切分成多个角度（如事件主体 + 各方评论）
- 跨时代同名事件（如「双十一」不同年份）

## 5. 平台权重（综合排名计算）

| 平台 | 综合排名权重 | 理由 |
|------|------------|------|
| 微博 | 1.2 | 全网舆情风向标 |
| 百度 | 1.0 | 搜索意图最强 |
| 头条 | 1.0 | 资讯覆盖广 |
| 抖音 | 0.9 | 短视频主导 |
| 知乎 | 0.8 | 知识话题专业 |
| 36Kr | 0.7 | 创投垂类 |
| 哔哩哔哩 | 0.7 | 年轻人向 |
| 小红书 | 0.7 | 生活类垂直 |
| 澎湃 | 0.6 | 时政深度 |
| 微信 | 0.6 | 已读已转发 |

## 6. 输出结构

```json
{
  "topics": [
    {
      "rank": 1,
      "platform": "微博",
      "title": "OpenAI 发布 GPT-5 Turbo",
      "heat": 4823000,
      "heatLabel": "482.3 万",
      "url": "https://weibo.com/...",
      "category": "科技",
      "discoveredAt": "2026-04-20T08:15:00Z"
    }
  ],
  "crossPlatformTopics": [
    {
      "title": "OpenAI 发布 GPT-5 Turbo",
      "mergedHeat": 12500000,
      "platforms": ["微博", "百度", "头条", "抖音", "知乎", "36Kr"],
      "platformCount": 6,
      "rankings": {
        "微博": 1,
        "百度": 2,
        "头条": 3,
        "抖音": 5,
        "知乎": 1,
        "36Kr": 1
      },
      "urls": ["https://weibo.com/...", "https://baidu.com/...", "..."],
      "category": "科技",
      "weightedRank": 2.17,
      "firstDiscoveredAt": "2026-04-20T08:15:00Z"
    }
  ],
  "fetchedAt": "2026-04-20T12:00:00Z",
  "coverage": {
    "requestedPlatforms": 10,
    "successfulPlatforms": 9,
    "failedPlatforms": ["澎湃"],
    "totalTopics": 190,
    "crossPlatformTopicsCount": 12
  }
}
```

## 7. 质量把关

### 自检清单

- [ ] 所有请求平台至少 80% 有数据（低于则报告降级）
- [ ] 跨平台聚合命中 ≥ 5 条（全网热点应有跨平台共鸣）
- [ ] Top 10 话题时间戳都在 `timeWindowHours` 内
- [ ] 无重复话题（合并后）
- [ ] 分类标签准确率 ≥ 80%（LLM 或规则分类）

### Top-3 失败模式

| 失败 | 表现 | 修正 |
|------|------|------|
| API 超时 / 频控 | 某平台连续 3 次失败 | 降级跳过该平台，其他平台照常；failedPlatforms 里记录 |
| 跨平台过度合并 | 两个不同事件错误合并（相似度判断失误） | 提高阈值到 0.85；关键词交集 ≥ 2 个 |
| 广告 / 营销号污染 | 热度数据被刷单 | 与 7 天平均对比，单日涨幅 > 10 倍标记「存疑」 |

## 8. 合规红线

- **政治敏感话题**：热榜中的政治敏感词按网信办负面词清单扫描；命中话题**保留但标记**，不自动推送到内容生成工作流
- **涉疫 / 涉军 / 涉外**：需二次审核才能进入 content_generate 链路
- **未成年人**：涉未成年人真实姓名的话题自动脱敏处理
- **虚假热点**：热度异常（单日涨幅 > 10 倍）话题需要人工复核（可能是刷单）

详见 [docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)。

## 9. EXTEND.md 示例

```yaml
trending_config:
  default_platforms: [微博, 百度, 头条, 抖音, 知乎]
  default_limit: 20
  default_time_window_hours: 2

platform_weights:
  微博: 1.5           # 业务更重视微博
  澎湃: 0.3           # 本地媒体降权

category_aliases:
  科技: [科技, AI, 人工智能, 互联网, 大模型]
  财经: [财经, 经济, 股市, 基金]

cross_platform_config:
  similarity_threshold: 0.75
  merge_time_window_hours: 2
  ignore_platforms: [哔哩哔哩]   # 某些平台不参与跨平台合并（如弹幕文化特殊）
```

## 10. 上下游协作

**上游触发方**：
- Inngest cron `collection-hot-topic-cron`：每 30 分钟自动触发
- xiaolei（热点分析师）的「每日热点监控」工作流
- xiaoce（选题策划师）的「每日选题会」第一步
- 用户手动 `/inspiration` 页面刷新

**下游消费方**：
- `news_aggregation`：进一步聚合分类 + 去重
- `topic_extraction`：提取可追踪选题
- `heat_scoring`：热度详细评分
- `content_generate`：作为热点上下文喂入 prompt
- `hot_topics` DB 表：持久化存储供 `/inspiration` 页面展示

## 11. 常见问题

**Q1：为什么跨平台话题数偶尔为 0？**
A：两种可能：① 某热门事件只在单一平台发酵（如 bilibili 独有）；② 相似度阈值太高。可以调低到 0.6。

**Q2：某平台持续失败怎么办？**
A：检查：① 平台 API 变更（对照 `TRENDING_RESPONSE_MAPPING`）；② `TRENDING_API_KEY` 过期；③ 频控限制。跳过该平台不影响其他。

**Q3：热度单位怎么统一？**
A：各平台热度单位不同（阅读量 / 互动数 / 搜索指数）。归一化策略：统一取 log10，然后按平台权重加权。UI 展示时仍用原单位（如「482.3 万」）。

**Q4：如何排除广告 / 营销话题？**
A：配置黑名单词（`TRENDING_BLACKLIST_KEYWORDS` env）；启动时自动过滤。典型黑名单：xx 节、xx 首发、xx 预售 等明显营销词。

## 12. 参考资料

- **平台热榜 API 规范**：[references/platform-ranking-specs.md](./references/platform-ranking-specs.md)（10 平台热榜 API 格式 + 归一化字段映射）
- **媒体行业规范**：[docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)（热点话题合规判定 / 负面词清单 / AI 时代虚假热点识别）
- 代码实现：[src/lib/agent/tools/trending-topics.ts](../../src/lib/agent/tools/trending-topics.ts)
- Collection Hub 适配器：[src/inngest/functions/collection](../../src/inngest/functions/collection)
- 历史版本：`git log --follow skills/trending_topics/SKILL.md`
