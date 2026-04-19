# 场景 / 工作流架构纠偏 Spec（含 B.2 合并）

> **v2（2026-04-20）** —— 第一轮 reviewer 反馈修订。关键修订：
> - `inputs_schema` 改为**扩展 B.1 已落的 `workflow_templates.input_fields`**，不新增列
> - 移除不存在的 `awaiting_input` mission_status
> - `is_public` 语义锁在"org 级开关"
> - `promptTemplate` 明确为 system prompt 的可选 hint，非 Leader 分解主路径
> - 下游消费者清单对齐实际 grep 结果（25+ 处）
> - SKILL.md 精确清单由 Phase 0 Audit 产出，不在 spec 内硬写
>
> 本 spec 是一次产品心智模型与实现落地的整体纠偏。系统未生产，采用一次彻底重构路线（非增量），同时把 B.2 迁移（legacy 常量 / employee_scenarios / 下游 25+ 消费者）合并进来做完。

**日期：** 2026-04-20
**作者：** PM (zhuyu) + Claude
**状态：** 待实现
**前置：** B.1（commit `2110908`）已合入 main
**合并目标：** 原计划独立的 B.2（`2026-04-19-scenario-legacy-cleanup-spec.md`）并入本 spec；本 spec 合并后 B.2 spec 移至 `docs/superpowers/archive/`

---

## 1. 设计原则（心智模型纠偏）

> **AI 数字员工 = 智能体 = 工作流载体。员工的"预设场景"即是绑定在该员工身上的默认工作流。`workflow_templates` 是所有场景的唯一真相源。场景触发入口只在"员工工作台"和"首页 / 任务中心的场景快捷启动"——不在"选文章→挑场景"这类内容流下游。**

### 1.1 推论

1. **`workflow_templates` 承担全部场景语义**：`isBuiltin=true` 的公共预置、`ownerEmployeeId` 指向的员工预设、`isBuiltin=false` 的用户自定义，统一用同一张表、同一个 DAL 列表 API 暴露。
2. **员工预设默认公开、可私有化（org 级）**：每个员工预设模板有 `is_public`（default true）。Org 管理员（`role >= admin`）可把本 org 内该条预设切为私有；私有只在该员工工作台可启动，不进首页与 `/workflows`，不跨 org 影响。是一个 **per-row-per-org** 的布尔（不是系统级）。
3. **启动参数声明式化**：模板显式声明 `input_fields`（扩展 B.1 已有 `InputFieldDef`），前端按 schema 渲染统一的 `WorkflowLaunchDialog`；不再有"点击就跑、参数靠 Leader 猜"。
4. **首页"场景快捷启动"按员工分 tab**：呼应"员工=能力载体"的产品叙事；最后一档 tab "我的工作流"放用户自定义。
5. **内容流不再承载场景选择**：热点详情、稿件详情页的"生成稿件"按钮走固定的默认工作流（`ownerEmployeeId=xiaolei AND legacyScenarioKey='breaking_news' AND isBuiltin=true`，详见 §4.6），不弹出场景选择器。

### 1.2 与 B.1 的关系

B.1 已经建好"workflow_templates 唯一读路径" + `input_fields` / `defaultTeam` / `legacyScenarioKey` / `appChannelSlug` 等字段。本 spec 是 B.1 基础之上：

- **扩展** `input_fields` 表达力（添加更多字段类型、validation、默认值）
- **新增** `is_public` / `owner_employee_id` / `launch_mode` 三列 + 一个可选的 `prompt_template` text 列（system prompt hint，非主路径）
- **新增** `missions.input_params` 一列
- **删除**：4 个 @deprecated 常量 + `employee_scenarios` 表 + 17 条空 steps 的 legacy seed + `/scenarios/customize` 页 + `ScenarioDetailSheet` 组件
- **迁移**：25+ 下游消费者从 `mission.scenario` slug 硬分支改走 `mission.workflowTemplateId` + `steps[]` 驱动

---

## 2. 现状 Inventory（对齐事实）

### 2.1 五组 workflow_templates seed 源（39 条，新旧混杂）

