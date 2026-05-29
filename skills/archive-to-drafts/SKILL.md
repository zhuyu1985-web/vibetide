---
name: archive_to_drafts
displayName: 稿件入库（不发布）
description: 把一批生成稿件批量写入本地 articles 表作为 approved 待审状态。不调任何外部 CMS / 发布接口。支持按 sourceUrl 去重。适合海外热榜搬运、跨语言改写等需要落库待审的场景。
version: "1.0"
category: distribution

metadata:
  skill_kind: distribution
  scenario_tags: [archive, batch, dedupe]
  compatibleEmployees: [xiaowen, xiaofa]
  modelDependency: none
  requires:
    env: [DATABASE_URL]
    knowledgeBases: []
    dependencies: []
  implementation:
    scriptPath: src/lib/agent/tool-registry.ts
    testPath: src/lib/agent/__tests__/
---

# 稿件入库（archive_to_drafts）

把改写好的英文/中文稿件批量入 articles 表，等待编辑后续处理。**只入本地 DB，不调任何外部 CMS / 发布接口**。

## 使用条件

✅ **应调用场景**：
- 「海外热榜搬运」workflow step 4（cross_language_rewrite 产出 N 个 variant 后批量入库）
- 「海外转发」workflow step 2（单条改写产出后入库）
- 编辑批量把生成稿件落库待审

❌ **不应调用场景**：
- 要直接发到华栖云 CMS → 走 `cms_publish`
- 要发外站（X / Instagram）→ 编辑在稿件库手动触发 `publishToAyrshareAction`

## 步骤边界 (Step Boundary)

本 skill 在工作流里通常作为 **step 4 (稿件入库)** —— **只把传入的稿件批量写到 articles 表**。

禁止跨步:
- 不要做发布到外部 CMS (`publishArticleToCms`) 的动作 —— 那是另一个 spec 的工作
- 不要修改 / 重排传入的稿件 —— 保持调用方传过来的内容原样
- 不要从训练数据补充缺失字段 —— 缺什么就缺什么，让上游解决

`dedupBySourceUrl` 默认开启，遇到重复 sourceUrl 不要插入新行，写到 `skipped[]`，同时把已有稿件的 `articleId` 放入 `created[]` / `articles[]` 兼容字段，供下游 CMS 发布步骤继续消费。

## 输入

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `articles` | object[] (1-20) | ✓ | 待入库稿件数组 |
| `articles[].title` | string (1-200) | ✓ | 稿件标题 |
| `articles[].body` | string (≥ 10) | ✓ | 正文 |
| `articles[].summary` | string | ✗ | 摘要 |
| `articles[].sourceUrl` | string | ✗ | 原文链接，去重的关键字段 |
| `articles[].sourceTopicId` | string | ✗ | 来源 topic id（来自 cross_language_rewrite 输出） |
| `articles[].variantIndex` | 0\|1\|2 | ✗ | variant 索引（来自 cross_language_rewrite 输出） |
| `articles[].language` | "zh" \| "en" | ✗ | 默认 "en"，会落 articles.language 列 |
| `articles[].category` | string | ✗ | 上游分类（topic_classifier 输出） |
| `articles[].tags` | string[] | ✗ | 中文 tag |
| `articles[].hashtags` | string[] | ✗ | 英文 hashtag（与 tags 合并后落 articles.tags） |
| `articles[].culturalNotes` | string | ✗ | 本地化决策注解 |
| `dedupBySourceUrl` | boolean | ✗ | 默认 true，sourceUrl 已存在则 skip |
| `initialStatus` | "draft" \| "approved" | ✗ | 默认 "approved"，入库时的 article.status |
| `dryRun` | boolean | ✗ | 测试入口自动注入，跳过所有 DB 操作，但返回 shape-compatible 的 `created[]` |
| `missionId` | string | ✗ | 正式 mission 执行时由执行器注入，落 `articles.mission_id` |

## 输出

- `totalRequested / totalCreated / totalSkipped / totalAvailable`
- `created[]`: 下游兼容字段，表示本次确保可用的稿件，包含新建和去重命中的已有稿件
- `inserted[]`: 本次真实新建稿件的 `articleId + title + sourceUrl`
- `articles[]`: 与 `created[]` 同义，推荐新工作流绑定这个字段
- `skipped[]`: 去重跳过的 `sourceUrl + existingArticleId + reason="duplicate_source_url"`

## 持久化字段

**当前真正写入 articles 表的列**（来自 HEAD 的 tool-registry.ts 实现）：

| articles 列 | 来源 | 备注 |
|---|---|---|
| `organization_id` | 上下文注入 | 多租户隔离 |
| `title` | input.title | |
| `body` | input.body | |
| `summary` | input.summary ?? null | |
| `source_url` | input.sourceUrl ?? null | dedupBySourceUrl 的依据 |
| `mission_id` | 执行器注入 missionId | 用于任务产物归属 |
| `status` | initialStatus（默认 approved） | |
| `tags` | [...input.tags, ...input.hashtags] | 中英 tag 合并 |
| `media_type` | "article" | 硬编码 |
| `published_at` | null | 始终为 null，跟"未发布"语义对齐 |
| `language` | input.language ?? "en" | |
| `metadata` | sourceTopicId / variantIndex / category / culturalNotes / createdByWorkflow | 工作流来源信息 |

**metadata 持久化字段**：

- `sourceTopicId`
- `variantIndex`
- `category`
- `culturalNotes`
- `createdByWorkflow`

## 与 cms_publish 的区别

`cms_publish` 走完整 9 步发到华栖云 CMS（含 publishArticleToCms）；
`archive_to_drafts` **只入本地 articles 表**，不调任何外部接口。
当稿件库 UI 集成 CMS 发布能力后，可由编辑手动触发 cms_publish。

## 质量把关

- `sourceUrl` 去重防止反复跑同一热点污染稿件库（cross_language_rewrite 输出多个 variant 共用同一 sourceUrl 时，第 1 个 variant 入库、其余 skip——按 source 去重的设计）
- 纯去重命中不是失败：只要 `skipped[]` 里有 `existingArticleId`，下游仍可继续用已有稿件发布
- 拒绝 `cross_language_rewrite` 的 `[NEEDS REVIEW]` 兜底稿，且 `language="en"` 时拒绝明显中文内容；这类输入说明上游翻译失败，不能污染英文稿件库
- `published_at` 始终为 null（不算"已发布"，跟稿件库 status 过滤对齐）
- `dryRun=true` 必须在所有 DB 操作之前短路返回（跟 cms_publish 一致），防止测试入口污染 articles 表
- 缺 `organizationId` 直接返回 error code `missing_context`，不允许跨租户写入

## 上下游协作

- **上游**：`cross_language_rewrite`（提供英文 variant 数组）或 `style_rewrite`（中文稿）
- **下游**：编辑在稿件库 `/articles` 列表手动审核；如要发外站可触发 `publishToAyrshareAction`
