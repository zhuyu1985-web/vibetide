# Capability: Skill Management UX

优化技能管理的列表和详情展示体验。

## MODIFIED Requirements

### Requirement: Skill List Layout
系统 SHALL 将技能列表从卡片网格改为行卡片布局，每个技能占据完整一行，水平展示名称、标签、描述和元数据，MUST 支持按绑定数、更新时间、名称三种方式排序。

#### Scenario: 行卡片列表展示
- **Given** 已登录用户访问 `/skills`
- **When** 页面加载完成
- **Then** 每个技能以行卡片形式展示
- **And** 左侧显示名称、版本、类型标记（内置/自定义）、分类标签
- **And** 中部显示描述文本（不截断，最多 3 行）
- **And** 右侧显示绑定员工数、更新时间、操作按钮

#### Scenario: 排序切换
- **Given** 技能列表页已加载
- **When** 用户切换排序方式（绑定数/最近更新/名称）
- **Then** 列表按选中方式重新排序

#### Scenario: 点击跳转详情
- **Given** 技能列表页已加载
- **When** 用户点击某个技能的名称或卡片主体区域
- **Then** 跳转到 `/skills/[id]` 详情页

## ADDED Requirements

### Requirement: Skill Detail Page
系统 SHALL 提供技能独立详情页（`/skills/[id]`），采用左右布局：左侧主区域完整渲染 Markdown 描述文档，右侧 sidebar 展示元数据和操作。

#### Scenario: 查看技能详情
- **Given** 用户访问 `/skills/[id]`
- **When** 页面加载完成
- **Then** 左侧主区域完整渲染技能描述的 Markdown 内容（标题、列表、代码块、引用等）
- **And** 右侧 sidebar 显示：分类、类型（内置/自定义）、版本号、已绑定员工数、创建时间、更新时间
- **And** 右侧 sidebar 显示绑定此技能的员工列表（名称 + 角色）

#### Scenario: 详情页操作
- **Given** 用户在技能详情页
- **When** 点击「编辑」按钮
- **Then** 弹出编辑表单弹窗（复用 SkillFormDialog）
- **And** 保存后页面刷新显示更新内容

#### Scenario: 详情页删除
- **Given** 用户在自定义技能详情页
- **When** 点击「删除」按钮并确认
- **Then** 技能被删除，跳转回 `/skills` 列表页

#### Scenario: 返回列表
- **Given** 用户在技能详情页
- **When** 点击「返回技能管理」链接
- **Then** 跳转回 `/skills`
