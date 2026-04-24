---
name: topic_extraction
displayName: 主题提取
description: 从一段 / 一篇 / 一批文本中提取核心主题、关键词、命名实体、推荐 APP 栏目标签。输出含主题层级（一级大类 / 二级场景 / 三级角度）、关键词 TF-IDF 排序 + 语义权重、命名实体四类（人物 / 机构 / 地点 / 时间）、推荐栏目标签（对齐 9 大 APP 栏目 slug）、相关选题线索。支持单文 / 批量两种模式，批量可做主题聚类（把同类稿件归一）。当用户提及"这篇讲啥""抽关键词""栏目归类""打标签""相关选题""实体识别""主题聚类"等关键词时调用；不用于情感倾向（走 `sentiment_analysis`）或稿件改写（走 `style_rewrite`）。
version: "2.0"
category: content_analysis

metadata:
  skill_kind: analysis
  scenario_tags: [topic, tagging, entity, clustering]
  compatibleEmployees: [xiaoce, xiaowen, xiaoshu]
  modelDependency: deepseek:deepseek-chat
  requires:
    env: [OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL]
    knowledgeBases: []
    dependencies: []
  implementation:
    scriptPath: src/lib/agent/execution.ts
    testPath: src/lib/agent/__tests__/
  openclaw:
    referenceSpec: docs/superpowers/specs/2026-04-19-skill-md-baoyu-standardization.md
---

# 主题提取（topic_extraction）

你是选题策划师的副驾，从杂乱的素材文本里抓出核心主题、关键词、实体和适配栏目。核心信条：**主题可执行 > 关键词多**——"XX 公司裁员" 比 "裁员 公司 人员" 更能直接转成选题。

## 使用条件

✅ **应调用场景**：
- 选题策划阶段拿到一堆素材文本，快速归类抽主题
- CMS 入库前自动打栏目标签 / 关键词标签
- 素材入库自动抽实体建索引（人 / 机构 / 地点 / 时间）
- 批量文档主题聚类（如 100 条素材归到 10 大类）
- 稿件发布前补关键词 SEO meta

❌ **不应调用场景**：
- 要情感倾向 → `sentiment_analysis`
- 要热度趋势 → `heat_scoring`
- 要改写 → `style_rewrite`
- 要生成标题 → `headline_generate`（虽然也用关键词但目标不同）
- 纯翻译 → `translation`

**前置条件**：输入文本长度 ≥ 100 字；批量模式上限 500 条；LLM 可用；实体识别需领域词典支持（可选）。

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| text | string / string[] | ✓ | 单文或批量 |
| topN | int | ✗ | 关键词数量，默认 10 |
| includeEntities | boolean | ✗ | 是否提取实体，默认 `true` |
| includeTags | boolean | ✗ | 是否推荐 APP 栏目标签，默认 `true` |
| clusteringMode | enum | ✗ | `off` / `basic` / `hierarchical`，默认 `off` |
| language | enum | ✗ | `zh` / `en` / `auto`，默认 `auto` |

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| topics | `{label, level, confidence}[]` | 主题（含层级） |
| keywords | `{word, weight, pos?}[]` | 关键词 + 权重 |
| entities | `{person[], org[], place[], time[]}` | 命名实体 |
| tags | string[] | 推荐栏目标签（9 大 APP 栏目 slug） |
| clusters | `{cluster, members[], centerTopic}[]` | 聚类结果（clustering 开启时） |
| relatedAngles | string[] | 相关选题角度建议 |

## 工作流 Checklist

- [ ] Step 0: 文本清洗 + 分句 + 分词
- [ ] Step 1: TF-IDF 关键词初筛
- [ ] Step 2: LLM 主题识别（一级 / 二级 / 三级）
- [ ] Step 3: 命名实体识别（人 / 机构 / 地点 / 时间）
- [ ] Step 4: APP 栏目映射（主题 → app_news / app_politics / app_sports / ...）
- [ ] Step 5: 关键词精排（TF-IDF + 语义权重融合）
- [ ] Step 6: 聚类（批量模式，基于关键词向量）
- [ ] Step 7: 相关选题角度生成（3-5 条）
- [ ] Step 8: 结果去重 / 合并同义词
- [ ] Step 9: 质量自检（见 §5）

## APP 栏目映射表

