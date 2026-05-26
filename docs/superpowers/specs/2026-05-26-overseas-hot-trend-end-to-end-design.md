# 海外热榜搬运端到端优化 设计

**日期**: 2026-05-26
**作者**: Zhuyu
**状态**: Brainstorming → Spec
**追踪**: `docs/superpowers/specs/2026-05-26-overseas-hot-trend-end-to-end-design.md`

---

## 1. 背景

### 1.1 现状

VibeTide 已经存在「海外热榜搬运」公共场景（slug `hot_topics_overseas_en`，定义在 `src/db/seed-builtin-workflows.ts:2213`），5 步流水线：

1. `trending_topics` — 拉 24h 国内热榜
2. `topic_classifier` — 美食/萌宠/国内科技 LLM 过滤
3. `cross_language_rewrite` — 中翻英 + 海外本地化
4. `cms_publish` — 入英文稿件库
5. `compliance_check` — 通知编辑

底层 skill 实现已就位（`topic-classifier.ts` / `cross-language-rewrite.ts` 都是真 LLM 调用，走 `model-router` → openai 配置 → 当前 env 是 qwen3-max）；`tophubAdapter` 也已接通真实 TopHub API。

### 1.2 用户反馈的痛点

测试 skill 详情页（如 `/skills/642122e6-1176-48ef-a9c3-a9a0e6c9f627` 即 `trending_topics`）显示"模拟数据"，看不到真实拉取的热榜；想为「海外热榜搬运」做完整验证和优化。

具体诉求：

1. tophub 调用能力封装为可测试的 skill，**测试时显示真实接口数据**（不是 LLM 编故事）
2. 全栈 LLM 调用统一走 **qwen3-max**（env 已配，但代码里有 stale fallback）
3. 海外热榜搬运的"美食/萌宠/国内科技"过滤主题，**支持工作流编辑器加/改/删 + 运行时勾选**
4. 每个环节输出的数据在**任务看板可查看**（mission console 已有 task card，需保证渲染清晰）
5. **多条匹配输出多条稿件**到稿件库；**1 条 topic 可生成多个版本**（参数控制）
6. 每条英文稿在**预览模式 / 翻译模式顶部显示原文链接**（跳回 tophub）

额外新增需求：

7. 在 `/inspiration` 热点话题卡片**新增"海外转发"按钮**（放在快速追踪左侧），点击启动单条 topic 简化工作流，生成英文稿入稿件库。

### 1.3 关键技术发现

- **稿件库尚未集成"发布到华栖云 CMS"UI**：故海外热榜搬运的 step 4 应**只落本地 articles 表**，不调 `publishArticleToCms`。后续若需 CMS 发布能力，单独 spec。
- `articles.sourceUrl` 列已存在（`src/db/schema/articles.ts:72`），DAL 已透出（`src/lib/dal/articles.ts`），UI 没用到。
- `missions_source_dedup_uidx` 是 `(orgId, sourceModule, sourceEntityId)` 复合唯一索引 — 海外转发必须用不同 sourceModule 才能跟快速追踪共存。
- `input-fields-editor` + `workflow-launch-dialog` 已支持 multiselect 类型 + options 添加；真正缺口在 `topic_classifier` schema 硬编码 4 类 enum，用户加新分类后 LLM 返回会被 zod 拒绝。
- `cross_language_rewrite` 输出 schema 当前是 1:1（每条 input → 1 条 output），无 sourceUrl 透传、无 variants。
- `cms_publish` 工具签名是单稿入库（非批量），且默认调 `publishArticleToCms` 入华栖云。
- skill 详情页"测试"按钮的 `testSkillExecution`（`src/app/actions/employee-advanced.ts:196`）当前把 SKILL.md 喂 LLM 让它生成"预期行为"，没真调对应实现函数。
- skill `trending_topics` 的 SKILL.md frontmatter 写的 `scriptPath: src/lib/agent/tools/trending-topics.ts` **该文件不存在**；真实实现在 `src/lib/agent/tool-registry.ts:557` 的 `trending_topics` 工具定义。

## 2. 目标

把海外热榜搬运从「能跑」升级为「真实数据 + 灵活配置 + 多稿入库 + 闭环可查」的端到端能力，并提供单条转发快捷入口。

非目标（明确不做）：

- 不引入 CMS 发布能力到稿件库 UI（单独 spec）
- 不重构 mission-executor 调度架构（保留 LLM 调度 + 预执行工具的现有模式）
- 不引入多模型 router / cost-based routing / 模型降级
- 不做 sourceUrl normalize / URL 已 404 检测
- 不动 `cms_publish` 工具行为（其他工作流仍可正常使用）

