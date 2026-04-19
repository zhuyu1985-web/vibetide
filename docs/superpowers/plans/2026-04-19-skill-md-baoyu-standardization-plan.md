# Track B 实施 Plan：13 个 Skill MD 按 baoyu-skills 标准中等深度重写

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 13 个 CMS/AIGC/场景 skill MD 从总计 7797 行压缩到 ≤ 3500 行（-58%），保留业务规则核心，对齐 baoyu-skills 的简洁风格。**不改任何 .ts 代码**（除创建 3 个 subtemplates stub 文件）。

**Architecture:**
- 每个 skill：frontmatter 精简 + body 10-12 章 + 代码外链
- 3 个 script-heavy skill（duanju/zhongcao/podcast）先创建 `subtemplates.ts` stub 文件，满足 AC scriptPath 存在性
- 批次执行（易→难），批 1 固化 pattern 后批 2/3 可并行

**Tech Stack:** Pure markdown + YAML frontmatter。仅涉及 `skills/*/SKILL.md` 和 3 个新 `src/lib/agent/skills/*-subtemplates.ts` stub。

**Spec reference:** [docs/superpowers/specs/2026-04-19-skill-md-baoyu-standardization.md](docs/superpowers/specs/2026-04-19-skill-md-baoyu-standardization.md) §1-§11

---

## 任务一览

### Section A — 前置准备（1 task）
- [ ] Task 1：创建 3 个 subtemplates stub 文件（duanju/zhongcao/podcast）

### Section B — 批 1：Rewrite 类 4 个（pattern 固化）
- [ ] Task 2：`summary_generate` (258 → 180)
- [ ] Task 3：`style_rewrite` (320 → 200)
- [ ] Task 4：`headline_generate` (426 → 200)
- [ ] Task 5：`script_generate` (476 → 220)

### Section C — 批 2：中等难度 5 个
- [ ] Task 6：`cms_catalog_sync` (519 → 220)
- [ ] Task 7：`aigc_script_push` (521 → 220)
- [ ] Task 8：`content_generate` (644 → 240)
- [ ] Task 9：`zongyi_highlight` (623 → 250)
- [ ] Task 10：`tandian_script` (620 → 250)

### Section D — 批 3：script-heavy 4 个
- [ ] Task 11：`cms_publish` (683 → 250)
- [ ] Task 12：`podcast_script` (714 → 270)
- [ ] Task 13：`zhongcao_script` (782 → 280)
- [ ] Task 14：`duanju_script` (1211 → 300)

### Section E — 验收（1 task）
- [ ] Task 15：批量自动检查 + CLAUDE.md 更新 + 总结 commit

---

# 通用改造模板（所有 13 个 skill task 共用）

**每个 skill 改造的标准 6 步：**

1. **读原文件：** `wc -l skills/<name>/SKILL.md && cat skills/<name>/SKILL.md`
2. **应用 §3 Frontmatter 标准：**
   - 保留：`name / displayName / description / version / category`
   - 精简：`metadata.skill_kind / scenario_tags / compatibleEmployees / modelDependency`（按类别取舍）
   - 新增：`metadata.implementation.{scriptPath, testPath}` + `metadata.openclaw.{schemaPath, referenceSpec}`
   - 删除：`metadata.runtime.avgLatencyMs / maxConcurrency / timeoutMs / type`
   - 保留但精简：`metadata.requires.{env, knowledgeBases, dependencies}`（列表式）
3. **应用 §4 Body 章节标准（10-12 章）：**
   - 合并：When + Prereq → "使用条件"
   - 合并：自检 + 失败模式 → "质量把关"
   - 合并：参考实现 + Changelog → "参考资料"（Changelog 非单纯版本号时 migration 段保留到 referenceSpec）
   - 删除：Language 声明 / Feature Comparison 详表 / 反例集合（保留 Top-3）
4. **验收本文件：**
   - `wc -l` 在目标范围 ±20%
   - `grep "^## " skills/<name>/SKILL.md | wc -l` ≤ 12
   - `grep -c "^## Changelog\|^## 变更\|^## 版本历史" skills/<name>/SKILL.md` = 0
   - `metadata.implementation.scriptPath` 指向真实存在的文件（`[ -f $path ] && echo OK`）
