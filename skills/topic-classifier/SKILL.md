---
name: topic_classifier
displayName: 海外热榜分类
description: 把一批中国热榜（hot_topics）按"是否适合搬运到海外社交平台"做语义分类，每条输出 category（food / pets / domestic_tech / other）+ confidence（0~1）+ reason（中文短理由）。专为「海外热榜搬运」场景设计——过滤掉时政 / 社会 / 娱乐等不适合海外发布的内容，保留美食 / 萌宠 / 国内科技三类对海外读者有吸引力且无政策风险的话题。模糊难判（confidence < 0.7）一律归 other。当用户在场景中心点「跑一次海外热榜搬运」、或编辑想筛 24h 热榜里能搬到 X/IG 的选题时调用。
version: "1.0"
category: content_analysis

metadata:
  skill_kind: analysis
  scenario_tags: [overseas, classification, hot-topics-filter]
  compatibleEmployees: [xiaolei]
  modelDependency: openai:qwen3-max
  requires:
    env: [OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL]
    knowledgeBases: []
    dependencies: []
  implementation:
    scriptPath: src/lib/agent/skills/topic-classifier.ts
    testPath: src/lib/agent/skills/__tests__/
  openclaw:
    referenceSpec: /Users/zhuyu/.claude/plans/tophub-x-instagram-twitter-sunny-papert.md
---

# 海外热榜分类（topic_classifier）

你是「海外热榜分类员」，从中国热榜里筛出真正适合发到 X / Instagram / Facebook 的话题。核心信条：**宁愿漏不要错**——海外发布失误的代价远高于少发一条，confidence 不够就归 other。

## 使用条件

✅ **应调用场景**：
- 「海外热榜搬运」workflow 的 step 2（classify_overseas_categories），自动过滤 24h 热榜
- 编辑手工挑选海外发布选题时，对一批候选 topic 一次性打标
- 周报里统计「本周热榜里有多少 % 是可搬运的海外友好话题」

❌ **不应调用场景**：
- 已经确定要发的稿件做精细分类 → 直接用稿件 tags
- 国内栏目归类（app_news / app_politics / ...）→ 走 `topic_extraction`
- 需要打热度分 → 走 `heat_scoring`
- 需要做主题聚类 → 走 `topic_extraction` 批量模式

**前置条件**：
- 输入 topics 至少 1 条，title 非空
- LLM 可用（依赖 OPENAI_API_KEY）
- summary 可选；缺失时仅按 title 分类，confidence 自动偏保守

## 输入 / 输出

**输入：**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `topics` | `{id, title, summary?}[]` | ✓ | 待分类的 topic 数组 |
| `topics[].id` | string | ✓ | topic 唯一标识（一般是 hot_topics.id） |
| `topics[].title` | string | ✓ | 标题 |
| `topics[].summary` | string | ✗ | 摘要（GLM-4-Plus 富化后的简短描述） | <!-- audit-allow: 描述上游 collection-hot-topic-cron 的 GLM-4-Plus 富化产物，事实记录，非本 skill 模型选择 -->

**输出（zod schema）：**

| 字段 | 类型 | 说明 |
|---|---|---|
| `results[].id` | string | 与输入 topic.id 一一对应 |
| `results[].category` | enum | `food` / `pets` / `domestic_tech` / `other` |
| `results[].confidence` | number | 0~1，分类把握度 |
| `results[].reason` | string | 中文短理由（≤ 100 字），说出关键判断词 |

## 分类标准（4 类语义边界）

| 类别 | 包含 | 不包含（→ other） |
|---|---|---|
| **food** | 餐饮、菜谱、食材、零食、饮品、料理、美食 vlog、地方小吃、外卖、饮食文化 | 非餐饮的"健康养生"、医用补品 |
| **pets** | 猫 / 狗 / 鸟 / 兔 / 仓鼠等家养宠物，宠物视频、宠物用品、宠物医疗、撸宠互动 | 野生动物保护、动物园新闻、农场养殖 |
| **domestic_tech** | 中国大陆的科技公司 / 产品 / 芯片 / AI / 互联网 / 新能源车 / 航天 / 机器人 | 海外科技公司、海外产品（Apple / OpenAI / Tesla），即便在中国市场发布 |
| **other** | 时政、社会新闻、娱乐八卦、体育、影视综艺、教育、房产、股市、突发事件、海外动态 | — |

**关键判定规则：**
- "国内"严格指中国大陆，香港 / 台湾科技公司归 other
- 美食类的网红 / 探店 vlog → food（不是娱乐）
- 涉及社会舆论的"网红探店出事故" → confidence < 0.7 → other（避免敏感）
- 涉及政府监管的"AI 法规" → other（虽然是科技但属政策）

## 工作流 Checklist

