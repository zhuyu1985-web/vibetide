# Design: Skill Management UI

## Architecture Overview

遵循项目现有的 Server/Client 组件拆分模式，新增一个完整的技能管理页面。

```
/skills (技能管理页面)
├── page.tsx              — Server Component, 获取技能数据
└── skills-client.tsx     — Client Component, 列表/筛选/交互
```

## Data Flow

```
skills-client.tsx (UI)
    ↓ 用户操作
Server Actions (src/app/actions/skills.ts)
    ↓ 认证 + 校验
DAL (src/lib/dal/skills.ts)  ← 新增查询函数
    ↓
Drizzle ORM → skills 表
```

## Page Layout

```
┌─────────────────────────────────────────────┐
│ PageHeader: 技能管理                         │
│ 描述: 管理 AI 员工可用的技能库               │
├─────────────────────────────────────────────┤
│ [+ 添加技能]          [搜索框] [分类筛选▾]   │
├─────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│ │ 技能卡片 │ │ 技能卡片 │ │ 技能卡片 │       │
│ │ 名称     │ │ 名称     │ │ 名称     │       │
│ │ 分类标签 │ │ 分类标签 │ │ 分类标签 │       │
│ │ 描述     │ │ 描述     │ │ 描述     │       │
│ │ 绑定数/版│ │ 绑定数/版│ │ 绑定数/版│       │
│ │ [编辑]   │ │ [编辑]   │ │ [编辑]   │       │
│ └─────────┘ └─────────┘ └─────────┘       │
│ ...更多卡片                                  │
└─────────────────────────────────────────────┘
```

## Key Decisions

### 1. 路由位置
放在 `/skills`，侧边栏「工作台」分组中添加入口，使用 `Sparkles` 图标。工作台是管理类功能的自然归属。

### 2. builtin vs custom 权限
- **builtin 技能:** 只读展示，不可编辑核心字段（名称、分类、描述），不可删除。可编辑兼容角色。
- **custom 技能:** 完全可编辑、可删除。删除前提示确认（该技能已绑定的员工会自动解绑）。

### 3. 创建/编辑 UI
使用 Dialog 弹窗表单，而非跳转到新页面，保持与项目中其他创建流程一致（如 `EmployeeCreateDialog`、`StartWorkflowDialog`）。

### 4. 统计信息
每个技能卡片显示「已绑定 N 个员工」，通过 DAL 联表查询 `employeeSkills` 获取。

## Components

### 新增文件
| 文件 | 类型 | 说明 |
|------|------|------|
| `src/app/(dashboard)/skills/page.tsx` | Server | 数据获取 |
| `src/app/(dashboard)/skills/skills-client.tsx` | Client | 列表/交互 |
| `src/components/shared/skill-form-dialog.tsx` | Client | 创建/编辑表单弹窗 |
| `src/app/actions/skills.ts` | Server Action | CRUD 操作 |

### 修改文件
| 文件 | 说明 |
|------|------|
| `src/lib/dal/skills.ts` | 新增 `getSkillsWithBindCount()`, `getSkillById()` |
| `src/components/layout/app-sidebar.tsx` | 添加「技能管理」导航项 |

## Form Fields

创建/编辑技能表单字段：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 名称 | text | ✓ | 技能名称（中文） |
| 分类 | select | ✓ | 6 个分类之一 |
| 描述 | textarea | ✓ | 技能描述 |
| 版本 | text | ✗ | 默认 "1.0" |
| 兼容角色 | multi-select | ✗ | 可绑定该技能的角色类型 |