| 源 | 数量 | 有 steps[] | 本 spec 处置 |
|----|-----|----------|------------|
| SCENARIO_CONFIG（legacy）`src/lib/constants.ts:478` | 10 | ❌ | **删除** |
| ADVANCED_SCENARIO_CONFIG（legacy）`src/lib/constants.ts:636` | 6 | ❌ | **删除** |
| `employeeScenarios.xiaolei` seed（`src/db/seed.ts` ~1330 行附近）| 5 | ❌ | **删除**（并被新的 xiaolei 预设工作流覆盖） |
| DEMO_DAILY_SCENARIOS（`seed-builtin-workflows.ts`）| 10 | ✅ | **保留为公共预置** |
| EMPLOYEE_DAILY_SCENARIOS（8 员工 × 1）| 8 | ✅ | **保留为员工预设**，补 `is_public=true` 默认 |

**清理后目标**：锁定 **≥ 26 条 builtin**，全部有真实 `steps[]` 和 `input_fields`，分布见 §5.3。

### 2.2 25+ 处 legacy slug 下游消费者（核实 grep，分四层）

**UI 层（16 处）：**
- `missions-client.tsx:214/259/263/265/403/535/538`（7 处，SCENARIO_CONFIG 迭代 + 行显示 + filter）
- `mission-console-client.tsx:187/887`（2 处）
- `home-client.tsx:209/231`（2 处，ADVANCED_SCENARIO_CONFIG 查）
- `scenario-detail-sheet.tsx:33`（1 处）
- `scenario-grid.tsx:86/140`（2 处）
- `asset-revive-client.tsx:337/674`（2 处，scenarioBadge 本地 map）
- `scenarios/customize/*`（770 行整页，一并删）

**Inngest / 后台（~9 处）：**
- `leader-plan.ts:65`
- `leader-consolidate.ts:110`
- `execute-mission-task.ts:234`
- `mission-core.ts:93/115/345/381`（4 处 LLM prompt 插值）
- `mission-executor.ts:66/220/291/344/546`（5 处步骤派发 + 事件名）

**入口（2 处）：**
- `channels/gateway.ts:56/133`（DingTalk / 企业微信 `#场景名` 快速指令解析）

**DAL（1 处）：**
- `asset-revive.ts:130`（scenario label map）

**总计 ≥ 28 处**，Phase 4 迁移时以 `rg 'SCENARIO_CONFIG|ADVANCED_SCENARIO_CONFIG|mission\\.scenario'` 为准重新核对。

### 2.3 skill SKILL.md 规范 Audit 交给 Phase 0

Track B（2026-04-19）已标准化 13 个 skill（CMS/AIGC 域，包含 `summary_generate`、`topic_extraction`、`content_generate` 等）。§5.3 重写后 seed 所引用的 skill slug 集合可能与 Track B 的 13 个有重叠 / 差集 —— **精确清单由 Phase 0 Audit 产出**（脚本 `scripts/check-skill-md.ts`，见 §7），本 spec 不硬写候选列表以免失准。

---

## 3. 数据模型变更

### 3.1 `workflow_templates` 字段增补（不替换 B.1 已落列）

B.1 已有的保留原状：`input_fields` / `default_team` / `app_channel_slug` / `system_instruction` / `legacy_scenario_key` / `icon`。

**新增 4 列：**

```ts
// src/db/schema/workflows.ts
export const workflowTemplates = pgTable("workflow_templates", {
  // ... 所有 B.1 字段保留
  isPublic: boolean("is_public").notNull().default(true),                     // NEW
  ownerEmployeeId: text("owner_employee_id"),                                  // NEW (nullable)
  launchMode: text("launch_mode").notNull().default("form"),                   // NEW: "form" | "direct"
  promptTemplate: text("prompt_template"),                                     // NEW (nullable, Mustache hint)
});
```

**字段语义：**

| 字段 | 类型 | 默认 | 语义 |
|------|-----|-----|-----|
| `is_public` | boolean | true | 是否在首页与 `/workflows` 列表出现；false 则仅员工工作台可见。Org 级（依 `organization_id` 正交），每 org 一条 row 独立控制。 |
| `owner_employee_id` | text NULL | null | 员工预设指向 8 个员工 slug 之一；公共模板 / 用户自定义为 null。 |
| `launch_mode` | text | "form" | `"form"`→弹 `WorkflowLaunchDialog` 收参数；`"direct"`→直接 `startMissionFromTemplate(templateId, {})`（无参数场景，如"小数日报"）。 |
| `prompt_template` | text NULL | null | 可选 Mustache 模板（`{{field_key}}` 占位），仅在组装 Leader system prompt 时作为附加 hint 注入，**不替代** Leader 的结构化分解流程。 |