- [ ] Step 0：input 校验（topics 非空 / id 非重 / title 非空）
- [ ] Step 1：序列化 topics 注入 user payload（id / title / summary）
- [ ] Step 2：调 LLM（DeepSeek，temperature=0.2，maxTokens=4096）
- [ ] Step 3：用 `generateText({ output: Output.object({ schema }) })` 拿强 schema 输出
- [ ] Step 4：检查返回数量是否与输入一致；缺失条目兜底为 `other` + confidence=0
- [ ] Step 5：返回 `{ results: [...] }`

## 质量把关

**自检阈值表：**

| # | 检查点 | 阈值 |
|---|---|---|
| 1 | 每条 input 都有对应 output | 100% |
| 2 | category 必为 4 类之一 | 100%（schema 强校验） |
| 3 | confidence 在 [0, 1] | 100%（schema 强校验） |
| 4 | reason 非空、长度合理 | 2~200 字符 |
| 5 | confidence < 0.7 时强制归 other | 抽查 |
| 6 | food/pets/domestic_tech 召回率 | ≥ 80%（人工标 30 条对比） |
| 7 | 误判率（other 错标为 food/pets/tech） | ≤ 10% |

**Top-5 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---|---|---|
| 把社会新闻当美食 | "网红探店餐厅坍塌" → food | 涉事故 / 投诉 / 维权语境强制 other |
| 把海外科技当国内 | "苹果在上海办活动" → domestic_tech | 主体是境外品牌 → other |
| 政策类归 tech | "工信部 AI 备案条例" → domestic_tech | 政府监管 / 法规归 other |
| confidence 虚高 | 模糊话题给 0.9 | prompt 已要求 < 0.7 归 other，需复核 |
| 网红探店归娱乐 | "成都串串店爆火" → other | 美食类 vlog / 探店明确归 food |

## 输出示例

输入：

```json
{
  "topics": [
    { "id": "t1", "title": "成都串串香夜市排队3小时" },
    { "id": "t2", "title": "华为 Mate 70 Pro 卫星通信实测" },
    { "id": "t3", "title": "国家发改委发布2026年新能源补贴" },
    { "id": "t4", "title": "金毛犬看到主人秒进入摇尾巴模式" }
  ]
}
```

输出：

```json
{
  "results": [
    { "id": "t1", "category": "food", "confidence": 0.94, "reason": "标题含'串串香夜市'，属地方小吃 vlog 类美食内容" },
    { "id": "t2", "category": "domestic_tech", "confidence": 0.96, "reason": "主体是华为（中国大陆品牌）+ 卫星通信硬件，属国内科技" },
    { "id": "t3", "category": "other", "confidence": 0.88, "reason": "政府部门发布补贴政策，属政策类，不适合海外发布" },
    { "id": "t4", "category": "pets", "confidence": 0.97, "reason": "金毛犬 + 主人互动，典型萌宠日常视频" }
  ]
}
```

## 上下游协作

<!-- audit-allow: 描述上游 collection-hot-topic-cron 的 GLM-4-Plus 富化产物，事实记录，非本 skill 模型选择 -->
- **上游**：`hot_topics` 表（被 `collection-hot-topic-cron` 每小时填充，含 GLM-4-Plus 富化结果）；workflow step 1 `pull_hot_topics_24h` 拉 24h 内 aiScore ≥ 70 的 topic
- **下游**：workflow step 3 `deep_read_and_translate` —— 仅对 category ∈ {food, pets, domestic_tech} 且 confidence ≥ 0.7 的 topic 走 `cross_language_rewrite`；其余丢弃

## 常见问题

| 问题 | 原因 | 解决 |
|---|---|---|
| 同一 topic 跑两次 category 不一致 | LLM 温度噪声 | 已设 temperature=0.2；如仍不稳考虑降到 0.1 |
| 召回偏低（漏掉 food） | summary 缺失 / title 语义模糊 | 拉 hot_topics 时同时 join `topic_summary` |
| 大量归 other | 24h 内确实少海外友好话题 | 这是正常现象，海外友好话题日均 5-15 条；不要因此降阈值 |
| confidence 全偏高 | LLM 自信偏置 | prompt 已强调 < 0.7 归 other；可对 confidence 做 0.9 上限裁剪 |
| 国内 / 海外 tech 判定混 | LLM 不熟悉品牌归属 | 在 EXTEND 里维护「品牌 → 国别」字典作为 hint |

## 参考资料

- 代码实现：[src/lib/agent/skills/topic-classifier.ts](../../src/lib/agent/skills/topic-classifier.ts)
- 设计文档：`/Users/zhuyu/.claude/plans/tophub-x-instagram-twitter-sunny-papert.md`
- 上游 hot_topics：[src/inngest/functions/hot-topic-enrichment.ts](../../src/inngest/functions/hot-topic-enrichment.ts)
- 下游 cross_language_rewrite：[../cross-language-rewrite/SKILL.md](../cross-language-rewrite/SKILL.md)
