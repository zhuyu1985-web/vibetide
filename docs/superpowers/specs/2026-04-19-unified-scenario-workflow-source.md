# 统一场景来源：workflow_templates 作为唯一真相源

> **v2（2026-04-19）—— 根据 spec-reviewer 反馈修订：** 清点真实 inventory、拆分 B.1/B.2 两阶段，避免一次改动牵扯 20+ 下游消费者。

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

### 2.1 三套独立场景系统

| 系统 | 文件 | 具体 keys | 数据源 |
|------|-----|---------|------|
| 首页场景网格 | [src/components/home/scenario-grid.tsx](src/components/home/scenario-grid.tsx) | 读 `ADVANCED_SCENARIO_CONFIG` 6 个 + `employeeScenarios` 表 | 常量+DB |
| 任务中心发起 | [src/app/(dashboard)/missions/missions-client.tsx:214](src/app/(dashboard)/missions/missions-client.tsx:214) | `SCENARIO_CONFIG` 11 个 | 常量 |
| 工作流 | [src/db/seed.ts:571-655](src/db/seed.ts:571) | 6 条 templatesData seed | DB |
| 员工场景 | [src/db/seed.ts:~1330-1470](src/db/seed.ts) | xiaolei 5 条 | DB |

### 2.2 SCENARIO_CONFIG 完整清单（11 个，src/lib/constants.ts:456-567）

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

注：原清单 11 项，上表列出 10 项；实际验证时若发现第 11 项（如 `breaking_news_auto` / `event_express` / `daily_briefing` / `weekly_deep_report`）以代码为准。

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

### 2.5 现有 workflow_templates seed（至少 6 条，src/db/seed.ts:571-655）

- 快讯工作流（无 category 字段，默认 custom）
- 深度报道工作流（同上）
- 每日热点新闻推荐（category=news）
- 金融科技监管日报（category=news）
- 每周竞争对手情报报告（category=analytics）
- 客户投诉邮件分类（category=distribution）

### 2.6 workflow_category enum 现状（src/db/schema/enums.ts:523）

```
["news", "video", "analytics", "distribution", "custom"]  -- 5 values
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
- 扩 `workflow_templates` schema（+5 列）
- 扩 `workflow_category` enum（保留现有 5 值 + 新增 8 值）
- 写 seed：SCENARIO_CONFIG / ADVANCED_SCENARIO_CONFIG / employeeScenarios 全量导入 workflow_templates
- 新 DAL `listWorkflowTemplatesByOrg(orgId, filter)`
- **首页 + 任务中心两个入口改读 DAL**
- 新增 `missions.workflowTemplateId` 可空 FK（向后兼容）
- 常量标 `@deprecated`（不删）

**不包含（推到 B.2）：**
- ❌ 删 SCENARIO_CONFIG / ADVANCED_SCENARIO_CONFIG 常量
- ❌ 删 employee_scenarios 表
- ❌ 改 mission.scenario 语义（仍存 slug）
- ❌ 改动 20+ 下游消费者
- ❌ 删 /scenarios/customize 页面
- ❌ 改 channels/gateway.ts

### Phase B.2（后续 PR，本 spec 仅列大纲）—— "清理遗产"

**计划做：**
- mission.scenario 消费者逐个迁移到 `workflowTemplateId`（改 mission-executor / leader-plan / leader-consolidate / execute-mission-task 等 5-8 个文件）
- 常量 `SCENARIO_CONFIG` / `ADVANCED_SCENARIO_CONFIG` / `SCENARIO_CATEGORIES` / `ADVANCED_SCENARIO_KEYS` 全部删除
- 表 `employee_scenarios` DROP
- DAL `src/lib/dal/scenarios.ts` 删除
- API route `src/app/api/scenarios/execute/route.ts` 删除
- API route `src/app/api/employees/[slug]/scenarios/route.ts` 删除
- `/scenarios/customize` 页面重写或删除
- `channels/gateway.ts:56,133` 改为读 DB
- `scenario-detail-sheet.tsx` / `scenario-grid.tsx` 切断对常量的依赖

**B.2 独立写 spec，不在本 spec 范围。**

---

## 4. B.1 数据模型变更

### 4.1 扩展 `workflow_templates` 字段

```sql
ALTER TABLE workflow_templates
  ADD COLUMN icon text,
  ADD COLUMN input_fields jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN default_team jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN app_channel_slug text,
  ADD COLUMN system_instruction text,
  ADD COLUMN legacy_scenario_key text;   -- 暂存旧 slug（B.2 删）
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

