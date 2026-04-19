# 员工场景管理后台 — 实施计划

**日期**：2026-04-19
**状态**：待评审
**负责**：zhuyu
**上下文**：首页切换员工后"预设场景"芯片不显示的事件暴露出两个结构问题：
1. 场景 seed 被拆在 `src/db/seed.ts`（只含 xiaolei 5 条）和 `scripts/seed-scenarios.ts`（8 员工 27 条）两个文件，DB 重置后容易漏跑副 seed。
2. 场景内容完全由开发改 TS 文件写死，**产品经理/运营改不了**，每次调整都要发版。

目标：把场景配置从"代码里的种子"升级为"运行时可由员工所有者自助维护的记录"。

---

## 功能范围

### 一期（MVP，目标 1 周内可用）

- 每位员工可**自行维护**其预设场景列表（最多约 10 条）
- 每个场景字段：名称、描述、图标、**欢迎词**（新增）、输入参数（动态字段组）、`system_instruction`、工具提示、启用开关、排序
- 入口：员工详情页 `/ai-employees/[slug]` 新增 **"预设场景"Tab**
- CRUD：新增 / 编辑 / 删除（软删除：置 `enabled=false`）/ 排序拖动
- 校验：
  - 名称同员工下唯一（DB 唯一索引已有）
  - 输入参数 `name` 在场景内唯一、合法 JS 标识符
  - `system_instruction` 里的 `{{name}}` 占位符必须能在 `inputFields` 里找到
- 权限：`admin` 全部；员工所有者（`ai_employees.ownerId`）仅自己员工；其他角色只读

### 二期（暂不做，列出以便设计时预留）

- 版本历史与回滚
- 场景模板市场（组织间/公开分享）
- AI 辅助生成 `system_instruction`
- 场景执行次数 / 成功率统计（与 `skill_usage_records` 打通）

---

## 数据模型变更

### 1. 新增列：`welcome_message`

```ts
// src/db/schema/employee-scenarios.ts
welcomeMessage: text("welcome_message"),  // 可空，打开场景时展示的欢迎语
```

**迁移**：0029（`welcome_message` 列，可空，无默认值，向后兼容）

### 2. 新增列：`ownerId` 关联

当前 `employee_scenarios` 只有 `organizationId` + `employeeSlug`，没记录"谁创建的"。为了做"员工所有者编辑权"，依赖 `ai_employees.ownerId`（需确认已存在；若没有则同期加）。

**迁移 0029 合并**：
```sql
ALTER TABLE employee_scenarios ADD COLUMN welcome_message text;
-- ai_employees.owner_id 是否已存在 → 查 src/db/schema/ai-employees.ts 确认
```

### 3. 输入字段类型扩展

当前 `inputFields.type` 仅支持 `"text" | "textarea" | "select"`。一期保持不变（已够用），但在类型定义里留好扩展位：
```ts
type: "text" | "textarea" | "select" | "number" | "date";  // 后两个二期做
```

---

## 文件清单

### 新增

| 路径 | 作用 |
|---|---|
| `supabase/migrations/0029_*.sql` | `welcome_message` 列（生成自 drizzle） |
| `src/lib/dal/scenarios.ts`（扩展） | 增加 `getScenarioForEdit`，`listScenariosForEmployeeWithDisabled`（含禁用） |
| `src/app/actions/scenarios.ts` | `createScenario` / `updateScenario` / `deleteScenario` / `toggleScenarioEnabled` / `reorderScenarios` |
| `src/app/(dashboard)/ai-employees/[slug]/scenarios/page.tsx` | 服务端页面（tab 内容） |
| `src/app/(dashboard)/ai-employees/[slug]/scenarios/scenarios-client.tsx` | 客户端交互（列表 + 编辑器） |
| `src/components/scenarios/scenario-editor-sheet.tsx` | 编辑器抽屉（复用在列表里） |
| `src/components/scenarios/input-fields-editor.tsx` | 动态输入字段编辑器（add/remove/sort） |

### 修改

| 路径 | 改动 |
|---|---|
| `src/db/schema/employee-scenarios.ts` | 加 `welcomeMessage` 字段 |
| `src/db/seed.ts` | **合并** `scripts/seed-scenarios.ts` 的全部 27 条场景进主 seed，废弃副脚本，避免再出现"漏跑副 seed" |
| `src/app/(dashboard)/ai-employees/[slug]/ai-employee-detail-client.tsx` | 新增 "预设场景" Tab |
| `src/lib/dal/scenarios.ts` | `getAllScenariosByOrg` 顺带返回 `welcomeMessage` |
| `src/app/(dashboard)/chat/chat-panel.tsx` | 打开场景时，若有 `welcomeMessage` 以 system 消息形式插入对话首行 |
| `src/app/(dashboard)/home/home-client.tsx` | 同上（场景表单提交时使用欢迎词） |
| `scripts/seed-scenarios.ts` | 删除（或改为 deprecated 提示，让文件指向主 seed） |

---

## UI 设计要点

### 列表视图（tab 内）

