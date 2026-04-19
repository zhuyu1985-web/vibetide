# Track B — Skill MD 按 baoyu-skills 标准中等深度重写

**日期：** 2026-04-19
**作者：** PM (zhuyu) + Claude
**状态：** 待实现
**范围：** B-Narrow（13 个 CMS/AIGC/场景 skill）+ 中等深度（无 3 层拆分，保单文件）

---

## 1. 设计原则

> **严谨不失轻便，规范不失易读。** 把每个 skill MD 从 VibeTide 的"企业 SOP"风格压缩为 baoyu-skills 的"开源工具 README"风格，主文件控制在 ~250 行，核心业务规则保留，冗余一律去除。

**具体推论：**

1. 不做 3 层拆分（不创建 `subtemplates/*.md` 或 `EXTEND.md` 附属文件）
2. 主 SKILL.md 目标体积：200-300 行（原 500-1200 行）
3. Frontmatter 精简：去掉 runtime.avgLatencyMs 等监控类字段，保留业务所需
4. Body 章节压缩：从 16-25 章降到 10-12 章
5. 代码引用改外链：TypeScript Schema 完整定义、Changelog、实现文件路径改为代码/git 链接，不再内嵌

---

## 2. 13 个目标 Skill 清单

按 category 分三组：

### A. B 类（管理/动作）— 3 个

| Skill | 当前行数 | 目标 | 核心业务 |
|-------|--------|------|--------|
| cms_publish | 683 | 250 | CMS 稿件入库调度 |
| cms_catalog_sync | 519 | 220 | CMS 栏目同步 |
| aigc_script_push | 521 | 220 | AIGC 脚本推送到渲染平台 |

### B. 场景脚本类 — 5 个

| Skill | 当前行数 | 目标 | 核心业务 |
|-------|--------|------|--------|
| script_generate | 476 | 220 | 视频脚本生成（场景分化） |
| duanju_script | 1211 | 300 | 短剧脚本（最大，需重点瘦身） |
| zhongcao_script | 782 | 280 | 种草脚本 |
| tandian_script | 620 | 250 | 探店脚本 |
| podcast_script | 714 | 270 | 播客脚本 |
| zongyi_highlight | 623 | 250 | 综艺精彩片段 |

### C. Rewrite 类 — 5 个

| Skill | 当前行数 | 目标 | 核心业务 |
|-------|--------|------|--------|
| content_generate | 644 | 240 | 正文生成 |
| headline_generate | 426 | 200 | 标题生成 |
| summary_generate | 258 | 180 | 摘要生成（已经较精简，少量调整） |
| style_rewrite | 320 | 200 | 风格改写 |

**总计：** 13 个 skill。当前总行数 **7797**，目标 **~3280**（压缩 ~58%）。

---

## 3. Frontmatter 标准

### 3.1 精简后 Frontmatter（标准格式）

```yaml
---
name: cms_publish
displayName: CMS 文稿入库发布
description: <一句话描述，含"当用户提及 X/Y/Z 时调用"的触发条件>
version: 5.0.0
category: management             # 保留：与 DB skill_category enum 对齐

metadata:
  skill_kind: action             # action / generation / retrieval / analysis（baoyu 无此字段，VibeTide 特有）
  scenario_tags: [news, politics, sports, variety]   # 适用场景标签
  compatibleEmployees: [xiaofa, xiaoshen, leader]    # 可调用的员工
  modelDependency: anthropic:claude-opus-4-7         # 生成类需要；管理/检索类可省
  requires:
    env: [CMS_HOST, CMS_LOGIN_CMC_ID]
    knowledgeBases: []             # 可空
    dependencies: [cms_catalog_sync]
  implementation:
    scriptPath: src/lib/cms/publish/publish-article.ts
    testPath: src/lib/cms/__tests__/publish/
  openclaw:
    schemaPath: src/lib/cms/types.ts#CmsArticleSaveDTO
    referenceSpec: docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md
---
```

### 3.2 删除的 Frontmatter 字段

- `runtime.avgLatencyMs` / `runtime.maxConcurrency` / `runtime.timeoutMs` — 属于运行时监控，非使用文档
- `runtime.type` — 大部分情况可从 `metadata.skill_kind` 推断
- `subtemplates` — 改为 body 里的"子模板导读表"（见 §4.4）

### 3.3 保留/新增的 Frontmatter 字段