### 3.2 `InputFieldDef` 扩展（继承并兼容）

`InputFieldDef` 在 `src/lib/types.ts:332` 当前只有 `name / label / type("text"|"textarea"|"select")`。本 spec **扩展而非替换**：

```ts
// src/lib/types.ts (修改)
export interface InputFieldDef {
  name: string;                     // 保持 B.1 命名 (不叫 key)
  label: string;
  type:
    | "text"
    | "textarea"
    | "select"
    | "multiselect"    // NEW
    | "date"           // NEW
    | "daterange"      // NEW
    | "url"            // NEW
    | "number"         // NEW
    | "toggle";        // NEW
  required?: boolean;                              // NEW
  placeholder?: string;                            // NEW
  defaultValue?: unknown;                          // NEW
  options?: Array<{ value: string; label: string }>;
  helpText?: string;                               // NEW
  validation?: {                                   // NEW
    minLength?: number;
    maxLength?: number;
    pattern?: string;   // regex
    min?: number;
    max?: number;
  };
}
```

**兼容性**：现有 seed 中的 `input_fields` 只用了 `name / label / type / options`，新字段全部可选，不破坏历史数据。

**为什么不新增 `inputs_schema` 列**：B.1 刚落 `input_fields` + 18 处 seed/UI/DAL 已在消费；新增一个结构相似的平行列会造成同义重复和迁移负担。扩展现列是最低熵路径。

### 3.3 `missions` 表字段

B.1 已存在：`workflow_template_id`（`src/db/schema/missions.ts:61`）。

**新增 1 列：**

```ts
// src/db/schema/missions.ts
export const missions = pgTable("missions", {
  // ...
  inputParams: jsonb("input_params").$type<Record<string, unknown>>().default({}), // NEW
});
```

**`mission.scenario`（text，B.1 已存）保留**：作为 denormalized label cache，写入时从 `template.name` 回填，不再语义驱动下游。沿用 B.2 spec §3.1 选 A。

### 3.4 Migration 合并

单个 migration 文件：`supabase/migrations/0053_workflow_realignment.sql`

- `ALTER TABLE workflow_templates ADD COLUMN is_public boolean NOT NULL DEFAULT true`
- `ALTER TABLE workflow_templates ADD COLUMN owner_employee_id text`
- `ALTER TABLE workflow_templates ADD COLUMN launch_mode text NOT NULL DEFAULT 'form' CHECK (launch_mode IN ('form', 'direct'))`
- `ALTER TABLE workflow_templates ADD COLUMN prompt_template text`
- `ALTER TABLE missions ADD COLUMN input_params jsonb NOT NULL DEFAULT '{}'`
- `DROP TABLE IF EXISTS employee_scenarios`

Seed 层同步改 `seed-builtin-workflows.ts` 写入新列。

---

## 4. UI 变更

### 4.1 首页"场景快捷启动"：按员工 tab

**路径**：`src/components/home/scenario-grid.tsx`（重构，Phase 2）

**结构**：
```
[Tabs: 小雷 | 小策 | 小子 | 小文 | 小剑 | 小审 | 小发 | 小数 | 我的工作流]
[Grid: 该 tab 下的预设工作流卡片]
    每张卡片：icon + 名称 + 一句话描述 + [启动] 按钮
```

**数据查询**（新增 DAL 函数 `listTemplatesForHomepage`）：
- 前 8 tab：`WHERE organization_id = $org AND is_public = true AND owner_employee_id = $employeeId`
- 最后 tab：`WHERE organization_id = $org AND is_builtin = false`

**点击行为**：
- `launchMode === "form"` → 弹 `WorkflowLaunchDialog`
- `launchMode === "direct"` → 直接 server action `startMissionFromTemplate(templateId, {})`