| 主题特征 | 推荐栏目 slug |
|---------|--------------|
| 央媒 / 时政 / 政策 | `app_politics` |
| 突发 / 社会 / 民生 | `app_news` |
| 赛事 / 球队 / 冠军 | `app_sports` |
| 明星 / 综艺 / 晚会 | `app_variety` |
| 美食 / 探店 / 本地 | `app_livelihood_tandian` |
| 好物 / 种草 / 开箱 | `app_livelihood_zhongcao` |
| 访谈 / 深度 / 音频 | `app_livelihood_podcast` |
| 短剧 / 剧情 / 爽感 | `app_drama` |
| 不确定 / 综合 | `app_home` |

## 质量把关

**自检阈值表：**

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | topics 至少 1 条 | 100% |
| 2 | 关键词可执行 | "XX公司裁员" > "公司 裁员" |
| 3 | 实体类型齐全 | 4 类都尝试抽（无则空数组） |
| 4 | 栏目标签合法 | 100% 在 9 大 APP slug 内 |
| 5 | 聚类簇内语义一致 | 人工抽检一致率 ≥ 80% |
| 6 | 相关选题数 | 3-5 条 |
| 7 | 关键词去重 | 同义合并（如 "AI" / "人工智能"） |

**Top-5 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---------|------|----------|
| 关键词太碎 | 单字刷屏 "的 / 了 / 是" | 停用词 + 词性过滤 noun/vn/nz |
| 主题过泛 | "社会" / "新闻" | 主题至少二级（"社会-突发"） |
| 实体漏抽 | 人名只抽名不抽姓 | 全名优先；短名称标 `short_form` |
| 栏目乱标 | 体育稿标成 `app_news` | 映射表严格匹配 + LLM 兜底 |
| 聚类太散 | 100 条分 50 簇 | 设目标簇数；或用 hierarchical |

## 输出示例

```json
{
  "topics": [
    { "label": "人工智能-监管政策", "level": 2, "confidence": 0.92 },
    { "label": "政策-科技", "level": 1, "confidence": 0.88 }
  ],
  "keywords": [
    { "word": "生成式人工智能管理条例", "weight": 0.95 },
    { "word": "AI内容标识", "weight": 0.88 },
    { "word": "安全评估", "weight": 0.72 }
  ],
  "entities": {
    "person": [],
    "org": ["国务院", "工信部", "百度", "阿里", "腾讯"],
    "place": ["中国"],
    "time": ["2026-03-17", "2026-07-01"]
  },
  "tags": ["app_politics", "app_news"],
  "relatedAngles": [
    "条例对 AI 创业公司的影响",
    "中美欧 AI 监管对比",
    "AI 服务备案流程解读"
  ]
}
```

## EXTEND.md 示例

```yaml
default_top_n: 10
default_include_entities: true
default_include_tags: true

# 停用词（除通用中文停用词外）
extra_stopwords: ["的", "了", "在", "是", "和"]

# 自定义实体词典（高优先级）
entity_dict:
  org: ["华栖云传媒集团", "VibeTide"]

# 栏目映射微调
channel_bias:
  "政策": "app_politics"
  "明星": "app_variety"

# 聚类目标簇数
cluster_target_k: 10
```

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 关键词碎 | 停用词不全 | 补自定义停用词；POS 过滤 |
| 主题太笼统 | 未分层 | 强制输出二级以上 |
| 实体漏 | 词典太薄 | 补 `entity_dict` |
| 聚类无意义 | 文本太少 / 差异太大 | 需 ≥ 30 条才聚；否则关聚类 |
| 栏目归错 | 主题歧义 | 提供上下文（来源 / 作者职位） |
| 标签冗余 | 同义词未合 | 合并同义词表 |

## 上下游协作

- **上游**：`news_aggregation` 聚合结果、`web_deep_read` 正文、CMS 入库前稿件、素材入库前文件
- **下游**：`headline_generate` 用关键词组标题；`cms_publish` 写 `keywords` 字段；`case_reference` 按主题入库；`angle_design` 基于 relatedAngles 扩展角度

## 参考资料

- 代码实现：[src/lib/agent/execution.ts](../../src/lib/agent/execution.ts)
- 历史版本：`git log --follow skills/topic_extraction/SKILL.md`

- **媒体行业专业标准（共享）**：[../../docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)
