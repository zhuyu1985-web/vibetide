# Proposal: Add Skill Management UI

## Change ID
`add-skill-management-ui`

## Status
`proposed`

## Summary

将技能库管理从硬编码常量 + 种子脚本的方式，升级为系统界面上可视化添加、编辑、删除技能的完整管理功能。

## Motivation

当前技能库存在以下问题：
1. **28 个内置技能**硬编码在 `src/lib/constants.ts` 的 `BUILTIN_SKILLS` 数组中
2. 技能只能通过运行 `npm run db:seed` 写入数据库，无法在运行时管理
3. 虽然 DB schema 已支持 `type: "custom"` 和 `type: "plugin"` 类型，但没有对应的创建/编辑 UI
4. 运营人员无法自行添加、修改或停用技能，必须依赖开发人员修改代码

## Scope

### In Scope
- 新增「技能管理」页面（独立路由 `/skills`），放在侧边栏「工作台」分组中
- 技能列表：按分类展示所有技能，支持搜索和筛选
- 创建技能：通过表单创建自定义技能（type=custom），填写名称、分类、描述、版本、兼容角色等
- 编辑技能：修改已有技能信息（仅 custom 类型可编辑核心字段，builtin 只可编辑兼容角色）
- 删除技能：删除自定义技能（builtin 不可删除）
- 技能使用统计：显示每个技能被多少个 AI 员工绑定

### Out of Scope
- 技能的 inputSchema / outputSchema 可视化编辑器（保持 JSONB 手动输入）
- 技能的运行时配置（runtimeConfig）编辑（后续迭代）
- plugin 类型技能的管理（需要独立的插件系统）
- 技能版本历史/回滚

## Impact

- **新增页面:** `/skills` 技能管理页面
- **新增文件:** Server action、DAL 函数、客户端组件
- **修改文件:** 侧边栏导航（添加入口）
- **数据库:** 无 schema 变更（现有 `skills` 表已满足需求）

## Risks

- **低风险:** 不涉及现有 schema 变更，不影响已有的员工技能绑定流程
- 删除技能时需处理级联（`employeeSkills` 已配置 `onDelete: cascade`）
