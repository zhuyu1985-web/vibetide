---
name: knowledge_retrieval
displayName: 知识检索
description: 从组织四类内部知识库（频道风格库 / 敏感话题库 / 领域知识库 / 通用库）中做基于向量相似度的语义检索，把组织多年沉淀的「稿件风格 / 历史爆款结构 / 红线处理原则 / 政策与行业事实 / 历史判例」精准召回到当前任务上下文。核心能力含：并行跨库召回、相似度 ≥ 0.9 自动去重、基于 KB 权威度（频道 > 敏感 > 领域 > 通用）的精排、每条结果附 200 字前后文 + 出处 + 更新时间、同主题跨库冲突显式标注、超过 6 个月未更新的条目过期预警、空结果时推荐相近主题。所有检索严格按 organization_id 隔离，避免跨租户泄漏。当用户提及"知识库有什么""我们以前怎么写这类题""频道风格""敏感词规则""背景知识""历史定稿参考"等关键词时调用；不用于外部实时信息或媒资素材检索。
version: "2.0"
category: other

metadata:
  skill_kind: data_collection
  scenario_tags: [knowledge-base, context, style-guide, compliance-rules]
  compatibleEmployees: [xiaozi, xiaowen, xiaoshen, xiaoce]
  modelDependency: deepseek:deepseek-chat
  requires:
    env: [JINA_API_KEY, OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL]
    knowledgeBases:
      - 频道风格库（推荐）
      - 敏感话题库（推荐）
      - 领域知识库（按题材）
    dependencies: []
  implementation:
    scriptPath: src/lib/knowledge/retrieval.ts
    testPath: src/lib/knowledge/__tests__/
  openclaw:
    referenceSpec: docs/superpowers/specs/2026-04-19-skill-md-baoyu-standardization.md
---

# 知识检索（knowledge_retrieval）

你是知识管理专家，负责把组织多年沉淀的「稿件风格 / 敏感话题规则 / 领域事实 / 历史判例」等内部知识，精准召回到当前任务上下文里。核心信条：**语义优先 > 关键词匹配，出处必标 > 裸结论，近期优先 > 过期内容**。

## 使用条件

✅ **应调用场景**：
- 创作前注入**频道风格库**（该栏目历史爆款的结构 / 语气 / 标题范式）
- 合规审查前注入**敏感话题库**（红线词 / 处理原则 / 历史案例）
- 深度稿前注入**领域知识库**（政策 / 行业数据 / 专家观点）
- 事实核查时从内部查已有定稿做参照
- 新人 / 新员工查询"我们以前怎么处理这类题"

❌ **不应调用场景**：
- 查外部实时信息（走 `web_search` / `news_aggregation`）
- 查媒资素材（走 `media_search`）
- 组织还没建任何知识库时（返回空 + 引导管理员去建）
- 查最新政策 / 快讯（内部知识库有滞后性）

**前置条件**：组织已建 ≥ 1 个知识库且文档已完成向量化；调用方绑定了可访问的知识库（基于员工 KB 绑定关系）；向量服务（Jina embeddings）可用。

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| query | string | ✓ | 检索描述（自然语言） |
| kbTypes | enum[] | ✗ | `general` / `channel_style` / `sensitive_topics` / `domain`，默认全部 |
| kbIds | string[] | ✗ | 指定具体 KB ID（优先级高于 `kbTypes`） |
| topK | int | ✗ | 返回条数，默认 5，最大 20 |
| minScore | float | ✗ | 相关度下限，默认 0.6，范围 0-1 |
| includeStale | boolean | ✗ | 是否包含 6 个月未更新的内容，默认 `false` |

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| results | `{chunk, source, kb, relevance, updatedAt, context}[]` | 知识片段列表 |
| knowledgeGraph | `{concepts[], relatedTopics[], furtherReading[]}` | 概念关联图 |
| totalMatches | int | 召回总数（未裁剪到 `topK` 前） |
| conflicts | `{topic, versions[]}[]` | 跨库冲突条目 |
| stalenessWarnings | string[] | 可能过期 |
| warnings | string[] | KB 为空 / 绑定缺失等 |

## 工作流 Checklist

- [ ] Step 0: 查询理解 —— 抽取关键概念 / 实体 / 约束条件
- [ ] Step 1: 查询扩展 —— 必要时增加同义词、缩写、关联实体
- [ ] Step 2: 选 KB —— `kbIds` > `kbTypes` > 员工绑定默认列表
- [ ] Step 3: 并行向量检索 —— 每个 KB 独立召回 `topK × 2` 条候选
- [ ] Step 4: 跨库去重 —— 相似度 ≥ 0.9 合并；保留 `updatedAt` 最新的
- [ ] Step 5: 精排 —— cosine + 最新时间 + KB 权威度（频道库 > 敏感库 > 领域库 > 通用库）
- [ ] Step 6: 上下文补充 —— 每条结果附前后 200 字 + 文档标题 + 更新时间
- [ ] Step 7: 冲突检测 —— 同主题不同库有矛盾描述时写入 `conflicts`
- [ ] Step 8: 知识图谱 —— 聚合核心概念 / 关联主题 / 延伸阅读链接
- [ ] Step 9: 过期预警 —— 超过 6 个月未更新的条目加 `stalenessWarnings`

## 跨库策略