5. **grep 全文确认 §5 P0 清单已执行：**
   - Language 声明（无）
   - Changelog 章节（无）
   - 反例 >= 3 条（无；最多 2 条）
6. **Commit（独立 commit，message 前缀 `docs(skills/p1):`）：**
```bash
git add skills/<name>/SKILL.md
git commit -m "docs(skills/p1): <name> MD standardized to baoyu-skills format (<N>→<M> lines)"
```

---

# Section A — 前置准备

## Task 1：创建 3 个 subtemplates stub 文件

**目的：** script-heavy skill（duanju / zhongcao / podcast）的 frontmatter 会引用 `subtemplatesPath`，指向这 3 个文件。必须先创建 stub 否则 §10 AC 第 2 条会失败。

**Files to create:**
- `src/lib/agent/skills/duanju-subtemplates.ts`
- `src/lib/agent/skills/zhongcao-subtemplates.ts`
- `src/lib/agent/skills/podcast-subtemplates.ts`

- [ ] **Step 1.1：创建目录 + 3 个 stub 文件**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide/.worktrees/phase1-cms-adapter-mvp
mkdir -p src/lib/agent/skills
```

每个 stub 文件内容（3 个都一样，按 skill 名替换）：

```ts
/**
 * Subtemplates for <skill_name>.
 *
 * TODO(follow-up issue): populate subtemplate detailed specs extracted from
 *   skills/<skill_name>/SKILL.md §4.4 of Track B spec.
 * See: docs/superpowers/specs/2026-04-19-skill-md-baoyu-standardization.md §4.4
 *
 * Real content will be filled in after B.1/B.2/Track B PRs merge. Keeping this
 * stub avoids blocking Track B's AC scriptPath existence check.
 */
export const SUBTEMPLATES = {} as const;
export type SubtemplateKey = keyof typeof SUBTEMPLATES;
```

替换 `<skill_name>` 为 duanju / zhongcao / podcast。

- [ ] **Step 1.2：类型编译 + 提交**

```bash
npx tsc --noEmit
# Expected: 0 errors (stubs are type-safe empty)

git add src/lib/agent/skills/
git commit -m "feat(skills/p1): add 3 subtemplate stubs for script-heavy skills

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

# Section B — 批 1：Rewrite 类（pattern 固化）

批 1 是 rewrite 类 4 个 skill，相对简单、结构相似。完成后这 4 个文件的改造 pattern 固化，批 2/3 可以 subagent 并行加速。

## Task 2：summary_generate (258 → 180)

**文件：** `skills/summary_generate/SKILL.md`

**Frontmatter 调整：**
- `category`: 保持 `generation`
- `metadata.skill_kind`: `generation`
- `metadata.modelDependency`: `deepseek:deepseek-chat`
- `metadata.implementation.scriptPath`: 查代码找真实路径（如 `src/lib/agent/skills/summary-generate.ts` 或 agent 执行层对应的实现；不存在则写 `src/lib/agent/execution.ts`）
- `metadata.implementation.testPath`: `src/lib/agent/__tests__/`（通用 fallback）

**Body 重点瘦身：**
- summary_generate 已相对精简（258 行），主要删 Language / Changelog / Feature Comparison
- 保留核心：使用条件 / 输入输出 / 工作流 / 质量把关 / 上下游协作 / FAQ / 参考资料

**AC：** `wc -l = 160-200`

- [ ] 应用通用 6 步模板
- [ ] Commit：`docs(skills/p1): summary_generate MD standardized to baoyu format (258→<N> lines)`

---

## Task 3：style_rewrite (320 → 200)

**文件：** `skills/style_rewrite/SKILL.md`

**Frontmatter 调整：** 同 summary_generate（都是 rewrite 类）
- `scriptPath`: 查真实路径，fallback `src/lib/agent/execution.ts`

**AC：** `wc -l = 180-220`

- [ ] 应用通用 6 步模板
- [ ] Commit：`docs(skills/p1): style_rewrite MD standardized (320→<N> lines)`

---

## Task 4：headline_generate (426 → 200)

**文件：** `skills/headline_generate/SKILL.md`

**Frontmatter 调整：**
- `metadata.implementation.scriptPath`: 查代码
- 生成类，保留 `modelDependency: deepseek:deepseek-chat`

**Body 瘦身要点：**
- 426 行较大，预计会有大块"多风格标题样例"—— 保留 Top-3 样例，其他删
- 若有"反例"块，最多留 2 条