`<DataTable>` 渲染（不自己写表）：
- 列：排序手柄 / 名称 + 图标 / 描述 / 参数数量 / 启用开关 / 操作（编辑 / 删除）
- 顶部：`+ 新建场景` 按钮（无边框，走项目 `<Button>` 默认变体 — 参考 CLAUDE.md 规范）
- 空态："还没有预设场景，点击上方按钮创建第一个"

### 编辑器抽屉（Sheet）

分 3 段：

**基本信息**
- 名称（Input）/ 描述（Textarea）/ 图标（shadcn Combobox，选 Lucide 图标名）/ 启用开关（Switch）

**欢迎词**
- Textarea，提示"用户进入该场景时的开场白；支持 Markdown"
- 占位示例："你好，我是小雷。请告诉我要分析的领域，我会帮你扫描全网热点。"

**系统指令 + 输入参数**（放一起方便核对占位符）
- `systemInstruction` Textarea，高度 8 行
- 下方动态字段列表：每行一组（name / label / type / required / placeholder / options 若 select）
- 实时校验：系统指令里 `{{foo}}` 是否全都对得上输入参数的 `name`，对不上给警告

### 保存与校验

- 服务端严格校验：name 组内唯一、系统指令占位符闭合、输入参数 name 非空/合法
- 成功：`revalidatePath("/ai-employees/[slug]")` + `revalidatePath("/home")` + `revalidatePath("/chat")`

---

## 权限模型

```ts
// src/lib/dal/scenarios.ts 新增
export async function assertScenarioEditPermission(
  scenarioOrEmployeeSlug: string,
  userId: string,
  orgId: string,
): Promise<void> {
  const role = await getUserRole(userId, orgId);
  if (role === "admin") return;
  const employee = await db.query.aiEmployees.findFirst({
    where: and(eq(aiEmployees.slug, slug), eq(aiEmployees.organizationId, orgId)),
  });
  if (employee?.ownerId === userId) return;
  throw new Error("FORBIDDEN");
}
```

每个 server action 入口都调一次，不在前端做权限。

---

## 构建顺序（5 个 checkpoint）

1. **DB + Schema**（~1h）
   - 新增 `welcomeMessage` 列 → 生成迁移 0029 → 合并 `scripts/seed-scenarios.ts` 进主 seed → 删除副脚本
   - 验收：`npx tsc --noEmit` + `npm run db:push` + `npm run db:seed` 后 `SELECT COUNT(*) FROM employee_scenarios GROUP BY employee_slug` 返回 8 行

2. **DAL + Server Actions**（~2h）
   - `scenarios.ts` 加 CRUD + 权限 assert
   - 校验逻辑：唯一名、占位符闭合、输入参数名合法
   - 验收：类型检查通过；写 2 个简单测试覆盖成功 / 权限拒绝路径

3. **列表 UI + Tab 接入**（~2h）
   - 员工详情页加 Tab
   - `<DataTable>` + 空态 + 排序拖动
   - 新建 / 删除 / 启用开关接通 server action
   - 验收：浏览器手测 CRUD；无 console 报错

4. **编辑器抽屉**（~3h）
   - `<Sheet>` + 三段式布局
   - 动态输入字段组件（增删改、拖动排序）
   - 占位符实时校验提示
   - 验收：手测编辑流程；保存后列表即时刷新（`router.refresh()`）

5. **欢迎词接入对话流**（~1h）
   - `chat-panel.tsx` 打开场景时，如有 `welcomeMessage` 注入为首条 assistant 消息
   - `home-client.tsx` 场景表单提交后同步发送
   - 验收：手测新建一个带欢迎词的场景，在首页点触发后首句确实是设置的欢迎词

**总工时估算**：~9 小时（2 个工作日）

---

## 风险与回滚

| 风险 | 缓解 |
|---|---|
| `welcome_message` 列对现有代码影响 | 列可空，现有代码不读即无感；新 DAL 函数单独走 |
| 主 seed 合并副 seed 后重复跑会 upsert（已有唯一索引），不会爆掉 | 已验证 onConflictDoUpdate 逻辑存在 |
| 权限判断漏 → 非所有者改了别人的场景 | 所有 server action 入口统一过 `assertScenarioEditPermission`，code review 强制检查 |
| 场景被删后历史对话引用 `scenario_id` 悬空 | 软删除（`enabled=false`）而非物理删除；物理删除入口需二次确认 + 断开引用 |

---

## 非目标（划清边界）

- ❌ 场景市场 / 分享
- ❌ 场景执行数据报表
- ❌ AI 辅助生成系统指令
- ❌ 多语言场景（当前全 zh-CN）
- ❌ 场景 A/B 测试

---

## 验收标准

- 任意员工的所有者登录后，能在员工详情页看到"预设场景" Tab
- 可以新建、编辑、删除、启用/禁用、排序场景
- 保存的欢迎词在首页触发该场景时会作为首条消息展示
- 非 admin 且非所有者的用户看到 Tab 只能浏览不能编辑（按钮禁用或隐藏）
- 主 seed 一把梭能恢复所有 8 员工 × 3~5 场景的默认数据
