# 统一场景来源：workflow_templates 作为唯一真相源

> **v3（2026-04-19）—— 第二轮 spec-reviewer 反馈修订：** 修正 SCENARIO_CONFIG 数量（10 不是 11）、去掉可疑的 feature flag、明确 PG enum migration 写法、修正唯一索引、加 custom workflow slug 规则、FK 语义明确化。

**日期：** 2026-04-19
**作者：** PM (zhuyu) + Claude
**状态：** 待实现（B.1 先行）

---

## 1. 设计原则

> **除 AI 员工是固定的（8 个 preset）外，所有"场景"都从工作流派生；因此工作流需要具备分类能力。**

**推论：**

1. `workflow_templates` 表是场景的**唯一真相源**（single source of truth）
2. 首页"场景快捷启动"和任务中心"发起新任务"都从同一个 DAL 读
3. `workflow_templates` 的 `category` enum 扩展为覆盖所有场景类别
4. 员工是固定的，workflow_templates 通过 `defaultTeam` (jsonb EmployeeId[]) 绑定推荐员工
5. 组织可自定义工作流（`isBuiltin=false`），每个 org 创建时自动 copy 一份系统预置（`isBuiltin=true`）

---

## 2. 真实 Inventory（核对后的现状）

### 2.1 四套独立场景系统

| 系统 | 文件 | 具体 keys | 数据源 |
|------|-----|---------|------|
| 首页场景网格 | [src/components/home/scenario-grid.tsx](src/components/home/scenario-grid.tsx) | 读 `ADVANCED_SCENARIO_CONFIG` 6 个 + `employeeScenarios` 表 | 常量+DB |
| 任务中心发起 | [src/app/(dashboard)/missions/missions-client.tsx:214](src/app/(dashboard)/missions/missions-client.tsx:214) | `SCENARIO_CONFIG` 10 个 | 常量 |
| 工作流 | [src/db/seed.ts:571-655](src/db/seed.ts:571) | 6 条 templatesData seed | DB |
| 员工场景 | [src/db/seed.ts:~1330-1470](src/db/seed.ts) | xiaolei 5 条 | DB |

### 2.2 SCENARIO_CONFIG 完整清单（10 个，核实 src/lib/constants.ts:456-567）

| key | label | category | defaultTeam | 建议 appChannelSlug |
|-----|-------|---------|-----------|------------------|
| breaking_news | 突发新闻 | news | xiaolei/xiaowen/xiaoshen/xiaofa | app_news |
| flash_report | 快讯速报 | news | xiaolei/xiaowen | app_news |
| press_conference | 发布会追踪 | news | xiaolei/xiaoce/xiaowen/xiaoshen | app_news |
| deep_report | 深度报道 | deep | 6 人 | app_news |
| series_content | 系列策划 | deep | 6 人 | app_news |
| data_journalism | 数据新闻 | deep | xiaolei/xiaoshu/xiaowen/xiaoshen | app_news |
| social_media | 社交媒体 | social | xiaoce/xiaowen/xiaofa/xiaoshu | (null) |
| video_content | 视频内容 | social | xiaoce/xiaowen/xiaojian/xiaoshen/xiaofa | app_variety |
| multi_platform | 全平台分发 | social | xiaoce/xiaowen/xiaojian/xiaofa/xiaoshu | (null) |
| custom | 自定义任务 | custom | [] | (null) |

### 2.3 ADVANCED_SCENARIO_CONFIG 完整清单（6 个，src/lib/constants.ts:573-579）

| key | 建议 category | 建议 appChannelSlug |
|-----|--------------|-------------------|
| lianghui_coverage | advanced | app_politics |
| marathon_live | advanced | app_sports |
| emergency_response | advanced | app_news |
| theme_promotion | advanced | app_variety |
| livelihood_service | livelihood | app_livelihood_zhongcao |
| quick_publish | advanced | (动态) |

### 2.4 employee_scenarios.xiaolei seed（5 个）

- 全网热点扫描 / 话题深度追踪 / 平台热榜查看 / 热点分析报告 / 关键词热度监测
- 全部归入 `category=news, defaultTeam=[xiaolei]`

### 2.5 现有 workflow_templates seed（6 条，src/db/seed.ts:571-655）