## 3. 总体架构

### 3.1 改造模块（M1-M6）

按依赖关系顺序：

| 模块 | 范围 | 依赖 |
|---|---|---|
| M1 | Skill 测试入口真实化 | 无 |
| M2 | 模型路由审计 + qwen3-max 统一 | 无 |
| M3 | 工作流编辑器主题管理 + 动态分类 | 无 |
| M4 | variants + sourceUrl 透传 + `archive_to_drafts` 工具 | M2 |
| M5 | 原文链接 UI（预览/翻译/mission console） | M4 |
| M6 | inspiration "海外转发" 按钮 + 单条 topic 工作流 | M4, M5 |

### 3.2 数据流（海外热榜搬运 + 海外转发）

```
[批量场景 hot_topics_overseas_en]
  step1 trending_topics
    → 30 条 TrendingItem { title, url, heat, ... }
    ↓
  step2 topic_classifier (M3 动态 enum + M4 sourceUrl 透传)
    → N 条 ClassifiedItem { id, category, confidence, sourceUrl }
    ↓
  step3 cross_language_rewrite (M3 string categoryHint + M4 variants + sourceUrl)
    → N×V 条 RewrittenArticle { id, sourceTopicId, variantIndex, title_en, body_en, hashtags, sourceUrl }
    ↓
  step4 archive_to_drafts (M4 新工具，batch 入库，sourceUrl 去重)
    → articles 表写入 M 行 (status='approved', sourceUrl 落库, metadata 含 variantIndex)
    ↓
  step5 compliance_check（通知编辑）

[单条场景 hot_topic_single_overseas_repost — M6]
  入参：source_topic_id / source_title / source_body / source_url / variants_per_topic
    ↓
  step1 cross_language_rewrite (跳过 trending + classifier，直接翻译)
    ↓
  step2 archive_to_drafts (1×V 条入库)
```

### 3.3 UI 数据流

```
articles.sourceUrl
  ↓
  ├→ /articles/[id] preview view → SourceUrlPill (M5)
  ├→ /articles/[id] translate view → SourceUrlPill (M5)
  └→ /missions/[id] step 4 TaskCard 展开 → 新建稿件列表 + SourceUrlPill (M5)

/inspiration topic 卡片 → 海外转发按钮 (M6)
  → startOverseasRepost(topicId)
  → mission 启动
  → router.push(`/missions/${id}`)
```

## 4. 模块详细设计

### 4.1 M1 — Skill 测试入口真实化

**目标**: 让任何带真实工具实现的 skill 在 `/skills/[id]` 测试按钮**直接执行该工具**，不再让 LLM 编故事；写入型工具强制 dryRun 防污染。

**改动文件**:
- `src/app/actions/employee-advanced.ts` — `testSkillExecution`（核心）
- `src/app/(dashboard)/skills/[id]/skill-detail-client.tsx` — 测试 UI 微调

**执行流程**:

```
testSkillExecution(skillId, testInput)
  ↓
1. 查 skill 行 → 提取 skill.name
2. 用 tool-registry.resolveTools([skill.name]) 找真实工具
3a. 找到 → 真实调用路径
    ├ 解析 testInput：JSON 则当 input；空/自然语言用 inputSchema 默认值
    ├ 写入型工具（cms_publish / archive_to_drafts / cms_catalog_sync / external_publish）
    │  强制注入 dryRun=true
    ├ 30s 超时调 tool.execute(parsed, { organizationId, operatorId })
    ├ 结果 JSON.stringify pretty → output
    └ validationChecks 加 "真实接口调用 ✅"
3b. 没找到 → 沿用 LLM 演示路径
```

**真实路径返回**：
- `runtimeInfo.type = "Tool (真实接口)"`（不再写 LLM）
- `runtimeInfo.modelDependency` = 真实数据源（如 `tophub (TRENDING_API_URL)`）
- `executionResult.output` = 完整真实 payload（JSON）
- 截断阈值 8000 字符（避免 UI 卡顿）

**写入型 dryRun**:
- 在工具 `execute` 内识别 `dryRun=true` → 不调 DB.insert / publishArticleToCms，返回 "如果真跑会发生什么" 的 payload
- UI 在测试结果顶部黄色横幅提示
- **实现陷阱**: `cms_publish` 当前实现是先 `db.insert(articles)` 再调 `publishArticleToCms`（`tool-registry.ts:1113`）。dryRun 必须**在 articles insert 之前短路**，否则测试仍会污染 articles 表（验收 SQL 会失败）。`archive_to_drafts` 同理 — dryRun 分支必须在 insert 之前 return mock payload。