- `metadata.skill_kind` 保留（action / generation / retrieval / analysis）
- `metadata.scenario_tags` 保留（UI 过滤用）
- `metadata.compatibleEmployees` 保留（agent 路由用）
- `metadata.modelDependency` 仅生成类保留
- `metadata.requires.{env, knowledgeBases, dependencies}` 保留但精简（列清单即可，不写描述）
- `metadata.implementation.{scriptPath, testPath}` **新增**（baoyu 风格：指向代码文件）
- `metadata.openclaw.{schemaPath, referenceSpec}` **新增**（类型定义/spec 外链）

---

## 4. Body 章节标准

### 4.1 精简后的章节模板（10 章）

```markdown
# <Skill 显示名>

## 使用条件（合并 "When to Use" + "Prerequisites"）
- ✅ 何时调用（2-4 条）
- ❌ 何时不调用（2-3 条）
- 前置依赖：指向 metadata.requires

## 输入 / 输出（合并 Input Schema + Output Schema）
- 输入简要表（字段名 / 类型 / 是否必填 / 说明）
- 输出简要表
- 完整 Zod Schema 见 `metadata.openclaw.schemaPath`（外链）

## 工作流 Checklist（保留，精简到 5-8 步）
- [ ] 每步 1-2 行说明，不展开子步
- 详细实现见 `metadata.implementation.scriptPath`

## 子模板分化（仅 script-heavy skill 需要；其他 skill 跳过本节）
- 摘要表：子模板名 / 触发条件 / 核心差异
- 每个子模板不展开详细规范，只给 2-3 行关键点
- 详细规范放 scriptPath 对应代码的注释/常量里

## 质量把关（合并 "质量自检" + "典型失败模式"）
- 自检阈值表（10-15 项核心指标，非 20+）
- Top-3 典型失败模式 + 修正 hint（不展开完整子方案）

## 输出模板 / 示例（保留，精简）
- 1 个完整的正例（Markdown 或 JSON 样本，≤ 40 行）
- 不再列"反例对比"

## EXTEND.md 用户配置示例（baoyu 特色；保留简版）
- 1 个 YAML 最小配置样例（≤ 20 行）
- 说明 3 个最常用的可配置项

## 上下游协作
- 前驱 skill（1-3 个）
- 后继 skill（1-3 个）
- 数据契约链接

## 常见问题（FAQ，替代 "Troubleshooting"）
- Top-5 FAQ（每条 2-3 行答案）

## 参考资料
- 代码实现：`metadata.implementation.scriptPath`（链接）
- Schema 定义：`metadata.openclaw.schemaPath`
- 完整规范：`metadata.openclaw.referenceSpec`
- 历史版本：`git log --follow skills/<name>/SKILL.md`
```

### 4.2 删除的章节

- **Language 声明** — 移到全局（`skills/README.md` 或各 skill 首行注释），不再每文件重复
- **Changelog** — 改为"参考资料"里的 `git log` 链接
- **Feature Comparison** — 仅保留"边界划分"一句话，不再列对标表
- **Completion Report 详细模板** — 保留于 scriptPath 代码注释；body 只给简要 JSON 样本
- **反例集合** — 仅保留 Top-3 失败模式，不全列
- **详细失败修正方案** — 原方案可能 50+ 行；改为 2-3 行 hint
- **"Anthropic Skill 协议说明"等元描述** — 删除

### 4.3 合并后的章节对照

| 原章节（VibeTide 当前） | 新章节 |
|-----------------------|--------|
| When to Use + Prerequisites + Pre-flight Check | 使用条件 |
| Input Schema + Output Schema + Completion Report | 输入 / 输出 + 输出模板 |
| Workflow Checklist | 工作流 Checklist |
| 详细规范 / 子模板说明 | 子模板分化（摘要表） |
| 质量自检清单 + 典型失败模式 | 质量把关 |
| EXTEND.md 用户配置 | EXTEND.md 示例 |
| Feature Comparison | 上下游协作 |
| 上下游协作 | 上下游协作 |
| Troubleshooting | 常见问题 |
| Changelog + 参考实现文件 | 参考资料（链接） |

### 4.4 script-heavy skill 特殊处理（duanju_script / zhongcao_script / podcast_script）

这些 skill 有 N 个子模板（e.g., duanju_script 有 12 个子类型），详细规范内嵌会超长。处理方式：