- 快讯工作流（无 category 字段 → 默认 custom）
- 深度报道工作流（同上）
- 每日热点新闻推荐（category=news）
- 金融科技监管日报（category=news）
- 每周竞争对手情报报告（category=analytics）
- 客户投诉邮件分类（category=distribution）

**这 6 条 B.1 保留** —— 但要补 `icon / defaultTeam / legacyScenarioKey` 字段（见 §5.2）。

### 2.6 workflow_category enum 现状（src/db/schema/enums.ts:523）

```
["news", "video", "analytics", "distribution", "custom"]   -- 5 values, 保留
```

### 2.7 mission.scenario 下游消费者（20+ 处硬编码 slug 分发）

**UI 层：**
- `missions-client.tsx:214/259/263/403`
- `mission-console-client.tsx:187/887/921`
- `home-client.tsx:209/231`
- `scenario-detail-sheet.tsx:33`
- `scenario-grid.tsx:86/140`
- `scenarios/customize/customize-scenario-client.tsx:121/446/775`（770 行）
- `asset-revive/asset-revive-client.tsx:337/674`

**Inngest / 后台：**
- `inngest/functions/leader-plan.ts:65`
- `inngest/functions/leader-consolidate.ts:110`
- `inngest/functions/execute-mission-task.ts:234`
- `lib/mission-core.ts:115/381`
- `lib/mission-executor.ts:66/220/291/344/546`

**入口：**
- `lib/channels/gateway.ts:56/133`（钉钉/企微 `#场景名` 快速指令）

**DAL：**
- `lib/dal/asset-revive.ts:130`

---

## 3. 两阶段拆分

### Phase B.1（本 spec，~1 周）—— "统一读路径"

**目标：** 两个入口数据同源（解决 PM 核心痛点）、workflow_templates 激活为场景 SSOT、不动 mission 下游消费者。

**包含：**
- 扩 `workflow_templates` schema（+5 业务字段 + legacyScenarioKey）
- 扩 `workflow_category` enum（保留现有 5 值 + 新增 7 值 → 共 12 值）
- 写 seed：SCENARIO_CONFIG(10) / ADVANCED_SCENARIO_CONFIG(6) / employeeScenarios.xiaolei(5) 全量导入 `workflow_templates`
- 新 DAL `listWorkflowTemplatesByOrg(orgId, filter)`
- **首页 + 任务中心两个入口改读 DAL**（一次切换，不用 feature flag）
- 新增 `missions.workflowTemplateId` 可空 FK（onDelete RESTRICT 防误删 + builtin UI 不允许删）
- 常量标 `@deprecated`（不删）
- employee_scenarios seed 停写（表保留为空）

**不包含（推到 B.2）：**
- ❌ 删 SCENARIO_CONFIG / ADVANCED_SCENARIO_CONFIG 常量
- ❌ 删 employee_scenarios 表
- ❌ 改 mission.scenario 语义（仍存 slug）
- ❌ 改动 20+ 下游消费者
- ❌ 删 /scenarios/customize 页面
- ❌ 改 channels/gateway.ts

### Phase B.2（后续 PR，本 spec 仅列大纲）—— "清理遗产"

见 §12。B.2 独立写 spec。

---

## 4. B.1 数据模型变更

### 4.1 扩展 `workflow_templates` 字段

**依赖已存在字段（不重复加）：**
- `is_builtin boolean default false`（存在，B.1 直接用）
- `is_enabled boolean default true`（存在）

**新增 6 列：**

```sql
ALTER TABLE workflow_templates
  ADD COLUMN icon text,
  ADD COLUMN input_fields jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN default_team jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN app_channel_slug text,
  ADD COLUMN system_instruction text,
  ADD COLUMN legacy_scenario_key text;  -- 旧 slug 桥接（B.2 删）
```

对应 Drizzle schema：
```ts
icon: text("icon"),
inputFields: jsonb("input_fields").$type<InputFieldDef[]>().default([]),
defaultTeam: jsonb("default_team").$type<EmployeeId[]>().default([]),
appChannelSlug: text("app_channel_slug"),           // nullable
systemInstruction: text("system_instruction"),      // from employeeScenarios
legacyScenarioKey: text("legacy_scenario_key"),    // e.g. "breaking_news"（B.2 删）
```

### 4.2 扩展 `workflow_category` enum