**AC：** `wc -l = 180-220`

- [ ] 应用通用 6 步模板
- [ ] Commit：`docs(skills/p1): headline_generate MD standardized (426→<N> lines)`

---

## Task 5：script_generate (476 → 220)

**文件：** `skills/script_generate/SKILL.md`

**Frontmatter 调整：**
- `metadata.skill_kind`: `generation`
- `metadata.openclaw.subtemplatesPath`: 不设置（script_generate 不是 script-heavy，没有独立的 subtemplates.ts）
- 或者如果 script_generate 确实有多个子模板（5 大场景分化），可以复用上文的 3 个 stub 文件之一？—— **否**。script_generate 是通用场景生成框架，不同于 duanju/zhongcao/podcast 的专属子模板池。本 task 不创建新 stub 文件。

**Body 瘦身要点：**
- 476 行，主要大块是"5 大子模板详细规范"（新闻/时政/赛事/综艺/纪录片）
- 按 §4.4 处理：保留"子模板摘要表"（5 行 + 每子模板 2-3 行关键差异），详细规范删除
- 详细规范可以移到 scriptPath 对应代码的常量里（follow-up）

**AC：** `wc -l = 200-240`

- [ ] 应用通用 6 步模板（附加：§4.4 子模板表替换）
- [ ] Commit：`docs(skills/p1): script_generate MD standardized w/ subtemplate summary (476→<N> lines)`

---

## Section B 完成检查（批 1 pattern 固化）

- [ ] 4 个文件 wc -l 都在目标范围
- [ ] 4 个 commit 前缀 `docs(skills/p1):`
- [ ] `grep -l "^## Changelog\|^## 变更" skills/summary_generate/SKILL.md skills/style_rewrite/SKILL.md skills/headline_generate/SKILL.md skills/script_generate/SKILL.md | wc -l` = 0
- [ ] 4 个文件的 `implementation.scriptPath` 都指向真实存在的文件
- [ ] 检查是否可以 subagent 并行化批 2：pattern 是否真正机械可复制？

---

# Section C — 批 2：中等难度 5 个

批 2 可以 subagent 并行（多个 implementer 同时跑不同 skill），但最终 review 要串行以保持风格一致性。

## Task 6：cms_catalog_sync (519 → 220)

**文件：** `skills/cms_catalog_sync/SKILL.md`

**特殊说明：** B.1 已把 category 修为 `management`，`metadata.skill_kind` 加了 `action`。本 task 确保不回退。

**Frontmatter 调整：**
- `category: management`（保持）
- `metadata.skill_kind: action`（保持）
- `metadata.implementation.scriptPath`: `src/lib/cms/catalog-sync/sync.ts`
- `metadata.implementation.testPath`: `src/lib/cms/__tests__/catalog-sync/`
- `metadata.openclaw.referenceSpec`: `docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md`

**Body 瘦身：** 519 行，大量 CMS 调用细节 + schema 说明 — schema 改引 types.ts，调用细节删。

**AC：** `wc -l = 200-240`

- [ ] 应用通用 6 步模板
- [ ] Commit：`docs(skills/p1): cms_catalog_sync MD standardized (519→<N> lines)`

---

## Task 7：aigc_script_push (521 → 220)

**文件：** `skills/aigc_script_push/SKILL.md`

**Frontmatter：**
- `category: management`（保持 B.1 修复）
- `metadata.skill_kind: action`
- `metadata.implementation.scriptPath`: 查代码（可能 `src/lib/aigc/*` 或 `src/app/actions/aigc.ts`；不存在则 `src/app/actions/`）

**AC：** `wc -l = 200-240`

- [ ] 应用通用 6 步模板
- [ ] Commit：`docs(skills/p1): aigc_script_push MD standardized (521→<N> lines)`

---

## Task 8：content_generate (644 → 240)

**文件：** `skills/content_generate/SKILL.md`

**Frontmatter：** generation 类

**Body 瘦身重点：** 644 行较大，预计有多个"风格模板样例" — 保留 Top-3，删其他。

**AC：** `wc -l = 220-260`

- [ ] 应用通用 6 步模板
- [ ] Commit：`docs(skills/p1): content_generate MD standardized (644→<N> lines)`

---

## Task 9：zongyi_highlight (623 → 250)

