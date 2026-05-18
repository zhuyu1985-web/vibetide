# 采集模块整合重构设计

- **作者**：zhuyu
- **日期**：2026-05-18
- **状态**：草案 → 待评审
- **关联模块**：`/data-collection/*`、`/research/*`、`app-sidebar.tsx`、`rbac-constants.ts`

---

## 1. 背景与目标

当前"采集"和"研究"是两条相互独立的模块线：

- `/data-collection/*`：四个 tab（采集池 / 源管理 / 媒体字典 / 监控面板），处理"采集到了什么"。
- `/research/*`：检索工作台 + 主题词库管理 + 主题词库检索 + 研究报告，处理"怎么搜、怎么打标、怎么出报告"。

这种切分让用户在"找内容 → 用主题筛 → 出报告"的工作流上反复跨模块跳转，且"研究"作为顶层菜单语义模糊（既是检索又是分析又是报告）。

**目标**：把所有"采集→检索→分析→报告"相关页面统一到"采集"管理之下，重组为五个职责清晰的二级菜单，删除"研究"顶级模块。同时按参考图（图 1–10）调整采集池/主题监测/监控面板三处页面布局。

**非目标**（明确不做）：
- 不引入新的 DB 字段（采集池筛选不加"AI 识别 / MCN / 认证 / 已读未读"等图 1 抽屉里的项；监控业务看板使用 `collected_items` 已有字段，不新增）。
- 不动 Inngest 函数、采集 Adapter、CMS 集成层、Agent 系统。
- 不改 `collected_items` DAL 主要查询接口（`LoadCollectedItemsFilters` 保持兼容）。
- 不重构 `research_topics` 表业务逻辑（仅可能 nullable 新增 `group_name`）。

---

## 2. 新结构概览

### 2.1 侧边栏

"采集"由单链接变为带子菜单组，含五个二级菜单：

```
采集 (Database icon)
├── 采集池            /data-collection/content
├── 采集配置          /data-collection/sources         (matches /sources + /outlets)
├── 主题监测          /data-collection/topics
├── 研究报告          /data-collection/reports
└── 监控面板          /data-collection/monitoring
```

"研究"顶级菜单**完全删除**。

### 2.2 路由迁移表

| 新路径 | 来源 / 旧路径 redirect | 说明 |
|---|---|---|
| `/data-collection/content` | `/research`（默认落点，无 query string 或非 topics tab） | 采集池布局重排 |
| `/data-collection/sources` | 保留不动 | 顶部 sub-tab 切到"源管理" |
| `/data-collection/sources/[id]` | 保留不动 | 详情/编辑 |
| `/data-collection/sources/new` | 保留不动 | 新建源 |
| `/data-collection/outlets` | 保留不动 | 顶部 sub-tab 切到"媒体字典" |
| `/data-collection/topics` | `/research/admin/topics`<br>`/research?mode=topics`、`/research?tab=topics`（主题词库 deep link） | 新建主从布局页 |
| `/data-collection/reports` | `/research/reports` | 物理搬迁 |
| `/data-collection/reports/[id]` | `/research/reports/[id]` | 物理搬迁 |
| `/data-collection/monitoring` | 保留不动 | 内部 sub-tab 增"业务看板" |

旧 `/research/*` 路径用 Next.js `redirect()` 在 page.tsx 内做服务端跳转（支持 `[id]` 动态参数）；保留旧目录下的薄 redirect page，其他文件清理。

`/research` redirect 时按 query string 区分目标，避免单个 URL 多目标歧义：

- `/research?mode=topics` 或 `/research?tab=topics` → `/data-collection/topics`
- 其余 `/research` 及 `/research?*` → `/data-collection/content`（默认落点）

### 2.3 权限

`MENU_PERMISSION_MAP`（`src/lib/rbac-constants.ts`）变更：

- `/research` 与 `/research/admin/topics` 条目从 `MENU_PERMISSION_MAP` 删除。
- `PERMISSIONS.MENU_RESEARCH` 常量**保留**（避免破坏 `role_permissions` 表里既有的行），标 `@deprecated`；废弃 label "查看新闻研究模块"。
- `PERMISSIONS_CONFIG` 里的 `MENU_RESEARCH` label 删除（避免在权限管理 UI 里再出现该权限位）。

**关于 MENU_DATA_COLLECTION**（实地核查后的决定）：当前 `MENU_PERMISSION_MAP` 中**没有** `/data-collection` 条目，即采集模块**对所有登录用户开放**。本次重构**不**新增 `MENU_DATA_COLLECTION` permission、**不**修改 `role_permissions` 表，原因：