**保留：**
- 子模板摘要表（12 行内）
- 每个子模板 2-3 行关键差异（Total: ~30-40 行）

**外置（改为 scriptPath 对应代码的导出常量）：**
- 每个子模板的完整 shotlist 模板
- 每个子模板的 24 项质量阈值
- 每个子模板的音频/画面/配音详细要求

**Code-side representation（duanju_script 示例）：**
在 `src/lib/agent/skills/duanju-subtemplates.ts` 里（假设路径）：
```ts
export const DUANJU_SUBTEMPLATES = {
  "urban_romance": {
    shotlistTemplate: "...",
    qualityThresholds: { ... },
    voiceStyle: "...",
  },
  // 11 more
};
```

SKILL.md 引用：`具体子模板常量见 metadata.implementation.scriptPath 目录下的 duanju-subtemplates.ts`

**本 spec 不要求立即创建这些代码文件**（那会膨胀 scope）；允许在 SKILL.md 中先放个 "TODO: extract to scriptPath" 标记，由 follow-up PR 真正外置。关键是 SKILL.md 体积瘦下来。

---

## 5. 删减优先级（每个 skill 必做）

按优先级打分，dev 改造每个 skill 时按列表机械执行：

1. **P0 删（必删）：**
   - 所有 Language 声明（跨文件重复）
   - 所有 Changelog
   - 完整的 Input/Output Zod Schema（保留 5-10 行简要表，完整定义放代码文件）
   - 反例集合 / 详细失败修正方案（保留 Top-3 + 一行 hint）
   - Feature Comparison 详细表（改为"边界划分"一行）
   - Anthropic Skill 协议/用法说明类元描述

2. **P1 合并：**
   - When to Use + Prerequisites + Pre-flight → "使用条件"
   - 质量自检 + 典型失败模式 → "质量把关"
   - 参考实现文件 + Changelog → "参考资料"

3. **P2 瘦身：**
   - Workflow Checklist 每步 1-2 行（原可能 5-8 行）
   - 子模板详情外置（见 §4.4）
   - FAQ 从 15+ 个减到 Top-5

---

## 6. 代码外置策略

### 6.1 放哪里

**不创建新目录**（保持 B 目标"不做 3 层拆分"）。改为引用已存在或即将存在的代码文件：

| 外置内容 | 链接目标 |
|---------|---------|
| 完整 Input/Output Schema | `src/lib/cms/types.ts` 等 TypeScript 类型文件 |
| Workflow 实现细节 | `src/lib/cms/publish/publish-article.ts` 等 impl 文件 |
| 子模板详细规范 | `src/lib/agent/skills/<name>-subtemplates.ts`（新建文件，由 follow-up PR 填充；本 spec 只占位） |
| Test 规范 | `src/lib/cms/__tests__/<path>/` test 目录 |
| 历史版本 | `git log --follow skills/<name>/SKILL.md` |

### 6.2 Frontmatter 引用格式

```yaml
metadata:
  implementation:
    scriptPath: src/lib/cms/publish/publish-article.ts
    testPath: src/lib/cms/__tests__/publish/
  openclaw:
    schemaPath: src/lib/cms/types.ts#CmsArticleSaveDTO        # 锚点指向 interface
    subtemplatesPath: src/lib/agent/skills/duanju-subtemplates.ts   # 可选，仅 script-heavy
    referenceSpec: docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md
```

Body 里引用用 markdown 链接：`[具体实现见 publish-article.ts](../../src/lib/cms/publish/publish-article.ts)`

---

## 7. 测试 & 验证

### 7.1 每个 skill 改造后的验收指标

- [ ] 行数在 200-300 范围（允许 ±20%）
- [ ] Frontmatter 符合 §3.1 格式（有 `metadata.implementation.scriptPath`）
- [ ] Body 章节数 10-12
- [ ] 无 Changelog 章节
- [ ] 无重复的 Language 声明
- [ ] 所有 `implementation.scriptPath` 引用的文件真实存在（grep 验证）
- [ ] category + skill_kind 与 DB skill 表一致

### 7.2 批量自动检查（shell 脚本）

改造所有 13 个 skill 后，跑：