**唯一索引：** 添加复合唯一索引供 seed 幂等：
```sql
CREATE UNIQUE INDEX IF NOT EXISTS workflow_templates_org_legacy_key_uidx
  ON workflow_templates (organization_id, legacy_scenario_key)
  WHERE legacy_scenario_key IS NOT NULL;
```

### 4.2 扩展 `workflow_category` enum

```sql
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'deep';
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'social';
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'advanced';
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'livelihood';
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'podcast';
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'drama';
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'daily_brief';
-- news / video / analytics / distribution / custom 已存在，保留
```

Drizzle：
```ts
export const workflowCategoryEnum = pgEnum("workflow_category", [
  "news", "video", "analytics", "distribution",
  "deep", "social", "advanced",
  "livelihood", "podcast", "drama", "daily_brief",
  "custom",
]);
```

最终 12 个值。

### 4.3 扩展 `missions` 表

```sql
ALTER TABLE missions
  ADD COLUMN workflow_template_id uuid REFERENCES workflow_templates(id) ON DELETE SET NULL;

CREATE INDEX missions_workflow_template_id_idx ON missions (workflow_template_id)
  WHERE workflow_template_id IS NOT NULL;
```

Drizzle：
```ts
workflowTemplateId: uuid("workflow_template_id")
  .references(() => workflowTemplates.id, { onDelete: "set null" }),
```

- `mission.scenario` text 字段**保持不变**（继续存 slug，所有下游消费者 UI/Inngest/mission-executor 零改动）
- 新 mission 创建时双写：`scenario = template.legacyScenarioKey ?? template.name`、`workflowTemplateId = template.id`
- B.2 再把下游消费者从 `scenario` 迁到 `workflowTemplateId`

### 4.4 InputFieldDef 类型统一

保留现有类型（从 `src/lib/types.ts:322-338` 保持，DB jsonb 存相同结构）：

```ts
export interface InputFieldDef {
  name: string;
  label: string;
  type: "text" | "textarea" | "select" | "number";
  required: boolean;
  placeholder?: string;
  options?: Array<string | { value: string; label: string }>;  // 兼容现有 employee_scenarios 两种格式
}
```

---

## 5. B.1 数据迁移（Seed）

### 5.1 新 DAL：`src/lib/dal/workflow-templates.ts`

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

`seedBuiltinTemplatesForOrg` 使用 `onConflictDoUpdate` on `(organizationId, legacyScenarioKey)` 唯一索引。

### 5.2 Seed 映射表（合并 4 个来源）

**来源 1：SCENARIO_CONFIG** → 11 条（legacyScenarioKey = key）
**来源 2：ADVANCED_SCENARIO_CONFIG** → 6 条（legacyScenarioKey = key）
**来源 3：employeeScenarios.xiaolei** → 5 条（legacyScenarioKey = `employee_scenario_xiaolei_${slugify(name)}`，defaultTeam = [xiaolei]）
**来源 4：现有 workflow_templates seed** → 6 条（legacyScenarioKey = null，继续作为"后台编排"工作流）

**去重优先级：**
- employeeScenarios.systemInstruction > SCENARIO_CONFIG.templateInstruction（精细度高）
- 若两者名字/意图重复，employee 版本胜出

**总计预期：** ≥ 28 条 builtin workflow_templates / org（11 + 6 + 5 + 6）

### 5.3 Seed 实施步骤

1. 修改 `src/db/seed.ts` 的 `seedForOrganization(org)`：
   - 保留现有 `templatesData` 6 条（按 4.1 schema 填 icon/defaultTeam/null 等）
   - 新增 `BUILTIN_SCENARIOS_SEED` 合并来源 1+2+3（21 条）
   - 在 workflow_templates 插入块中串行处理所有 `templatesData.concat(BUILTIN_SCENARIOS_SEED)`
   - 删除原来 employee_scenarios 的 seed 块（但保留 employee_scenarios 表 —— B.2 才 DROP）

### 5.4 在途 org 升级

为已存在的 organizations 运行 backfill：
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

**保留：** `employeeScenarios` 的读取（若页面还展示单员工私有场景，则继续保留并新增 `workflows` 一起用）。**推荐：首页完全切到 workflows，employeeScenarios 查询暂时保留但不展示，B.2 阶段删。**

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

