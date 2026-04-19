# B.2 Scenario 遗产清理 Spec

> **v1（2026-04-19）** —— 紧接 B.1（commit `2110908`）的后续清理工作。B.1 完成了"统一读路径"（首页 + 任务中心两入口数据同源）；B.2 完成"清理遗产"（删 legacy 常量 + DROP employee_scenarios + 迁移 20+ 下游消费者到 workflowTemplateId）。

**日期：** 2026-04-19
**作者：** PM (zhuyu) + Claude
**状态：** 待实现
**前置：** B.1 已合入 main（PR 等用户 smoke 后 merge）

---

## 1. 设计原则

> **B.1 建好新路径、旧路径 @deprecated。B.2 拆旧路径、让 workflow_templates 成为唯一消费点。**

**具体推论：**
1. 删除 4 个 @deprecated 常量（SCENARIO_CONFIG / ADVANCED_SCENARIO_CONFIG / SCENARIO_CATEGORIES / ADVANCED_SCENARIO_KEYS）
2. DROP `employee_scenarios` 表（B.1 已停写）
3. 20+ 下游消费者从 `mission.scenario` slug lookup 改为 `mission.workflowTemplateId` 关联查
4. `mission.scenario` 字段**保留**（text，作为 label 的 denormalized cache，不再语义驱动）
5. `/scenarios/customize` 页面：**redirect 到 `/workflows`**（new module, P2 再做）；本 spec 删除 customize 页面代码
6. `channels/gateway.ts` `#场景名` 解析从常量查改为 DB 查

---

## 2. 影响面 Inventory（核对 B.1 Task 14 的 grep 结果）

### 2.1 四个 @deprecated 常量（B.1 已标注）

| 常量 | 位置 | 当前消费者 |
|------|-----|----------|
| SCENARIO_CONFIG | src/lib/constants.ts:456 | ~15 处（含 resolveScenarioConfig fallback） |
| ADVANCED_SCENARIO_CONFIG | :610 | ~8 处 |
| SCENARIO_CATEGORIES | :437 | 仅 missions-client.tsx filter Select |
| ADVANCED_SCENARIO_KEYS | :753 | scenario-grid / scenario-detail-sheet / customize 页 |

### 2.2 `mission.scenario` 下游消费者 20+ 处（B.1 §2.7 清单）

**UI 层：**
- `missions-client.tsx:403` — mission list 行显示（B.1 改 `resolveScenarioConfig(m)`，B.2 进一步改读 `workflowTemplateId`）
- `missions-client.tsx:214/259/263/265/535/538` — 内部 SCENARIO_CONFIG 迭代（创建 Sheet 已 B.1 改掉，B.2 删残留）
- `mission-console-client.tsx:187/887` — B.1 已改 `resolveScenarioConfig`
- `home-client.tsx:209/231` — Sheet ADVANCED_SCENARIO_CONFIG 查
- `scenario-detail-sheet.tsx:33` — ADVANCED_SCENARIO_CONFIG[scenarioKey]
- `scenario-grid.tsx:86/140` — ADVANCED_SCENARIO_CONFIG
- `scenarios/customize/customize-scenario-client.tsx:121/446/775` — 770 行页面
- `asset-revive/asset-revive-client.tsx:337/674` — scenarioBadge 本地 map

**Inngest / 后台：**
- `inngest/functions/leader-plan.ts:65` — `mission.scenario` 传入 LLM prompt（作为 label）
- `inngest/functions/leader-consolidate.ts:110` — 同上
- `inngest/functions/execute-mission-task.ts:234` — 同上
- `lib/mission-core.ts:115/381` — LLM prompt text 插值
- `lib/mission-executor.ts:66/220/291/344/546` — Mission 步骤派发、事件名

**入口：**
- `lib/channels/gateway.ts:56/133` — DingTalk / 企业微信 `#场景名` 快速指令解析

**DAL：**
- `lib/dal/asset-revive.ts:130` — scenario label map

### 2.3 可以删除的文件

- `src/db/schema/employee-scenarios.ts` — 表 schema（DROP 后 Drizzle 不再需要）
- `src/lib/dal/scenarios.ts` — DAL（B.1 已停写）
- `src/app/api/scenarios/execute/route.ts` — execute endpoint（遗产）
- `src/app/api/employees/[slug]/scenarios/route.ts` — per-employee scenarios GET endpoint
- `src/app/(dashboard)/scenarios/customize/page.tsx` — customize 页
- `src/app/(dashboard)/scenarios/customize/customize-scenario-client.tsx` — 770 行 client