**⚠️ PG `ALTER TYPE ... ADD VALUE` 不能在事务块里执行**，`drizzle-kit migrate` 默认把 migration 包事务，会报错。**必须手写 migration SQL**：

创建 `supabase/migrations/20260419000001_workflow_category_add_values.sql`：

```sql
-- PG enum ADD VALUE 需非事务执行。
-- 若用 Supabase CLI，在这个 SQL 头部加：
-- -- supabase: no-transaction

ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'deep';
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'social';
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'advanced';
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'livelihood';
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'podcast';
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'drama';
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'daily_brief';
```

**另一个 migration**（`20260419000002_workflow_templates_new_cols.sql`）放上节的 ALTER TABLE + 索引，可以包事务。

Drizzle enum 定义更新：
```ts
export const workflowCategoryEnum = pgEnum("workflow_category", [
  "news", "video", "analytics", "distribution",   // existing
  "deep", "social", "advanced",                    // new
  "livelihood", "podcast", "drama", "daily_brief", // new
  "custom",                                        // existing
]);
```

最终 12 个值。

### 4.3 扩展 `missions` 表

```sql
ALTER TABLE missions
  ADD COLUMN workflow_template_id uuid REFERENCES workflow_templates(id) ON DELETE RESTRICT;

CREATE INDEX missions_workflow_template_id_idx ON missions (workflow_template_id)
  WHERE workflow_template_id IS NOT NULL;
```

**FK 语义选择 RESTRICT 而非 SET NULL：**
- 防止误删 builtin template 导致历史 mission 丢失引用
- builtin template UI 入口不开放删除按钮（只能 `isEnabled=false` 软下线）
- 用户自定义 template：UI 可删，但如果被 mission 引用，DB 层会阻止（前端捕获提示"先删引用的任务或软下线"）

Drizzle：
```ts
workflowTemplateId: uuid("workflow_template_id")
  .references(() => workflowTemplates.id, { onDelete: "restrict" }),
```

- `mission.scenario` text 字段 **保持不变**（继续存 slug，所有下游消费者 UI/Inngest/mission-executor 零改动）
- 新 mission 创建时双写：
  - `scenario = slugify(template)`（见下方规则）
  - `workflowTemplateId = template.id`

**`slugify(template)` 规则：**
```ts
function templateToScenarioSlug(t: WorkflowTemplate): string {
  // 1. builtin 有 legacyScenarioKey → 直接用（与 SCENARIO_CONFIG / ADVANCED_SCENARIO_CONFIG 的 key 对齐）
  if (t.legacyScenarioKey) return t.legacyScenarioKey;
  // 2. custom（用户自定义 / 旧的 6 条 templatesData）→ 生成稳定 slug
  return `custom_${nanoid(6)}`;
}
```

**防下游 lookup undefined：** 所有 `SCENARIO_CONFIG[mission.scenario]` 的消费者已经是 `?? SCENARIO_CONFIG.custom`（或容错到 `mission.scenario` 本身当 label）。B.1 **不改这些容错路径**，但要在 mission 创建时避免写入纯中文 name（例如 "快讯工作流"），以免 lookup 失败后 UI 显示空 label。

验收检查：B.1 完成后 grep:
```bash
grep -rn "SCENARIO_CONFIG\[" src/ | grep -v "?? SCENARIO_CONFIG.custom\|?? SCENARIO_CONFIG\['custom'\]"
```
任何裸 `SCENARIO_CONFIG[scenario]` 必须在 B.1 内修补兜底（~5 处）。

### 4.4 InputFieldDef 类型统一

保留现有类型（从 `src/lib/types.ts:322-338` 保持，DB jsonb 存相同结构）：

```ts
export interface InputFieldDef {
  name: string;
  label: string;
  type: "text" | "textarea" | "select" | "number";
  required: boolean;
  placeholder?: string;
  options?: Array<string | { value: string; label: string }>;  // 兼容两种格式
}
```

---

## 5. B.1 数据迁移（Seed）

### 5.1 Seed 幂等设计

**唯一索引（两个互补 partial index）：**

