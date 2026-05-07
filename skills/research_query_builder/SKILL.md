---
name: research_query_builder
displayName: 研究检索构建
description: 把用户口语化的研究检索需求（如"2025 上半年重庆乡村振兴的省级及以上媒体报道"）翻译成 vibetide A4 高级检索的 AdvancedSearchCondition[] + SidebarFilter JSON。
version: "1.0"
category: data_collection
compatibleRoles: ["xiaoyan", "xiaolei"]

metadata:
  skill_kind: data_collection
  scenario_tags: [academic, research-search]
  modelDependency: deepseek:deepseek-chat
  requires:
    env: [OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL]
    knowledgeBases: []
    dependencies: []
  implementation:
    scriptPath: src/lib/agent/skills/research-query-builder.ts
    testPath: src/lib/agent/skills/__tests__/research-query-builder.test.ts
  openclaw:
    referenceSpec: docs/superpowers/specs/2026-05-07-a6-xiaoyan-design.md
---

# 研究检索构建（research_query_builder）— STUB

Phase 3 填充完整 baoyu 10-12 章 body。