### 2.4 ScenarioCardData 类型

`src/lib/types.ts:322-338` — 仅 scenarios.ts DAL 用；DAL 删后类型可删。

---

## 3. 两大策略选择

### 3.1 mission.scenario 字段处置

**选 A：保留字段做 label cache**（推荐）
- DB 不改（无 migration）
- 新 mission 创建时：`scenario = templateToScenarioSlug(template)` 继续写
- 下游消费者 label 降级公式（四级 fallback，对齐现有 `resolveScenarioConfig` 实现）：
  ```ts
  label = mission.workflowTemplate?.name     // 1. 首选：workflow 关联
        ?? mission.title                       // 2. 次选：missions.title (notNull text)
        ?? mission.scenario                    // 3. 再次：scenario slug text（若为 custom_xxx 可读性差但非空）
        ?? "任务"                              // 4. 兜底
  ```
  **说明：** B.1 的 `src/lib/scenario-fallback.ts:65` `makeFallback` 已经是 `title ?? scenario ?? "任务"`；B.2 只在前面加一级 `workflowTemplate?.name`。**不要**回归成 `workflowTemplate?.name ?? scenario ?? "任务"`（会丢 title，回归风险）。
- 优点：零回归，对已有 mission 行兼容
- 缺点：两个字段长期并存

**选 B：删除字段**（不推荐）
- 需要数据迁移：把 scenario slug 换成 name 存 DB，或者全拆读 workflow
- 大量 SQL migration + 下游可能 break
- 优点：彻底整洁
- 缺点：风险大，回归多

**采用：A**。`mission.scenario` 成为"冗余 label 缓存"，所有新逻辑走 `mission.workflowTemplateId`，旧行不动。

### 3.2 Mission 查询时的 workflow_template 关联

**选 A：Drizzle `with` relation**（推荐）
- `db.query.missions.findFirst({ where, with: { workflowTemplate: true } })`
- Relation 在 schema 定义；一次查询拿到 `mission + template`
- 优点：简单、类型安全
- 缺点：需要在 missions schema 加 relation

**选 B：UI 层二次查询**
- 先查 mission，再查 workflow_templates
- 优点：schema 不动
- 缺点：N+1 查询

**采用：A**。B.2 加 `missionsRelations.workflowTemplate` relation。

---

## 4. 分阶段推进（4 阶段）

### Phase 4.1 — 建立新的读路径（Infrastructure）

- [ ] Drizzle schema 加 `missionsRelations.workflowTemplate` → workflowTemplates
- [ ] 新 DAL helper `getMissionWithTemplate(id)` → `{ mission, workflowTemplate }`
- [ ] 修订 `resolveScenarioConfig(mission)` 加第 4 种兜底：如果 `mission.workflowTemplate` 有值 → 用它；否则保持原 fallback
- [ ] 测试通过：mission list 既能用新关联也能用旧 scenario text

### Phase 4.2 — 迁移 20+ 下游消费者

**Phase 4.2 与 B.1 Task 14 的关系（采纳 reviewer I1）：**
- B.1 Task 14 通过 `resolveScenarioConfig(mission)` 给 5 个 UI 消费点加了**兜底层**（SCENARIO_CONFIG → ADVANCED_SCENARIO_CONFIG → fallback 三级）— 这是热修，保证 custom_slug 不崩
- B.2 Phase 4.2 的工作是**换底层实现**：从"SCENARIO_CONFIG 常量 lookup + fallback"改为"workflow_template 直读 + 降级到 title/slug"
- 换底后删除 SCENARIO_CONFIG 常量（Phase 4.3）
- `resolveScenarioConfig` **保留**但简化：接受 `{ scenario, title, workflowTemplate }` → 返回 label / icon / description 等；删掉 SCENARIO_CONFIG/ADVANCED_SCENARIO_CONFIG 分支

**按类型分批：**

