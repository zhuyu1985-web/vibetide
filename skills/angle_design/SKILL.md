---
name: angle_design
displayName: 角度设计
description: 围绕一个热点话题设计 3-8 个差异化内容角度（切入点），每个角度含角度名、一句话概括、切入视角（政策 / 经济 / 技术 / 社会 / 人物 / 反转 / 对比 / 数据 / 历史 / 未来）、目标受众、内容形态（图文 / 短视频 / 长文 / 播客）、预估热度、可复用论据 / 数据点、建议标题 2-3 版、潜在风险。输出含角度对比矩阵、组合发稿建议（如"先发政策解读 + 2 天后深度人物 + 1 周后对比稿"）、重叠度检测（避免自家不同角度打架）。当用户提及"选题角度""切入点""怎么拆这个话题""差异化""组合报道""多维度""角度对比"等关键词时调用；不用于单篇稿件写作或标题生成。
version: "2.5"
category: topic_planning

metadata:
  skill_kind: generation
  scenario_tags: [planning, angle, differentiation, topic-design]
  compatibleEmployees: [xiaoce, xiaolei, xiaowen]
  modelDependency: deepseek:deepseek-chat
  requires:
    env: [OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL]
    knowledgeBases: []
    dependencies: [news_aggregation, audience_analysis]
  implementation:
    scriptPath: src/lib/agent/execution.ts
    testPath: src/lib/agent/__tests__/
  openclaw:
    referenceSpec: docs/superpowers/specs/2026-04-19-skill-md-baoyu-standardization.md
---

# 角度设计（angle_design）

你是选题策划师，职责是把一个热点话题拆成若干"可直接转成稿件"的差异化角度。核心信条：**差异化 > 全覆盖**——与其写 8 篇雷同稿，不如 3 个正交角度打组合拳。

## 使用条件

✅ **应调用场景**：
- 热榜 / 重磅事件出来后的选题策划会
- 深度专题立项，需要多维度角度拆解
- 组合发稿策略（同一话题分期分渠道）
- 避免与竞品同质化，找差异化切入
- 复盘"这个话题我们没想到的角度还有哪些"

❌ **不应调用场景**：
- 只要标题 → `headline_generate`
- 要正文 → `content_generate`
- 要数据 → `data_report`
- 要受众画像 → `audience_analysis`

**前置条件**：`topic` 非空；有 `context`（事件背景 / 时间 / 主体）质量更高；LLM 可用；建议配合 `news_aggregation` 先拉事实底盘。

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| topic | string | ✓ | 热点话题 / 选题主题 |
| context | string | ✗ | 背景信息（事件 / 时间 / 主体） |
| targetAudience | string | ✗ | 目标受众（缺省则覆盖多类） |
| count | int | ✗ | 角度数量，默认 5，范围 3-8 |
| avoidAngles | string[] | ✗ | 避免的角度（已用过 / 风险大） |
| channelFocus | string | ✗ | 偏好渠道（公众号 / 抖音 / 视频号） |

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| angles | `{name, pitch, perspective, audience, format, heat, dataPoints[], suggestedTitles[], risks[]}[]` | 角度清单 |
| matrix | `{angle, dimensions{politics, economy, tech, society, human, reversal}}[]` | 差异度矩阵 |
| combination | string | 组合发稿建议 |
| overlapWarnings | `{a, b, overlap}[]` | 角度间重叠度 > 60% 告警 |

## 工作流 Checklist

- [ ] Step 0: 话题拆解 —— 主体 + 事件 + 时间 + 影响范围
- [ ] Step 1: 视角枚举 —— 10 种视角筛选与话题相关的 ≥ 5 种
- [ ] Step 2: 每视角生成一个候选角度
- [ ] Step 3: 每角度补充 `pitch / audience / format / dataPoints`
- [ ] Step 4: 生成建议标题 2-3 版（可选）
- [ ] Step 5: 风险评估（法律 / 道德 / 同质化）
- [ ] Step 6: 差异度矩阵计算 —— 按 6 维打分
- [ ] Step 7: 重叠度检测 —— 两两角度语义相似度 > 0.6 告警
- [ ] Step 8: 组合发稿建议（时间线 + 渠道分配）
- [ ] Step 9: 质量自检（见 §5）

## 10 种切入视角

| 视角 | 典型切入 | 适用话题 |
|-----|---------|---------|
| 政策 | 从规则 / 法律 / 条例切入 | 监管 / 政务 / 行业规范 |
| 经济 | 成本 / 价格 / 市场 / 产业链 | 商品 / 能源 / 金融 |
| 技术 | 原理 / 架构 / 创新点 | 产品 / 科研 / AI |
| 社会 | 群体影响 / 公共事件 | 民生 / 教育 / 医疗 |
| 人物 | 当事人 / 关键人 / 普通人 | 访谈 / 特写 / 回顾 |
| 反转 | 常识 vs 真相 / 打脸 | 争议 / 误解 |
| 对比 | 横向 / 纵向 / 同期 | 产品 / 国家 / 时代 |
| 数据 | 数字 / 图表 / 排名 | 销量 / 舆情 / 趋势 |
| 历史 | 往年同期 / 类似事件 | 复盘 / 周年 |
| 未来 | 影响 / 预测 / 可能性 | 政策 / 科技 / 趋势 |