1. 引入新 permission gate 会给已经能访问 `/data-collection` 的用户带来意外权限墙。
2. 现有用户的角色绑定无需调整；MENU_RESEARCH 权限位虽不再被代码引用，但作为 db 行存在不破坏任何逻辑。
3. 若日后需要更细粒度 RBAC（如限制研究报告只对特定角色可见），可单独立新 spec 引入。

实际效果：迁移后，原绑了 `MENU_RESEARCH` 的角色与未绑该权限的普通用户一样，都能正常访问 `/data-collection/*`。

---

## 3. 各页面设计

### 3.1 采集池（`/data-collection/content`）— 按图 1 借鉴布局

**目标布局**：

```
┌─── 顶部筛选区 ─────────────────────────────────────────────┐
│ [信息来源 chips]  全部 微博(2,654) 抖音(3,491) ...        │
│ [监测时间]       今日 昨日 24h 近3日 近7日 近30日 自定义  │
│ [媒体维度]       outletTier▼  outletRegion▼  category▼... │
│ [关键词]         🔍 ___________  [重置] [查询]             │
└────────────────────────────────────────────────────────────┘
┌─── 结果区 (现有 DataTable / 卡片视图) ─────────────────────┐
```

**Filter 字段范围**（按问题 2 选 B 决定）：

可启用（已存于 DB 且 UI 已实现）：
- `platform` / `firstSeenChannel`（chips，含计数）
- `time` / `publishedSince/Until`
- `outletTier` / `outletRegion` / `outletId`
- `category` / `tag` / `author`
- `q`（关键词模糊搜）
- `sourceType` / `module` / `enrichment`

不启用（按问题 2 决议）：
- 敏感性 / 信息类型 / 已读未读 / AI 识别 / MCN / 认证 / 相似合并

> 备注：调研发现 `collected_items` 表实际已有 `sentiment` 和 `infoType` 字段，但本次 UI 改造按用户选择"B：只用 UI 已有的过滤字段"，**不**接入这两个过滤器。如未来开放，只是加 chip + 把字段塞进 `LoadCollectedItemsFilters` 即可，不影响本次架构。

**文件变更**：
- `src/app/(dashboard)/data-collection/content/content-client.tsx` — 重排 UI，filter state shape 不变。
- 新增 `src/app/(dashboard)/data-collection/content/filter-chips.tsx` — chips 行子组件（信息来源 chips、媒体维度 chips），把 content-client.tsx 从 993 行拆下来。

**数据查询变更**：不变。`loadCollectedItemsAction` / `LoadCollectedItemsFilters` 保持现状；chips 的计数走同一查询的 `groupBy(firstSeenChannel)` 聚合（如果性能有问题，独立的轻量 count action）。

---

### 3.2 采集配置（`/data-collection/sources` + `/data-collection/outlets`）

**实现策略**（按问题 3 选 B）：URL 保留不动，只调整入口和顶部 tab 视觉。

**Tab 结构**：

```
顶级 tab（data-collection-tabs.tsx）
┌────────────────────────────────────────────────────────────┐
│  采集池   [采集配置]   主题监测   研究报告   监控面板      │
└────────────────────────────────────────────────────────────┘
"采集配置" tab 在 pathname 是 /sources/* 或 /outlets/* 时高亮。

进入"采集配置"后页面顶部出现 sub-tab：
┌────────────────────────────────────────────────────────────┐
│  [源管理]    媒体字典                                       │
└────────────────────────────────────────────────────────────┘
```

**文件变更**：
- `src/app/(dashboard)/data-collection/data-collection-tabs.tsx` — 把 "源管理" + "媒体字典" 合并为"采集配置"一个 tab，`matchPrefixes` 含两者；href 默认 `/data-collection/sources`。
- 新增 `src/app/(dashboard)/data-collection/config-subtabs.tsx` — 共享 sub-tab 组件。
- `src/app/(dashboard)/data-collection/sources/page.tsx`、`outlets/page.tsx` — 各自在内容上方插入 `<ConfigSubtabs />`。

**保留不动**：`sources/[id]/`、`sources/new/`、`outlets/` 内所有 dialog / 组件 / server action。

---

### 3.3 主题监测（`/data-collection/topics`）— 按图 2 主从布局

**布局**：