**UI 微调**:
- 测试输入框旁加折叠的"参数示例"区，按 skill.name 注入示例 JSON
- 结果区"预期行为"字段 label 改为"真实输出"

**验收**:
1. 进 `/skills/642122e6`（trending_topics）点测试，看到真实平台名 + 真实条目，不再是 LLM 编造
2. 进 `topic_classifier` skill 输入 JSON `{topics:[...]}` 看到真实 LLM 分类结果
3. 进 `cms_publish` skill 测试，黄色横幅 + `SELECT count(*) FROM articles` 不变
4. 没绑工具的纯文档 skill 继续走 LLM 演示
5. 接口报错 → validationChecks 标 fail，不再回退编故事

**范围排除**:
- 不引入 DB migration 同步 `metadata.implementation.scriptPath`
- 不重新设计 testInput schema（保留 string 字段）

---

### 4.2 M2 — 模型路由审计 + qwen3-max 统一

**目标**: 让 `.env.local` 的 `OPENAI_MODEL=qwen3-max` 成为全栈 LLM 调用唯一真相；任何 fallback / 硬编码模型名都清掉或同步。

**审计清单**:

| 类别 | 操作 |
|---|---|
| 代码硬编码模型名 | grep `"deepseek-chat"` / `"deepseek-"` / `"glm-"` / `"zhipu"` 在 `src/**/*.ts`（非测试代码）→ 改成读 `process.env.OPENAI_MODEL` 或抛错 |
| `testSkillExecution` fallback | `src/app/actions/employee-advanced.ts:258` `|| "deepseek-chat"` 改为 fail-fast：`if (!OPENAI_MODEL) throw new Error("OPENAI_MODEL 未配置")` |
| `model-router.ts` 收敛 | 确保它是唯一 provider/model 解析点 |
| SKILL.md frontmatter | 13 个 skill MD 里 `modelDependency: deepseek:*` 改成 `modelDependency: openai:qwen3-max` |
| UI 显示 | skill 详情页"模型依赖"字段从运行时 `getLanguageModel` 真实 provider+model 字符串读 |

**新增脚本**（可选）: `scripts/audit-model-references.ts` 扫描所有 .ts / .md 找违规字符串

**验收**:
1. `grep -rn "deepseek-chat" src/` 非注释/非测试上下文为空
2. `unset OPENAI_MODEL && npm run dev` → skill 测试报"OPENAI_MODEL 未配置"
3. 任一 LLM skill 输出 console 看到 `openai:qwen3-max`
4. 审计脚本输出"无违规"
5. `npx tsc --noEmit` 通过

**关键决策**: **fail-fast > fallback**（宁愿测试入口报错，也不要静默用错模型）

**范围排除**: 不引入多模型 router / 不引入 `models.config.ts` 配置中心

---

### 4.3 M3 — 工作流编辑器主题管理 + 动态分类

**目标**: 让用户在工作流编辑器加的任何 `categories` 选项（如"汽车""旅游"），运行时能被 `topic_classifier` 真实分类。

**关键洞察**:
- `input-fields-editor.tsx` **已支持** multiselect + options 编辑（`:251`）
- `workflow-launch-dialog.tsx` **已支持** multiselect 运行时勾选（`:212`）
- 真正 gap: `topic_classifier` schema 硬编码 4 类 enum（`src/lib/agent/skills/topic-classifier.ts:21`）

**改动文件**:
- `src/lib/agent/skills/topic-classifier.ts` — schema 改运行时构造
- `src/lib/agent/skills/cross-language-rewrite.ts` — `categoryHint` 类型 enum → string

**Schema 改造（topic_classifier）**:

```typescript
// Before
export const OVERSEAS_CATEGORY_ENUM = ["food","pets","domestic_tech","other"] as const;
const CategoryEnumSchema = z.enum(OVERSEAS_CATEGORY_ENUM);

// After
export interface TopicClassifierInput {
  topics: TopicInput[];
  enabledCategories: { value: string; label: string }[];  // 从 workflow inputData.categories 透传
}

function buildClassifierSchema(categoryValues: string[]) {
  const enumValues = [...categoryValues, "other"] as [string, ...string[]];
  return z.object({
    results: z.array(z.object({
      id: z.string().min(1),
      category: z.enum(enumValues),
      confidence: z.number().min(0).max(1),
      reason: z.string().min(2).max(200),
      sourceUrl: z.string().optional(),  // ← M4 透传字段
    })),
  });
}

function buildClassifierPrompt(categories: { value: string; label: string }[]) {
  const lines = categories.map(c => `**${c.value}（${c.label}）**: 按名称语义判断；模糊归 other`).join("\n");
  return `你是话题分类员。从输入中筛出下列类别（不属于则归 other）：\n${lines}\n\nconfidence < 0.7 时归 other。`;
}
```