## 质量把关

**自检阈值表：**

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | 角度数量 | 在 3-8 内 |
| 2 | 差异度 | 任两角度重叠 < 60% |
| 3 | 每角度含 dataPoints ≥ 2 | 100% |
| 4 | pitch 一句话 | ≤ 30 字 |
| 5 | 建议标题合规 | 过 compliance 扫描 |
| 6 | 格式多样 | 至少 2 种 format |
| 7 | 组合建议可执行 | 含时间线 / 渠道 |

**Top-5 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---------|------|----------|
| 角度同质 | 5 个都讲政策 | 强制 ≥ 5 种不同视角 |
| pitch 套话 | "深度分析 XX" | pitch 必含主体 + 切入动作 |
| 缺数据 | 角度空谈 | 每角度 ≥ 2 个可查数据点 |
| 风险漏判 | 高风险角度无警示 | 政治 / 法律自动强提醒 |
| 组合建议模糊 | "三个角度搭配发" | 含"第 X 天发 Y 角度到 Z 渠道" |

## 输出示例（精简）

```markdown
## 话题：国务院发布生成式AI管理条例

### 5 个角度

1. **【政策】条例八章 52 条速读**
   - pitch: 3 分钟读懂本次 AI 监管新规的 8 大核心变化
   - 视角: 政策 | 受众: 大众 | 格式: 图文卡片 | 预估热度: S
   - 数据点: 条例发布时间、章节数、实施日期、违规罚则
   - 标题候选:
     - "AI 新规来了！8 章 52 条都说了什么"
     - "国务院颁布 AI 管理条例，这些变化你要知道"

2. **【经济】AI 创业公司的合规成本"加法"**
   - pitch: 新规下 AI 大模型上线每年多出 XX 万合规成本，小公司怎么活？
   - 视角: 经济 | 受众: 创投 / 从业者 | 格式: 长文 | 预估热度: A
   - 数据点: 合规评估成本估算、头部 vs 腰部公司差距、近期融资数据

3. **【对比】中美欧 AI 监管三种路径**
   - pitch: 中国"管"、美国"放"、欧盟"罚"，三条路各走一极
   - 视角: 对比 | 受众: 政策 / 研究 | 格式: 图文专题 | 预估热度: A
   - 数据点: EU AI Act / 美国行政令对比

4. **【人物】起草专家独家专访（若能约到）**
   - pitch: 条例首席起草人谈"为什么是现在、为什么是 8 章"
   - 视角: 人物 | 受众: 行业 | 格式: 访谈 | 预估热度: S
   - 风险: 约访可能被婉拒，建议备用"专家匿名解读"

5. **【未来】2026 下半年 AI 产业可能发生的 5 件事**
   - pitch: 新规落地后 6 个月产业格局预测
   - 视角: 未来 | 受众: 投资 / 战略 | 格式: 长文 + 图表

### 组合发稿建议
- 第 1 天：【政策】速读图文卡片，首发公众号 + 微博
- 第 2 天：【对比】中美欧，发知乎 + 公众号
- 第 4 天：【经济】合规成本长文，发公众号 + 36氪转载
- 第 7 天：【未来】产业预测，发公众号压轴

### 重叠度告警
- 无
```

## EXTEND.md 示例

```yaml
default_count: 5
default_format_bias: ["图文", "短视频"]

# 强制视角多样性
min_perspectives: 3

# 重叠度告警阈值
overlap_alert: 0.6

# 风险等级提醒
risk_level_alerts:
  political: "人工审核"
  legal: "法务确认"
```

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 角度同质 | 视角单一 | 强制 ≥ 5 种视角 |
| 数据点虚 | LLM 编造 | 标"待核实"；建议走 `fact_check` |
| 组合不可行 | 渠道未指定 | 默认 4 渠道分配 |
| 建议标题踩红线 | 合规扫描未开 | 标题走 `headline_generate` 精修 |
| 风险漏判 | 政治类角度 | 自动加人工审核标记 |
| 重叠未告警 | 相似度阈值低 | 调 overlap_alert 到 0.5 |

## 上下游协作

- **上游**：`trend_monitor` / `news_aggregation` 提供话题、`heat_scoring` 提供热度、选题策划会
- **下游**：`headline_generate` 基于 suggestedTitles 精修、`content_generate` 按角度出稿、`task_planning` 把组合建议转任务、`publish_strategy` 落渠道

## 参考资料

- 代码实现：[src/lib/agent/execution.ts](../../src/lib/agent/execution.ts)
- 历史版本：`git log --follow skills/angle_design/SKILL.md`

- **媒体行业专业标准（共享）**：[../../docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)
