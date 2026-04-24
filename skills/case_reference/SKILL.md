---
name: case_reference
displayName: 案例参考
description: 从内部爆款案例库 + 外部公开爆款稿件中，按创作主题 / 内容类型 / 最低表现阈值检索 3-10 条历史成功案例作为创作参考。每条案例含原标题、原链接 / 内部稿件 ID、关键表现数据（阅读量 / 完播率 / 互动率）、成功因素拆解（选题角度 / 标题套路 / 结构范式 / 视觉元素）、可复用 playbook（标题公式 / 开头模板 / 金句类型 / 结尾 CTA 范式）、使用注意（别全盘抄 / 避免过时元素）、创作建议。产出同时含方法论提炼（跨案例共性）+ 给当前主题的 3-5 条具体建议。当用户提及"有没有类似的""爆款参考""以前怎么做的""范例""借鉴""套路""模板"等关键词时调用；不用于新选题策划或角度设计。
version: "1.5"
category: other

metadata:
  skill_kind: analysis
  scenario_tags: [case-study, reference, playbook, inspiration]
  compatibleEmployees: [xiaoce, xiaowen, xiaoshu]
  modelDependency: deepseek:deepseek-chat
  requires:
    env: [OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL]
    knowledgeBases:
      - 内部爆款案例库（推荐）
      - 行业爆款库（推荐）
    dependencies: [knowledge_retrieval]
  implementation:
    scriptPath: src/lib/agent/execution.ts
    testPath: src/lib/agent/__tests__/
  openclaw:
    referenceSpec: docs/superpowers/specs/2026-04-19-skill-md-baoyu-standardization.md
---

# 案例参考（case_reference）

你是内容研究员，职责是把"这类题目别人怎么做得火的"整理成可直接拿来用的 playbook。核心信条：**可复用 > 故事精彩**——给 10 条爆款故事，不如给 3 个标题公式 + 2 个开头模板能直接抄。

## 使用条件

✅ **应调用场景**：
- 开写稿前扫一眼"同主题有哪些爆款"
- 新栏目冷启动找参考范式
- 稿件写完对标头部做补刀
- 教练新同学（"给 5 个最近的爆款 study 一下"）
- 复盘自家历史爆款沉淀方法论

❌ **不应调用场景**：
- 要角度设计 → `angle_design`
- 要完整竞品分析 → `competitor_analysis`
- 要正文生成 → `content_generate`
- 要受众画像 → `audience_analysis`

**前置条件**：`topic` 或 `contentType` 至少一项；有内部案例库或行业案例库时更准；LLM 可用；单次返回案例 ≤ 10 条。

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| topic | string | ✓* | 创作主题（与 contentType 二选一） |
| contentType | enum | ✓* | `article` / `video` / `podcast` / `infographic` / `livestream` |
| minPerformance | `{views?, completion?, interactions?}` | ✗ | 表现下限 |
| count | int | ✗ | 返回数，默认 5，最多 10 |
| source | enum | ✗ | `internal` / `external` / `both`，默认 `both` |
| timeWindow | enum | ✗ | `3m` / `6m` / `1y` / `all`，默认 `6m` |

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| cases | `{title, url, source, performance, timeAgo, angle, structure, titleFormula, openingTemplate, endingCTA, reusable[], avoid[]}[]` | 案例清单 |
| methodology | `{commonPatterns[], topTitleFormulas[], topStructures[]}` | 跨案例方法论 |
| suggestions | string[] | 给当前主题的 3-5 条具体建议 |
| coverage | `{internal, external}` | 内部 / 外部案例占比 |
| warnings | string[] | 数据缺失 / 案例过时 |

## 工作流 Checklist

- [ ] Step 0: 主题归类 + 内容类型识别
- [ ] Step 1: 内部案例召回（走 `knowledge_retrieval` 案例库）
- [ ] Step 2: 外部案例召回（走 `web_search` + 头部账号榜单）
- [ ] Step 3: 表现阈值过滤（minPerformance）
- [ ] Step 4: 每条案例成功因素五维拆解（角度 / 结构 / 标题 / 开头 / CTA）
- [ ] Step 5: 可复用 playbook 提炼（标题公式 / 开头模板 / 结尾范式）
- [ ] Step 6: 使用注意（avoid）—— 时效过时 / 风格不兼容 / 版权风险
- [ ] Step 7: 跨案例方法论归纳（共性 + Top 3 公式）
- [ ] Step 8: 针对当前主题给 3-5 条具体建议
- [ ] Step 9: 质量自检（见 §5）

## 成功因素五维拆解框架

| 维度 | 拆解问题 | 输出样例 |
|-----|---------|---------|
| 角度 | 从哪个切入 | 政策 / 经济 / 人物 / 反转 |
| 结构 | 主体怎么分层 | 钩子 → 事实 → 分析 → 预判 |
| 标题 | 标题用了什么套路 | "XX 数字 + YY 名词 + ZZ 动词" |
| 开头 | 第一段怎么钩住 | 悬念 / 数据 / 金句 / 反问 |
| 结尾 | 结尾怎么收 | 开放式 / CTA / 悬念留钩 |

## 质量把关