**批 A：UI 层（自下而上）**
- [ ] scenario-detail-sheet.tsx — 移除 ADVANCED_SCENARIO_CONFIG lookup
- [ ] scenario-grid.tsx — 移除 ADVANCED_SCENARIO_CONFIG（B.1 Task 16 已大部分改完，残留 B.2 清）
- [ ] mission-console-client.tsx:187/887 — 改读 mission.workflowTemplate（现在 resolveScenarioConfig 继续工作；B.2 换为直接读 workflowTemplate）
- [ ] missions-client.tsx:403 (list row) / :535-538 (filter Select) — 改读 workflowTemplate
- [ ] home-client.tsx:209/231 — 移除 ADVANCED_SCENARIO_CONFIG
- [ ] asset-revive-client.tsx — scenario badge 改用 workflowTemplate name / fallback text

**批 B：Inngest / 后台**
- [ ] leader-plan.ts / leader-consolidate.ts / execute-mission-task.ts — `mission.scenario` 改为 `mission.workflowTemplate?.name ?? mission.scenario`
- [ ] mission-core.ts / mission-executor.ts — 同上

**批 C：入口**
- [ ] channels/gateway.ts:56/133 — `#场景名` 解析改为 `db.query.workflowTemplates.findFirst({ where: ... name=...  AND org })`
- [ ] asset-revive.ts:130 — scenario label 改为 workflowTemplate name

### Phase 4.3 — 删除代码 / 页面

- [ ] 删 `SCENARIO_CONFIG` / `ADVANCED_SCENARIO_CONFIG` / `SCENARIO_CATEGORIES` / `ADVANCED_SCENARIO_KEYS` 4 个常量
- [ ] 删 `resolveScenarioConfig` 的 ADVANCED 兜底分支（只保留 workflowTemplate + 纯文本兜底）
- [ ] 删 `src/lib/dal/scenarios.ts`
- [ ] 删 `src/app/api/scenarios/execute/route.ts`
- [ ] 删 `src/app/api/employees/[slug]/scenarios/route.ts`
- [ ] 删 `src/app/(dashboard)/scenarios/customize/*`（page + client）
- [ ] `/scenarios/customize` 改为 redirect（`src/app/(dashboard)/scenarios/customize/page.tsx` 只 redirect 到 `/workflows` 占位页，P2 真做）
- [ ] 删 `ScenarioCardData` type in `src/lib/types.ts:322-338`
- [ ] 删 `scenario-detail-sheet.tsx`（若首页完全切到 workflow，可能整文件删）— **评估保留性**：若 Sheet UX 仍需要，保留但重写读 workflow

### Phase 4.4 — DROP table + 清理

- [ ] Drizzle schema：删 `src/db/schema/employee-scenarios.ts`
- [ ] Migration：`supabase/migrations/20260419_drop_employee_scenarios.sql`
  ```sql
  DROP TABLE IF EXISTS employee_scenarios CASCADE;
  ```
- [ ] `src/db/seed.ts` 的 `delete from employee_scenarios` 清理行也删掉（表都没了，delete 会挂）
- [ ] 验证：`grep -rn "employee_scenarios\|employeeScenarios" src/` 零匹配

---

## 5. UI 清理策略

### 5.1 `/scenarios/customize` 页面处理

**当前：** 770 行，读 ADVANCED_SCENARIO_CONFIG，支持用户自定义场景，存到 localStorage

**B.2 处理：**
- 删 `customize-scenario-client.tsx`（770 行）
- `page.tsx` 改为：
  ```tsx
  import { redirect } from "next/navigation";
  export default function Page() {
    redirect("/workflows");
  }
  ```
- **`/workflows` 是真实管理页面**（commit B.1 前已存在）：
  - `src/app/(dashboard)/workflows/page.tsx` 43 行，读 `getMyWorkflows` + `getBuiltinTemplates`
  - 已有 `[id]/` 详情 + `new/` 创建子路由
  - redirect 会直接把用户带到能用的列表页，非"占位"