```sql
-- builtin scenario keys（SCENARIO_CONFIG / ADVANCED_SCENARIO_CONFIG / employeeScenarios 迁入后的）
CREATE UNIQUE INDEX IF NOT EXISTS workflow_templates_org_legacy_key_uidx
  ON workflow_templates (organization_id, legacy_scenario_key)
  WHERE legacy_scenario_key IS NOT NULL;

-- builtin 工作流（旧 templatesData 6 条，legacy_scenario_key=null）
CREATE UNIQUE INDEX IF NOT EXISTS workflow_templates_org_builtin_name_uidx
  ON workflow_templates (organization_id, name)
  WHERE is_builtin = true AND legacy_scenario_key IS NULL;
```

seed 层分两个 `onConflictDoUpdate` 分支：
- 有 legacy_key → conflict target `(org_id, legacy_scenario_key)`
- 无 legacy_key（custom builtin） → conflict target `(org_id, name) where is_builtin and legacy_key is null`

### 5.2 新 DAL：`src/lib/dal/workflow-templates.ts`

```ts
export type WorkflowTemplateCategory =
  | "news" | "video" | "analytics" | "distribution"
  | "deep" | "social" | "advanced"
  | "livelihood" | "podcast" | "drama" | "daily_brief" | "custom";

export interface ListFilter {
  category?: WorkflowTemplateCategory;
  isBuiltin?: boolean;
  isEnabled?: boolean;        // default true
  appChannelSlug?: string;
  employeeSlug?: string;      // 过滤 defaultTeam 含某员工的模板
}

export async function listWorkflowTemplatesByOrg(
  organizationId: string,
  filter: ListFilter = {},
  options: { limit?: number; offset?: number } = {},
): Promise<WorkflowTemplateRow[]>;

export async function getWorkflowTemplateById(id: string);
export async function getWorkflowTemplateByLegacyKey(orgId: string, legacyKey: string);
export async function createWorkflowTemplate(orgId: string, input);
export async function updateWorkflowTemplate(id: string, patch);
export async function softDisableWorkflowTemplate(id: string);  // isEnabled=false
export async function seedBuiltinTemplatesForOrg(orgId: string);  // idempotent upsert
```

**性能 note：** `employeeSlug` 过滤使用 `default_team @> '["slug"]'::jsonb`，当前量级 (<100) 无需 GIN 索引；若未来 builtin templates 超 5000 条，考虑 `CREATE INDEX ... USING GIN (default_team)`。

### 5.3 Seed 映射表（合并 4 个来源）

| 来源 | 数量 | legacyScenarioKey 规则 |
|------|-----|---------------------|
| SCENARIO_CONFIG | 10 | = constant key（e.g. `breaking_news`） |
| ADVANCED_SCENARIO_CONFIG | 6 | = constant key（e.g. `lianghui_coverage`） |
| employeeScenarios.xiaolei | 5 | `employee_scenario_xiaolei_${slugify(name)}` |
| 现有 workflow_templates seed | 6 | `null`（走第二个 partial 索引） |

**去重优先级：**
- employeeScenarios.systemInstruction > SCENARIO_CONFIG.templateInstruction
- 若两者名字/意图重复，employee 版本胜出（systemInstruction 更细致）

**总计预期：** **≥ 27 条** builtin workflow_templates / org（10 + 6 + 5 + 6）

### 5.4 Seed 实施步骤

1. 修改 `src/db/seed.ts` 的 `seedForOrganization(org)`：
   - 保留现有 `templatesData` 6 条 — 但每条补 `icon`、`defaultTeam`、以及上面 Drizzle schema 新字段（暂用 null / [] 兜底）
   - 新增 `BUILTIN_SCENARIOS_SEED` 合并来源 1+2+3（共 21 条）
   - workflow_templates 插入块 `onConflictDoUpdate` 分两路
   - **删除原来 employee_scenarios 的 seed 块**（~4 条 xiaolei 已迁到 workflow_templates）
2. `employee_scenarios` 表**保留**但不再 seed 数据；B.2 才 DROP。
3. 若运行时发现 `employee_scenarios` 表里已有老 seed 数据，seed 脚本在 `seedForOrganization` 开头 `DELETE FROM employee_scenarios WHERE organization_id = $1` 清一次。

### 5.5 在途 org 升级

- `npm run db:seed` 幂等，重复跑会 upsert
- 提供一次性脚本 `scripts/backfill-builtin-workflows.ts` 批量跑所有 org

---

## 6. B.1 UI 改造

### 6.1 首页 server 组件 — [src/app/(dashboard)/home/page.tsx](src/app/(dashboard)/home/page.tsx)