```
┌─ 280px 左栏 ──┬─ 主区 ──────────────────────────────────────┐
│ 🔍 搜方案名   │ 美丽中国  [查看方案][编辑方案][数据看板]... │
│               ├─────────────────────────────────────────────┤
│ ⌄ 默认分组    │ [信息来源 chips]                            │
│   • 美丽中国  │ [监测时间] [信息属性] [更多筛选]            │
│   • 成都民意  │ [关键词] 🔍                                 │
│   • 青羊公安  ├─────────────────────────────────────────────┤
│               │ 命中文章卡片流（复用 collected items 渲染）│
│               │   1. 时政新闻眼 | ...                        │
│               │   2. 重庆日报 | ...                          │
│   ...        │   ...                                        │
│               │                                              │
│ [+ 新建分组]  │                                              │
│ [+ 创建方案]  │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

**功能拆解**：

| 功能 | 来源 | 新位置 |
|---|---|---|
| 主题/方案列表 + 搜索 | `admin/topics/topics-client.tsx`（647行） | 左栏 `topic-sidebar.tsx` |
| 分组 | （表里目前无 `group_name`，详见下） | 左栏分组渲染 |
| CRUD（增删改） | `admin/topics/topics-client.tsx` | Drawer：`topic-edit-drawer.tsx` |
| 选中主题后的检索结果 | `research/topic-library-search.tsx`（417行） | 右栏 `topic-detail-panel.tsx` |
| 检索筛选条件 | 同上 | 右栏顶部 |
| 命中卡片渲染 | 同上 | 右栏底部 |

**Schema 变更**：

`research_topics` 当前无分组字段。新增 nullable 列：

```sql
ALTER TABLE research_topics
  ADD COLUMN group_name text;
```

- nullable，未分组的主题默认显示在 UI 上的"默认分组"。
- 不需要外键，仅作展示分组。
- 一条 migration：`supabase/migrations/<timestamp>_research_topics_group_name.sql`。

**文件变更**：
- 新增 `src/app/(dashboard)/data-collection/topics/page.tsx`（server，load 所有 topics + 默认选中第一个 topic 的命中列表）。
- 新增 `src/app/(dashboard)/data-collection/topics/topics-client.tsx`（主从壳）。
- 新增 `src/app/(dashboard)/data-collection/topics/topic-sidebar.tsx`（左栏，含搜索 / 分组折叠 / 选中态）。
- 新增 `src/app/(dashboard)/data-collection/topics/topic-detail-panel.tsx`（右栏，含 filter + 命中列表）。
- 新增 `src/app/(dashboard)/data-collection/topics/topic-edit-drawer.tsx`（编辑/新建 drawer）。
- 新增 `src/app/(dashboard)/data-collection/topics/topic-group-dialog.tsx`（新建/重命名分组 dialog）。
- 删除 `src/app/(dashboard)/research/admin/topics/topics-client.tsx`。
- 删除 `src/app/(dashboard)/research/topic-library-search.tsx`。
- `src/app/actions/research/research-topics.ts` — 新增 `setTopicGroup` action 和 `listTopicGroups` query。

---

### 3.4 研究报告（`/data-collection/reports`）— 物理搬迁

**搬迁**：

```
src/app/(dashboard)/research/reports/
  ├── page.tsx                       → src/app/(dashboard)/data-collection/reports/page.tsx
  ├── reports-list-client.tsx        → 同上目录
  └── [id]/
      ├── page.tsx                   → 同上目录
      └── report-client.tsx          → 同上目录
