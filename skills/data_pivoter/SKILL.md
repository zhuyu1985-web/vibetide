---
name: data_pivoter
displayName: 数据透视分析
description: 把用户口语化的数据透视需求（如"按主题×媒体分级透视"）翻译成 pivot_config（rows/cols/measure/filter）+ chart_type（bar/heatmap/donut/line），并可选基于 current_report_id 计算 5×5 预览。
version: "1.0"
category: data_analysis
# compatibleRoles 必须用 ai_employees.role_type 的值（如 research_analyst / trending_scout / data_analyst），
# 不是 employee slug（xiaoyan / xiaolei …）；src/lib/dal/skills.ts:519 按 roleType 匹配。
compatibleRoles: ["research_analyst", "data_analyst"]

metadata:
  skill_kind: data_analysis
  scenario_tags: [academic, research-pivot]
  modelDependency: deepseek:deepseek-chat
  requires:
    env: [OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL]
    knowledgeBases: []
    dependencies: []
  implementation:
    scriptPath: src/lib/agent/skills/data-pivoter.ts
    testPath: src/lib/agent/skills/__tests__/data-pivoter.test.ts
  openclaw:
    referenceSpec: docs/superpowers/specs/2026-05-07-a6-xiaoyan-design.md
---

# 数据透视分析（data_pivoter）— STUB

Phase 4 填充完整 baoyu 10-12 章 body。