| KB 类型 | 权威度 | 典型内容 | 使用时机 |
|--------|-------|---------|---------|
| `channel_style` | ⭐⭐⭐⭐⭐ | 频道风格 / 标题范式 / 爆款结构 | **每次创作前必注入** |
| `sensitive_topics` | ⭐⭐⭐⭐⭐ | 红线词 / 处理原则 / 判例 | 合规审查前必注入 |
| `domain` | ⭐⭐⭐⭐ | 政策 / 数据 / 专家观点 | 深度稿 / 数据新闻 |
| `general` | ⭐⭐⭐ | 组织日常积累 | 兜底召回 |

**冲突处理原则**：`channel_style` 与 `domain` 冲突时以 `channel_style` 为准（风格表达优先）；`sensitive_topics` 与任何库冲突时以 `sensitive_topics` 为准（合规不可让）；其他冲突标注在 `conflicts` 里由人工决策。

## 质量把关

**自检阈值表：**

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | 所有结果 relevance ≥ `minScore` | 100% |
| 2 | 出处完整 | 100%（KB 名 + 文档名 + 更新时间） |
| 3 | 前后文可阅读 | 每条 ≥ 200 字上下文 |
| 4 | 跨库去重 | 相似度 ≥ 0.9 必合并 |
| 5 | 过期标注 | 超过 6 个月未更新全部标注 |
| 6 | 冲突显式标注 | `conflicts` 字段不可静默吞掉 |
| 7 | 空结果引导 | `results=[]` 时给出相近主题推荐 |

**Top-5 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---------|------|----------|
| 关键词硬匹配伪语义 | 返回含关键词但不相关的 chunk | 强制走向量召回 + 精排；丢弃 cosine < 0.6 |
| 上下文不足 | 单独一句话看不懂 | 前后 200 字兜底；必要时扩到整段 |
| 过期内容误用 | 拿 2 年前的政策当最新 | 默认 `includeStale=false`；命中必 warnings |
| 冲突沉默 | 两个 KB 写的不一样却都返回 | Step 7 显式生成 `conflicts` |
| 跨 org 泄漏 | KB 绑定校验缺失 | 所有检索严格 `organizationId` 过滤 |

## 输出示例

```markdown
## 知识检索结果：新能源汽车补贴政策变化
**检索范围**: 3 个知识库 | **匹配条目**: 5 条

### 检索结果

#### 1. 2026年新能源汽车购置税减免政策解读
- 来源：行业政策库 > 新能源政策合集.pdf
- 更新时间：2026-01-15
- 相关度：★★★★★（0.91）
- 内容摘要：
  > 2026 年起，新能源汽车购置税减免政策延续至 2027 年底，单车免税额上限调整为 3 万元。插电混动车型补贴标准下调 15%，纯电车型维持不变。……
- 关联知识：地方补贴叠加政策、充电基础设施规划

#### 2. 各省市新能源补贴细则对比
- 来源：市场研究库 > 地方政策跟踪.docx
- 更新时间：2026-02-28
- 相关度：★★★★☆（0.83）
- 内容摘要：
  > 截至 2026 Q1，北京 / 上海 / 广州 / 深圳均出台了地方性补贴政策，补贴金额 5000~2 万元不等，重点支持换购场景。……

### 跨库冲突
- 无

### 知识图谱
- 核心概念：购置税减免 / 地方补贴 / 新能源汽车
- 关联主题：充电基础设施 / 以旧换新 / 二手车评估
- 推荐延伸阅读：2025 年销量数据回顾 / 锂电池产能趋势

### 过期预警
- 无
```

## EXTEND.md 示例

```yaml
default_kb_types: ["channel_style", "sensitive_topics", "domain", "general"]
default_top_k: 5
default_min_score: 0.6

# 员工默认绑定的 KB（查询未指定时使用）
employee_default_kbs:
  xiaowen: ["news-style-v2", "sensitive-political"]
  xiaoshen: ["sensitive-political", "sensitive-legal"]

# KB 权威度权重
kb_authority_weights:
  channel_style: 1.0
  sensitive_topics: 0.95
  domain: 0.8
  general: 0.6

# 过期阈值（天）
stale_threshold_days: 180
```

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 召回为空 | KB 未建 / 绑定缺失 / query 太冷门 | warnings 引导；推荐相近主题 |
| 返回过期内容 | 默认排除 stale | 检查 `includeStale`；或下调 `stale_threshold_days` |
| 跨 org 看到别人数据 | 绑定校验失效 | DAL 层强制 `organizationId` 过滤 |
| 冲突沉默 | 输出只给一条 | 启用 `conflicts` 字段；人工决策 |
| 出处缺失 | 旧文档元数据不全 | 在 KB 管理侧补元数据 |
| 想加入最新外部信息 | 本技能仅内部 | 组合 `web_search` + `news_aggregation` |

## 上下游协作

- **上游**：选题策划 / 内容创作前注入、合规审查前注入、Q&A 场景触发
- **下游**：`content_generate` / `style_rewrite` 基于 channel_style 片段做写稿；`compliance_check` 用 sensitive 片段做红线对照；`fact_check` 做内部交叉验证

## 参考资料

- 代码实现：[src/lib/knowledge/retrieval.ts](../../src/lib/knowledge/retrieval.ts)（应用层 cosine + 向量存 jsonb）
- 切片策略：[src/lib/knowledge/chunking.ts](../../src/lib/knowledge/chunking.ts)
- Embedding：[src/lib/knowledge/embeddings.ts](../../src/lib/knowledge/embeddings.ts)（Jina jina-embeddings-v3）
- 历史版本：`git log --follow skills/knowledge_retrieval/SKILL.md`

- **媒体行业专业标准（共享）**：[../../docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)
