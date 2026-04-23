# 首页工作流模版 拖拽排序 + 置顶 设计

- **日期**：2026-04-24
- **作者**：zhuyu（PM）+ Claude
- **状态**：待实现
- **关联模块**：`/home`、`workflow_templates`、`ScenarioGrid`

---

## 1. 背景与目标

首页 `ScenarioGrid` 有 10 个 tab（`featured` 主流场景 + 8 员工职能 + `custom` 我的工作流），每个 tab 渲染一个 `workflow_templates` 卡片列表，目前固定按 `created_at ASC` 排序，管理员无法调整优先露出的模版。

本设计新增两个能力：

1. **拖拽重排**——管理员可自由调整非置顶卡片在当前 tab 的顺序。
2. **一键置顶**——管理员把重要模版钉到 tab 顶部，始终优先展示。

---

## 2. 决策摘要（brainstorm 阶段四问四答）

| # | 决策点 | 选项 | 结论 |
|---|---|---|---|
| 1 | 排序作用域 | 每用户 vs 组织共享 | **组织共享** |
| 2 | 谁能操作 | 所有人 / 仅管理员 / 审计 | **仅 admin/owner** |
| 3 | 哪些 tab 生效 | 仅 9 共享 tab / 全部 / 双存储 | **仅 9 共享 tab**（`custom` 不变） |
| 4 | 多 tab 出现的同一模版 | 共用一个 sort / 按 tab 分开 / 折中 | **按 tab 分开存储** |
| 5 | 置顶语义 | 独立区 / 拖到最前 / 双排序键 | **独立"置顶区"**（`pinned_at` + `sort_order`） |

---

## 3. 数据模型

### 3.1 新表 `workflow_template_tab_order`

```
workflow_template_tab_order
  id                uuid pk
  organization_id   uuid not null → organizations.id
  tab_key           text not null        -- "featured" | xiaolei | ... | xiaoshu
  template_id       uuid not null → workflow_templates.id (on delete cascade)
  sort_order        integer not null default 0
  pinned_at         timestamptz null
  created_at        timestamptz not null default now()
  updated_at        timestamptz not null default now()

  unique  (organization_id, tab_key, template_id)
  index   idx_homepage_order_tab (organization_id, tab_key, pinned_at desc nulls last, sort_order asc)
```

**要点**：

- `tab_key` 限制在 9 个值：`featured` / `xiaolei` / `xiaoce` / `xiaozi` / `xiaowen` / `xiaojian` / `xiaoshen` / `xiaofa` / `xiaoshu`。`custom` 不写入此表。
- 模板第一次出现在某 tab 时**不预写行**——DAL 用 `LEFT JOIN`，缺行时 `pinned_at=NULL`、`sort_order` 视为"+∞"，落到非置顶末尾。
- 删除模板时通过 FK CASCADE 自动清。
- 不在 Drizzle schema 里硬编码 `tab_key` enum，保持字符串+应用层校验，避免 enum 迁移扰动。

### 3.2 对 `workflow_templates` 不做 schema 改动

顺序数据完全落在新表，主表保持只读语义；现有 `is_featured` / `owner_employee_id` / `is_public` 过滤逻辑不变。

---

## 4. 读路径：排序规则

`src/lib/dal/workflow-templates-listing.ts` 中 `listTemplatesForHomepageByTab`：

- `tab === "custom"`：**保持原样**，按 `created_at ASC`。
- 其余 9 个 tab：`LEFT JOIN workflow_template_tab_order ON (template_id = id AND organization_id = :org AND tab_key = :tab)`，ORDER BY：

```
(pinned_at IS NOT NULL) DESC,     -- 置顶区在前
pinned_at DESC NULLS LAST,        -- 置顶区内：最近置顶在最顶
sort_order ASC NULLS LAST,        -- 非置顶区：拖拽序
created_at ASC                    -- 稳定兜底
```

**两区语义**：

- **置顶区**（`pinned_at IS NOT NULL`）：不支持区内拖拽；想调整位置 → 取消再重新置顶（最近 pin 上浮）。
- **非置顶区**（`pinned_at IS NULL`）：拖拽只改这里的 `sort_order`。

---

## 5. 写路径：三个动作

### 5.1 置顶 `pinHomepageTemplate({ tab, templateId })`

```
UPSERT (organization_id, tab_key, template_id)
SET pinned_at = now(), sort_order = 0
```

（`sort_order` 置 0 只是放个无害默认值，置顶区不读它。）

### 5.2 取消置顶 `unpinHomepageTemplate({ tab, templateId })`

先查当前 tab 非置顶区 `MAX(sort_order)`，记为 `maxSort`：

```
UPSERT (organization_id, tab_key, template_id)
SET pinned_at = NULL, sort_order = COALESCE(maxSort, 0) + 10
```

