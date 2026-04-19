---
name: fact_check
displayName: 事实核查（媒体行业专业版）
description: 对稿件做多源交叉事实验证 —— 4 大核查类型（数字/人名/时间/地点 + 引言） × 3 源交叉验证 × 信源 S/A/B/C/D 分级。识别 AI 幻觉编造、时效失效、统计口径差异、翻译失真等真实错误。守护品牌公信力的最后一道关卡。对接新华社译名表、官方政府数据库、学术论文库等权威源。
category: analysis
version: "5.0"

metadata:
  skill_kind: analysis
  scenario_tags: [all]
  compatibleEmployees: [xiaoshen, xiaoce, xiaozi]
  modelDependency: deepseek:deepseek-chat
  requires:
    env: [OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL, TAVILY_API_KEY, JINA_API_KEY]
    knowledgeBases: [官方信源白名单, 新华社译名表]
    dependencies: [web_search, web_deep_read]
  implementation:
    scriptPath: src/lib/agent/execution.ts
    testPath: src/lib/agent/__tests__/

inputSchema:
  content: 待核查的完整稿件
  focusAreas: 重点核查领域（数字/人名/时间/地点/引言/法规）
  strictLevel: 严格程度 (standard / strict / maximum)
  allowAsyncVerify: 是否允许异步调 web_search 实时核查（默认 true）
outputSchema:
  totalChecks: 核查总数
  passed: 通过数
  issues: 逐项问题清单（含原文、问题类型、正确信息、来源、修改建议）
  credibility: 整体可信度（high/medium/low）
  recommendation: 发布建议 (publish / revise / hold)
  unverifiableCount: 无法验证项数
runtimeConfig:
  type: llm_analysis
  avgLatencyMs: 15000
  maxConcurrency: 3
  modelDependency: deepseek:deepseek-chat
compatibleRoles:
  - quality_reviewer
  - content_strategist
---

# 事实核查（fact_check）

## 1. 使用条件

**应调用场景**：
- 所有 `content_generate` 产出的 `scenario=news_standard / politics_* / sports_chuanchao / premium_content` 类稿件（4 大高风险场景强制）
- `quality_review` 8 维评分前的预处理
- 编辑手动提交的已有稿件核查
- 舆情类稿件发布前的事实钉板

**不应调用场景**：
- 纯观点 / 评论类文章（主观立场不可核查）
- 种草 / 探店等个人体验稿（体验无法公开验证）
- 短剧 / 综艺剧情类（虚构内容）
- 摘要 / 标题单独核查（走 headline_generate / summary_generate 自带）

**前置条件**：
- `content` 长度 ≥ 500
- web_search + web_deep_read 可用（`TAVILY_API_KEY`、`JINA_API_KEY` 配置）
- KB「官方信源白名单」「新华社译名表」已绑定

## 2. 4 大核查类型

事实核查聚焦**可公开验证**的事实，分 4 大类：

### 2.1 数字类（数据 / 统计 / 金额 / 比例 / 排名）

- **典型**：GDP 增速 / 销量 / 市场份额 / 融资金额 / 评分
- **核查维度**：数值 + 单位 + 时间点 + 统计口径
- **常见错误**：国内数据 vs 全球数据混淆；不同机构口径差异；过时数据
- **核查深度**：所有具体数字**必须**附原始数据源

### 2.2 人名类（人物 / 机构 / 职务）

- **典型**：企业家 / 政府官员 / 学者 / 艺人
- **核查维度**：姓名 + 最新职务 + 机构全称
- **常见错误**：职务过时（升迁 / 调任）；姓名错字；机构简称错误
- **核查深度**：
  - 中国公职人员 → 对照各级政府官网最新公告
  - 企业高管 → 对照公司官网 / 财报披露
  - 外国政要 → 对照新华社译名表

### 2.3 时间类（事件时间 / 发布日期 / 预告）

- **典型**：政策发布日期 / 产品发布会 / 历史事件节点
- **核查维度**：精确到日（重要事件精确到小时）+ 时区（UTC/CST 明示）
- **常见错误**：时区混淆（UTC vs CST）；记忆偏差；AI 幻觉（生成似是而非时间）
- **核查深度**：所有具体日期必须在公开报道中可查

### 2.4 地点类（发生地 / 机构所在 / 地域划分）

- **典型**：城市 / 区县 / 街道 / 行政区划
- **核查维度**：最新行政区划（如合并 / 撤销情况）
- **常见错误**：行政区划过时（区县合并）；地名同名混淆；港澳台表述不规范
- **核查深度**：中国行政区划对照民政部最新公告；境外按新华社译名表

### 2.5 引言类（直接引语 / 政策原文 / 专家观点）