**文件：** `skills/zongyi_highlight/SKILL.md`

**Frontmatter：** generation 类

**AC：** `wc -l = 230-270`

- [ ] 应用通用 6 步模板
- [ ] Commit：`docs(skills/p1): zongyi_highlight MD standardized (623→<N> lines)`

---

## Task 10：tandian_script (620 → 250)

**文件：** `skills/tandian_script/SKILL.md`

**Frontmatter：** generation 类

**AC：** `wc -l = 230-270`

- [ ] 应用通用 6 步模板
- [ ] Commit：`docs(skills/p1): tandian_script MD standardized (620→<N> lines)`

---

## Section C 完成检查

- [ ] 5 个文件都在目标范围
- [ ] 批 2 总行数从 3027 降到 ≤ 1280（-58%）
- [ ] Subagent 并行度：本批可批量并行（3-5 个 skill 同时），review 后合并

---

# Section D — 批 3：script-heavy 4 个

批 3 每个都有复杂子模板。不建议并行（一致性风险）。串行执行，每完成 1 个 review 1 次。

## Task 11：cms_publish (683 → 250)

**文件：** `skills/cms_publish/SKILL.md`

**Frontmatter：**
- `category: management`（保持 B.1 修复）
- `metadata.skill_kind: action`
- `metadata.implementation.scriptPath`: `src/lib/cms/publish/publish-article.ts`
- `metadata.implementation.testPath`: `src/lib/cms/__tests__/publish/`
- `metadata.openclaw.schemaPath`: `src/lib/cms/types.ts#CmsArticleSaveDTO`
- `metadata.openclaw.referenceSpec`: `docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md`

**Body 瘦身重点：** 683 行是 CMS 管理类最大的。核心业务（9 step workflow + 5 type 映射）保留；调用细节 / 错误处理详情 / 字段映射表 改引代码。

**AC：** `wc -l = 230-270`

- [ ] 应用通用 6 步模板
- [ ] Commit：`docs(skills/p1): cms_publish MD standardized (683→<N> lines)`

---

## Task 12：podcast_script (714 → 270)

**文件：** `skills/podcast_script/SKILL.md`

**Frontmatter：**
- `metadata.skill_kind: generation`
- `metadata.openclaw.subtemplatesPath: src/lib/agent/skills/podcast-subtemplates.ts`（Task 1 创建的 stub）

**Body 瘦身重点：** 714 行，预计有多个 podcast 子类型（访谈/圆桌/故事/讲解等）详细规范 — 按 §4.4 保留摘要表，详细规范移到 scriptPath（stub 现在空，follow-up 填）。

**AC：** `wc -l = 250-290`

- [ ] 应用通用 6 步模板（附加：§4.4 子模板外置）
- [ ] Commit：`docs(skills/p1): podcast_script MD standardized + subtemplates deferred (714→<N> lines)`

---

## Task 13：zhongcao_script (782 → 280)

**文件：** `skills/zhongcao_script/SKILL.md`

**Frontmatter：**
- `metadata.skill_kind: generation`
- `metadata.openclaw.subtemplatesPath: src/lib/agent/skills/zhongcao-subtemplates.ts`

**Body 瘦身重点：** 782 行，种草脚本通常按平台（小红书/抖音/B 站/视频号）分化 — 保留平台摘要表 + 每平台 2-3 行要点，详细规范移到 subtemplates stub。

**AC：** `wc -l = 260-300`

- [ ] 应用通用 6 步模板（附加：§4.4 子模板外置）
- [ ] Commit：`docs(skills/p1): zhongcao_script MD standardized + subtemplates deferred (782→<N> lines)`

---

## Task 14：duanju_script (1211 → 300)

**文件：** `skills/duanju_script/SKILL.md`

**Frontmatter：**
- `metadata.skill_kind: generation`
- `metadata.openclaw.subtemplatesPath: src/lib/agent/skills/duanju-subtemplates.ts`

**Body 瘦身重点：** **最大挑战**。1211 行压到 300 行（-75%）。duanju_script 有 12+ 种剧集类型（都市言情 / 悬疑推理 / 古装奇幻 / ...），每种有完整的分镜模板 + 质量阈值 + 配音风格。