```bash
# 行数检查
for s in cms_publish cms_catalog_sync aigc_script_push script_generate duanju_script zhongcao_script tandian_script podcast_script zongyi_highlight content_generate headline_generate summary_generate style_rewrite; do
  lines=$(wc -l < skills/$s/SKILL.md)
  echo "$s: $lines"
done

# scriptPath 存在性
for s in cms_publish cms_catalog_sync aigc_script_push script_generate duanju_script zhongcao_script tandian_script podcast_script zongyi_highlight content_generate headline_generate summary_generate style_rewrite; do
  script_path=$(grep -A1 "implementation:" skills/$s/SKILL.md | grep scriptPath | awk '{print $2}')
  [ -f "$script_path" ] && echo "$s: scriptPath OK" || echo "$s: scriptPath MISSING: $script_path"
done

# Frontmatter category 合法性
for s in cms_publish cms_catalog_sync aigc_script_push; do
  cat=$(grep "^category:" skills/$s/SKILL.md | awk '{print $2}')
  echo "$s: category=$cat"  # 期望 management
done
```

### 7.3 数据库一致性

B.1 修复了 `category: management` + `skill_kind: action` 模式（3 个 B 类 skill）。本 Track B 保持此约定，不再重犯 `category: action` 的错误。

### 7.4 不验证代码行为

本 Track B 只改 SKILL.md 文档，**不改任何 .ts 代码**。不需要跑 `npm run test` / `npx tsc --noEmit`（skill MD 不纳入 TS 编译）。

仅需运行：
- `npm run db:seed` 确认 skill 仍能被 skills 表 seed（`skillCategoryEnum` 等约束未违反）

---

## 8. 执行顺序（Rollout）

按风险度从小到大，分 3 批：

**批 1（基线，先改最轻的 4 个）：**
- style_rewrite (320 → 200)
- summary_generate (258 → 180)
- headline_generate (426 → 200)
- script_generate (476 → 220)

走完这 4 个后，pattern 固化，后续批次可加速。

**批 2（中等难度，5 个）：**
- cms_catalog_sync (519 → 220)
- aigc_script_push (521 → 220)
- content_generate (644 → 240)
- zongyi_highlight (623 → 250)
- tandian_script (620 → 250)

**批 3（最大难度，4 个 script-heavy）：**
- cms_publish (683 → 250)
- podcast_script (714 → 270)
- zhongcao_script (782 → 280)
- duanju_script (1211 → 300)

这批需要大量外置子模板/规范（§4.4），可能还要 follow-up PR 真正创建 subtemplates 代码文件。

---

## 9. Out of scope（本 spec 不做）

- 修改 Anthropic Skill 加载机制
- 修改 `skills/*/` 之外的 skill（其他 27 个 tool/review/management skill 留给 B-All 或 Phase 2）
- 创建 `subtemplates/*.md` 或 `EXTEND.md` 附属文件（本 spec 坚持单文件）
- 真正实现 `src/lib/agent/skills/<name>-subtemplates.ts` 代码文件（仅在 frontmatter 占位，真实创建放 follow-up）
- 改 skill 对应的 agent 执行代码

---

## 10. Acceptance Criteria

- [ ] 13 个 SKILL.md 改完，行数全部落在 180-320 范围内
- [ ] 每个 Frontmatter 有 `metadata.implementation.scriptPath` 且指向真实存在的文件
- [ ] 每个 Frontmatter 有 `metadata.openclaw.schemaPath` 或 `referenceSpec`（至少一个）
- [ ] 无任何 skill 保留 Changelog 章节（grep `##\s*Changelog` 返回 0）
- [ ] 无任何 skill 保留 >= 3 个"反例对比"（grep `反例|anti-pattern|错误示范` 每文件 ≤ 2 处）
- [ ] 所有 3 个 B 类 skill 的 `category: management` + `metadata.skill_kind: action`（保持 B.1 修复不回退）
- [ ] `npm run db:seed` 能成功加载全部 13 个 skill（不违反 skillCategoryEnum）
- [ ] 总行数从 7797 降到 ≤ 3500

---

## 11. 预计工作量

- 批 1（4 个 skill）：每个 ~25 分钟，总 100 分钟
- 批 2（5 个 skill）：每个 ~30 分钟，总 150 分钟
- 批 3（4 个 script-heavy）：每个 ~40 分钟，总 160 分钟
- 验收 + commit：30 分钟

**总预计：** ~7 小时（1 天工作量）

用 subagent-driven 并行化可以压到 3-4 小时（批 1 完后 pattern 固化，批 2/3 可以多个 skill 并行 implementer）。
