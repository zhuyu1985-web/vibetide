# Capability: Skill Management

管理 AI 员工技能库的增删改查功能。

## ADDED Requirements

### Requirement: Skill List Page
系统 SHALL 提供技能管理列表页面（`/skills`），展示所有技能及其使用情况，支持按分类筛选和关键词搜索。

#### Scenario: 查看技能列表
- **Given** 已登录用户访问 `/skills`
- **When** 页面加载完成
- **Then** 展示所有技能卡片，按分类分组
- **And** 每个卡片显示：名称、分类标签、描述、版本号、已绑定员工数
- **And** builtin 技能有「内置」标记，custom 技能有「自定义」标记

#### Scenario: 按分类筛选
- **Given** 技能列表页已加载
- **When** 用户选择某个分类筛选项（如「生成」）
- **Then** 仅展示该分类下的技能
- **And** 选择「全部」恢复完整列表

#### Scenario: 搜索技能
- **Given** 技能列表页已加载
- **When** 用户在搜索框输入关键词
- **Then** 实时过滤，仅展示名称或描述包含关键词的技能

### Requirement: Create Custom Skill
系统 SHALL 支持通过表单弹窗创建自定义技能（type=custom），MUST 校验名称、分类、描述为必填字段。

#### Scenario: 创建自定义技能
- **Given** 用户点击「添加技能」按钮
- **When** 弹出技能表单弹窗
- **And** 用户填写名称、分类、描述（必填），版本、兼容角色（选填）
- **And** 点击「确定」
- **Then** 技能以 `type=custom` 写入数据库
- **And** 列表刷新并显示新技能
- **And** 新技能可在员工技能浏览器中被绑定

#### Scenario: 表单验证
- **Given** 用户打开创建技能弹窗
- **When** 未填写必填字段（名称/分类/描述）就点击「确定」
- **Then** 显示字段级错误提示，不提交

### Requirement: Edit Skill
系统 SHALL 支持编辑已有技能信息。builtin 类型技能 MUST 限制为仅可编辑兼容角色字段。

#### Scenario: 编辑自定义技能
- **Given** 用户点击某个 custom 类型技能的「编辑」按钮
- **When** 弹出预填充的技能表单弹窗
- **And** 用户修改任意字段后点击「确定」
- **Then** 技能信息更新，列表刷新

#### Scenario: builtin 技能编辑限制
- **Given** 用户点击某个 builtin 类型技能的「编辑」按钮
- **When** 弹出技能表单弹窗
- **Then** 名称、分类、描述字段为只读状态
- **And** 兼容角色字段可编辑

### Requirement: Delete Skill
系统 SHALL 支持删除自定义技能，MUST 禁止删除 builtin 类型技能，且删除已绑定技能时 MUST 提示用户确认。

#### Scenario: 删除未绑定的自定义技能
- **Given** 用户点击某个未绑定任何员工的 custom 技能的「删除」按钮
- **When** 确认删除
- **Then** 技能从数据库删除，列表刷新

#### Scenario: 删除已绑定的自定义技能
- **Given** 用户点击某个已绑定 N 个员工的 custom 技能的「删除」按钮
- **When** 弹出确认弹窗，提示「该技能已被 N 个员工绑定，删除后将自动解绑」
- **And** 用户确认删除
- **Then** 技能及关联的 employeeSkills 记录被级联删除

#### Scenario: 禁止删除内置技能
- **Given** 某技能的 type 为 builtin
- **Then** 不展示删除按钮

### Requirement: Sidebar Navigation Entry
系统 SHALL 在侧边栏工作台分组中添加「技能管理」导航入口，链接到 `/skills` 页面。

#### Scenario: 导航到技能管理
- **Given** 用户在仪表板任意页面
- **When** 点击侧边栏「工作台」分组中的「技能管理」
- **Then** 跳转到 `/skills` 页面