**处理：**
1. 保留：总览 / 使用条件 / 核心 workflow / 质量把关（通用层） / 上下游 / FAQ
2. 保留：子模板摘要表（12-15 行）
3. 删除：每个子模板的完整分镜模板、24 项质量阈值详表、音频/画面/配音详细规范
4. 引：`详细子模板常量见 @/lib/agent/skills/duanju-subtemplates.ts`（当前 stub）
5. follow-up issue: "populate duanju-subtemplates.ts with extracted content from pre-Track-B SKILL.md"

**AC：** `wc -l = 280-320`

**⚠️ 此 task 最容易走形：** review 时重点检查核心业务规则是否误删。建议 implementer 先做 dry-run（列出打算删的每一节）再执行。

- [ ] Step 14.1：Dry-run，产出"保留/删除"清单
- [ ] Step 14.2：应用通用 6 步模板
- [ ] Commit：`docs(skills/p1): duanju_script MD standardized + 12 subtemplates deferred (1211→<N> lines)`

---

## Section D 完成检查

- [ ] 4 个文件都在目标范围
- [ ] 3 个 script-heavy skill（duanju/zhongcao/podcast）frontmatter 有 `subtemplatesPath` 指向 Task 1 创建的 stub
- [ ] 批 3 总行数从 3390 降到 ≤ 1100（-68%）

---

# Section E — 验收 & 文档

## Task 15：批量自动检查 + CLAUDE.md 更新

- [ ] **Step 15.1：行数批量检查**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide/.worktrees/phase1-cms-adapter-mvp
for s in cms_publish cms_catalog_sync aigc_script_push script_generate duanju_script zhongcao_script tandian_script podcast_script zongyi_highlight content_generate headline_generate summary_generate style_rewrite; do
  lines=$(wc -l < skills/$s/SKILL.md)
  printf "%-22s %s\n" "$s" "$lines"
done | tee /tmp/track-b-linecounts.txt

# 总和
awk '{sum += $2} END {print "Total:", sum}' /tmp/track-b-linecounts.txt
# Expected: ≤ 3500
```

- [ ] **Step 15.2：Frontmatter 合规检查**

```bash
# scriptPath 存在性（每个 skill 必须有，且指向真实文件）
for s in cms_publish cms_catalog_sync aigc_script_push script_generate duanju_script zhongcao_script tandian_script podcast_script zongyi_highlight content_generate headline_generate summary_generate style_rewrite; do
  script=$(grep -A1 "implementation:" skills/$s/SKILL.md | grep scriptPath | awk -F: '{print $2}' | tr -d ' ')
  if [ -f "$script" ]; then
    echo "✓ $s: $script"
  else
    echo "✗ $s: MISSING $script"
  fi
done

# category 对 3 个 B 类 skill 必须是 management + skill_kind: action
for s in cms_publish cms_catalog_sync aigc_script_push; do
  cat=$(grep "^category:" skills/$s/SKILL.md | awk '{print $2}')
  kind=$(grep "skill_kind:" skills/$s/SKILL.md | awk '{print $2}')
  echo "$s: category=$cat skill_kind=$kind"
  [ "$cat" = "management" ] && [ "$kind" = "action" ] && echo "  ✓" || echo "  ✗"
done
```

- [ ] **Step 15.3：章节合规检查**

```bash
# 无 Changelog / 变更历史
for s in cms_publish cms_catalog_sync aigc_script_push script_generate duanju_script zhongcao_script tandian_script podcast_script zongyi_highlight content_generate headline_generate summary_generate style_rewrite; do
  if grep -qE "^## (Changelog|变更历史|Version History|版本历史)" skills/$s/SKILL.md; then
    echo "✗ $s: has Changelog section"
  fi
done
# Expected: no output

# 章节数 ≤ 12
for s in cms_publish cms_catalog_sync aigc_script_push script_generate duanju_script zhongcao_script tandian_script podcast_script zongyi_highlight content_generate headline_generate summary_generate style_rewrite; do
  count=$(grep -c "^## " skills/$s/SKILL.md)
  [ "$count" -le 12 ] && echo "✓ $s: $count sections" || echo "✗ $s: $count sections (too many)"
done
```

- [ ] **Step 15.4：DB seed 冒烟**

```bash
set -a; source .env.local; set +a
npm run db:seed 2>&1 | tail -20
# Expected: 无 skillCategoryEnum 约束错误；13 个 skill 全部 upsert 成功
```

- [ ] **Step 15.5：更新 CLAUDE.md**

在 `CLAUDE.md` 的 Architecture 章节内（Scenario/Workflow 统一架构之后），追加：

```markdown
### Skill MD 标准（Track B / baoyu-inspired）

