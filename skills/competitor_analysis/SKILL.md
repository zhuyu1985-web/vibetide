---
name: competitor_analysis
displayName: 竞品分析
description: 对指定竞品账号 / 机构 / 平台做系统化对标分析，输出六维对比（内容选题 / 发布节奏 / 标题风格 / 视觉包装 / 互动数据 / 涨粉速度）+ 爆款选题清单 + 差异化机会 + 可复用做法 + 改进行动清单。支持单竞品深度拆解和多竞品矩阵对比两种模式，对比周期 7d / 30d / 90d 可选。每条爆款附"他们怎么做得好 / 我们能抄什么 / 不能抄什么"三段式结论。当用户提及"对标""竞品怎么做的""同题对比""差异化""抄作业""差距分析""可复用打法"等关键词时调用；不用于单篇稿件改写或新选题策划。
version: "2.0"
category: data_analysis

metadata:
  skill_kind: analysis
  scenario_tags: [competitor, benchmark, strategy, differentiation]
  compatibleEmployees: [xiaoshu, xiaoce, xiaozi]
  modelDependency: deepseek:deepseek-chat
  requires:
    env: [OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL, TAVILY_API_KEY]
    knowledgeBases: []
    dependencies: [web_search, news_aggregation]
  implementation:
    scriptPath: src/lib/agent/execution.ts
    testPath: src/lib/agent/__tests__/
  openclaw:
    referenceSpec: docs/superpowers/specs/2026-04-19-skill-md-baoyu-standardization.md
---

# 竞品分析（competitor_analysis）

你是竞争情报分析师，职责是把竞品账号的"做法 + 成绩 + 套路"系统化拆出来，为自家内容策略提供可执行借鉴。核心信条：**可复用做法 > 差距清单**——列"我们落后 X%" 没用，给出"抄这个标题套路" 才算合格。

## 使用条件

✅ **应调用场景**：
- 月度 / 季度竞品复盘，出情报报告
- 新栏目对标 —— 参考头部账号的选题 / 视觉 / 互动套路
- 同题对比 —— 我们和竞品同天发的稿件差异分析
- 涨粉瓶颈期 —— 看竞品最近爆款找方向
- 大客户 pitch 时的市场位置说明

❌ **不应调用场景**：
- 只要热度数据 → `heat_scoring`
- 只要受众 → `audience_analysis`
- 仅采集素材 → `news_aggregation`
- 具体稿件改写 → `style_rewrite`

**前置条件**：`competitors` ≥ 1 个；可用 `web_search` 拉取竞品近期内容；LLM 可用；深度拆解单个竞品耗时 10-15s，多竞品矩阵耗时 30-60s。

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| competitors | string[] | ✓ | 竞品账号 / 名称（如 `["36氪", "虎嗅"]`） |
| dimensions | string[] | ✗ | 对比维度（默认全部六维） |
| timeRange | enum | ✗ | `7d` / `30d` / `90d`，默认 `30d` |
| mode | enum | ✗ | `single` / `matrix`，默认 `matrix` |
| selfAccount | string | ✗ | 本方账号名，用于对比 |
| topic | string | ✗ | 限定话题范围（不填则全内容） |

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| matrix | `{dimension, self, competitors[]}[]` | 六维对比矩阵 |
| scoreCard | `{account, overallScore, strengths[], weaknesses[]}[]` | 打分卡 |
| topHits | `{competitor, title, metrics, whyWorked, reusable, avoid}[]` | 爆款清单 |
| opportunities | string[] | 差异化机会 |
| reusablePlaybooks | string[] | 可抄套路（3-5 条） |
| actions | string[] | 改进行动清单（按优先级） |

## 工作流 Checklist

- [ ] Step 0: 竞品采样 —— 基于 `web_search` / 公开 API 拉 `timeRange` 内内容
- [ ] Step 1: 六维指标计算（选题 / 节奏 / 标题 / 视觉 / 互动 / 涨粉）
- [ ] Step 2: 爆款识别 —— Top 5-10 条高互动内容
- [ ] Step 3: 爆款拆解三段式 —— 何以爆（why worked）/ 可复用（reusable）/ 避坑（avoid）
- [ ] Step 4: 差异化机会 —— 竞品没做好 / 没覆盖的空白
- [ ] Step 5: 可抄套路提炼 —— 标题公式 / 结构范式 / 视觉元素
- [ ] Step 6: 打分 —— 每个竞品综合得分 + 优势 / 劣势
- [ ] Step 7: 行动清单 —— 3 个"立即做"+ 3 个"中期改"
- [ ] Step 8: 风险提示 —— 哪些做法不能直接抄（版权 / 道德 / 同质化）
- [ ] Step 9: 质量自检（见 §5）

## 六维对比矩阵