**启动权限**：v1 所有 org 成员登录用户均可启动（等同于现 `requireAuth()`）。RBAC 接入留在后续（out of scope）。

### 4.2 `WorkflowLaunchDialog`（新组件）

**路径**：`src/components/workflows/workflow-launch-dialog.tsx`（Phase 2）

**职责**：
- 接收 `template: WorkflowTemplate`
- 根据 `template.input_fields` 渲染对应控件（复用 `<Input>/<Textarea>/<Select>/<DatePicker>/<DateRangePicker>` 共享原语；`multiselect` 用 `<MultiSelect>`——若 ui 库无该组件则 Phase 2 新建）
- `required` 字段校验，提交前一次性显示所有错误
- `validation` 违规时 inline 错误；用户修正后清除
- 提交调用 server action `startMissionFromTemplate(templateId, inputs)`；成功后跳 `/missions/{missionId}`

**数据流（Leader 消费侧）**：
- Server 端 action 校验 `inputs` 符合 `input_fields`，写入 `missions.input_params`
- Leader（`leader-plan.ts`）读：
  1. `mission.input_params`（主，结构化 JSON 传入 LLM prompt）
  2. `template.prompt_template`（辅，若存在则 Mustache 渲染后注入 system prompt 作为 hint；不渲染成功（缺字段）则忽略）
  3. `template.description` + `template.steps[]`（分解参考）
- **Leader 的分解路径不依赖 `prompt_template`**；后者是"作者给 Leader 的写作风格提示"，不存在时 Leader 照常跑。

### 4.3 `/workflows/[id]/edit` 的 `InputFieldsEditor`（区块）

**路径**：`src/app/(dashboard)/workflows/[id]/edit/page.tsx` + 新组件 `src/components/workflows/input-fields-editor.tsx`

**位置**：Steps 编排区块上方。

**能力**：
- 增删字段、切换 type（切换时调整子控件：`select` 出现 options 编辑、`number` 出现 min/max）
- 排序（拖拽）
- 预览区：实时渲染为只读的 `WorkflowLaunchDialog` 样式

**API 契约**：
- 保存时 PATCH 整个 `workflow_templates` row（沿用 B.1 `updateTemplate(id, patch)` server action，增加 `input_fields` / `prompt_template` / `launch_mode` 字段到允许更新 allowlist）

### 4.4 `/scenarios/customize` 整页删除

- 目录 `src/app/(dashboard)/scenarios/customize/` 全删
- 在 `middleware.ts`（或路由层 layout）加 308 redirect：`/scenarios/customize → /workflows`（308 保留 method，长期 bookmark 友好）

### 4.5 `ScenarioDetailSheet` 删除

`src/components/home/scenario-detail-sheet.tsx` —— 曾是 ADVANCED_SCENARIO_CONFIG 的表单对话框，被 §4.2 通用 `WorkflowLaunchDialog` 取代。

### 4.6 热点流 `startTopicMission` 改造

**路径**：`src/app/actions/hot-topics.ts:89-150`

- 移除硬编码 `scenario: "breaking_news"`
- 新增 DAL：`getDefaultHotTopicTemplate(orgId): Promise<WorkflowTemplate>`
  - **选取规则**（优先级从高到低）：
    1. `WHERE organization_id = $org AND owner_employee_id = 'xiaolei' AND legacy_scenario_key = 'breaking_news' AND is_builtin = true`（按 `created_at asc` 取首条）
    2. `WHERE organization_id = $org AND owner_employee_id = 'xiaolei' AND category = 'news' AND is_builtin = true`（按 `created_at asc` 取首条）
    3. 抛 `Error("default hot topic template missing, please reseed")`
- 把热点的 title / context / platforms / angles 组装进 `inputs`（对应该模板预期的字段名），调用 `startMissionFromTemplate(templateId, inputs)`
- 该默认模板是否可 org 级定制 —— v1 不做，写死规则；后续 settings 可配（out of scope）

---

## 5. Legacy 清理清单（合并 B.2）

### 5.1 删除 4 个 @deprecated 常量

- `src/lib/constants.ts:437` `SCENARIO_CATEGORIES`
- `src/lib/constants.ts:478` `SCENARIO_CONFIG`
- `src/lib/constants.ts:636` `ADVANCED_SCENARIO_CONFIG`
- `src/lib/constants.ts:753` `ADVANCED_SCENARIO_KEYS`