**Schema 改造（cross_language_rewrite）**:

```typescript
// Before
const CATEGORY_HINT_ENUM = ["food","pets","domestic_tech"] as const;
categoryHint?: CategoryHint;  // 严格 enum

// After
categoryHint?: string;
// categoryTone 查表保留 3 个内置；没命中 → fallback 通用语气
const toneHint = categoryHint
  ? `本批稿件属于 **${categoryHint}**。${categoryTone[categoryHint] ?? "保持简洁直白，无特定语气倾向"}`
  : "";
```

**UI 微调**: 编辑器选中 `categories` 字段时下方加 helper text + "恢复默认 3 类" 按钮

**验收**:
1. 进编辑器加 `{value:"auto",label:"汽车"}` 保存
2. 发起任务运行时表单看到 4 个勾选项
3. 跑通后 mission step 2 输出含 `category:"auto"`
4. step 3 英文稿 hashtags 含 `#AutoNews` 类
5. "恢复默认"按钮能重置
6. `npx tsc --noEmit` 通过

**关键决策**: 用户加的分类**靠 LLM 常识理解 value 名字**，不强求填判断标准

**范围排除**: 不做"每类一段自定义 prompt" / 不做"置信度阈值可配" / 不做全局分类管理页

---

### 4.4 M4 — variants + sourceUrl 透传 + archive_to_drafts

**目标**:
- sourceUrl 从 step 1 一路透传到 articles 表
- 支持 `variants_per_topic`（1-3，默认 1）
- 新增 `archive_to_drafts` 工具批量入库（只落本地，不调 CMS）
- sourceUrl 去重（同 org 已存在则 skip）

**改动文件**:
- `src/lib/agent/skills/topic-classifier.ts` — schema 透传 sourceUrl
- `src/lib/agent/skills/cross-language-rewrite.ts` — schema 加 sourceUrl + variants + sourceTopicId + variantIndex
- `src/lib/agent/tool-registry.ts` — **新增** `archive_to_drafts` 工具
- `src/db/seed-builtin-workflows.ts` — `hot_topics_overseas_en` step 4 切到 `archive_to_drafts` + 加 `variants_per_topic` inputField
- `skills/archive-to-drafts/SKILL.md` — **新增** skill 文档

**核心：`cross_language_rewrite` Schema**:

```typescript
export interface ArticleInput {
  id: string;
  title: string;
  body: string;
  tags?: string[];
  sourceUrl?: string;       // ← 新
  category?: string;        // ← 新（M3 透传）
}

export interface CrossLanguageRewriteInput {
  articles: ArticleInput[];
  targetLanguage: TargetLanguage;
  categoryHint?: string;
  variantsPerTopic?: 1 | 2 | 3;  // ← 新，默认 1
}

const RewrittenArticleSchema = z.object({
  id: z.string().min(1),                       // 唯一稿件 ID 如 t1-v0
  sourceTopicId: z.string().min(1),            // ← 新，原 topic id
  variantIndex: z.number().int().min(0).max(2),  // ← 新
  sourceUrl: z.string().optional(),            // ← 新，透传
  category: z.string().optional(),             // ← 新，透传
  title_en: z.string().min(1).max(140),
  body_en: z.string().min(10),
  hashtags: z.array(z.string()).min(3).max(7),
  cultural_notes: z.string().max(400).optional(),
});

// system prompt 加：
// - "variantsPerTopic=N 时为每条 input 生成 N 个不同切入角度的英文版本
//    (variant 0=headline-driven 短版；variant 1=storytelling 中版；variant 2=analytical 长版)"
// - "id 必须按 <source_id>-v<index> 格式（如 t1-v0、t1-v1）"
// - "sourceUrl / category 必须从输入原样 echo 到输出（每个 variant 都带）"
```

**核心：`archive_to_drafts` 工具**:

```typescript
archive_to_drafts: tool({
  description:
    "把一批稿件批量写入个人稿件库（articles 表）作为指定状态，等待编辑后续处理。" +
    "**只入本地 DB，不调任何外部 CMS / 发布接口**。" +
    "适合：海外热榜搬运、跨语言改写等需要把生成内容落库待审的场景。",
  inputSchema: z.object({
    articles: z.array(z.object({
      title: z.string().min(1).max(200),
      body: z.string().min(10),
      summary: z.string().optional(),
      sourceUrl: z.string().optional(),
      sourceTopicId: z.string().optional(),
      variantIndex: z.number().int().min(0).max(2).optional(),
      language: z.enum(["zh","en"]).optional().default("en"),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      hashtags: z.array(z.string()).optional(),
      culturalNotes: z.string().optional(),
    })).min(1).max(20),
    dedupBySourceUrl: z.boolean().optional().default(true),
    initialStatus: z.enum(["draft","approved"]).optional().default("approved"),
    organizationId: z.string().optional(),
    operatorId: z.string().optional(),
  }),
  execute: async ({ articles: items, dedupBySourceUrl, initialStatus, organizationId, operatorId }) => {
    if (!organizationId) return { success: false, error: { code: "missing_context", message: "缺少 organizationId" } };
    const created = [];
    const skipped = [];
    for (const item of items) {
      if (dedupBySourceUrl && item.sourceUrl) {
        const exists = await db.query.articles.findFirst({
          where: and(
            eq(articles.organizationId, organizationId),
            eq(articles.sourceUrl, item.sourceUrl),
          ),
          columns: { id: true, title: true },
        });
        if (exists) {
          skipped.push({ sourceUrl: item.sourceUrl, existingArticleId: exists.id, reason: "duplicate_source_url" });
          continue;
        }
      }
      const [row] = await db.insert(articles).values({
        organizationId,
        title: item.title,
        body: item.body,
        summary: item.summary ?? null,
        sourceUrl: item.sourceUrl ?? null,
        status: initialStatus,
        tags: [...(item.tags ?? []), ...(item.hashtags ?? [])],
        mediaType: "article",
        publishedAt: null,
        metadata: {
          sourceTopicId: item.sourceTopicId,
          variantIndex: item.variantIndex,
          language: item.language ?? "en",
          category: item.category,
          culturalNotes: item.culturalNotes,
          createdByWorkflow: true,
        },
      }).returning({ id: articles.id, title: articles.title });
      created.push({ articleId: row.id, title: row.title, sourceUrl: item.sourceUrl });
    }
    void operatorId;
    return {
      success: true,
      totalRequested: items.length,
      totalCreated: created.length,
      totalSkipped: skipped.length,
      created,
      skipped,
    };
  },
}),
```

**Workflow seed 修订**:

```typescript
// src/db/seed-builtin-workflows.ts:2257
step(4, "入英文稿件库（待审）", "archive_to_drafts", "稿件入库", "distribution", "store",
  { language: "en", category: "app_overseas_en", initialStatus: "approved" }),

// inputFields 加：
{
  name: "variants_per_topic",
  label: "每个热点生成稿件数",
  type: "number",
  required: false,
  defaultValue: 1,
  validation: { min: 1, max: 3 },
  helpText: "1=每个热点 1 篇；2-3=同一热点产出多版本",
}
```

**验收**:
1. 发起海外热榜搬运（variants=1）→ mission step 4 看到"新建 N 篇，跳过 0 篇"，每篇带 sourceUrl
2. `SELECT id, title, source_url FROM articles ORDER BY published_at DESC LIMIT 10` 每条 sourceUrl 都是 tophub 原链接
3. 同参数跑两次 → 第二次 totalSkipped=N，articles 表不增
4. variants=2 跑一次 → 入库条数是 step 3 通过分类条数的 2 倍，id 是 `tX-v0` / `tX-v1`
5. `SELECT count(*) FROM cms_publications` 不变（确认没调华栖云）
6. status='approved'，publishedAt=null（"已发布"过滤里看不到）
7. `cms_publish` 工具行为不变（向后兼容）
8. `npx tsc --noEmit` 通过

**关键决策**:
- **新建独立工具** `archive_to_drafts`（不污染 cms_publish 语义）
- **完全不调华栖云**（稿件库 UI 尚未支持 CMS 发布）
- 去重默认开 + sourceUrl 主键

**范围排除**:
- 不做 variants 之间互相去重
- 不做 sourceUrl normalize
- 不做 mission-executor 硬注入 fan-out（后续若 LLM 不可靠再做 M4.1）
- 不做 articles 表加 `source_topic_id` / `variant_index` 显式列（jsonb metadata 已够）

---

### 4.5 M5 — 原文链接 UI