**Localstorage 自定义场景迁移 + 前置用户通知（采纳 reviewer I5）：**
- 现有代码 `home-client.tsx:83` 和 `customize-scenario-client.tsx:62` 读取 `vibetide_custom_scenarios` localStorage key
- B.2 merge 后该 key 不再有读取路径，用户之前定义的场景从 UI 消失（数据仍在 localStorage）
- **前置通知策略（merge B.2 前必须先 ship）：**
  1. **Phase 0（B.2 之前，独立 PR）：** 在 `/home` + `/scenarios/customize` 顶部埋 7 天告警 banner：
     ```
     ⚠️ 场景自定义即将迁移到新的工作流编辑器（/workflows）。
         您目前在本页保存的 N 个自定义场景将在 2026-04-26 后无法通过此页面访问。
         如需保留，请联系管理员协助导出。
     ```
     （N 从 localStorage 读）
  2. **至少观察 1 周**（~7 天）后再 merge B.2
  3. **B.2 merge 同时**在 `/workflows` 顶部加一次性提示："您如有历史自定义场景需迁移，请联系管理员" —— P2 做真正的 import 工具
- localStorage 数据**不删除**（浏览器端，B.2 无法删），后续用户清缓存自行丢弃
- **完整 import 工具推迟到 P2**（独立 spec）

### 5.2 `scenario-detail-sheet.tsx` 处置

- 当前：读 ADVANCED_SCENARIO_CONFIG[scenarioKey]
- B.1 保留不动
- B.2 决策：
  - 若首页场景网格 onClick 不再触发 Sheet（直接启动 mission）→ 可删
  - 若 Sheet 仍要展示 workflow 详情（icon/description/defaultTeam/inputFields）→ 保留但改为读 workflowTemplate props
- **采用：保留但改读 workflowTemplate**。Sheet 是优秀 UX，删掉是浪费。props 类型改为 `workflow: WorkflowTemplateRow`。

---

## 6. 数据库迁移

### 6.1 Missions relation（Phase 4.1）

```ts
// src/db/schema/missions.ts
export const missionsRelations = relations(missions, ({ one }) => ({
  organization: one(organizations, { ... existing }),
  workflowTemplate: one(workflowTemplates, {
    fields: [missions.workflowTemplateId],
    references: [workflowTemplates.id],
  }),
}));
```

### 6.2 DROP employee_scenarios（Phase 4.4）

```sql
-- supabase/migrations/20260419000003_drop_employee_scenarios.sql
-- 前置备份（防意外）：
-- pg_dump -t employee_scenarios $DATABASE_URL > backup_employee_scenarios_20260419.sql
-- 已验证无 FK 指向本表（schema + migrations grep zero matches on 2026-04-19）
-- B.1 停写 + 每 org seed delete，表已空

DROP TABLE IF EXISTS employee_scenarios CASCADE;
```

**CASCADE 确认（采纳 reviewer I3，spec 阶段已跑）：**
- `grep -rE "references.*employeeScenarios|REFERENCES.*employee_scenarios" src/db/schema supabase/migrations` = 0 matches
- 无任何 FK 指向本表，CASCADE 等价于 DROP（不会级联删其他表）
- B.1 已确保表空（停写 + 每 org seed 开头 delete）

### 6.3 channels/gateway.ts `#场景名` 解析重写（采纳 reviewer I2）

**当前：** `gateway.ts:36/42/54/133` 按常量查（`ADVANCED_SCENARIO_CONFIG[key]` + `[key].label`）。

**B.2 查询规范：**

```ts
// lib/channels/gateway.ts
async function resolveScenarioByNameOrKey(
  scenarioText: string,       // 用户输入的 #场景名 (中文 name 或英文 key)
  organizationId: string,     // DingTalk/WeCom tenant → orgId 映射（现有逻辑已有）
): Promise<WorkflowTemplateRow | null> {
  // 策略：精确匹配（legacyScenarioKey OR name） → 模糊匹配（name ILIKE）
  // 1. 精确 legacyScenarioKey（英文 slug 输入优先）
  const exactKey = await db.query.workflowTemplates.findFirst({
    where: and(
      eq(workflowTemplates.organizationId, organizationId),
      eq(workflowTemplates.legacyScenarioKey, scenarioText),
      eq(workflowTemplates.isEnabled, true),
    ),
  });
  if (exactKey) return exactKey;

  // 2. 精确 name（中文输入）
  const exactName = await db.query.workflowTemplates.findFirst({
    where: and(
      eq(workflowTemplates.organizationId, organizationId),
      eq(workflowTemplates.name, scenarioText),
      eq(workflowTemplates.isEnabled, true),
    ),
  });
  if (exactName) return exactName;

  // 3. 模糊 name（最后兜底；限 1 条避免歧义）
  const fuzzy = await db.query.workflowTemplates.findFirst({
    where: and(
      eq(workflowTemplates.organizationId, organizationId),
      sql`${workflowTemplates.name} ILIKE ${`%${scenarioText}%`}`,
      eq(workflowTemplates.isEnabled, true),
    ),
    limit: 1,
  });
  return fuzzy ?? null;
}
```