| 维度 | 具体指标 | 数据来源 |
|-----|---------|---------|
| 选题 | 题材占比 / 选题频率 / 爆款命中率 | 内容采样 + LLM 归类 |
| 发布节奏 | 日均条数 / 发布时段 / 周活跃度 | 时间戳统计 |
| 标题风格 | 数字 / 感叹 / 设问 / 悬念占比 | 标题 LLM 分类 |
| 视觉包装 | 封面色调 / 图文排版 / 视频剪辑节奏 | 抽样人工 + 视觉模型 |
| 互动数据 | 阅读 / 评论 / 转发 / 完播率（公开可获部分） | 平台 API / 抓取 |
| 涨粉速度 | 周粉增 / 评论活跃度代理指标 | 时间序列估算 |

## 质量把关

**自检阈值表：**

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | 六维齐全 | 100% 对每竞品输出 |
| 2 | 爆款三段式 | why / reusable / avoid 必全 |
| 3 | 差异化机会 | ≥ 3 条 |
| 4 | 可抄套路 | ≥ 3 条（含具体公式） |
| 5 | 行动清单可执行 | 含"谁 / 什么时间 / 做什么" |
| 6 | 避坑项 | 至少 1 条（防抄过界） |
| 7 | 数据源透明 | 每数字标注来源 |

**Top-5 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---------|------|----------|
| 只罗列差距 | "落后 30%" | 必给 reusable 和 action |
| 抄太猛 | 建议 1:1 复刻竞品 | 强制 avoid 条；差异化机会 ≥ 3 |
| 维度缺数据 | 互动数据拿不到 | 用代理指标（评论数估互动）|
| 爆款凭感觉 | Top 5 没有指标支持 | 按互动 / 转发排序 |
| 行动太虚 | "加强选题能力" | 含主体 + 动作 + 时间 |

## 输出示例

```markdown
## 竞品分析：科技媒体对标（30d）
对比对象：36氪 / 虎嗅 / 钛媒体 | 本方：VibeTide Tech

### 六维矩阵

| 维度 | VibeTide | 36氪 | 虎嗅 | 钛媒体 |
|-----|---------|------|------|-------|
| 选题 | 3.5/5 | 4.3/5 | 4.0/5 | 3.8/5 |
| 发布节奏 | 日 3-5 | 日 20+ | 日 8-12 | 日 5-8 |
| 标题风格 | 理性 | 悬念+数字 | 反问+名人 | 理性 |
| 视觉 | 简洁 | 封面强 | 配图一般 | 中 |
| 互动 | 3K 均 | 8K+ | 5K | 2K |
| 涨粉 | +1200/w | +5000/w | +3500/w | +800/w |

### Top 爆款（Top 3）

1. **36氪《OpenAI 内部信流出：GPT-6 训练停摆 72h》** 阅读 85w
   - 何以爆：独家 + 悬念 + 行业龙头
   - 可复用：标题 "内部信 / 流出 / XX 小时" 公式
   - 避坑：真假存疑的独家要三方核实后再发

2. **虎嗅《为什么马斯克的 X 突然不灵了》** 阅读 62w
   - 何以爆：名人 + 反问 + 洞察
   - 可复用：反问标题 + 名人视角拆行业
   - 避坑：对个人评判要留分寸

3. ...

### 差异化机会
1. 他们都没做：本土 AI 公司的深度人物稿
2. 他们做但质量一般：AI 监管政策解读（多是快讯）
3. 他们不擅长：数据新闻 / 可视化

### 可抄套路
1. "内部信 / 流出 / XX小时" 悬念公式
2. "为什么 XX 突然不灵了" 反问 + 名人
3. 封面用大字卡片式设计

### 行动清单
1. 【1 周内】本周增加 2 条深度人物稿（xiaowen 主笔）
2. 【2 周内】开数据新闻专题（xiaoshu 主导，配封面工具）
3. 【1 月内】固化 3 个标题公式到知识库 channel_style
```

## EXTEND.md 示例

```yaml
default_time_range: "30d"
default_mode: "matrix"
default_dimensions: ["选题", "发布节奏", "标题风格", "视觉包装", "互动数据", "涨粉速度"]

# 爆款阈值（互动量）
top_hit_threshold: 50000

# 同质化告警 —— 可抄套路与本方已有套路重合 > 80% 时警告
similarity_alert: 0.8
```

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 数据拿不到 | 平台不开放 | 用公开页抓 + 代理指标估 |
| 竞品太多 | > 5 个 | 建议 ≤ 5；多的拆多次 |
| 爆款定义模糊 | 平台基数不同 | 按账号均值的 3x 作为爆款阈值 |
| 抄太近 | 复刻风险 | avoid 强制 ≥ 1 条 |
| 行动不聚焦 | 清单 10+ | Top 3 优先级 + 责任人 |
| 版权风险 | 配图直接套 | 视觉可复用但资产自建 |

## 上下游协作

- **上游**：`news_aggregation` 聚合竞品内容、`web_search` 拉公开数据、运营手动提供竞品清单
- **下游**：`angle_design` 基于 opportunities 扩选题；`headline_generate` 用可抄套路做标题；`data_report` 做月度情报报告

## 参考资料

- 代码实现：[src/lib/agent/execution.ts](../../src/lib/agent/execution.ts)
- 历史版本：`git log --follow skills/competitor_analysis/SKILL.md`

- **媒体行业专业标准（共享）**：[../../docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)