**Before：** 调用 `getAllScenariosByOrg()`（读 employeeScenarios）
**After：**
```ts
const workflows = await listWorkflowTemplatesByOrg(org.id, { isBuiltin: true, isEnabled: true });
```
透传 `workflows` 给 `HomeClient`。

**一次切换，不保留 feature flag。** 切换后 employeeScenarios 不再被读，表空数据 B.2 再 DROP。

### 6.2 首页场景网格 — [src/components/home/scenario-grid.tsx](src/components/home/scenario-grid.tsx)

**Before：** 从 `ADVANCED_SCENARIO_CONFIG` 读，硬编码 6 个 key
**After：** 改为受控组件，通过 props 接收：

```tsx
interface Props {
  workflows: WorkflowTemplateRow[];
  currentEmployeeSlug?: EmployeeId;
}

// 按当前员工过滤
const filtered = currentEmployeeSlug
  ? workflows.filter(w => w.defaultTeam?.includes(currentEmployeeSlug))
  : workflows;

const handleCardClick = (workflow: WorkflowTemplateRow) => {
  startMission({
    scenario: templateToScenarioSlug(workflow),   // slug 保持
    workflowTemplateId: workflow.id,
    teamSlugs: workflow.defaultTeam ?? [],
    title: workflow.name,
  });
};
```

**兼容：** `scenario-detail-sheet.tsx:33` 目前读 `ADVANCED_SCENARIO_CONFIG[scenarioKey]`，**B.1 阶段保持不动**（绕开即可）。

### 6.3 任务中心发起新任务 — [src/app/(dashboard)/missions/missions-client.tsx:225](src/app/(dashboard)/missions/missions-client.tsx:225)

**Before：** 从 `SCENARIO_CONFIG` + `SCENARIO_CATEGORIES` 读
**After：** server 预加载 workflows 透传给 client：

```tsx
interface Props {
  workflows: WorkflowTemplateRow[];
}

const byCategory = groupBy(workflows, w => w.category);
const categoryTabs = ORDERED_CATEGORIES.filter(c => byCategory[c]?.length > 0);

// 选中 workflow 创建 mission
await startMission({
  scenario: templateToScenarioSlug(workflow),
  workflowTemplateId: workflow.id,
  teamSlugs: workflow.defaultTeam,
  ...
});
```

**保留：** `missions-client.tsx:403` 列表行仍 `SCENARIO_CONFIG[m.scenario] ?? ADVANCED_SCENARIO_CONFIG[...]` 取 label/icon —— B.1 追加兜底 `?? { label: m.title, icon: FileText, color: "#6b7280" }`，保证 custom workflow 不挂。

### 6.4 Mission 创建（startMission API / action）

修改 `src/lib/mission-core.ts` 或 `src/app/actions/missions.ts`（以实际为准）：
- 接受 `workflowTemplateId?: string` 新参数
- 创建时双写 `scenario` + `workflowTemplateId`
- 若调用方未传 `workflowTemplateId`，尝试从 `scenario` slug 查 `workflow_templates.legacyScenarioKey` 补上（forward-compat）

---

## 7. B.1 测试策略

### 7.1 DAL 单测

`src/lib/dal/__tests__/workflow-templates.test.ts`：
- listWorkflowTemplatesByOrg with 5 filter combinations (no filter / by category / by isBuiltin / by employeeSlug / combined)
- seedBuiltinTemplatesForOrg 幂等（跑 2 次，断言行数相等，updated_at 变化）
- create / update / softDisable
- `templateToScenarioSlug` 纯函数：builtin 走 legacyScenarioKey、custom 走 `custom_${nanoid}`

**两入口同源断言（关键 AC）：**
```ts
it("首页和任务中心调用 DAL 返回相同的 workflow id 集合", async () => {
  const homeFilter = { isBuiltin: true, isEnabled: true };
  const missionsFilter = { isBuiltin: true, isEnabled: true };
  const homeResult = await listWorkflowTemplatesByOrg(testOrgId, homeFilter);
  const missionsResult = await listWorkflowTemplatesByOrg(testOrgId, missionsFilter);
  expect(new Set(homeResult.map(w => w.id))).toEqual(new Set(missionsResult.map(w => w.id)));
  expect(homeResult.length).toBeGreaterThanOrEqual(27);
});
```