- **典型**：领导人讲话 / 公司 CEO 表态 / 专家评论
- **核查维度**：原文逐字对照 + 上下文保真
- **常见错误**：断章取义；翻译失真；记忆错位
- **核查深度**：所有加引号内容**必须**可追溯到原始发言 / 文本

## 3. 3 源交叉验证原则

对每个待核查事实，必须在 ≥ 3 个**权威**信源中交叉验证：

| 源数 | 全部一致 | 2 一致 + 1 异 | 全部不一致 |
|------|---------|---------------|-----------|
| 3 | ✅ 通过 | ⚠️ 存疑（按多数，标注） | ❌ 错误 |
| 2 | ⚠️ 弱通过（需人工复核） | ❌ 错误 | — |
| 1 | ⚠️ 单源孤证（按源权威度判定） | — | — |
| 0 | ❌ 无法核查（根据场景决定是否保留） | — | — |

**信源权威度分级**（详见 [docs/skills/media-industry-standards.md §8](../../docs/skills/media-industry-standards.md)）：
- **S 级**：新华社 / 人民日报 / 中央广播电视总台 / 政府官网
- **A 级**：省级党报党媒 / 中国新闻社 / 各部委官方客户端
- **B 级**：主流商业媒体（21 世纪经济报道 / 第一财经 / 澎湃 / 财新）
- **C 级**：社交平台 / 自媒体（需人工判断机构认证）
- **D 级**：匿名 / 未认证源

**按场景的信源要求**：
- 时政稿 → 仅接受 S + A 级
- 深度稿 → S-B 级，C 级需明确标注「据 XX 报道」
- 娱乐轻资讯 → S-C 级
- D 级 → 不得作为事实来源；仅作为「存在某某传闻」的陈述对象

## 4. 工作流 Checklist

- [ ] **Step 1**：全文扫描提取事实声明（标注位置：段落 + 句子号）
- [ ] **Step 2**：按 5 大类型分类每条事实
- [ ] **Step 3**：对每条事实设计核查策略（可否直接查 / 需 web 搜索 / 需 KB 对照）
- [ ] **Step 4**：执行 3 源交叉验证（并行 `web_search` + KB 查询）
- [ ] **Step 5**：逐项判定（✅/⚠️/❌）+ 记录证据
- [ ] **Step 6**：计算可信度（通过率 / 加权分）
- [ ] **Step 7**：输出结构化报告（含修改建议）
- [ ] **Step 8**：判定 publish / revise / hold

## 5. AI 时代特殊挑战

AI 生成内容的事实核查有**额外的**挑战，fact_check 必须专门处理：

### 5.1 AI 幻觉（Hallucination）

LLM 会生成**语法正确但内容编造**的「事实」，表现：
- 编造不存在的论文作者（「据 XX 教授在《Nature》2024 年 3 月发表研究」）
- 编造似是而非的数据（「市场规模达 1200 亿」但实际 800 亿）
- 混淆相似事件（把 A 公司的融资说成 B 公司）

**对抗策略**：所有具体数字 / 人名 / 论文标题必须 web 核查；命中 D 级源仅 = 不可信。

### 5.2 时效失效

LLM 训练数据有截止日期，**最新事件**可能编造：
- 新政策发布 < 训练截止日
- 最新人事变动未更新
- 最新统计数据过时

**对抗策略**：涉 T-3 天内事件时强制 web 实时查询；涉人事 / 统计必查最新源。

### 5.3 跨语言失真

LLM 翻译中文原文为英文、或英文原文为中文时可能改变语义：
- 政策原文意译走样
- 专家观点弱化 / 强化
- 双关语 / 文化梗丢失

**对抗策略**：涉翻译部分对照双语原文；涉领导人讲话必须对照中央原发通稿。

### 5.4 统计口径混淆

AI 常把不同口径数据混用：
- 国内 vs 全球
- YoY vs MoM
- 营收 vs 利润 vs 现金流
- 出货量 vs 销量 vs 市场份额

**对抗策略**：每个数字必须标注口径（「据 XX 统计，2025 Q4 国内销量达 XX」）。

## 6. 输出结构

```json
{
  "totalChecks": 12,
  "passed": 9,
  "suspicious": 2,
  "errors": 1,
  "unverifiableCount": 0,
  "credibility": "medium",
  "recommendation": "revise",
  "issues": [
    {
      "location": { "section": "正文", "paragraph": 3, "sentenceNumber": 2 },
      "claimType": "number",
      "originalText": "2025 年中国新能源汽车销量突破 1200 万辆",
      "verdict": "passed",
      "correctInfo": "1286.6 万辆",
      "sources": [
        { "name": "中汽协 2026 年 1 月数据", "tier": "S" },
        { "name": "乘联会年终综述", "tier": "S" },
        { "name": "工信部新能源汽车公告", "tier": "S" }
      ],
      "severity": "low"
    },
    {
      "location": { "section": "正文", "paragraph": 8, "sentenceNumber": 1 },
      "claimType": "number",
      "originalText": "欧盟将在 2030 年全面禁售燃油车",
      "verdict": "error",
      "correctInfo": "欧盟计划 2035 年起禁止销售新燃油车，合成燃料车型除外",
      "sources": [
        { "name": "欧盟理事会 2023 年 3 月正式法规", "tier": "S" }
      ],
      "suggestion": "将「2030 年全面禁售」改为「2035 年起禁止销售新燃油车（合成燃料车型除外）」",
      "severity": "high"
    }
  ],
  "metadata": {
    "fact_check_duration_ms": 18500,
    "web_queries_executed": 15,
    "kb_queries_executed": 3
  }
}
```

