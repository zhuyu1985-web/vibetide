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

把改写好的英文/中文稿件批量入 articles 表，等待编辑后续处理。

## 使用条件

当 workflow 走「海外热榜搬运」step 4 / 「海外转发」step 2，或编辑想批量把生成稿件落库待审时调用。

## 输入

- `articles[]` (1-20)：每条含 title / body / summary / sourceUrl / sourceTopicId / variantIndex / language / category / tags / hashtags / culturalNotes
- `dedupBySourceUrl` (default true)：sourceUrl 已存在则 skip
- `initialStatus` (default "approved")：入库时的状态
- `dryRun` (optional)：测试入口自动注入，跳过所有 DB 操作

## 输出

- `totalRequested / totalCreated / totalSkipped`
- `created[]`: 新建稿件的 articleId + title + sourceUrl
- `skipped[]`: 去重跳过的 sourceUrl + 现有 articleId + reason

## 与 cms_publish 的区别

`cms_publish` 走完整 9 步发到华栖云 CMS（含 publishArticleToCms）；
`archive_to_drafts` **只入本地 articles 表**，不调任何外部接口。
当稿件库 UI 集成 CMS 发布能力后，可由编辑手动触发 cms_publish。

## 质量把关

- sourceUrl 去重防止反复跑同一热点污染稿件库
- 工作流元信息分散落已有列：language → `articles.language`；sourceTopicId → `articles.translated_from_topic_id`（uuid FK to hot_topics）；variantIndex / category / culturalNotes → `articles.advisor_notes`（jsonb string[]）
- publishedAt 始终为 null（不算"已发布"，跟稿件库 status 过滤对齐）

## 上下游协作

- 上游：`cross_language_rewrite`（提供英文稿）或 `style_rewrite`（中文稿）
- 下游：编辑在稿件库 `/articles` 列表手动审核