### 7.2 Seed 冒烟

```bash
npm run db:seed
# 断言：
psql $DATABASE_URL -c "SELECT COUNT(*) FROM workflow_templates WHERE is_builtin=true;"
# 预期 ≥ 27
psql $DATABASE_URL -c "SELECT DISTINCT category FROM workflow_templates WHERE is_builtin=true;"
# 预期至少覆盖 news / deep / social / advanced / livelihood / daily_brief / custom / analytics / distribution
```

### 7.3 回归断言（确保 Inngest 链路不挂）

```bash
# 跑单测 workflow-templates + missions + mission-executor
npm run test -- src/lib/dal src/lib/mission-
# 预期：全绿；mission-executor 的测试用例读 mission.scenario slug 仍能解到 label
```

### 7.4 UI 冒烟（手动）

1. `/home`：场景网格能显示 workflows（按当前员工 tab 过滤）
2. `/missions` → "发起新任务"：Sheet 按 category 分 tab、每 tab 有对应 workflow、点选能启动 mission
3. **两个入口 workflow 列表的 ID 集合一致**（7.1 自动化已覆盖，UI 再手动对照一次）
4. 启动 mission 后 mission-console 能正常加载（mission.scenario 解析到 label）

### 7.5 编译 & 全量回归

- `npx tsc --noEmit` → 0 error
- `npm run test` → 全绿
- `npm run build` → 成功

---

## 8. B.1 风险 & rollout

| 风险 | 缓解 |
|------|------|
| seed 字段映射错（例如 defaultTeam 里的 employeeId 拼错） | 加 zod schema 校验，seed 前验证 |
| PG enum `ADD VALUE` migration 失败 | §4.2 已明确写手写 SQL + no-transaction 注释；migration PR 单独执行避免事务冲突 |
| 首页切换 DAL 后，旧 employeeScenarios 的 5 条 xiaolei 数据丢失 | §5.3 seed 先把 5 条迁进 workflow_templates；切换后 employeeScenarios 表保留为空，B.2 DROP |
| 新 mission 的 `scenario` 字段是中文 name，下游 SCENARIO_CONFIG lookup 挂 | §4.3 `templateToScenarioSlug` 规则保证 builtin 走 legacyScenarioKey（与 SCENARIO_CONFIG key 对齐）；custom 用 `custom_${nanoid}` 保证是 slug；§6.3 在 UI 消费端加 `?? { label: m.title }` 兜底 |
| builtin workflow 被 UI 误删导致 FK restrict 报错 | onDelete RESTRICT + builtin 在 UI 不显示删除按钮；API 层校验 `isBuiltin=false` 才允许 DELETE |

**Rollout 顺序：**

1. **Migration 1**（非事务）：`ALTER TYPE workflow_category ADD VALUE ...` × 7
2. **Migration 2**（事务）：`ALTER TABLE workflow_templates ADD COLUMN ...` × 6 + 两个 partial unique index + `ALTER TABLE missions ADD COLUMN workflow_template_id`
3. **DAL 实现**：`listWorkflowTemplatesByOrg` + `seedBuiltinTemplatesForOrg` + 单测全绿
4. **Seed 迁移**：`src/db/seed.ts` 合并 4 个来源，`npm run db:seed` 验证 >= 27 行
5. **UI 改造**：首页 + 任务中心一起切到 DAL（一个 PR），加 `templateToScenarioSlug` 工具 + `?? { label }` 兜底
6. **startMission 双写**：action 层接收 workflowTemplateId 参数
7. **QA 冒烟 + 7.1-7.5 测试全绿**
8. **merge main → deploy**（观察 1 周 → 评估 B.2）

---

## 9. B.1 代码处理清单

**保留但 @deprecated：**
- `SCENARIO_CONFIG` (src/lib/constants.ts:456)
- `ADVANCED_SCENARIO_CONFIG` (:610)
- `SCENARIO_CATEGORIES` (if exists)
- `ADVANCED_SCENARIO_KEYS` (:753)

**表保留但 seed 停写：**
- `employee_scenarios` table + DAL `src/lib/dal/scenarios.ts`
- `src/app/api/scenarios/execute/route.ts`
- `src/app/api/employees/[slug]/scenarios/route.ts`