## 7. 边界场景处理

| 场景 | 处理策略 |
|------|---------|
| 观点性内容（如「这家公司很有创新力」） | 标注 `claimType: opinion`，不参与核查 |
| 实时变动数据（股价 / 汇率） | 标注核查时间戳 + 建议发布前再查 |
| 完全无法核查（匿名 / 未公开） | `verdict: unverifiable`，风险等级按场景定 |
| 历史数据口径差异 | 说明口径差异，不一律判错 |
| 翻译转述失真 | 与原文对照后标注误差幅度 |
| 专家匿名引言 | 要求公开信息认证；否则建议修改为「据某行业人士」+ 保留风险标注 |

## 8. EXTEND.md 示例

```yaml
fact_check_config:
  strict_scenarios: [politics_shenzhen, news_standard, premium_content, sports_chuanchao]
  default_level: standard
  require_human_review_on_error: true  # 任何 error 强制人工复核

  source_priority:
    politics_shenzhen: [S]               # 只接受 S 级
    news_standard: [S, A]                # S + A 级
    premium_content: [S, A, B]           # 允许 B 级
    livelihood_*: [S, A, B, C]           # 生活类可用 C 级

  web_verify_scope:
    numbers: always                      # 所有数字必查
    names: if_not_in_kb                  # KB 命中则跳过 web
    times: if_t_minus_3_days             # T-3 天内事件必查
    quotes: always                       # 所有加引号必查
```

## 9. 参考资料

- **官方信源白名单**：[references/source-whitelist.md](./references/source-whitelist.md)（S/A 级信源全清单 + API 端点）
- **典型核查错误案例**：[references/typical-errors.md](./references/typical-errors.md)（20+ 真实案例 + 错误模式）
- **媒体行业规范**：[docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)（信源分级 / 违规案例库 / AIGC 合规）
- **上游 skill**：`web_search`（Tavily 搜索）、`web_deep_read`（Jina Reader 深读）、`knowledge_retrieval`（KB 查询）
- **下游 skill**：`quality_review`（事实核查作为 factAccuracy 维度输入）
- 代码实现：[src/lib/agent/execution.ts](../../src/lib/agent/execution.ts)
- 历史版本：`git log --follow skills/fact_check/SKILL.md`

## 10. 上下游协作

**上游输入方**：
- `content_generate`：生成稿件后立即调 fact_check
- `xiaoshen`（质量审核官）：手动送审
- Inngest `leader-consolidate`：任务完成前兜底核查

**下游消费方**：
- `quality_review`：读取 `credibility` + `issues` 作为 `factAccuracy` 评分依据
- `cms_publish`：`recommendation=publish` 才允许入库
- `learning-engine`：核查发现的错误模式写入员工 `memories` 用于下次改进

## 11. 常见问题

**Q1：fact_check 报错「无法验证」怎么办？**
A：三种处理方式：
1. 删除该事实声明（如不是核心信息）
2. 改为模糊表述（「据相关报道」「业内估算」）
3. 保留并标注「以上数据待进一步确认」

**Q2：不同信源数据口径不同怎么办？**
A：**标注口径差异**，不一律判错。例如：
- 中汽协：1286.6 万辆（国内零售口径）
- 乘联会：1298.2 万辆（批发口径）
- 建议稿件明确标注「据 XX 口径」

**Q3：fact_check 速度很慢怎么办？**
A：这是设计必要代价。稿件核查 100 个事实 × 3 源 × 2 秒 = 10 分钟是正常的。
优化方向：
- 并行 web_search（Tavily 支持并发）
- KB 先命中可跳过 web
- 配置 `allowAsyncVerify=true` 后台异步核查

**Q4：为什么 AI 生成的数字经常错？**
A：LLM 的数字幻觉是已知问题。fact_check 必须强制外部验证所有具体数字。
我们的策略：
- content_generate 阶段禁止 LLM 编造具体数字（无原始数据时只能定性表述）
- fact_check 阶段全部外部核查
- quality_review 阶段 factAccuracy 维度对未核查的数字扣分严厉
