# Tasks: add-skill-management-ui

## Implementation Order

### Phase 1: 后端 (DAL + Server Actions)

- [x] **T1: 新增 DAL 查询函数** — 在 `src/lib/dal/skills.ts` 中添加：
  - `getSkillsWithBindCount()`: 返回所有技能 + 每个技能的 `employeeSkills` 绑定数量
  - `getSkillById(id)`: 按 ID 查询单个技能
  - 验证: 函数可被 Server Component 正常调用

- [x] **T2: 新增技能 CRUD Server Actions** — 创建 `src/app/actions/skills.ts`：
  - `createSkill(data)`: 创建 custom 技能，需 requireAuth
  - `updateSkill(id, data)`: 更新技能，builtin 只允许改 compatibleRoles
  - `deleteSkill(id)`: 删除 custom 技能，builtin 拒绝删除
  - 验证: 类型检查通过 (`npx tsc --noEmit`)

### Phase 2: 前端页面

- [x] **T3: 创建技能管理页面** — `src/app/(dashboard)/skills/page.tsx` (Server Component)
  - 调用 `getSkillsWithBindCount()` 获取数据
  - 传递给客户端组件
  - 验证: 页面可访问，数据正确加载

- [x] **T4: 创建技能列表客户端组件** — `src/app/(dashboard)/skills/skills-client.tsx`
  - 技能卡片网格布局
  - 分类筛选 + 搜索
  - 每个卡片显示名称、分类、描述、版本、绑定数
  - builtin/custom 类型标记
  - 编辑/删除按钮（根据类型显示）
  - 验证: UI 正确渲染，筛选和搜索正常工作

- [x] **T5: 创建技能表单弹窗** — `src/components/shared/skill-form-dialog.tsx`
  - 支持创建和编辑两种模式
  - 表单字段：名称、分类(Select)、描述(Textarea)、版本、兼容角色(MultiSelect)
  - builtin 模式下名称/分类/描述只读
  - 表单验证（必填校验）
  - 验证: 创建和编辑均可正常提交

- [x] **T6: 删除确认集成** — 在技能卡片中集成删除功能
  - 使用已有的 `ConfirmDialog` 组件
  - 显示绑定员工数量提示
  - 验证: 删除流程正常，列表刷新

### Phase 3: 导航集成

- [x] **T7: 添加侧边栏入口** — 修改 `src/components/layout/app-sidebar.tsx`
  - 在 workspaceItems 中添加「技能管理」项
  - 使用 Sparkles 图标
  - 验证: 导航正常跳转

### Phase 4: 验证

- [x] **T8: 类型检查 + 构建验证**
  - `npx tsc --noEmit` 通过
  - `npm run build` 通过