删除后 `npx tsc --noEmit` 会在所有引用点编译失败 —— 这是故意的，以 TS 报错作为"漏改兜底"。Phase 4 的任务就是把每个报错点改好。

### 5.2 DROP `employee_scenarios` 表

Migration：合并进 §3.4 的 `0053_workflow_realignment.sql`。

连带删除：
- `src/db/schema/employee-scenarios.ts`
- `src/lib/dal/employee-scenarios.ts`（如有）
- `src/app/api/employees/[id]/scenarios/*`（如有）
- seed 中 `employeeScenarios` 对象（`src/db/seed.ts` ~1330-1470）

### 5.3 Seed 重写：≥ 26 条 builtin（按员工归属）

**路径**：`src/db/seed-builtin-workflows.ts` 重写为 per-employee 组织。

**分布（锁定目标）：**

| owner_employee_id | 数量 | 示例 slug |
|-------|------|---------|
| xiaolei（选题/热点）| 3 | `xiaolei.breaking_news` / `xiaolei.hot_radar` / `xiaolei.press_conference` |
| xiaoce（策划）| 3 | `xiaoce.topic_package` / `xiaoce.series_planning` / `xiaoce.livelihood_brief` |
| xiaozi（写稿）| 3 | `xiaozi.news_write` / `xiaozi.deep_report` / `xiaozi.social_post` |
| xiaowen（文字深稿）| 2 | `xiaowen.analysis` / `xiaowen.data_journalism` |
| xiaojian（视频）| 3 | `xiaojian.vlog_edit` / `xiaojian.short_video` / `xiaojian.doc_video` |
| xiaoshen（审）| 2 | `xiaoshen.fact_check` / `xiaoshen.compliance_review` |
| xiaofa（发）| 2 | `xiaofa.multi_platform` / `xiaofa.channel_adapt` |
| xiaoshu（数）| 3 | `xiaoshu.daily_brief` / `xiaoshu.weekly_report` / `xiaoshu.benchmark_analysis` |
| null（公共协作）| 5 | `pub.daily_news_push` / `pub.press_conf_relay` / `pub.viral_video_kit` / `pub.feature_story_pipeline` / `pub.incident_rapid_response` |
| **合计** | **26** | |

**每条必须满足：**
- `steps[]` 非空，每 step 指向真实存在的 skill slug
- `input_fields` 至少 1 个字段（无参场景改用 `launch_mode: "direct"` 并 `input_fields=[]`）
- `is_public: true` 默认
- 员工预设：`owner_employee_id` 填对应 slug；公共：`owner_employee_id=null`
- `icon` / `description` / `legacy_scenario_key`（迁旧 slug 用，本轮可置 null）完整

**Custom workflow slug 规则**：延续 B.1 `templateToScenarioSlug`，用户自建 workflow 写入 `mission.scenario` 时格式 `custom_${nanoid(6)}`（`src/lib/workflow-template-slug.ts`）。

### 5.4 25+ 处下游消费者改造（详表）

见 §2.2。全部 `mission.scenario` 硬分支逻辑改走 `mission.workflowTemplateId`，细节分组：

- **Leader prompt**（`leader-plan.ts:65` / `leader-consolidate.ts:110`）：
  原：`buildLeaderDecomposePrompt(mission)` 读 `mission.scenario` → 查 SCENARIO_CONFIG → 插值 label
  新：读 `mission.workflow_template_id` → DAL `getTemplateWithStepsAndSkills(id)` → 把 `template.description` + `steps[]` 中的 skill 名 + `mission.input_params` 结构化传入 prompt；`template.prompt_template` 作为 system hint（若存在）

- **Mission 分步执行**（`mission-executor.ts:66/220/291/344/546`）：
  原：按 scenario slug switch 派步骤
  新：按 `template.steps[]` 派（每步的 skill slug 自描述）；`mission-executor` 移除 scenario 分支

- **`mission-core.ts` LLM prompt 插值**（93/115/345/381）：
  原：`mission.scenario` 作为 label 拼 prompt
  新：读 `template.name`（从 mission 关联查）