**未命中时：** 回复用户："未识别到场景『${scenarioText}』，请在 `/workflows` 查看可用场景列表。"
**org 上下文：** 从 DingTalk/WeCom webhook 的 tenantId 查 `organizations` 表获得 orgId（`gateway.ts` 现有逻辑已做此映射，复用即可）。

---

## 7. 测试策略

### 7.1 集成测试

- `getMissionWithTemplate` DAL 单测
- 修订 `resolveScenarioConfig` 单测：3 种分支（workflowTemplate / SCENARIO_CONFIG fallback（B.2 后删）/ 纯文本）
- mission-executor 传 `mission.workflowTemplate?.name` 而非 `mission.scenario` 的 smoke

### 7.2 回归测试

- 启动 mission → mission 详情 → mission 控制台：label/icon/defaultTeam 正确显示
- 旧 mission（workflowTemplateId=null）仍能正确显示 label（兜底 `mission.scenario` text）
- DingTalk `#场景名` 入口触发 → mission 创建成功

### 7.3 Staging E2E 验证（采纳 reviewer I6）

**Merge 前必须通过的 staging 冒烟：**

1. **部署 preview build** 到 staging（Supabase + Vercel preview env）
2. **触发真实 Mission 流（3 类）：**
   - 用户 UI 启动：`/home` → 点 workflow card → 创建 mission → mission 详情 label 显示正确
   - 任务中心启动：`/missions` → "发起新任务" → tab → 启动 → mission console label 正确
   - DingTalk 入口：企微 IM 发 `#快讯工作流 测试内容` → 看 bot 回复 mission 创建成功
3. **观察 Inngest 24-48h：**
   - leader-plan / leader-consolidate / execute-mission-task 三个 function run 无异常
   - `mission.workflowTemplate?.name` 在 prompt 中正确出现（检查 Inngest run log）
4. **验证 channels gateway：**
   - 测一个精确 key（`#flash_report`）→ 命中
   - 测一个精确 name（`#快讯工作流`）→ 命中
   - 测一个 fuzzy name（`#快讯`）→ 命中
   - 测一个不存在的（`#不存在场景`）→ 回复"未识别，请查 /workflows"
5. **回归 critical path：** mission 列表、mission 详情、`/scenarios/customize` 跳转到 `/workflows`

**必须 100% 通过**；任意步骤失败 → 阻止 merge。

### 7.4 Acceptance

- `grep -rn "SCENARIO_CONFIG\|ADVANCED_SCENARIO_CONFIG" src/` = 0 匹配（完全删除）
- `grep -rn "employee_scenarios\|employeeScenarios" src/` = 0 匹配
- `npm run db:push` 成功（schema 去 employee_scenarios）
- `npx tsc --noEmit` 0 errors
- `npm run test` 全绿
- `npm run build` 成功

---

## 8. Out of scope（B.2 不做）

- ~~新 `/workflows` 管理页~~ — **已存在，见 §5.1**；B.2 只做 redirect 把旧 URL 带过去
- Localstorage 自定义场景真正的 import 工具（推迟到 P2，单独 spec；B.2 通过 §5.1 banner 前置通知用户）
- `mission.scenario` 字段删除（保留 text 做 cache）
- workflow_templates 编辑 UI 增强（`/workflows` 现有版本够用，富编辑推迟到 P2）
- Inngest consumers 的进一步优化（只做 label 替换，不改业务逻辑）

**Follow-up tracker 占位（合入 B.2 PR 时同时开 GH issue）：**
- `follow-up-A`: localStorage 场景 import 工具 → `/workflows/import`
- `follow-up-B`: workflow_templates 编辑器增强 (drag-reorder steps, team picker UI)
- `follow-up-C`: mission.scenario 字段真正下掉（数据彻底迁到 workflowTemplateId JOIN 后）

---

## 9. 风险与回滚