让被 unpin 的卡落到非置顶区末尾，用户可以继续拖。

### 5.3 拖拽重排 `reorderHomepageTemplates({ tab, orderedUnpinnedIds })`

单事务：

1. 校验 `orderedUnpinnedIds` 全部属于当前 org、能出现在当前 tab、且**当前都不是置顶**（防越权/防误传）。
2. 对数组依序 upsert：第 `i` 个 id → `sort_order = i * 10`（留 gap 方便后续只改局部；但默认实现仍是全量重写，这样最简单稳定）。
3. 不动置顶行。

全量重写单 tab 非置顶序是可接受的：单 tab 典型 <30 条，UPDATE 量很小；避免了 fractional indexing 的复杂度。

---

## 6. 权限

### 6.1 判定

复用现有 RBAC：`user_profiles.role in ('admin', 'owner')` 记为 `canManageHomepage = true`。其他角色一律只读。

### 6.2 服务端校验

新 server actions 统一走：

1. `requireAuth()` 拿 userId。
2. 查用户的 orgId + role。
3. `role` 不在 `{admin, owner}` 抛 403。
4. `tab === "custom"` 抛 400（"不支持此 tab 排序"）。
5. `revalidatePath('/home')` 刷新 RSC 缓存。

### 6.3 前端控制

- `page.tsx` 把 `canManageHomepage: boolean` 透传给 `<HomeClient>` → `<ScenarioGrid>`。
- UI 根据这个 flag 决定是否渲染编辑态入口 / 置顶按钮 / 拖拽手柄。

---

## 7. 前端 UI & 交互

### 7.1 库选型

**Framer Motion `Reorder.Group` / `Reorder.Item`**——已在 `package.json` 里（`framer-motion ^12.34.3`），不新增依赖。

### 7.2 编辑态模式（Grid → List）

Grid 3 列拖拽需要 2D 落点判定，Framer Motion 原生不支持。采用**编辑态模式**：

- 默认态：3 列 grid，所有用户看到相同布局。
- 管理员在 tab 标题行右侧看到"整理顺序"文本按钮（`variant="ghost"`，带 `ArrowUpDown` 图标，无边框）。
- 点击 → 当前 tab 切换编辑态：grid `grid-cols-3` → `grid-cols-1`（单列），卡片变窄长条，左侧出现拖拽手柄。按钮文本变"完成"。
- 再点"完成"回到 grid。
- 非当前 tab 不受影响。

### 7.3 置顶视觉（无 emoji，全部 Lucide + sky 色系）

| 元素 | 渲染 |
|---|---|
| 置顶卡的顶边条 | 卡片顶部 2px 渐变带：`bg-gradient-to-r from-sky-400/80 via-sky-300/60 to-transparent`；叠加卡片外框 `ring-1 ring-sky-300/40` |
| 置顶卡标题行右侧标记 | `<Pin size={14} className="text-sky-500/80 rotate-[30deg]" />`，非填充，细线风格 |
| 置顶按钮（hover 可见） | 卡右上角：`Pin`（未置顶）/ `PinOff`（已置顶），`ghost` 风格，`size-7 rounded-full`，无边框，`hover:bg-sky-50/60 dark:hover:bg-sky-950/40` |
| 拖拽手柄（编辑态可见） | `GripVertical size={16} text-muted-foreground/60`，hover 变 `text-sky-500`，`cursor-grab` / active:`cursor-grabbing` |

**全部图标来自 `lucide-react`，颜色走现有 sky 色系，不引入新色盘。**

### 7.4 渲染结构（单 tab）

```tsx
const pinned   = list.filter(t => t.__order?.pinnedAt)
const unpinned = list.filter(t => !t.__order?.pinnedAt)

<>
  {/* 置顶区 —— 静态，按服务端顺序（pinned_at DESC）渲染，不可拖 */}
  <div className={editing ? "grid grid-cols-1 gap-3" : "grid grid-cols-3 gap-4"}>
    {pinned.map(tpl => <Card tpl={tpl} pinned />)}
  </div>

  {/* 非置顶区 —— admin 编辑态下 Reorder；否则普通 grid */}
  {canManage && editing ? (
    <Reorder.Group values={unpinned} onReorder={handleReorder} axis="y" className="flex flex-col gap-3 mt-3">
      {unpinned.map(tpl => (
        <Reorder.Item key={tpl.id} value={tpl} className="list-none">
          <Card tpl={tpl} showDragHandle />
        </Reorder.Item>
      ))}
    </Reorder.Group>
  ) : (
    <div className={`grid grid-cols-3 gap-4 ${pinned.length ? "mt-3" : ""}`}>
      {unpinned.map(tpl => <Card tpl={tpl} />)}
    </div>
  )}
</>
```

