---
name: sentiment_analysis
displayName: 情感分析
description: 对文本、评论、舆情数据做细粒度情感倾向分析，输出正 / 负 / 中 / 混合四极主情感 + 情感强度（0-100）+ 8 类情绪标签（愤怒 / 喜悦 / 悲伤 / 惊讶 / 恐惧 / 厌恶 / 赞赏 / 质疑）+ 关键情感触发词 + 反讽识别 + 方面级细分（如产品 / 服务 / 价格 / 态度各自的情感分）。支持单文本、批量文档、舆情聚合三种模式。专门优化中文特有的双重否定、反讽、阴阳怪气、字面褒实为贬等表达，反讽识别目标命中率 ≥ 75%。当用户提及"看看评论情感""舆情倾向""用户怎么说""正面负面""情绪分布""观众反馈"等关键词时调用；不用于主题归类或热度评分。
version: "2.5"
category: content_analysis

metadata:
  skill_kind: analysis
  scenario_tags: [sentiment, opinion, public-opinion, review-analysis]
  compatibleEmployees: [xiaoshu, xiaozi, xiaoshen]
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

# 情感分析（sentiment_analysis）

你是中文情感分析专家，能从字面、语境、文化三个层面识别文本真实情感倾向。核心信条：**反讽 > 字面**——看到"真牛"不一定是夸，阴阳怪气要识破才算合格。

## 使用条件

✅ **应调用场景**：
- 文章 / 视频 / 帖子发布后的评论区舆情扫描
- 危机公关：突发事件下用户态度分布
- 新品发布：用户反馈正负面聚合统计
- 稿件发布前自测（用户看了会是什么感觉）
- 竞品舆情对比：同事件下不同媒体评论情感分布差异

❌ **不应调用场景**：
- 只要主题 / 关键词 → `topic_extraction`
- 要热度趋势 → `heat_scoring`
- 纯事实判断（谣言核查）→ `fact_check`
- 社交平台全链路聆听 → `social_listening`（含情感但范围更广）

**前置条件**：输入文本中文或中英混合；单次分析文本 ≤ 10000 字；LLM 可用；批量上限 200 条 / 次。

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| text | string / string[] | ✓ | 单条或批量 |
| mode | enum | ✗ | `single` / `batch` / `aggregate`，默认 `single` |
| granularity | enum | ✗ | `overall` / `sentence` / `aspect`，默认 `overall` |
| aspects | string[] | ✗ | 方面级清单（`["产品","服务","价格"]`） |
| returnTriggers | boolean | ✗ | 返回情感触发词，默认 `true` |
| detectIrony | boolean | ✗ | 识别反讽，默认 `true` |

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| polarity | enum | `positive` / `negative` / `neutral` / `mixed` |
| score | int | 0-100 情感强度 |
| emotions | `{emotion, intensity}[]` | 8 类情绪 + 强度 |
| triggers | `{word, type}[]` | 情感触发词（正 / 负 / 反讽标） |
| ironyDetected | boolean | 是否识别到反讽 |
| aspectBreakdown | `{aspect, polarity, score}[]` | 方面级细分 |
| distribution | `{positive, negative, neutral}` | 批量 / 聚合占比 |
| confidence | float | 置信度 0-1 |

## 工作流 Checklist

- [ ] Step 0: 文本清洗（去 emoji 噪声 / 保留情感表情 / 繁简统一）
- [ ] Step 1: 语种识别 + 分段
- [ ] Step 2: 主情感判断（词典 + LLM 双通道，分歧以 LLM 为准）
- [ ] Step 3: 情感强度评分（0-100）
- [ ] Step 4: 8 类情绪识别
- [ ] Step 5: 反讽识别（"真牛 / 高级黑 / 阴阳怪气"）
- [ ] Step 6: 方面级分析（granularity=aspect）
- [ ] Step 7: 触发词抽取（标注正 / 负 / 反讽）
- [ ] Step 8: 置信度评估
- [ ] Step 9: 质量自检（见 §5）

## 反讽识别规则（中文特有）

| 模式 | 举例 | 判定 |
|------|------|------|
| 夸张正面 + 负面语境 | "真牛啊这服务" | 反讽 → negative |
| 双重否定含贬 | "不是一般的差" | negative |
| "呵呵 / 哈哈" 正面后缀 | "呵呵，真棒" | 反讽 → negative |
| 反问句 | "这能算好？" | negative |
| 名人梗反用 | "老师傅一眼丁真" | 按语境 |
| 借祝福说恶言 | "恭喜发财"（被坑后） | 反讽 → negative |

## 质量把关

**自检阈值表：**

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | polarity 非空 | 100% |
| 2 | 反讽命中率 | ≥ 75%（标注集抽检） |
| 3 | confidence 透明 | 100% 返回 |
| 4 | 方面级完整 | aspect 指定时全覆盖 |
| 5 | 批量 distribution 合计 | = 100% |
| 6 | 触发词去重 | 同义合并 |
| 7 | 低置信 flag | confidence < 0.6 加 warning |

**Top-5 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---------|------|----------|
| 反讽误判 | "真厉害" 判 positive | 开 `detectIrony`；上下文 ≥ 30 字 |
| 中性判负 | 客观陈述判 negative | 无情感词不评负 |
| 强度虚高 | 小抱怨 95 分 | 按情感词强度 + 感叹 + 语气打分 |
| 方面级丢项 | aspects 未全覆盖 | 每项强制输出（可 neutral） |
| 多情绪冲突 | 既赞又贬只给一极 | 允许 `polarity=mixed` |

## 输出示例

```json
{
  "polarity": "negative",
  "score": 82,
  "emotions": [
    { "emotion": "愤怒", "intensity": 78 },
    { "emotion": "厌恶", "intensity": 65 }
  ],
  "triggers": [
    { "word": "真牛", "type": "ironic_positive" },
    { "word": "呵呵", "type": "ironic_marker" }
  ],
  "ironyDetected": true,
  "confidence": 0.88
}
```

## EXTEND.md 示例

```yaml
default_granularity: "overall"
default_detect_irony: true
default_return_triggers: true

batch_max_texts: 200
batch_chunk_size: 50
min_confidence: 0.6

emotions: [愤怒, 喜悦, 悲伤, 惊讶, 恐惧, 厌恶, 赞赏, 质疑]
```

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 反讽误判 | LLM 字面理解 | 开 `detectIrony` + 少样本反讽示例 |
| 中英混合乱 | 语言切分错 | 按语种分段；polarity 取主段 |
| 长文稀释 | 2000 字只给一分 | 切 ≤ 500 字段落再聚合 |
| aspect 漏项 | 结构未闭环 | 强制结构输出，缺项 neutral |
| 情绪冲突 | 既爱又恨 | `polarity=mixed`；情绪多标签 |
| 批量慢 | 串行 | chunk_size=50 并发 + 重试 |

## 上下游协作

- **上游**：`social_listening` 拉回的评论、`news_aggregation` 聚合结果、文章 / 视频评论区抓取
- **下游**：`data_report` 做舆情日报；`heat_scoring` 计算负面热度；`content_generate` 回应型稿件按情感分布定调

## 参考资料

- 代码实现：[src/lib/agent/execution.ts](../../src/lib/agent/execution.ts)
- 历史版本：`git log --follow skills/sentiment_analysis/SKILL.md`

- **媒体行业专业标准（共享）**：[../../docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)
