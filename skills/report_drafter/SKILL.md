---
name: report_drafter
displayName: 学术报告草拟
description: 把模板插值的数据简报草稿 + 命中文章统计聚合输入，转写成学术中性、第三人称、引用具体数字的研究背景 / 数据简报学术润色 / 研究发现段落（A5 Inngest 报告导出 Step 3 调用）。
version: "1.0"
category: content_gen
compatibleRoles: ["xiaoyan"]

metadata:
  skill_kind: content_generation
  scenario_tags: [academic, research-report]
  modelDependency: deepseek:deepseek-chat
  requires:
    env: [OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL]
    knowledgeBases: []
    dependencies: []
  implementation:
    scriptPath: src/inngest/functions/research-report-generate.ts
    testPath: src/inngest/functions/__tests__/
  openclaw:
    referenceSpec: docs/superpowers/specs/2026-05-07-a6-xiaoyan-design.md
---

# 学术报告草拟（report_drafter）— STUB

Phase 2 填充完整 baoyu 10-12 章 body。