**目标**: 把 `articles.sourceUrl` 在 3 个位置可点击跳转：
1. 预览模式（preview view）顶部
2. 翻译模式（translate view）顶部
3. Mission console step 4 卡片展开

**改动文件**:
- `src/components/shared/source-url-pill.tsx` — **新增**共享组件
- `src/app/(dashboard)/articles/[id]/features/reader/meta-header.tsx` — 预览模式接入
- `src/app/(dashboard)/articles/[id]/features/translate/translate-overlay.tsx` — 翻译模式接入
- `src/app/(dashboard)/missions/[id]/mission-console-client.tsx` — step 4 TaskCard 增强

**`SourceUrlPill` 组件**:

```tsx
"use client";
import { ExternalLink } from "lucide-react";

interface SourceUrlPillProps {
  url: string | null | undefined;
  label?: string;          // 默认"查看原文"
  variant?: "default" | "compact";
}

export function SourceUrlPill({ url, label = "查看原文", variant = "default" }: SourceUrlPillProps) {
  if (!url) return null;
  let domain = url;
  try { domain = new URL(url).host.replace(/^www\./, ""); } catch {}
  const baseClass = "inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors";
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className={variant === "compact" ? baseClass : `${baseClass} px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-900/20`}
      title={url}>
      <ExternalLink size={variant === "compact" ? 10 : 12} />
      <span>{label}</span>
      <span className="text-gray-400 dark:text-gray-500">· {domain}</span>
    </a>
  );
}
```

**预览模式接入**（`meta-header.tsx`）: 元信息条最右侧 / 顶部独立一行加 `<SourceUrlPill url={article.sourceUrl} variant="default" />`

**翻译模式接入**（`translate-overlay.tsx`）: 对照面板顶部加 `<SourceUrlPill url={article.sourceUrl} variant="compact" />`

**Mission console step 4 接入**: 识别 task.assignedRole === "archive_to_drafts" → 解 task.outputData 的 created/skipped → 渲染列表 + 每条 SourceUrlPill。`<Link>` 跳内站文章详情，`<a target="_blank">` 跳外链。

**验收**:
1. 跑完 M4 后进 `/articles/<en-id>` 默认预览，顶部看到"查看原文 · weibo.com" chip 跳真链接
2. 切到"翻译模式" view 对照面板顶部同样能看到
3. 进 mission console 展开 step 4 看到"新建 N 篇" + 每条带原文链接
4. sourceUrl=NULL 的稿件预览/翻译模式不渲染 chip（无占位）
5. 移动端不撑破布局
6. `npx tsc --noEmit` + `npm run build` 通过

**关键决策**:
- 新增 1 个共享组件，3 处接入
- 只动 preview + translate 两个 view（用户明确要求范围）
- 内链 `<Link>` + 外链 `<a target="_blank">`

**范围排除**: 不做 404 检测 / 不做截图存档 / 不做 OG metadata 抓取 / 不动其他 view

---

### 4.6 M6 — inspiration "海外转发" 按钮 + 单条 topic 工作流

**目标**: 在 `/inspiration` 热点卡片新增"海外转发"按钮，点击启动 2 步简化工作流（翻译改写 + 落库），生成英文稿件入稿件库。

**改动文件**:
- `src/db/seed-builtin-workflows.ts` — **新增** workflow seed `hot_topic_single_overseas_repost`
- `src/app/actions/hot-topics.ts` — **新增** `startOverseasRepost(topicId)` server action
- `src/app/(dashboard)/inspiration/inspiration-client.tsx` — topic 卡片加按钮 + handler
- `src/lib/types.ts` — `InputFieldDef` 加 `hidden?: boolean`
- `src/components/workflows/workflow-launch-dialog.tsx` — 渲染时跳过 hidden 字段
- `src/db/schema/missions.ts` — 注释更新（`sourceModule` 新枚举值 `hot_topics_overseas`）

**新工作流 seed**:

```typescript
{
  slug: "hot_topic_single_overseas_repost",
  name: "海外转发（单条）",
  description: "把单条选定热点翻译改写成英文稿件入库。海外热榜搬运的简化版。",
  icon: "send",
  category: "social",
  ownerEmployeeId: null,
  defaultTeam: ["xiaowen"],
  inputFields: [
    { name: "source_topic_id", label: "热点 ID（系统注入）", type: "text", required: true, hidden: true },
    { name: "source_title", label: "原标题（系统注入）", type: "text", required: true, hidden: true },
    { name: "source_body", label: "原正文（系统注入）", type: "textarea", required: false, hidden: true },
    { name: "source_url", label: "原文链接（系统注入）", type: "url", required: false, hidden: true },
    {
      name: "variants_per_topic",
      label: "生成稿件版本数",
      type: "number",
      required: false,
      defaultValue: 1,
      validation: { min: 1, max: 3 },
      helpText: "1=单稿；2-3=多版本",
    },
  ],
  systemInstruction: "把这条选定热点改写成 {{variants_per_topic}} 篇适合 X / Instagram 海外读者的英文稿件并入本地稿件库。",
  promptTemplate: "原标题：{{source_title}}\n原文：{{source_body}}\n原文链接：{{source_url}}\n请翻译改写成英文，生成 {{variants_per_topic}} 个版本。",
  isFeatured: false,
  isPublic: true,
  steps: [
    step(1, "翻译改写", "cross_language_rewrite", "中英本地化改写", "content_gen", "translate"),
    step(2, "入英文稿件库（待审）", "archive_to_drafts", "稿件入库", "distribution", "store",
      { language: "en", initialStatus: "approved" }),
  ],
},
```

**Server action**:

```typescript
export async function startOverseasRepost(topicId: string) {
  const user = await requireAuth();
  const profile = await db.query.userProfiles.findFirst({ where: eq(userProfiles.id, user.id) });
  if (!profile?.organizationId) throw new Error("No organization found");

  const topic = await db.query.hotTopics.findFirst({ where: eq(hotTopics.id, topicId) });
  if (!topic) throw new Error("Topic not found");

  // sourceModule="hot_topics_overseas" 跟快速追踪 "hot_topics" 区分，可共存
  const existing = await db.query.missions.findFirst({
    where: and(
      eq(missions.organizationId, profile.organizationId),
      eq(missions.sourceModule, "hot_topics_overseas"),
      eq(missions.sourceEntityId, topicId),
      ne(missions.status, "failed"),
    ),
    columns: { id: true },
  });
  if (existing) return { id: existing.id };

  const template = await db.query.workflowTemplates.findFirst({
    where: and(
      eq(workflowTemplates.organizationId, profile.organizationId),
      eq(workflowTemplates.legacyScenarioKey, "hot_topic_single_overseas_repost"),
    ),
  });
  if (!template) throw new Error("海外转发模板未 seed");

  const res = await startMissionFromTemplate(template.id, {
    source_topic_id: topicId,
    source_title: topic.title,
    source_body: topic.summary ?? topic.title,
    source_url: topic.url ?? "",
    variants_per_topic: 1,
  });
  if (!res.ok) throw new Error(`启动海外转发失败：${Object.values(res.errors).join("; ")}`);

  await db.update(missions).set({
    title: `海外转发：${topic.title}`,
    sourceModule: "hot_topics_overseas",
    sourceEntityId: topicId,
    sourceEntityType: "hot_topic",
  }).where(eq(missions.id, res.missionId)).catch((err) => {
    console.warn("[overseas-repost] backfill source failed:", err);
  });

  revalidatePath("/missions");
  return { id: res.missionId };
}
```

**UI 改造**（`inspiration-client.tsx:1482-1511` 附近）:

```tsx
// 加在快速追踪左侧（第一个 action）
{!isTracked && (
  <button
    onClick={() => onStartOverseasRepost(topic.id)}
    disabled={isRepostPending}
    title="把本条热点翻译改写成英文稿件入稿件库"
    className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 disabled:opacity-50 flex items-center gap-0.5 transition-colors"
  >
    <Globe size={10} />
    {isRepostPending ? "转发中..." : "海外转发"}
  </button>
)}
```

**父组件 handler**:

