---
name: summary_generate
displayName: 摘要生成（场景化重写版）
description: 为文章/稿件生成摘要。输出 CMS summary 字段（≤ 200 字）、分享摘要（≤ 80 字）、APP 列表页展示摘要（≤ 50 字）三种形态。按 9 大场景分化摘要风格。支持从正文自动抽取 + LLM 润色 + 多版本 A/B。
version: 5.0.0
category: generation

metadata:
  skill_kind: generation
  scenario_tags: [news, politics, sports, variety, livelihood, drama, daily_brief]
  compatibleEmployees: [xiaowen, xiaoce]
  modelDependency: deepseek:deepseek-chat
  requires:
    env: [OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL]
    knowledgeBases: []
    dependencies: [content_generate]
  implementation:
    scriptPath: src/lib/agent/execution.ts
    testPath: src/lib/agent/__tests__/
  openclaw:
    referenceSpec: docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md
---

# 摘要生成（summary_generate）

## 使用条件

✅ **应调用场景**：
- 文章已生成，需要配套摘要（CMS 入库时的 summary 字段）
- 社交分享时的短摘要（微博/朋友圈）
- APP 列表页展示摘要（≤ 50 字）
- 重新润色旧文章的摘要

❌ **不应调用场景**：
- 正文不足 200 字（直接用首段即可）
- 视频脚本（视频用钩子，不用摘要）

**前置依赖**：正文已由 `content_generate` 产出；`scenario` 参数需与文章场景一致。

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| articleBody | string (≥100) | ✓ | 正文原文 |
| title | string | ✗ | 文章标题，用于对比避免摘要≈标题 |
| scenario | enum | ✓ | 9 个场景之一（见 §9 场景摘要风格规范） |
| summaryTypes | enum[] | ✗ | `cms_summary` / `share_summary` / `list_summary`，默认 `[cms_summary]` |
| variantCount | int (1-3) | ✗ | A/B 多版本数量，默认 1 |

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| summaries.{type}[] | array | 每类摘要的多版本数组，含 `content/charCount/score` |
| summaries.{type}[].keyPoints | string[] | 抽取到的核心事实（cms_summary 特有） |
| summaries.{type}[].hookStyle | string | 钩子风格标注（share_summary 特有） |
| recommendedPerType | object | 每类推荐版本的索引 |
| complianceCheck | object | `{ passed, flagged[] }` |

完整 Zod Schema 见 [src/lib/agent/execution.ts](../../src/lib/agent/execution.ts) 内 skill IO 定义。

## 9 场景摘要风格规范

### news_standard（新闻摘要）
- **风格**：事实提炼 + 5W1H 浓缩
- **示例**：> "4 月 17 日，深圳发布《促进人工智能产业高质量发展若干措施》，明确 5 年内投入 200 亿元专项基金，建设三个国家级 AI 产业园，对符合条件的 AI 企业最高补贴 5000 万元。"（105 字）

### politics_shenzhen（时政摘要）
- **风格**：官方化 + 规范用语；必含政策全称、会议主体、关键数字
- **示例**：> "《深圳市促进人工智能产业高质量发展若干措施》正式发布。该措施明确，深圳将在 2026-2030 年投入 200 亿元支持 AI 产业，重点涵盖产业园区建设、企业扶持、人才引进三方面。"（约 120 字）

### sports_chuanchao（体育摘要）
- **风格**：比分先行 + 关键时刻；必含比分、关键球员、时间
- **示例**：> "凤凰山体育场，成都蓉城 2-1 绝杀四川 FC。第 89 分钟，冯潇霆头球破门锁定胜局。本轮过后，蓉城积 18 分升至第二。"（70 字）

### variety_highlight（综艺摘要）
- **风格**：看点聚焦 + 话题感；必含艺人名、节目名
- **示例**：> "2026 春晚昨晚举行，沈腾贾玲合作的小品《脱不了干系》成为全场最大看点。盘点本届春晚 5 大名场面，从开场歌舞到压轴小品，每一个都值得回味。"（95 字）

### livelihood_zhongcao（种草摘要）
- **风格**：钩子 + 痛点 + CTA 暗示
- **示例**：> "大牌都刺痛的敏感肌姐妹看这篇。这款薇诺娜舒敏特护霜，用完两周，泛红肉眼可见变淡，皮肤科医生都推荐。128 到 168 元，敏感肌值得一试。"（92 字）