### 7.5 乐观更新

- `handleReorder(next)` 立即 `setLocalOrder(next)`，然后调 server action。
- 失败 → `rollback + toast.error`。
- 成功 → 已靠 `revalidatePath` 刷 RSC，本地态自然对齐。

置顶 / 取消置顶同理：立即本地更新分区归属，再调 action，失败回滚。

### 7.6 阻止事件冒泡

卡片本身 `onClick` 仍是"启动模版"。拖拽手柄、置顶按钮、编辑态整理按钮都要 `onClick={e => e.stopPropagation()}`，避免误触发启动。

编辑态下整张卡 `onClick` 暂时屏蔽（防止拖着拖着点开启动对话框）。

---

## 8. 文件清单

| # | 文件 | 新建/修改 | 动作 |
|---|---|---|---|
| 1 | `src/db/schema/workflows.ts` | 修改 | 新增 `workflowTemplateTabOrder` 表定义 + index + 导出 type |
| 2 | `supabase/migrations/<ts>_add_homepage_template_order.sql` | 新建 | `npm run db:generate` 产出 |
| 3 | `src/lib/dal/workflow-templates-listing.ts` | 修改 | `listTemplatesForHomepageByTab` 加 LEFT JOIN + 新 ORDER BY（仅 9 tab） |
| 4 | `src/app/actions/homepage-template-order.ts` | 新建 | 3 个 server actions + 管理员 guard |
| 5 | `src/app/(dashboard)/home/page.tsx` | 修改 | 查 role，算 `canManageHomepage`，往下传 |
| 6 | `src/app/(dashboard)/home/home-client.tsx` | 修改 | 透传 `canManageHomepage` 到 `<ScenarioGrid>` |
| 7 | `src/components/home/scenario-grid.tsx` | 修改 | 编辑态、Reorder、Pin/Unpin 按钮、拖拽手柄、乐观更新 |

---

## 9. 边界情况

| 情况 | 处理 |
|---|---|
| 模板同时在 `featured` 和所属员工 tab | 两条独立记录，互不影响（per-tab 表的直接收益） |
| 模板被删 | `ON DELETE CASCADE` 自动清 |
| 新建模板 / 首次进入 tab | LEFT JOIN 缺行，排在非置顶区末尾；不预写行 |
| 两个 admin 同时拖 | 后提交者覆盖前者；不加锁。整列重写，最终态收敛 |
| `sort_order` 不做 gap 维护 | 每次 reorder 全量重写同 tab 非置顶行（单 tab <30 条，UPDATE 量可忽略） |
| admin 拖完后被降级 | 顺序保留，仅前端失去编辑入口；服务端校验会挡住越权请求 |
| `custom` tab 尝试传给 action | server 返回 400；前端也不会显示入口 |
| Framer Motion `Reorder.Item` layout 动画冲突 | 编辑态下移除卡片外层的 `initial/animate` 入场动画，避免与 `Reorder` 的 layout 动画互踩 |
| 置顶卡太多（>9）撑满 3 行 | 置顶区继续 grid 扩展，非置顶区在下方；不做硬上限 |

---

## 10. 测试点

1. **迁移**：`npm run db:push` 能成功，索引存在，FK CASCADE 生效。
2. **DAL 单测**：`listTemplatesForHomepageByTab` 覆盖：无置顶 / 全置顶 / 混合；多 tab 互不串扰；`custom` tab 不走新排序路径。
3. **Action 权限**：非 admin 调用 3 个 action 均 403；`tab="custom"` 400。
4. **Action 原子性**：`reorderHomepageTemplates` 中途抛错不应留下半写状态（单事务）。
5. **UI**：
   - 普通用户看不到任何编辑控件；看得到置顶视觉。
   - admin 进入编辑态、拖拽、置顶、取消置顶 4 个路径都乐观 + 服务端落库。
   - 两个浏览器窗口（同一 admin）一窗拖拽，另一窗 `revalidatePath` 后顺序同步。
6. **视觉**：置顶渐变带、`Pin` 图标、拖拽手柄色彩与现有 sky 主色调一致；无边框；无 emoji。
7. **构建**：`npx tsc --noEmit` 与 `npm run build` 通过。

---

## 11. 不在本期内

- **个人化顺序**（per-user override）——若后续有"我想把 x 放前面只影响我自己"的需求，再新开 spec。
- **`custom` tab 的排序**——user-private，逻辑与共享 tab 不同，单独设计。
- **排序版本 / 历史回溯** / **操作审计日志**——当前不做，若多 admin 冲突成为问题再加。
- **置顶区内部拖拽重排**——当前"最近 pin 在最顶"的语义已足够；若用户反馈想精排置顶区再扩展。
- **批量操作 UI**（多选置顶）——非刚需。