```

**内部链接扫改**：6 个含 `/research/reports/...` href 的文件：

1. `research/search-workbench-client.tsx` — 整体删除（被 `/research` redirect 取代）。
2. `research/topic-library-search.tsx` — 整体删除（功能已迁主题监测）。
3. `research/reports/reports-list-client.tsx` — 搬走后改 href 为 `/data-collection/reports/[id]`。
4. `research/reports/[id]/report-client.tsx` — 搬走后扫改返回链接。
5. `research/research-breadcrumb.tsx` — 跟着搬到 `data-collection/reports/reports-breadcrumb.tsx`（实地核查仅 `/research/reports/*` 引用，无跨模块用法），所有 `/research/...` href 改为 `/data-collection/...`。
6. `components/layout/app-sidebar.tsx` — 整体重写侧边栏。

---

### 3.5 监控面板（`/data-collection/monitoring`）— 内部 sub-tab

**当前 `monitoring-client.tsx`** 是采集运维监控（成功率 / 错误源 / 错误日志 / 渠道分布 / tikhub 成本）。

**改造后**：

```
顶部 sub-tab：
  [业务看板]    采集运维
```

**业务看板**（新建，按图 5）：

| 模块 | 数据源 | 状态 |
|---|---|---|
| 三个指标卡 | `collected_items` 聚合 | 可实现 |
|  · 发文总量 | `count(*)` + 按 sentiment 分组 | ✓ |
|  · 互动声量 | `sum(likeCount + commentCount + shareCount + favoriteCount + viewCount + replyCount)`，各分项也展开 | ✓ |
|  · 影响力值 | `count(distinct author)` + `sum(authorFollowerCount)` | ✓ |
| 信息来源走势图 | `firstSeenChannel` 分线、按小时/日聚合 `firstSeenAt` | ✓ |
| 传播速度 | `count(*) / 时间窗`（条数/小时） | ✓ |
| 右侧信息列表 | `collected_items order by firstSeenAt desc limit 20` | ✓ |
| 顶部筛选 | 主题/方案多选、信息来源 chips、监测时间 | ✓ |

> 调研结论：`collected_items` 表已包含 `likeCount / commentCount / shareCount / viewCount / favoriteCount / replyCount / sentiment / infoType / authorFollowerCount`，业务看板**全部指标都可真实计算**，无需 stub 或新增字段。

**主题/方案过滤的数据源**：`research_collected_item_topics` 桥接表（含 `collectedItemId`、`topicId`、`matchType`、`matchScore`、`matchedKeyword`），由 Inngest `annotate-collected-item` 函数自动维护。业务看板的主题筛选 query 走 `collected_items INNER JOIN research_collected_item_topics ON collected_item_id = collected_items.id WHERE topic_id IN (selected_ids)`。**同样的桥接表也是主题监测（§3.3）右栏命中结果的数据源**。

**采集运维**（沿用）：当前 `monitoring-client.tsx` 内容（成功率 / 错误源 / 最近错误 / 分布 / tikhub 成本）原样作为该 sub-tab。

**文件变更**：
- `src/app/(dashboard)/data-collection/monitoring/monitoring-client.tsx` — 拆为 sub-tab 壳。
- 重命名 `monitoring-client.tsx` 内容为 `operations-panel.tsx`。
- 新增 `src/app/(dashboard)/data-collection/monitoring/business-dashboard.tsx`。
- 新增 `src/lib/dal/monitoring-business.ts`：
  - `getBusinessSummary(orgId, filters)` — 返回三个指标卡数据。
  - `getChannelTrend(orgId, filters, granularity)` — 折线图数据。
  - `getRecentItems(orgId, filters, limit)` — 右侧列表。
- `src/app/(dashboard)/data-collection/monitoring/page.tsx` — server 端拉所有 sub-tab 共需的数据。

---

## 4. 实施阶段

> 每个 Phase 收尾必须：`npx tsc --noEmit` 零错误 + `npm run build` 通过 + 独立 commit。每个 commit 可独立 build。

### Phase 1 — 骨架（侧边栏 + 二级菜单占位）

- 改 `app-sidebar.tsx`：删"研究"，给"采集"加 children。
- 改 `data-collection-tabs.tsx`：合并"源管理 + 媒体字典"为"采集配置"，新增"主题监测"和"研究报告" tab。
- 五个二级菜单页面建占位 page.tsx（先返回简单占位 UI，能编译通过）。
- `rbac-constants.ts` 加 `MENU_DATA_COLLECTION` 覆盖所有子路径。

### Phase 2 — 研究报告搬迁（独立、低风险，先做）

- 物理 mv `research/reports/*` → `data-collection/reports/*`。
- 扫改 href（reports 内部 + breadcrumb）。
- `research/reports/page.tsx` 改为薄 redirect。
- `research/reports/[id]/page.tsx` 改为薄 redirect（保留 `[id]` 动态段，redirect to `/data-collection/reports/${id}`）。

### Phase 3 — 主题监测合并（含 schema migration）

- 加 `research_topics.group_name` migration。
- 拆 `topic-library-search.tsx` 检索逻辑 + `admin/topics/topics-client.tsx` CRUD 为新主从布局五个组件。
- 旧 `/research/admin/topics`、`/research`(topic 检索) 改为 redirect 到 `/data-collection/topics`。
- 新 `setTopicGroup` action + `listTopicGroups` query。

### Phase 4 — 采集池图 1 重排

- 拆 `content-client.tsx` 出 `filter-chips.tsx`。
- 重排 UI 顺序与视觉。
- chips 计数 query（按 `firstSeenChannel` group by）。

### Phase 5 — 采集配置 sub-tab

- 改 `data-collection-tabs.tsx`：合并视觉。
- 新增 `config-subtabs.tsx`。
- `sources/page.tsx`、`outlets/page.tsx` 顶部插入 sub-tab。

### Phase 6 — 监控面板 tab 化（业务看板）

- 拆 `monitoring-client.tsx` 为 sub-tab 壳。
- 新增 `business-dashboard.tsx`、`operations-panel.tsx`。
- 新 DAL `monitoring-business.ts` 聚合查询。

### Phase 7 — 清理 + 权限迁移

- DB migration 跑 role_permissions 迁移（MENU_RESEARCH → MENU_DATA_COLLECTION）。
- 删 `MENU_RESEARCH` 在 `MENU_PERMISSION_MAP` 中的条目（保留 PERMISSIONS 常量作 @deprecated）。
- 删 `/research` 目录下除 redirect page 外的所有文件。
- 验证：登录已有用户、确认权限正常、所有旧链接都跳转。

---

## 5. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| `role_permissions` migration 未跑就删常量 | 已绑 MENU_RESEARCH 的角色丢权限 | Phase 7 顺序：先 migration → 再删常量；migration 用 INSERT ... ON CONFLICT DO NOTHING 幂等 |
| 主题监测 1064 行代码拆组件丢功能 | 检索功能或 CRUD 静默失败 | Phase 3 开始前列功能 checklist（搜索 / 增删改 / 关键词 / 样本 / 命中筛选），逐项搬完打勾 |
| chips 计数 query 加慢页面 | 采集池首屏变慢 | 用 SQL `GROUP BY firstSeenChannel` 单 query，加 organizationId + firstSeenChannel 复合索引（已存在 `collected_items_org_first_seen_idx`）；如仍慢则改成异步加载 |
| `/research/[id]` redirect 丢失参数 | 旧书签/链接打开 404 | redirect 用 `redirect(\`/data-collection/reports/\${params.id}\`)`，参数透传 |
| breadcrumb 组件归属 | 跨模块复用导致循环依赖 | 评估后选一：跟搬迁到 reports 目录、或就地改链接 |
| 中间态 build 失败 | 阻塞后续开发 | 每个 Phase 收尾跑 tsc + build，失败立即修，不留到下一 Phase |

---

## 6. 验收标准

- ✅ 侧边栏"采集"展开后显示 5 个子菜单，顺序：采集池 / 采集配置 / 主题监测 / 研究报告 / 监控面板。
- ✅ 侧边栏不再有"研究"顶级菜单。
- ✅ 访问 `/research`、`/research/admin/topics`、`/research/reports`、`/research/reports/:id` 均自动跳转到对应新路径。
- ✅ 采集池 UI 按图 1 风格排布：顶部信息来源 chips（带计数）、监测时间快捷段、媒体维度筛选行。
- ✅ 采集配置：进入 `/sources` 或 `/outlets`，顶部 sub-tab 切换两者，顶级 tab 始终显示"采集配置"高亮。
- ✅ 主题监测 `/data-collection/topics`：左主题列表（含分组、搜索、新建分组、创建方案按钮），右选中主题命中结果 + 筛选。
- ✅ 研究报告列表和详情都搬到 `/data-collection/reports`，旧链接 301-style redirect。
- ✅ 监控面板顶部 sub-tab "业务看板 / 采集运维"，业务看板三个指标卡 + 走势图 + 列表都能显示真实数据。
- ✅ 已绑 MENU_RESEARCH 的角色登录后能正常访问所有 `/data-collection/*` 路径（自动迁权限）。
- ✅ `npx tsc --noEmit` 和 `npm run build` 全过。
- ✅ Phase 1–7 各自独立 commit、独立 buildable。

---

## 7. 关联与参考

- 现有 `docs/superpowers/specs/2026-04-18-unified-collection-module-design.md`（Collection Hub 设计，本设计依赖其 adapter / DAL 结构）。
- 现有 `docs/superpowers/specs/2026-04-14-news-research-module-design.md`（研究模块设计，本设计将其前端整合到采集下）。
- ADR `docs/adr/2026-05-01-platform-supabase-strategy.md`（继续用 Drizzle + postgres driver，本设计不引入新数据访问层）。