```tsx
const [isRepostPending, startRepostTransition] = useTransition();
const handleStartOverseasRepost = (topicId: string) => {
  startRepostTransition(async () => {
    try {
      const res = await startOverseasRepost(topicId);
      router.push(`/missions/${res.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "海外转发启动失败");
    }
  });
};
```

**InputFieldDef.hidden 支持**（小改动，但 M6 依赖）:
- `src/lib/types.ts` 给 `InputFieldDef` 加 `hidden?: boolean`
- `workflow-launch-dialog.tsx` 渲染时跳过 `hidden===true` 字段
- mission-executor 不依赖渲染层，inputs 透传时按 defaultValue 填

**验收**:
1. 进 `/inspiration` 任一卡片右下看到 4 个按钮（海外转发/快速追踪/深度追踪/收藏）
2. 点海外转发 → 转圈 → 跳 `/missions/<new-id>`
3. Mission console 2 个 task：翻译改写 + 入稿件库，跑完
4. step 2 展开看到"新建 1 篇"，跳 `/articles/<id>` 看到英文稿
5. 英文稿预览模式顶部看到"查看原文" pill（M5）
6. 同 topic 再点海外转发 → 跳已创建 mission（dedupe）
7. 同时点快速追踪 + 海外转发 → 两个 mission 都能创建（不同 sourceModule）
8. `/articles` 列表能看到新英文稿 status='approved'
9. `SELECT title, source_url, status, metadata FROM articles WHERE metadata->>'createdByWorkflow' = 'true' ORDER BY id DESC LIMIT 5` 完整
10. `npx tsc --noEmit` + `npm run build` 通过

**关键决策**:
- 新建独立工作流模板（只 2 步，复用 M4 改造后 skill）
- `sourceModule="hot_topics_overseas"` 跟快速追踪共存
- emerald Globe 按钮放在快速追踪左侧
- 顺手加 `InputFieldDef.hidden` 支持

**范围排除**:
- 不做批量海外转发
- 不做转发前参数预览对话框（1-click 直接发起）
- 不做"转发后跳到稿件而非 mission"开关

## 5. 执行顺序与每模块独立 commit

按 CLAUDE.md "每个 commit 都能独立 build" 纪律，6 模块按依赖关系串行：

```
M1 (Skill 测试真实化) — 独立
  ↓
M2 (模型路由审计) — 独立
  ↓
M3 (工作流编辑器主题管理) — 独立
  ↓
M4 (variants + sourceUrl + archive_to_drafts) — 依赖 M2 模型路由稳定
  ↓
M5 (原文链接 UI) — 依赖 M4 sourceUrl 入 articles 表
  ↓
M6 (海外转发按钮 + 单条工作流) — 依赖 M4 archive_to_drafts + M5 sourceUrl pill
```

每个模块 commit 时：
1. `npx tsc --noEmit` 通过
2. `npm run build` 通过
3. 该模块验收 checklist 跑过
4. commit message 用中文，附 `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

## 6. 风险与回滚

| 风险 | 影响 | 缓解 |
|---|---|---|
| LLM 不按 prompt 透传 sourceUrl | M4 入库 article.sourceUrl 为空 → M5 pill 不显示 | M4.1 follow-up：mission-executor 检测到 step type archive_to_drafts 且 previousStep 是 cross_language_rewrite → 硬注入 articles[] |
| variants_per_topic > 1 时 LLM 生成的多版本内容雷同 | 稿件库出现高度相似稿件 | M4 prompt 引导明确"3 个 variant 必须明显不同"；编辑可手动删多余的 |
| qwen3-max 在某个 skill 上 schema 输出不稳定 | M3 动态 enum 校验失败 → 全归 other | M2 验收时全 skill 测一遍；如确认问题 → M2.1 加 retry-with-temperature |
| 同一 topic 跑 M6 + 批量场景产生重复 | sourceUrl 相同 → archive_to_drafts dedupe 自动 skip 第二次 | 已设计 dedupBySourceUrl 默认开 |
| seed-builtin-workflows 修改后 seed 重跑机制 | 新增模板 / 改 inputFields 不自动同步到已有 org | seedBuiltinTemplatesForOrg 已支持 upsert（更新 inputFields），M4/M6 改完跑一次 `npm run db:seed` 即可 |

**回滚策略**: 每模块独立 commit → 单独 `git revert <sha>` 即可，不影响其他模块。

## 7. 范围排除汇总

明确不做（YAGNI）:

- 不引入 CMS 发布能力到稿件库 UI（单独 spec）
- 不重构 mission-executor 调度架构
- 不引入多模型 router / 模型降级
- 不做 sourceUrl normalize / 404 检测
- 不做 variants 互相去重
- 不做 articles 表加 `source_topic_id` / `variant_index` 显式列
- 不动 `cms_publish` 工具行为
- 不做"每类一段自定义 prompt"
- 不做全局分类管理页
- 不做批量海外转发
- 不做 mission-executor 硬注入 fan-out（视 LLM 透传可靠性决定是否做 M4.1）

## 8. 后续 spec 候选

- 稿件库 UI 加"发到华栖云 CMS"按钮（独立 spec）
- mission-executor 硬注入 fan-out（M4.1，如果 LLM 透传不可靠）
- 海外转发批量入口（多选 topic 一次性发起）
- 海外发布通道集成（X / Instagram / Facebook 真发布，对接 Ayrshare）

---

**状态**: Brainstorming 已完成；进入 writing-plans 阶段。
