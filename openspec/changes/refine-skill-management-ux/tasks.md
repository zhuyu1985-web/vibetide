# Tasks: refine-skill-management-ux

## Implementation Order

### Phase 1: 数据层

- [x] **T1: 扩展 DAL** — 修改 `src/lib/dal/skills.ts`：
  - `getSkillsWithBindCount()` 增加返回 `updatedAt` 字段
  - 新增 `getSkillDetail(id)`: 返回技能完整信息 + 绑定员工列表（员工名称、ID、角色类型）
  - 验证: `npx tsc --noEmit` 通过

### Phase 2: 详情页（新增）

- [x] **T2: 创建详情页 Server Component** — `src/app/(dashboard)/skills/[id]/page.tsx`
  - 调用 `getSkillDetail(id)` 获取数据
  - 技能不存在时 `notFound()`
  - 验证: 路由已注册

- [x] **T3: 创建详情页 Client Component** — `src/app/(dashboard)/skills/[id]/skill-detail-client.tsx`
  - 左侧：Markdown 渲染区域（react-markdown, prose 样式）
  - 右侧 sidebar：元数据卡片（分类、版本、类型、绑定数、时间）+ 绑定员工列表
  - 顶部：返回链接 + 技能名称
  - 操作按钮：编辑（弹窗）、删除（确认 + 跳转回列表）
  - 验证: 页面正确渲染

### Phase 3: 列表页改造

- [x] **T4: 重构列表为行卡片布局** — 修改 `src/app/(dashboard)/skills/skills-client.tsx`
  - 移除卡片网格，改为每行一条的列表布局
  - 每行：左侧名称+标签、中部描述、右侧绑定数+时间+操作
  - 点击技能名称/描述跳转到 `/skills/[id]`
  - 移除详情查看弹窗（ViewDialog）
  - 验证: 列表正确渲染

- [x] **T5: 添加排序功能** — 在 skills-client.tsx 中：
  - 排序选项：绑定数(默认)、最近更新、名称
  - 客户端排序（useMemo）
  - 验证: 各排序方式正常工作

### Phase 4: 验证

- [x] **T6: 类型检查 + 构建验证**
  - `npx tsc --noEmit` 通过
  - `npm run build` 通过