- **`channels/gateway.ts`（56/133）**：
  沿用 B.2 spec §6.3 完整方案：`#发布会追踪` → DB 查 `SELECT * FROM workflow_templates WHERE organization_id=$org AND (name ILIKE $kw OR legacy_scenario_key ILIKE $kw) LIMIT 1`；命中则 `startMissionFromTemplate`；不命中则引导用户"在 /workflows 查看可用模板"。

- **UI 层（16 处）**：
  所有 `SCENARIO_CONFIG[scenario]` / `ADVANCED_SCENARIO_CONFIG[key]` 查询改为读 `mission.workflow_template_id` → DAL `getTemplate(id)` → `template.name / icon / description`；组件 props 改为接收 `template` object 而非 scenario key。

- **`asset-revive.ts:130`**：scenario label map 删除，改读 `getTemplate(mission.workflowTemplateId).name`。

### 5.5 `mission.scenario` 保留语义

**选 A**（沿用 B.2 spec §3.1）：保留为 text 列，作为 denormalized label cache。写入时从 `template.name` 或 `template.slug`（对 custom 是 `custom_xxx`）回填。读取时不信任其语义，下游只用于展示或兼容 grep。未来某次 cleanup 可 DROP 本列。

---

## 6. Demo 种子数据规约

**目标**：新架构下跑通 demo 所需的最小可用数据集。

**分两层：**

### 6.1 Builtin seed（每 org 自动）

§5.3 的 26 条模板作为 builtin，在 `organizations` 表新增 row 时由 Inngest `org-bootstrap` 函数或 `npm run db:seed` 自动写入（B.1 已有 `seedBuiltinTemplatesForOrg` 机制，本 spec 沿用）。

所有预设模板 `input_fields` 至少覆盖以下字段类型之一用于 demo 多样性：
- 1 个 `text` 字段（主题/主角）
- 1 个 `date` 或 `daterange` 字段（时效）
- 1 个 `select` 字段（如"语气"或"输出渠道"）
- 1 个 `multiselect`、`number` 或 `toggle` 字段（展示多样控件）

### 6.2 Demo seed（可选，仅开发用）

路径：`src/db/seed-demo.ts`，执行 `npm run db:seed:demo` 触发。**不随 `npm run db:seed` 跑**（避免污染真实 org）。

内容：
- 样例 missions **6 条**（`status` 只取合法枚举值：`queued / planning / executing / coordinating / consolidating / completed / failed / cancelled`）
  - `completed` × 3（展示产物）
  - `executing` × 2（展示进行中编排）
  - `failed` × 1（展示错误兜底）
  - 全部绑定到 §5.3 真实 template，`input_params` 非空
- 样例 custom workflow **2 条**（`is_builtin=false, owner_organization_id=<demoOrg>`），其中至少 1 条带 ≥ 3 个 `input_fields` 字段

**幂等性**：demo seed 用固定 UUID 或 `organization_id + name` 唯一索引配合 `onConflictDoUpdate`。

---

## 7. SKILL.md 补齐

### 7.1 Phase 0 Audit 产出精确清单

新增脚本：`scripts/check-skill-md.ts`。职责：

1. Walk `skills/` 目录，解析每个 `SKILL.md` 的 frontmatter
2. 对照 `src/db/seed-builtin-workflows.ts` 中 §5.3 重写后所有 `steps[].config.skillSlug` 的 unique 集合
3. 输出三类：
   - **Missing**：seed 引用但 `skills/<slug>/SKILL.md` 不存在
   - **Non-compliant**：存在但 frontmatter 不符 Track B 结构（缺 `metadata.skill_kind` / `metadata.openclaw.referenceSpec` / body 10 章等）
   - **OK**：已合规

Phase 5 补齐 Missing + Non-compliant 清单。预计数量 10-13 条（与 Track B 差集），Phase 0 精确核对后锁定。

### 7.2 每个 SKILL.md 结构（对齐 Track B）

参考 `docs/superpowers/specs/2026-04-19-skill-md-baoyu-standardization.md`：