**风险：**
| 风险 | 缓解 |
|------|------|
| DROP 表后发现仍有代码引用 | Phase 4.4 前先跑 grep，零匹配才 DROP |
| Inngest 活跃 mission 的 scenario 字段解不到 label | `mission.workflowTemplate?.name ?? mission.scenario ?? "任务"` 三级兜底 |
| DingTalk 场景名（中文）找不到匹配 workflow | 改为 fuzzy match + 兜底提示"场景未识别，请在 /workflows 配置" |
| resolveScenarioConfig 改动后老 mission 显示异常 | E2E smoke 覆盖新老 mission |
| /scenarios/customize 已有用户 bookmark | redirect 保证旧 URL 不 404 |

**回滚（采纳 reviewer I4 加 pg_dump 保险）：**

- Phase 4.1-4.3 回滚：每 Phase 独立 commit，用 `git revert`（代码变动可恢复）
- Phase 4.4 DROP 前**必须**执行：
  ```bash
  pg_dump -t employee_scenarios "$DATABASE_URL" > backups/employee_scenarios_backup_20260419.sql
  # backups/ 目录加 .gitignore，不入库
  ```
  保留 backup 至少 6 个月。即使 B.1 后表已空，也防止"意外数据"（某 org 没跑过 B.1 seed）
- 回滚 Phase 4.4：`psql $DATABASE_URL < backups/employee_scenarios_backup_20260419.sql` + `git revert`
- 代码变动多、test 覆盖有限，**merge 前要 staging 验证**（§7.4）

---

## 10. Acceptance Criteria

- [ ] 4 个常量完全删除（grep `SCENARIO_CONFIG\|ADVANCED_SCENARIO_CONFIG\|SCENARIO_CATEGORIES\|ADVANCED_SCENARIO_KEYS` src/ = 0）
- [ ] `employee_scenarios` 表 DROP；Drizzle schema 无此表引用
- [ ] `grep employeeScenarios\|employee_scenarios src/` = 0 匹配
- [ ] `src/lib/dal/scenarios.ts` 删除
- [ ] `src/app/api/scenarios/execute/route.ts` + `src/app/api/employees/[slug]/scenarios/route.ts` 删除
- [ ] `src/app/(dashboard)/scenarios/customize/customize-scenario-client.tsx` 删除
- [ ] `/scenarios/customize` 路由变为 redirect
- [ ] 20+ downstream consumers 全部改为 workflowTemplate-based lookup 或使用 `resolveScenarioConfig` 更新后的实现
- [ ] `missionsRelations.workflowTemplate` relation 已定义
- [ ] `getMissionWithTemplate(id)` DAL 已实现 + 单测
- [ ] `ScenarioCardData` type 删除
- [ ] `npx tsc --noEmit` 0 errors
- [ ] `npm run build` 成功
- [ ] `npm run test` 全绿
- [ ] `npm run db:seed` 成功（无 employee_scenarios 引用）
- [ ] `channels/gateway.ts` `#场景名` 入口仍能工作（改读 DB workflow_templates）

---

## 11. 预计工作量

**代码工作：**
- **Phase 0** (banner PR + 7 天观察窗口)：30 分钟编码 + 7 天等待
- **Phase 4.1** (Infrastructure)：1-2 小时
- **Phase 4.2** (20+ downstream migration)：4-6 小时
- **Phase 4.3** (delete code / pages)：1-2 小时
- **Phase 4.4** (DROP table + migration)：30 分钟
- **本地测试**：1-2 小时

**Staging 验证窗口：** 24-48 小时（§7.3）

**总计：** 代码 8-13 小时 + 7 天 banner 观察 + 24-48 小时 staging = **~10 天 wall-clock**（其中实际动手 ~1.5 天，其余是观察/等待）

**subagent-driven 并行化空间：** Phase 4.2 的 UI 批（A）和 Inngest 批（B）可并行（~3 小时压到 ~1.5 小时）；Phase 4.3 的文件删除也可并行

---

## 12. 与已有 spec 的关系

- **前置：** B.1 spec（2026-04-19-unified-scenario-workflow-source.md）—— 必须先合入 main
- **与 Track B 关系：** Track B 只改 SKILL.md 文档，不影响 B.2 代码迁移
- **与 Phase 1 CMS：** 无关
- **触发事件：** B.1 PR merge 到 main 后即可开 B.2