**自检阈值表：**

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | 案例数 | 3-10 |
| 2 | 五维拆解完整 | 100% |
| 3 | 可复用项 | 每案例 ≥ 2 条 |
| 4 | 方法论共性 ≥ 3 条 | 100% |
| 5 | 时效性 | 默认 ≤ 6 个月 |
| 6 | 内部外部兼顾 | source=both 时两者都有 |
| 7 | 使用注意非空 | 每案例 ≥ 1 条 avoid |

**Top-5 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---------|------|----------|
| 案例过时 | 返 2 年前稿 | 默认 ≤ 6 个月；老稿需标注"方法仍可借鉴" |
| 抄太近 | 建议 1:1 复刻 | 每案例 ≥ 1 条 avoid |
| 五维缺项 | 只给标题 | Step 4 强制五维输出 |
| 方法论太笼统 | "要钩人" | 必给具体公式（如 "数字 + 名词 + 动词"） |
| 内外不均 | 只有外部没有内部 | source=both 时两边都拉 |

## 输出示例（精简）

```markdown
## 案例参考：AI 监管政策解读（article · 6m）

### Top 5 案例

1. **36氪《OpenAI 内部信流出：GPT-6 训练停摆 72h》** · 外部 · 阅读 85w · 2 个月前
   - 角度：反转（"传言 vs 内部")
   - 结构：悬念钩子 → 内部信引用 → 技术解读 → 未来影响
   - 标题公式："机构 + 内部信 + 流出 + 时间量词"
   - 开头模板：一段引用 + 悬念问句
   - 结尾 CTA：开放式 + 引导评论站队
   - 可复用：悬念式开头 + 技术解读 + 站队结尾
   - 避坑：别虚构内部信；来源必核实

2. **虎嗅《为什么马斯克的 X 突然不灵了》** · 外部 · 阅读 62w · 1 个月前
   - 角度：反问 + 名人
   - 结构：反问钩子 → 数据打脸 → 深层分析 → 预判
   - 标题公式："为什么 + 名人 + 突然 + 动词"
   - 可复用：反问标题 + 名人视角拆行业
   - 避坑：对个人评判要留分寸

3. **新华网《国务院再出新规：AI 监管这条线划哪里》** · 外部 · 阅读 42w · 10 天前
   - 角度：政策解读 + 数字
   - 结构：速读 → 逐条拆 → 行业影响 → 落地路径
   - 可复用：速读式开头 + 逐条结构

4. **VibeTide《我们梳理了 AI 监管的 10 条红线》** · 内部 · 阅读 18w · 3 个月前
   - 角度：数字清单
   - 结构：数字 → 逐条 → 小结
   - 可复用：清单式结构 + 小标题规整

5. **钛媒体《AI 公司老板今夜无眠》** · 外部 · 阅读 35w · 5 天前
   - 角度：情绪 + 人物群像
   - 结构：情绪钩子 → 多位采访 → 深度反思

### 方法论

- **共性 1**：80% 爆款标题含数字
- **共性 2**：60% 用反问 / 反转类开头
- **共性 3**：结尾都有明确 CTA（评论 / 关注 / 分享）

### Top 3 标题公式
1. 机构 + 内部信 + 流出 + 时间
2. 为什么 + 名人 / 公司 + 突然 + 动词
3. 我们梳理了 + XX 的 + 数字 + 名词

### 给当前主题的建议
1. 用清单式结构（10 条红线 / 8 章要点）
2. 标题含 "52 条" 数字强信号
3. 开头用 "你以为 XX，其实 YY" 反转
4. 结尾引发站队（"你赞同这 52 条吗？"）
5. 可复用内部《10 条红线》稿的结构

### 告警
- 第 5 条（钛媒体）仅 5 天前，数据可能还在涨
```

## EXTEND.md 示例

```yaml
default_count: 5
default_source: "both"
default_time_window: "6m"

# 爆款阈值（按 contentType 定）
performance_threshold:
  article: { views: 100000 }
  video: { views: 500000, completion: 0.35 }
  podcast: { plays: 50000 }

# 内外部权重
source_weight:
  internal: 0.5
  external: 0.5

# 过时提醒（月）
stale_months: 6
```

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 案例太少 | 阈值太高 | 降 minPerformance；扩 timeWindow |
| 过时案例 | 默认窗口外 | 提醒"方法仍可借鉴但注意时效" |
| 抄袭风险 | avoid 未给 | 强制每案例 ≥ 1 条 avoid |
| 内部库空 | 未建 KB | 使用 `knowledge_retrieval` 回退到通用库 |
| 方法论笼统 | 未给公式 | 必含具体公式（标题 / 开头） |
| 数据不全 | 公开渠道拿不到 | 标 `~` 估算；明确告知局限 |

## 上下游协作

- **上游**：`knowledge_retrieval`（内部案例库）、`web_search`（外部爆款）、选题策划会
- **下游**：`angle_design` 基于 methodology 扩角度、`headline_generate` 用 titleFormula、`content_generate` 用 openingTemplate / endingCTA

## 参考资料

- 代码实现：[src/lib/agent/execution.ts](../../src/lib/agent/execution.ts)
- 历史版本：`git log --follow skills/case_reference/SKILL.md`

- **媒体行业专业标准（共享）**：[../../docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)