### livelihood_tandian（探店摘要）
- **风格**：地点 + 品类 + 特色 + 人均
- **示例**：> "藏在成都武侯区巷子里的"九二零成都老火锅"，30 年老店，牛油锅底香到隔壁桌回头。人均 95-120 元，推荐给想吃地道老火锅的朋友。"（72 字）

### livelihood_podcast（播客摘要）
- **风格**：主题 + 节奏 + 期待感
- **示例**：> "《深圳晨间 4 分钟》第 18 期：今天聊深圳 AI 200 亿新政、川超开赛、油价下调这 3 件事。4 分钟，带你了解早上该知道的。"（75 字）

### drama_serial（短剧摘要）
- **风格**：人物悬念 + 本集钩子（严禁剧透反转）
- **示例**：> "《裴总的掌心梨》第 1 集：设计师江嘉月误入裴氏集团总裁办公室。裴淮恩一句"一周后来上班"，让她陷入一场不知名的邂逅。她以为是面试错了公司，却不知道更大的秘密等着她。"（约 115 字）

### daily_brief（每日专题摘要）
- **风格**：日期 + 话题数 + 亮点
- **示例**：> "4 月 17 日科技早资讯：深圳 AI 产业 200 亿新政出台、川超第 7 轮今晚开赛、本地 95 号汽油下调 0.3 元/升。4 分钟，带你把握今天最该知道的事。"（90 字）

## 工作流 Checklist

- [ ] Step 0: 抽取正文 key points（LLM 提炼 3-7 个）
- [ ] Step 1: 按 scenario 确定风格模板
- [ ] Step 2: 按 summaryType 分别生成
- [ ] Step 3: 字数控制（硬裁剪或重生）
- [ ] Step 4: 评分 + 选推荐
- [ ] Step 5: 合规扫描

## 字数控制

| Type | max | 推荐 |
|------|-----|-----|
| cms_summary | 200 | 80-140 |
| share_summary | 80 | 40-60 |
| list_summary | 50 | 20-40 |

## 质量把关

**自检阈值表：**

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | 字数在目标范围内 | 硬 |
| 2 | 关键事实包含 | ≥ 3 个 |
| 3 | 场景风格匹配 | ≥ 70 |
| 4 | 合规 | passed |
| 5 | 无剧透（短剧/悬疑） | ✓ |

**Top-3 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---------|------|----------|
| 摘要 ≈ 标题 | 摘要和标题基本一致，无信息增量 | 强制包含 ≥ 3 个标题未提的 key facts |
| 超字数 | CMS 摘要 >200 字 / 分享摘要 >80 字 | 硬裁剪 + LLM 按目标范围重生 |
| 场景错配 | 新闻摘要写成娱乐风 / 短剧摘要剧透反转 | 按 scenario 锁定风格模板；drama_serial 开启 `no_spoiler` 检查 |

## 输出模板 / 示例

```json
{
  "summaries": {
    "cms_summary": [{
      "content": "4 月 17 日，深圳发布《促进人工智能产业高质量发展若干措施》，明确 5 年内投入 200 亿元专项基金，建设三个国家级 AI 产业园……",
      "charCount": 105,
      "keyPoints": ["200 亿元专项基金", "三个国家级 AI 产业园", "单企最高补贴 5000 万"],
      "score": 88
    }],
    "share_summary": [{
      "content": "深圳 AI 产业 200 亿新政来了！5 年内建 3 个国家级园区，单企最高补贴 5000 万。",
      "charCount": 42,
      "hookStyle": "数字冲击",
      "score": 85
    }]
  },
  "recommendedPerType": { "cms_summary": 0, "share_summary": 0 },
  "complianceCheck": { "passed": true, "flagged": [] }
}
```

## EXTEND.md 示例

```yaml
default_summary_types: [cms_summary, share_summary]
default_variant_count: 1

lengths:
  cms_summary:
    max: 200
    target_range: [80, 140]
  share_summary:
    max: 80
    target_range: [40, 60]
  list_summary:
    max: 50
    target_range: [20, 40]

scenario_weights:
  drama_serial:
    no_spoiler: true
  sports_chuanchao:
    require_score: true
```

## 上下游协作

- **上游**：`content_generate` 输出正文 → summary_generate 产出摘要
- **下游**：`cms_publish` 消费 summary 字段入库；分享摘要供社交渠道分发

## 参考资料

- 代码实现：[src/lib/agent/execution.ts](../../src/lib/agent/execution.ts)（通用 agent 执行入口）
- 参考 Spec：[docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md](../../docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md)
- 历史版本：`git log --follow skills/summary_generate/SKILL.md`