- Frontmatter：`name` / `displayName` / `description` / `version` / `category` / `metadata.{skill_kind, scenario_tags, compatibleEmployees, modelDependency, requires, implementation.{scriptPath, testPath}, openclaw.{schemaPath, referenceSpec}}`
- Body 10 章：使用条件 / 输入-输出 / Checklist / 子模板（可选）/ 质量把关 / 输出模板 / EXTEND.md 示例 / 上下游 / 常见问题 / 参考
- 每份目标 180-320 行

### 7.3 写入顺序

按被 §5.3 模板引用次数从高到低补齐（高频 skill 优先跑通 demo）。

---

## 8. 实施阶段概览（Plan 将细化）

- **Phase 0 — Audit & Schema**：跑 `scripts/check-skill-md.ts`，产 SKILL.md diff；migration `0053_workflow_realignment.sql`；`InputFieldDef` 扩展类型；新 DAL 函数骨架
- **Phase 1 — Seed 重写**：§5.3 的 26 条 builtin + §6.1 input_fields 规范 + §5.2 employee_scenarios 删除
- **Phase 2 — UI 新增**：`WorkflowLaunchDialog` + 首页 tab 重构 + workflow 编辑页 `InputFieldsEditor`
- **Phase 3 — Legacy 删除**：4 常量 + `ScenarioDetailSheet` + `/scenarios/customize` 整页
- **Phase 4 — 下游消费者迁移**：§5.4 的 25+ 处（`leader-plan` / `mission-executor` / `mission-core` / `channels/gateway` / `hot-topics` action / `asset-revive` / UI 层）；每阶段跑 `tsc --noEmit` 验证零漏改
- **Phase 5 — SKILL.md 补齐**：Phase 0 产出的 Missing + Non-compliant 全部补齐
- **Phase 6 — Demo 种子 + 验收**：§6.2 + 全链路 smoke + Golden Mission Suite（§9.1）

---

## 9. 风险与回滚

### 9.1 风险表

| 风险 | 影响 | 缓解 |
|-----|-----|-----|
| `leader-plan` prompt 迁移后 LLM 行为漂移 | 高 | 建立 **Golden Mission Suite**：锁 6 条代表性场景（breaking_news / press_conference / daily_brief / short_video / fact_check / custom_demo），各跑 3 次 Leader 分解，对比 B.1 时代 snapshot（记录在 `docs/golden-missions/2026-04-20-baseline.json`）。Phase 4 各 step 过后重跑对比，人工审 diff，可接受"风格变化但步骤粒度/覆盖一致" |
| 25+ 处下游改造漏改 | 高 | 删除 `SCENARIO_CONFIG` / `ADVANCED_SCENARIO_CONFIG` 常量时靠 TypeScript 编译报错兜底；Phase 4 每子任务结束必须 `tsc --noEmit` 零 error；`rg 'SCENARIO_CONFIG\\|ADVANCED_SCENARIO_CONFIG\\|mission\\\\.scenario'` 交叉验证零命中（除 `mission.scenario` 作为列名引用外） |
| `input_fields` 扩展导致 B.1 已存 seed 行为变化 | 低 | 新增字段全部 optional；现有 `name / label / type / options` 语义不变；写单测覆盖 9 种字段类型的反序列化 |
| `employee_scenarios` DROP 前 dev 库有未迁数据 | 低 | 生产未上线，dev 重新跑 `npm run db:seed` 即可；migration 执行前先 SELECT COUNT 并 warn |
| Demo seed 与 dev org 实际数据冲突 | 中 | demo seed 独立 `npm run db:seed:demo` 不随默认 seed 跑；用固定 UUID + onConflictDoUpdate；文档明示"仅开发环境使用" |
| i18n 未考虑（label 中文写死）| 低 | v1 Chinese only，已在 §11 Out of Scope 声明 |

### 9.2 回滚策略

本 spec 是一次性大迁移；如 Phase 4 或之后暴露无法修复的回归：

- 策略：整体 revert 本轮 PR（作为单个合并单元），回到 B.1 状态
- 不做部分回滚（legacy 与 new 并存会极度复杂）
- Phase 0-3 可在 feature branch 独立验证；Phase 4 必须在完整 golden test 通过后再合

---

## 10. 验收标准

### 10.1 数据层