// 点击卡片
const handleCardClick = (workflow: WorkflowTemplateRow) => {
  // 继续调用原有 startMission API：
  //   scenario: workflow.legacyScenarioKey ?? workflow.name   （slug 保持）
  //   workflowTemplateId: workflow.id                          （新）
  //   teamSlugs: workflow.defaultTeam
};
```

**兼容：** `scenario-detail-sheet.tsx:33` 目前读 `ADVANCED_SCENARIO_CONFIG[scenarioKey]`，**B.1 阶段保持不动**（若首页路径仍能找到 scenarioKey 则还 work；完全切换留到 B.2）。

### 6.3 任务中心发起新任务 — [src/app/(dashboard)/missions/missions-client.tsx:225](src/app/(dashboard)/missions/missions-client.tsx:225)

**Before：**
```tsx
import { SCENARIO_CONFIG, SCENARIO_CATEGORIES } from "@/lib/constants";
{SCENARIO_CATEGORIES.map(...)}
```

**After：**
```tsx
// page.tsx server 预加载 workflows 透传给 client
interface Props {
  workflows: WorkflowTemplateRow[];
}

const byCategory = groupBy(workflows, w => w.category);
const categoryTabs = orderedCategories(Object.keys(byCategory));   // 按枚举顺序显示

// 选中 workflow 创建 mission
await startMission({
  scenario: workflow.legacyScenarioKey ?? workflow.name,    // 继续给旧消费者用
  workflowTemplateId: workflow.id,                           // 新写
  teamSlugs: workflow.defaultTeam,
  ...
});
```

**保留：** 页面其他地方仍 `SCENARIO_CONFIG[m.scenario]`（例如 missions-client.tsx:403 列表行展示 label/icon）——B.1 不改，B.2 再切到 `workflowTemplateId` 查询。

### 6.4 Mission 创建（startMission API / action）

修改 `src/lib/mission-core.ts` 或 `src/app/actions/missions.ts`（以实际为准）：
- 接受 `workflowTemplateId?: string` 新参数
- 创建时双写 `scenario` + `workflowTemplateId`
- 若调用方未传 `workflowTemplateId`，尝试从 `scenario` slug 查 `workflow_templates` 补上（forward-compat）

---

## 7. B.1 测试策略

### 7.1 DAL 单测

`src/lib/dal/__tests__/workflow-templates.test.ts`：
- listWorkflowTemplatesByOrg with 5 filter combinations (no filter / by category / by isBuiltin / by employeeSlug / multi)
- seedBuiltinTemplatesForOrg 幂等（跑 2 次，行数相等）
- create / update / softDisable

### 7.2 Seed 冒烟

```bash
npm run db:seed
# 断言：
psql $DATABASE_URL -c "SELECT COUNT(*) FROM workflow_templates WHERE is_builtin=true;"
# 预期 ≥ 28
psql $DATABASE_URL -c "SELECT DISTINCT category FROM workflow_templates;"
# 预期至少覆盖 news / deep / social / advanced / livelihood / daily_brief / custom
```

### 7.3 UI 冒烟（手动）

1. `/home` 打开：场景网格能显示 workflows（按当前员工 tab 过滤）
2. `/missions` → "发起新任务"：Sheet 按 category 分 tab、每 tab 有对应 workflow、点选能启动 mission
3. **两个入口 workflow 列表的 ID 集合一致**（可写断言脚本）

### 7.4 编译 & 回归

- `npx tsc --noEmit` → 0 error
- `npm run test` → 全绿
- 启动 Mission 后 leader-plan / leader-consolidate / execute-mission-task 能正常运行（downstream 消费 `mission.scenario` slug 仍能 work）

---

## 8. B.1 风险 & rollout

| 风险 | 缓解 |
|------|------|
| seed 字段映射错（例如 scenario defaultTeam 里的 employeeId 拼错） | 加 zod schema 校验，seed 前验证 |
| workflow_category enum 扩展迁移失败（PG enum 追加需 `ADD VALUE`） | 使用 Drizzle migration + `ALTER TYPE ... ADD VALUE IF NOT EXISTS`（非事务内执行） |
| 首页切换 DAL 后，原来走 employeeScenarios 的数据消失 | B.1 先**双读**（workflows + employeeScenarios），通过 feature flag `HOME_USE_WORKFLOWS=true` 切换；B.2 删除 fallback |
| 任务中心 Sheet 切换后原 SCENARIO_CATEGORIES 分组丢失 | 保持 tab 顺序与原来一致（news/deep/social/advanced/custom），通过常量映射维护 |
| 现有 mission.scenario slug 与新 seed 的 legacyScenarioKey 对不上 | 以 slug 为主键做映射表，seed 时保证 `legacy_scenario_key` 与 SCENARIO_CONFIG 的 key 完全一致 |

**Rollout 顺序：**

1. **Migration**：schema 扩列 + enum 扩值 + 唯一索引（`npm run db:push`，约 5 分钟）
2. **DAL 实现**：listWorkflowTemplatesByOrg + seedBuiltinTemplatesForOrg + 单测
3. **Seed 迁移**：`src/db/seed.ts` 合并 4 个来源，跑 `npm run db:seed`
4. **UI 改造**：首页 + 任务中心（feature flag `HOME_USE_WORKFLOWS` 默认 false，测试通过后开 true）
5. **Mission 创建双写**：action 层加 workflowTemplateId 参数
6. **QA 冒烟** + 打开 feature flag
7. 观察 1 周 → 评估 B.2

---

## 9. B.1 代码删除清单（仅标 @deprecated，不删）

- `SCENARIO_CONFIG`（src/lib/constants.ts:456）→ 加 `@deprecated use workflow_templates` 注释
- `ADVANCED_SCENARIO_CONFIG`（同文件:610）→ 同上
- `SCENARIO_CATEGORIES`（若存在）→ 同上
- `ADVANCED_SCENARIO_KEYS`（:753）→ 同上
- `employee_scenarios` table / DAL → 保留
- `/scenarios/customize` 页面 → 保留（仍指向 ADVANCED_SCENARIO_CONFIG）

**B.2 spec 单独列删除清单：**
- 上述所有 @deprecated 项
- `src/app/api/scenarios/execute/route.ts`
- `src/app/api/employees/[slug]/scenarios/route.ts`
- `src/lib/dal/scenarios.ts`（或 employee-scenarios.ts）
- `/scenarios/customize` 整套
- mission.scenario 字段的硬编码消费者迁移 + slug 改 uuid

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
- [ ] `missions` 表有 `workflow_template_id uuid FK`（on delete set null）
- [ ] `workflow_templates` 有 unique index `(organization_id, legacy_scenario_key)` where not null
- [ ] `src/lib/dal/workflow-templates.ts` 8 个导出函数全部实现 + 单测通过
- [ ] `npm run db:seed` 后，test org 的 builtin workflow_templates 行数 ≥ 28
- [ ] 首页场景网格**和**任务中心发起新任务**都调用** `listWorkflowTemplatesByOrg()`（grep 确认源相同）
- [ ] 两个入口显示的 workflow id 集合相等（手动或脚本断言）
- [ ] `mission.workflowTemplateId` 在新 mission 上非空（旧 mission 保留 null）
- [ ] 原 Inngest 流程（leader-plan / leader-consolidate / execute-mission-task）**零改动**即可运行
- [ ] `npx tsc --noEmit` 0 error
- [ ] `npm run test` 全绿
- [ ] `grep -rn "SCENARIO_CONFIG\[" src/` 仍有 10+ 匹配（B.1 故意保留 fallback）

---

## 12. B.2 大纲（仅记录，独立 spec）

**B.2 spec 名：** `2026-0X-XX-scenario-legacy-cleanup.md`

**B.2 包含：**
1. 所有 @deprecated 常量删除
2. `employee_scenarios` 表 DROP + migration
3. mission 下游消费者（mission-executor / leader-plan / leader-consolidate / execute-mission-task / mission-console-client / missions-client / asset-revive 等）迁移到 `workflowTemplateId`
4. `/scenarios/customize` 重写为编辑 workflow_templates
5. `channels/gateway.ts` `#场景名` 解析改读 DB
6. `scenario-detail-sheet.tsx` / `scenario-grid.tsx` 移除对 ADVANCED_SCENARIO_CONFIG 的引用
7. `src/lib/types.ts:322-338` `ScenarioCardData` 类型清理
8. 验证：`grep "SCENARIO_CONFIG\|ADVANCED_SCENARIO_CONFIG\|employee_scenarios"` src/ 全部返回 0