**页面不改：**
- `/scenarios/customize` 整套（仍用 ADVANCED_SCENARIO_CONFIG；B.2 重写）
- `channels/gateway.ts:56,133`（仍解析 `#场景名`；B.2 改读 DB）

**必须改的下游 lookup 兜底（5 处左右）：**
- `missions-client.tsx:259/263/403`：加 `?? { label: m.title ?? scenario, icon: FileText, color: "#6b7280" }`
- `mission-console-client.tsx:187-188/887/921`：同上

---

## 10. Out of scope（本 spec 不做）

- `/workflows` 列表/详情/编辑 UI（P2+，单独 spec）
- 工作流多对多员工关联表（当前 `defaultTeam` jsonb 够用）
- 工作流版本管理 / diff / 发布流
- Skill MD 按 baoyu-skills 规范重写（**Track B**，独立 spec）
- B.2 清理工作（独立 spec）

---

## 11. Acceptance Criteria（B.1）

- [ ] `workflow_templates` 有 `icon / input_fields / default_team / app_channel_slug / system_instruction / legacy_scenario_key` 6 个新列
- [ ] `workflowCategoryEnum` 12 个值（原 5 + 新 7）
- [ ] `missions` 表有 `workflow_template_id uuid FK`（on delete **restrict**）
- [ ] `workflow_templates` 有 2 个 partial unique index：`(org_id, legacy_scenario_key) WHERE NOT NULL` 和 `(org_id, name) WHERE is_builtin AND legacy_scenario_key IS NULL`
- [ ] `src/lib/dal/workflow-templates.ts` 8 个导出函数全部实现 + 单测通过
- [ ] `npm run db:seed` 后，test org 的 builtin workflow_templates 行数 **≥ 27**
- [ ] 首页场景网格和任务中心发起新任务**都调用** `listWorkflowTemplatesByOrg()` — grep 确认：
  ```bash
  grep -l "listWorkflowTemplatesByOrg" src/app/\(dashboard\)/home/ src/app/\(dashboard\)/missions/
  # 至少 2 个匹配文件
  ```
- [ ] DAL 单测 `两个入口返回相同 workflow id 集合` 断言绿（§7.1）
- [ ] `mission.workflowTemplateId` 在新创建的 mission 上**非空**（旧 mission 保留 null）
- [ ] 原 Inngest 流程（leader-plan / leader-consolidate / execute-mission-task）**零改动**即可运行
- [ ] 下游 `SCENARIO_CONFIG[mission.scenario]` 消费点已加兜底（`?? { label: m.title, icon: FileText }`），grep 验证：
  ```bash
  grep -rn "SCENARIO_CONFIG\[" src/ | grep -v "\?\?\|??=" | wc -l
  # 预期 0（所有裸 lookup 都有兜底）
  ```
- [ ] `npx tsc --noEmit` 0 error
- [ ] `npm run test` 全绿
- [ ] `npm run build` 成功

---

## 12. B.2 大纲（仅记录，独立 spec）

**B.2 spec 名：** `2026-0X-XX-scenario-legacy-cleanup.md`

**B.2 包含：**
1. 所有 @deprecated 常量删除（SCENARIO_CONFIG / ADVANCED_SCENARIO_CONFIG / SCENARIO_CATEGORIES / ADVANCED_SCENARIO_KEYS）
2. `employee_scenarios` 表 DROP + migration
3. mission 下游消费者迁移到 `workflowTemplateId`（改 mission-executor / leader-plan / leader-consolidate / execute-mission-task / mission-console-client / missions-client / asset-revive / mission-core，估 ~10 个文件）
4. DAL `src/lib/dal/scenarios.ts` 删除
5. API route `src/app/api/scenarios/execute/route.ts` 删除
6. API route `src/app/api/employees/[slug]/scenarios/route.ts` 删除
7. `/scenarios/customize` 重写为编辑 workflow_templates
8. `channels/gateway.ts:56,133` `#场景名` 解析改读 DB
9. `scenario-detail-sheet.tsx` / `scenario-grid.tsx` 移除对 ADVANCED_SCENARIO_CONFIG 的引用
10. `src/lib/types.ts:322-338` `ScenarioCardData` 类型清理 / 删除 legacyScenarioKey 列
11. 验证：`grep "SCENARIO_CONFIG\|ADVANCED_SCENARIO_CONFIG\|employee_scenarios"` src/ 全部返回 0