- [ ] `SCENARIO_CONFIG` / `ADVANCED_SCENARIO_CONFIG` / `SCENARIO_CATEGORIES` / `ADVANCED_SCENARIO_KEYS` 4 个常量全部从代码库移除（`rg` 0 命中）
- [ ] `employee_scenarios` 表在 Supabase 中不存在
- [ ] `workflow_templates` 所有 builtin 记录 `steps` 非空、`launch_mode=direct` 外 `input_fields` 非空数组
- [ ] `workflow_templates` 的 builtin row（per demoOrg）≥ 26 条，分布符合 §5.3 表
- [ ] `missions.input_params` 列存在且默认 `{}`

### 10.2 UI 层

- [ ] 首页"场景快捷启动"显示 9 个 tab（8 员工 + 我的工作流），切换平滑
- [ ] 任一员工 tab 下点击任一预设卡片，`launch_mode=form` 弹 `WorkflowLaunchDialog` 并能成功提交
- [ ] `launch_mode=direct` 的模板点击后直跳 `/missions/{id}` 无对话框
- [ ] `/scenarios/customize` 访问时 308 redirect 到 `/workflows`
- [ ] `/workflows/[id]/edit` 有 `InputFieldsEditor` 区块，能编辑 9 种字段类型并保存

### 10.3 运行层

- [ ] 从首页启动任一预设 → mission 创建成功 → Leader 能读 `input_params` → 至少跑完第 1 个 step 无错
- [ ] 热点详情页"追热点"按钮走 `getDefaultHotTopicTemplate` 选定模板，不弹场景选择器
- [ ] DingTalk / 企业微信 `#发布会追踪` 指令仍能解析到对应模板（通过 `channels/gateway.ts` DB 查）
- [ ] Golden Mission Suite 6 条场景对比 B.1 snapshot，步骤粒度 / 覆盖一致（人工审）

### 10.4 文档

- [ ] Phase 0 Audit 脚本 `scripts/check-skill-md.ts` 提交且可重复运行
- [ ] Phase 0 产出的所有 Missing + Non-compliant SKILL.md 全部补齐并通过 lint
- [ ] `CLAUDE.md` 中 "Scenario/Workflow 统一架构（B.1）" 章节更新为 "B.1 + B.2 合并完成"，标注日期 2026-04-20
- [ ] B.2 spec 文件移至 `docs/superpowers/archive/`

### 10.5 类型与构建

- [ ] `npx tsc --noEmit` 通过
- [ ] `npm run build` 通过
- [ ] `npm run lint` 通过

---

## 11. Out of Scope（本 spec 不做）

- 对话式参数收集（用户已明确不需要）
- `workflow_templates` 的版本化（versioning）
- 工作流市场 / 共享机制（跨 org 发布）
- mission 中途 `awaiting_input` 的暂停-恢复能力（不引入新 enum 值）
- 首页 tab 的 A/B 实验框架（直接上新版本）
- RBAC：v1 任何登录用户都可启动 `is_public=true` 模板；角色细化留后续
- 国际化：v1 Chinese only；`input_fields.label` 直接写中文字符串，future 再抽 i18n key
- 热点默认模板 org 级定制（settings UI）

---

## 12. 参考

- B.1 spec：`docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md`
- B.2 spec（已并入，合并后 archive）：`docs/superpowers/specs/2026-04-19-scenario-legacy-cleanup-spec.md`
- Track B skill MD：`docs/superpowers/specs/2026-04-19-skill-md-baoyu-standardization.md`
- 员工预设场景需求：`docs/scenarios/employee-default-scenarios.md`（commit `e030585`）
- baoyu-skills 仓库：https://github.com/JimLiu/baoyu-skills
- 关键代码位置：
  - `src/db/schema/workflows.ts`（workflow_templates 现字段）
  - `src/db/schema/missions.ts:61`（workflowTemplateId）
  - `src/db/schema/enums.ts:33`（mission_status 合法值）
  - `src/db/seed-builtin-workflows.ts`（39 条现 seed）
  - `src/lib/types.ts:332`（InputFieldDef 原定义）
  - `src/lib/workflow-template-slug.ts`（custom slug 规则）
  - `src/app/actions/missions.ts:48-75`（startMission / resolveWorkflowTemplateId）