13 个 CMS/AIGC/场景 skill MD 按 baoyu-skills 规范标准化（Track B, 2026-04-19）：

**主文件规模：** 每个 `skills/<name>/SKILL.md` 目标 200-300 行（总计 ≤ 3500 行）

**Frontmatter 约定：**
- 保留：name / displayName / description / version / category
- 保留：metadata.{skill_kind, scenario_tags, compatibleEmployees, modelDependency, requires}
- 新增：metadata.implementation.{scriptPath, testPath}
- 新增：metadata.openclaw.{schemaPath, referenceSpec, subtemplatesPath?}
- 删除：metadata.runtime.{avgLatencyMs, maxConcurrency, timeoutMs, type}

**Body 10-12 章标准：**
1. 使用条件（合并 When/Prereq/Pre-flight）
2. 输入 / 输出（简要表，完整 Schema 外链）
3. 工作流 Checklist
4. 子模板分化（可选，摘要表）
5. 质量把关（合并自检+失败模式）
6. 输出模板 / 示例
7. EXTEND.md 示例
8. 上下游协作
9. 常见问题
10. 参考资料

**Script-heavy skill（duanju/zhongcao/podcast）子模板规范：**
- SKILL.md 只放摘要表
- 详细规范写入 `src/lib/agent/skills/<name>-subtemplates.ts`（当前为 stub，follow-up 填充）

**Spec：** `docs/superpowers/specs/2026-04-19-skill-md-baoyu-standardization.md`
**Plan：** `docs/superpowers/plans/2026-04-19-skill-md-baoyu-standardization-plan.md`
```

- [ ] **Step 15.6：Commit**

```bash
git add CLAUDE.md
git commit -m "docs(skills/p1): update CLAUDE.md with baoyu-skills standardization note

Track B complete: 13 skill MDs standardized from 7797 → <total> lines (-<pct>%)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 15.7：统计 Track B 总 commit 数**

```bash
git log --oneline origin/main..HEAD | grep "(skills/p1)" | wc -l
# Expected: 15 (1 prep + 13 skills + 1 verification)
```

---

# Track B 完成检查（Acceptance Criteria）

对照 spec §10 逐条核对：

- [ ] 13 个 SKILL.md 行数全部在 180-320 范围
- [ ] 每个 Frontmatter 有 `metadata.implementation.scriptPath` 且指向真实存在的文件
- [ ] 每个 Frontmatter 有 `metadata.openclaw.schemaPath` 或 `referenceSpec`（至少一个）
- [ ] 无任何 skill 保留 Changelog 章节
- [ ] 无任何 skill 保留 >= 3 个"反例对比"
- [ ] 所有 3 个 B 类 skill 的 `category: management` + `metadata.skill_kind: action`
- [ ] `npm run db:seed` 能成功加载全部 13 个 skill
- [ ] 总行数从 7797 降到 ≤ 3500（目标 3280）
- [ ] 3 个 script-heavy skill stub 文件已创建

全部勾选 → **Track B 完成，准备 PR 或合入 feature/phase1-cms-adapter-mvp**。

---

## Rollout 备注

- **并行化建议：** 批 2 的 Task 6-10（5 个 skill）pattern 相似、互相独立，可以 subagent 并行跑（3-5 个同时）
- **批 3 不并行：** Task 11-14 涉及子模板外置和业务规则把关，易走形，串行更稳
- **批 1 完成后回收 pattern：** 如果某个 task 改造中发现新问题（例如某 skill frontmatter 格式差异过大），回来更新"通用改造模板"再继续

## Follow-up 债务清单（Track B 后）

- **填充 subtemplates.ts：** 3 个 stub 文件真正写入 duanju/zhongcao/podcast 的子模板数据。**tracker：** 合入 main 后开 GitHub issue "populate script-heavy subtemplates (Track B follow-up)"
- **其他 27 个 skill：** B-All 阶段（或 Phase 2）做，单独 spec
- **3 层拆分探索：** 若用户反馈仍嫌冗长，未来可考虑 `EXTEND.md` + `subtemplates/*.md` 附属文件方案
