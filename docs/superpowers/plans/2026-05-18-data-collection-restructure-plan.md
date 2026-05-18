# 采集模块整合重构 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `/research/*` 全部前端功能并入 `/data-collection/*` 下，新建五个二级菜单（采集池 / 采集配置 / 主题监测 / 研究报告 / 监控面板），删除"研究"顶级菜单，所有旧 URL redirect 到新路径。

**Architecture:** Next.js App Router 路由重组 + 客户端组件主从布局重构 + 一条 nullable schema migration（`research_topics.group_name`）+ 一个新 DAL（`monitoring-business.ts`）+ 侧边栏导航与 RBAC 映射调整。所有数据流仍走既有 DAL/Server Actions，不改 Inngest、不改采集 adapter、不改 CMS 层。每个 Phase 单独 commit、单独可 build、单独可 ship。

**Tech Stack:** Next.js 16.1.6, React 19, TypeScript 5 (strict), Drizzle ORM 0.45.1, postgres driver, shadcn/ui, Tailwind v4, Recharts 3.7, Vitest。

**Spec：** `docs/superpowers/specs/2026-05-18-data-collection-restructure-design.md`

**关键约束：**
- 每个 Phase 结束必须：`npx tsc --noEmit` 零错误 + `npm run build` 通过 + 1 个独立 commit。
- 不引入新 DB 字段（除 `research_topics.group_name` 一个 nullable 列）。
- 不动 Inngest 函数、采集 Adapter、CMS 集成、Agent 系统。
- UI 文字一律中文（简体），按钮不带边框，使用既有 shared primitives（Button / Input / SearchInput / GlassCard / DataTable 等）。

---

## File Structure

### 新建文件

```
docs/superpowers/specs/2026-05-18-data-collection-restructure-design.md   (已存在)
docs/superpowers/plans/2026-05-18-data-collection-restructure-plan.md      (本文件)

supabase/migrations/<ts>_research_topics_group_name.sql                    (Phase 3)

src/app/(dashboard)/data-collection/
  config-subtabs.tsx                                                       (Phase 5)
  content/
    filter-chips.tsx                                                        (Phase 4)
  topics/
    page.tsx                                                                (Phase 3)
    topics-client.tsx                                                       (Phase 3)
    topic-sidebar.tsx                                                       (Phase 3)
    topic-detail-panel.tsx                                                  (Phase 3)
    topic-edit-drawer.tsx                                                   (Phase 3)
    topic-group-dialog.tsx                                                  (Phase 3)
  reports/                                                                  (Phase 2 - 物理搬迁)
    page.tsx
    reports-list-client.tsx
    reports-breadcrumb.tsx                                                  (新名,搬自 research-breadcrumb.tsx)
    [id]/
      page.tsx
      report-client.tsx
  monitoring/
    business-dashboard.tsx                                                  (Phase 6)
    operations-panel.tsx                                                    (Phase 6, 从 monitoring-client 拆)

src/lib/dal/
  monitoring-business.ts                                                    (Phase 6)
  monitoring-business-test.ts                                               (Phase 6 - test, optional)
```

### 修改文件

```
src/components/layout/app-sidebar.tsx                                       (Phase 1)
src/lib/rbac-constants.ts                                                   (Phase 1 + Phase 7)
src/app/(dashboard)/data-collection/data-collection-tabs.tsx                (Phase 1 + Phase 5)
src/app/actions/research/research-topics.ts                                 (Phase 3 - 新 setTopicGroup / listTopicGroups)
src/lib/dal/research/research-topics.ts                                     (Phase 3 - listTopicGroups query)
src/db/schema/research/research-topics.ts                                   (Phase 3 - group_name 字段)
src/app/(dashboard)/data-collection/content/content-client.tsx              (Phase 4)
src/app/(dashboard)/data-collection/sources/page.tsx                        (Phase 5)
src/app/(dashboard)/data-collection/outlets/page.tsx                        (Phase 5)
src/app/(dashboard)/data-collection/monitoring/monitoring-client.tsx        (Phase 6)
src/app/(dashboard)/data-collection/monitoring/page.tsx                     (Phase 6)
```

### 删除文件 (Phase 2, 3, 7)

```
src/app/(dashboard)/research/search-workbench-client.tsx                    (Phase 3 末尾)
src/app/(dashboard)/research/topic-library-search.tsx                       (Phase 3 末尾)
src/app/(dashboard)/research/research-breadcrumb.tsx                        (Phase 2 - 搬到 reports/reports-breadcrumb.tsx)
src/app/(dashboard)/research/advanced-filters-sidebar.tsx                   (Phase 3 末尾, 已无引用)
src/app/(dashboard)/research/advanced-search-builder.tsx                    (Phase 3 末尾, 已无引用)
src/app/(dashboard)/research/search-mode-types.ts                           (Phase 3 末尾, 已无引用)
src/app/(dashboard)/research/admin/topics/topics-client.tsx                 (Phase 3 末尾)
```

### 保留为薄 redirect (Phase 7)

```
src/app/(dashboard)/research/page.tsx                                       (redirect)
src/app/(dashboard)/research/layout.tsx                                     (保留或删,layout 无内容直接删)
src/app/(dashboard)/research/admin/topics/page.tsx                          (redirect)
src/app/(dashboard)/research/reports/page.tsx                               (redirect)
src/app/(dashboard)/research/reports/[id]/page.tsx                          (redirect)
```

---

## Phase 1 · 骨架（侧边栏 + 5 个二级菜单 + 占位页）

**目标**：完成导航重组与新二级菜单的占位页面。每个新路径都能编译并返回简单 placeholder UI，让后续 Phase 可以在已有路由上填内容。

**File Structure 受影响**：
- 修改：`src/components/layout/app-sidebar.tsx`、`src/app/(dashboard)/data-collection/data-collection-tabs.tsx`
- 新建：`src/app/(dashboard)/data-collection/topics/page.tsx`、`src/app/(dashboard)/data-collection/reports/page.tsx`（占位）

### Task 1.1: 侧边栏新增"采集"子菜单组 + 删除"研究"顶级菜单

**Files:**
- Modify: `src/components/layout/app-sidebar.tsx:113`（"采集"行）与 `:148-154`（"研究"行）

- [ ] **Step 0: 确认所有需要的 icon import 都已存在**

打开 `src/components/layout/app-sidebar.tsx` 顶部 import 块，确认这些 lucide-react icon 都在：`FolderOpen, Wrench, BookMarked, FileText, BarChart3, Database`。若缺任何一个，加到 import 列表。

实地核查（执行计划时）：在该文件 Read 后用 `grep -E "FolderOpen|Wrench|BookMarked|FileText|BarChart3|Database" <file>` 验证。

- [ ] **Step 1: 把"采集"从 `NavLink` 改为带 children 的 `NavGroup`**

把：
```tsx
{ label: "采集", href: "/data-collection", icon: Database },
```
改为：
```tsx
{
  label: "采集", href: "#data-collection", icon: Database,
  children: [
    { label: "采集池", href: "/data-collection/content", icon: FolderOpen },
    { label: "采集配置", href: "/data-collection/sources", icon: Wrench },
    { label: "主题监测", href: "/data-collection/topics", icon: BookMarked },
    { label: "研究报告", href: "/data-collection/reports", icon: FileText },
    { label: "监控面板", href: "/data-collection/monitoring", icon: BarChart3 },
  ],
},
```

- [ ] **Step 2: 删除"研究"整个 NavItem**

删除 `NAV_ITEMS` 数组里：
```tsx
{
  label: "研究", href: "/research", icon: Compass,
  children: [
    { label: "检索工作台", href: "/research", icon: Telescope },
    { label: "主题词库", href: "/research/admin/topics", icon: BookMarked },
  ],
},
```

- [ ] **Step 3: 调整 `matchPrefixes` 处理**

注意"采集配置"href 是 `/sources`，但点击 `/outlets` 也应高亮。`isHrefActive(pathname, '/data-collection/sources')` 当 pathname 是 `/outlets` 时会返回 false。

修改办法：在 `NavGroup` 渲染子项时，对"采集配置"特殊处理：用 `pathname.startsWith('/data-collection/sources') || pathname.startsWith('/data-collection/outlets')` 判定 active。最简洁做法是给 `SubItem` 加可选 `matchPrefixes?: string[]` 字段，子菜单 active 判定优先用 `matchPrefixes`。

代码改动：
```tsx
interface SubItem { label: string; href: string; icon: LucideIcon; matchPrefixes?: string[] }
```
并在 `SubMenuList` 内的 active 判定改为：
```tsx
const active = child.matchPrefixes
  ? child.matchPrefixes.some((p) => isHrefActive(pathname, p))
  : isHrefActive(pathname, child.href);
```
然后给"采集配置"子项加：
```tsx
{ label: "采集配置", href: "/data-collection/sources",
  matchPrefixes: ["/data-collection/sources", "/data-collection/outlets"],
  icon: Wrench },
```

- [ ] **Step 4: 类型检查**

```bash
npx tsc --noEmit
```
Expected: 零错误

- [ ] **Step 5: 启动 dev server 浏览器验证**

```bash
npm run dev
```
打开 `http://localhost:3000/data-collection/content`，鼠标悬停"采集"项，验证：
- 子菜单弹出含 5 项（采集池 / 采集配置 / 主题监测 / 研究报告 / 监控面板）
- 当前路径 `/content` 时"采集池"高亮
- 切到 `/sources` 或 `/outlets` 时"采集配置"高亮
- "研究"顶级菜单已不存在

- [ ] **Step 6: Commit（不要这步先做，连同后续 Task 一起 commit on Phase 1 结尾）**

---

### Task 1.2: 创建占位 `/data-collection/topics` 页面

**Files:**
- Create: `src/app/(dashboard)/data-collection/topics/page.tsx`

- [ ] **Step 1: 写占位 page.tsx**

```tsx
import { redirect } from "next/navigation";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";

export default async function TopicsPage() {
  const ctx = await getCurrentUserAndOrg();
  if (!ctx) redirect("/login");
  const allowed = await hasPermission(
    ctx.userId,
    ctx.organizationId,
    PERMISSIONS.MENU_RESEARCH, // 临时复用,Phase 7 评估是否换 MENU_DATA_COLLECTION
  );
  if (!allowed) redirect("/home");
  return (
    <div className="px-2 py-4">
      <h2 className="text-lg font-semibold">主题监测</h2>
      <p className="mt-2 text-sm text-muted-foreground">Phase 3 实现。</p>
    </div>
  );
}
```

- [ ] **Step 2: 类型检查 + 浏览器验证**

打开 `/data-collection/topics` 应能正常渲染占位文本，没有 build 错误。

---

### Task 1.3: 创建占位 `/data-collection/reports` 页面

**Files:**
- Create: `src/app/(dashboard)/data-collection/reports/page.tsx`

- [ ] **Step 1: 写占位 page.tsx**

同 Task 1.2 模板，但 H2 改成"研究报告"，提示"Phase 2 实现"。

- [ ] **Step 2: 浏览器验证**

`/data-collection/reports` 渲染占位文本。

---

### Task 1.4: 调整顶部 `data-collection-tabs.tsx` 加新 tab

**Files:**
- Modify: `src/app/(dashboard)/data-collection/data-collection-tabs.tsx:14-35`

- [ ] **Step 1: 替换 TABS 数组为 5 tab 结构**

```tsx
const TABS: TabDef[] = [
  { href: "/data-collection/content",  label: "采集池",
    matchPrefixes: ["/data-collection/content"] },
  { href: "/data-collection/sources",  label: "采集配置",
    matchPrefixes: ["/data-collection/sources", "/data-collection/outlets"] },
  { href: "/data-collection/topics",   label: "主题监测",
    matchPrefixes: ["/data-collection/topics"] },
  { href: "/data-collection/reports",  label: "研究报告",
    matchPrefixes: ["/data-collection/reports"] },
  { href: "/data-collection/monitoring", label: "监控面板",
    matchPrefixes: ["/data-collection/monitoring"] },
];
```

- [ ] **Step 2: 浏览器验证**

切换页面时顶部 tab 高亮正确。`/sources` 和 `/outlets` 两个 URL 都让"采集配置" tab 高亮。

---

### Task 1.5: Phase 1 收尾 — typecheck + build + commit

- [ ] **Step 1: 跑类型检查**

```bash
npx tsc --noEmit
```
Expected: 零错误

- [ ] **Step 2: 跑 build**

```bash
npm run build
```
Expected: build 成功

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/app-sidebar.tsx \
        src/app/\(dashboard\)/data-collection/data-collection-tabs.tsx \
        src/app/\(dashboard\)/data-collection/topics/page.tsx \
        src/app/\(dashboard\)/data-collection/reports/page.tsx
git commit -m "feat(data-collection): Phase 1 骨架 — 5 个二级菜单 + 占位

侧边栏'采集'变 NavGroup,加 5 个子菜单(采集池/采集配置/主题监测/研究报告/监控面板)。
'研究'顶级菜单删除。顶部 tabs 同步成 5 个,主题监测 + 研究报告先放占位 page.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2 · 研究报告物理搬迁（独立、低风险）

**目标**：把 `/research/reports/*` 整体搬到 `/data-collection/reports/*`，扫改内部 href，旧路径加 redirect。这步独立完成，跟其他 Phase 没依赖。

### Task 2.1: 物理移动文件

**Files:**
- Move: `src/app/(dashboard)/research/reports/page.tsx` → `src/app/(dashboard)/data-collection/reports/page.tsx`（覆盖 Phase 1 的占位）
- Move: `src/app/(dashboard)/research/reports/reports-list-client.tsx` → 同目录
- Move: `src/app/(dashboard)/research/reports/[id]/page.tsx` → 同目录的 `[id]/`
- Move: `src/app/(dashboard)/research/reports/[id]/report-client.tsx` → 同目录的 `[id]/`
- Move + Rename: `src/app/(dashboard)/research/research-breadcrumb.tsx` → `src/app/(dashboard)/data-collection/reports/reports-breadcrumb.tsx`

**前置条件**：Phase 1 创建了占位 `data-collection/reports/page.tsx` 但**没有**创建 `data-collection/reports/[id]/` 目录。Task 2.1 各步执行时**不要**预先 `mkdir` 这些目标目录 —— `git mv` 在目标目录已存在时会失败。

- [ ] **Step 1: 用 `git mv` 搬迁 client 组件（page.tsx 除外）**

```bash
git mv src/app/\(dashboard\)/research/reports/reports-list-client.tsx \
       src/app/\(dashboard\)/data-collection/reports/reports-list-client.tsx
git mv src/app/\(dashboard\)/research/reports/\[id\] \
       src/app/\(dashboard\)/data-collection/reports/\[id\]
git mv src/app/\(dashboard\)/research/research-breadcrumb.tsx \
       src/app/\(dashboard\)/data-collection/reports/reports-breadcrumb.tsx
```

**注意**：`page.tsx` 不能直接 git mv（目标已被 Phase 1 占位占据）。下一步处理。

- [ ] **Step 2: 用旧 page.tsx 的内容覆盖 Phase 1 占位**

**唯一方案**（不要两件事都做）：把旧 `research/reports/page.tsx` 的内容**复制**到 `data-collection/reports/page.tsx` 覆盖占位；**旧文件保留不动**（Phase 7 再改为 redirect）。

```bash
cp src/app/\(dashboard\)/research/reports/page.tsx \
   src/app/\(dashboard\)/data-collection/reports/page.tsx
```

此时同一个路由 `/data-collection/reports` 用新代码渲染；`/research/reports` 还能正常渲染（暂时和新页面行为一致，Phase 7 改 redirect）。Phase 之间用户可能同时访问两个 URL，是预期行为，无路由冲突（路径不同）。

---

### Task 2.2: 扫改内部 href

**Files:**
- Modify: `src/app/(dashboard)/data-collection/reports/reports-list-client.tsx`
- Modify: `src/app/(dashboard)/data-collection/reports/[id]/report-client.tsx`
- Modify: `src/app/(dashboard)/data-collection/reports/reports-breadcrumb.tsx`

- [ ] **Step 1: grep 找所有内部链接**

```bash
grep -rn "/research/reports" src/app/\(dashboard\)/data-collection/reports/
```
Expected: 列出所有 href 引用

- [ ] **Step 2: 替换为 `/data-collection/reports/`**

每个匹配项用 Edit 工具改：
- `/research/reports` → `/data-collection/reports`
- 注意保留动态参数（如 `/research/reports/${id}` → `/data-collection/reports/${id}`）

- [ ] **Step 3: 处理 reports-breadcrumb.tsx**

文件名变了，import 路径也要改：原 `import { ResearchBreadcrumb } ...` → `import { ReportsBreadcrumb } ...`（如果组件名也改了，同步改 export 名）。建议组件命名跟随文件名：`ReportsBreadcrumb`。

- [ ] **Step 4: grep 确认无残留**

```bash
grep -rn "/research/reports" src/
```
Expected: 仅 `src/app/(dashboard)/research/reports/page.tsx` 和 `[id]/page.tsx` 还含路径字符串（Phase 7 改 redirect 用）。

---

### Task 2.3: typecheck + build + 浏览器验证 + commit

- [ ] **Step 1: 类型检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 2: build**

```bash
npm run build
```

- [ ] **Step 3: 浏览器验证**

启动 dev server。访问 `/data-collection/reports`，应能看到报告列表（用真实数据库）。点进一条 `/data-collection/reports/[id]` 应能看到详情页，面包屑链接正确指向 `/data-collection/reports`。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(data-collection): Phase 2 研究报告搬迁 → /data-collection/reports

物理 mv research/reports/* 到 data-collection/reports/。
research-breadcrumb.tsx 改名为 reports-breadcrumb.tsx 并跟着搬。
内部 href 全部从 /research/reports/* 改为 /data-collection/reports/*。
旧 research/reports/page.tsx 暂保留(Phase 7 改 redirect)。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3 · 主题监测合并（含 schema migration）

**目标**：合并 `topic-library-search.tsx` + `admin/topics/topics-client.tsx` 为 `/data-collection/topics` 主从布局；加 `research_topics.group_name` 字段；旧路径 redirect。

**Commit 拆分（Phase 3 内部）**：为方便回滚，本 Phase 拆 3 个 commit：

1. **3a · schema + DAL**：Task 3.1（migration + schema 字段）+ Task 3.2（DAL listTopicGroups + setTopicGroup action）。这一 commit 在没有 UI 的情况下也是 `tsc + build` 干净的（新字段不影响既有查询）。
2. **3b · 新 UI**：Task 3.3–3.7（5 个新组件 + page.tsx + topics-client.tsx）。这一 commit 完成后 `/data-collection/topics` 能渲染主从布局。
3. **3c · 删旧 + redirect**：Task 3.8（删除老的 research/admin/topics、topic-library-search 等 + 旧 path 改 redirect）。这一 commit 之后 `/research` 旧路径全部跳新路径。

每个 sub-commit 都跑 `tsc --noEmit` + `npm run build` 验证。

### Task 3.1: Schema migration — `research_topics.group_name`

**Files:**
- Create: `supabase/migrations/<timestamp>_research_topics_group_name.sql`
- Modify: `src/db/schema/research/research-topics.ts`

- [ ] **Step 1: 生成 migration 文件**

文件名格式跟着既有命名：`20260518000001_research_topics_group_name.sql`。

```sql
-- 给 research_topics 加 group_name nullable 列,用于 UI 展示分组
ALTER TABLE research_topics
  ADD COLUMN IF NOT EXISTS group_name text;

-- 查询索引(可选,如果分组多可加)
CREATE INDEX IF NOT EXISTS research_topics_org_group_idx
  ON research_topics (organization_id, group_name);
```

- [ ] **Step 2: 改 schema 定义**

在 `researchTopics` 表 schema 加：
```ts
groupName: text("group_name"),
```

- [ ] **Step 3: 用 generate → migrate 标准流程跑 migration**

**唯一路径**：项目 drizzle.config.ts 配 `out: "./supabase/migrations"`，按既有约定用 `db:generate` + `db:migrate`，不要用 `db:push`（push 是 dev 旁路）。

```bash
# 1) 让 Drizzle 比对 schema 差异并生成 SQL（自动文件名,如 0xxx_xxx.sql）
npm run db:generate

# 2) 检视生成的 SQL — 应包含 ADD COLUMN group_name + 索引（若 Drizzle 推断出来）
ls -t supabase/migrations/*.sql | head -1
cat $(ls -t supabase/migrations/*.sql | head -1)

# 3) 应用到 DB
npm run db:migrate
```

如果生成的 SQL 与 Step 1 手写的不完全相同，**以 generate 出来的为准**（Step 1 手写文件可以直接 git rm 掉，避免 sql 冲突）。如果生成出的文件没有索引行而 Step 1 手写有，可以在生成文件末尾追加索引行（标注是后加的）。

- [ ] **Step 4: 验证**

```bash
psql "$DATABASE_URL" -c "\d research_topics"
```
Expected: 列里有 `group_name text` 行。

- [ ] **Step 5: Commit（部分提交，等 Phase 3 末尾再一次性 commit）**

---

### Task 3.2: 加 DAL `listTopicGroups` 和 server action `setTopicGroup`

**Files:**
- Modify: `src/lib/dal/research/research-topics.ts`
- Modify: `src/app/actions/research/research-topics.ts`

- [ ] **Step 1: DAL 新增 `listTopicGroups`**

```ts
// 返回该 org 下所有去重的 group_name(含 null 作为"默认分组")
export async function listTopicGroups(orgId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ g: researchTopics.groupName })
    .from(researchTopics)
    .where(eq(researchTopics.organizationId, orgId));
  // null 表示默认分组,过滤后单独处理
  return rows
    .map((r) => r.g)
    .filter((g): g is string => Boolean(g))
    .sort();
}
```

- [ ] **Step 2: 在 `listResearchTopics` 返回类型里加 `groupName`**

```ts
export type TopicSummary = {
  id: string;
  name: string;
  description: string | null;
  isPreset: boolean;
  primaryKeyword: string | null;
  aliasCount: number;
  sampleCount: number;
  groupName: string | null; // 新增
};
```
然后在 return 块里加 `groupName: t.groupName`。

- [ ] **Step 3: server action `setTopicGroup`**

在 `src/app/actions/research/research-topics.ts` 加：
```ts
export async function setTopicGroup(
  topicId: string,
  groupName: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireAuth();
  await db.update(researchTopics)
    .set({ groupName, updatedAt: new Date() })
    .where(and(
      eq(researchTopics.id, topicId),
      eq(researchTopics.organizationId, ctx.organizationId),
    ));
  revalidatePath("/data-collection/topics");
  return { ok: true };
}
```

- [ ] **Step 4: 类型检查 + build**

```bash
npx tsc --noEmit && npm run build
```

- [ ] **Step 5: Phase 3a commit（schema + DAL）**

```bash
git add supabase/migrations/*.sql \
        src/db/schema/research/research-topics.ts \
        src/lib/dal/research/research-topics.ts \
        src/app/actions/research/research-topics.ts
git commit -m "feat(research-topics): Phase 3a schema + DAL

新增 research_topics.group_name 列(nullable migration)。
DAL 新增 listTopicGroups,TopicSummary 类型加 groupName 字段。
Server action 新增 setTopicGroup。
本 commit 仅 backend,UI(Phase 3b)和老路径清理(Phase 3c)分两次后续 commit。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3.3: 构建 `topic-sidebar.tsx`（左栏列表）

**Files:**
- Create: `src/app/(dashboard)/data-collection/topics/topic-sidebar.tsx`

- [ ] **Step 1: 写组件**

约 150 行客户端组件，props：
```ts
interface TopicSidebarProps {
  topics: TopicSummary[];
  groups: string[]; // listTopicGroups 返回
  selectedTopicId: string | null;
  onSelectTopic: (id: string) => void;
  onOpenNewTopic: () => void;
  onOpenNewGroup: () => void;
  onMoveTopic: (topicId: string, groupName: string | null) => Promise<void>;
}
```

结构：
- 顶部 `<SearchInput>` 按 name 过滤主题
- 中部按 groupName 分组渲染主题列表（默认分组在最上，其他按字母序）
- 每个分组项可折叠（用 ChevronDown 旋转）
- 选中主题项高亮（蓝条左侧 indicator）
- 底部两按钮：`+ 新建分组` `+ 创建方案`，**不加边框**

使用 `<GlassCard>` 包裹左栏，宽度 `w-[280px]`。

- [ ] **Step 2: 浏览器验证**

无法独立验证，需 Task 3.7 把主从壳搭起来后才能看效果。这里只做 tsc 检查。

---

### Task 3.4: 构建 `topic-detail-panel.tsx`（右栏命中结果）

**Files:**
- Create: `src/app/(dashboard)/data-collection/topics/topic-detail-panel.tsx`

- [ ] **Step 1: 写组件**

约 250 行客户端组件。复用 `topic-library-search.tsx`（417 行）的检索逻辑，但拆出来作为子组件。Props：
```ts
interface TopicDetailPanelProps {
  topic: TopicSummary;
  // 重用现有 searchCollectedItemsByTopic action 拿命中结果
}
```

结构：
- 顶部主题标题 + 操作按钮（`编辑方案` `定向信源` `数据看板` `一键报告` — 实际操作复用 `topics-client.tsx` 的实现）
- 中部 filter 行：信息来源 chips（按 `firstSeenChannel` 聚合）、监测时间快捷段、关键词搜索
- 底部命中卡片流（复用 content-client 的卡片渲染样式）

数据查询：用 `research_collected_item_topics` JOIN `collected_items`，按 `topic.id` 过滤。

- [ ] **Step 2: 命中结果查询 — 复用现有 DAL**

**实地核查结果**：`src/lib/dal/research/collected-item-search.ts` 已有 `searchCollectedItemsForResearch(orgId, filters, pagination)`，filter 接口已包含 `topicIds?: string[]` 字段（在 Phase 3 之前确认；如发现接口缺这个 field，则补一个，并在 SQL 里加 `INNER JOIN research_collected_item_topics ON ... WHERE topic_id IN (...)`）。

`TopicDetailPanel` 直接调 `searchCollectedItemsForResearch` 即可，不要新建一个名字相近的 wrapper。

- [ ] **Step 3: 浏览器验证**

同 3.3 — 等 3.7 完成后整体验证。

---

### Task 3.5: 构建 `topic-edit-drawer.tsx`

**Files:**
- Create: `src/app/(dashboard)/data-collection/topics/topic-edit-drawer.tsx`

- [ ] **Step 1: 写 Drawer 组件**

用 shadcn/ui `<Sheet>`（drawer 形态）。复用 `admin/topics/topics-client.tsx` 里的编辑表单（关键词、近似称谓、样本、分组下拉）。

Props：
```ts
interface TopicEditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topic: TopicSummary | null; // null 时表示新建
  groups: string[];
}
```

表单字段：
- 主题名（required）
- 描述（optional）
- 分组（下拉，含"默认分组"和现有 groups + "+ 新建分组..."）
- 关键词列表（带"主关键词"标记）
- 样本列表

保存时调既有 `createTopic` / `updateTopic` action。

- [ ] **Step 2: 浏览器验证**

同上。

---

### Task 3.6: 构建 `topic-group-dialog.tsx`

**Files:**
- Create: `src/app/(dashboard)/data-collection/topics/topic-group-dialog.tsx`

- [ ] **Step 1: 写 Dialog**

用 `<Dialog>` 包裹一个简单输入框。Props：
```ts
interface TopicGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (groupName: string) => Promise<void>;
}
```

提交后会触发把当前选中主题（或选择中的主题集合）迁到新分组。简单做法：先只支持创建分组（不绑定主题），用户后续在主题编辑 drawer 里选分组。

- [ ] **Step 2: 浏览器验证**

同上。

---

### Task 3.7: 主从壳 `topics-client.tsx` + `page.tsx`

**Files:**
- Create: `src/app/(dashboard)/data-collection/topics/topics-client.tsx`
- Modify: `src/app/(dashboard)/data-collection/topics/page.tsx`（替换 Phase 1 占位）

- [ ] **Step 1: 写 page.tsx（server）**

```tsx
import { redirect } from "next/navigation";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { listResearchTopics, listTopicGroups } from "@/lib/dal/research/research-topics";
import { TopicsClient } from "./topics-client";

export default async function TopicsPage() {
  const ctx = await getCurrentUserAndOrg();
  if (!ctx) redirect("/login");
  const allowed = await hasPermission(
    ctx.userId, ctx.organizationId, PERMISSIONS.MENU_RESEARCH,
  );
  if (!allowed) redirect("/home");
  const [topics, groups] = await Promise.all([
    listResearchTopics(ctx.organizationId),
    listTopicGroups(ctx.organizationId),
  ]);
  return <TopicsClient topics={topics} groups={groups} />;
}
```

- [ ] **Step 2: 写 topics-client.tsx（主从壳）**

```tsx
"use client";
import { useState } from "react";
import { TopicSidebar } from "./topic-sidebar";
import { TopicDetailPanel } from "./topic-detail-panel";
import { TopicEditDrawer } from "./topic-edit-drawer";
import { TopicGroupDialog } from "./topic-group-dialog";
import type { TopicSummary } from "@/lib/dal/research/research-topics";

export function TopicsClient({ topics, groups }: { topics: TopicSummary[]; groups: string[] }) {
  const [selectedId, setSelectedId] = useState(topics[0]?.id ?? null);
  const [editingTopic, setEditingTopic] = useState<TopicSummary | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);

  const selected = topics.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="flex gap-4 h-[calc(100vh-200px)]">
      <TopicSidebar
        topics={topics}
        groups={groups}
        selectedTopicId={selectedId}
        onSelectTopic={setSelectedId}
        onOpenNewTopic={() => { setEditingTopic(null); setShowEdit(true); }}
        onOpenNewGroup={() => setShowNewGroup(true)}
      />
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <TopicDetailPanel topic={selected} />
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            从左侧选择一个主题查看命中结果，或点击「+ 创建方案」新建。
          </div>
        )}
      </div>
      <TopicEditDrawer
        open={showEdit}
        onOpenChange={setShowEdit}
        topic={editingTopic}
        groups={groups}
      />
      <TopicGroupDialog
        open={showNewGroup}
        onOpenChange={setShowNewGroup}
        onCreate={async (name) => {
          // 创建分组实际只是给某些主题改 groupName,这里可能弹二级流程
          // 简化:先关 dialog,让用户在新建/编辑主题时选这个分组
        }}
      />
    </div>
  );
}
```

- [ ] **Step 3: 类型检查 + 浏览器验证**

打开 `/data-collection/topics`：
- 左栏列出所有主题（按分组）
- 默认选中第一个主题
- 右栏显示该主题命中的卡片
- 「+ 创建方案」按钮打开 drawer

- [ ] **Step 4: Phase 3b commit（新 UI 完成）**

```bash
git add -A
git commit -m "feat(data-collection): Phase 3b 主题监测 主从布局 UI

新增主从布局组件:topic-sidebar / topic-detail-panel / topic-edit-drawer /
topic-group-dialog,以及 topics-client.tsx 主壳 + page.tsx server 端。
/data-collection/topics 可渲染,左栏分组主题列表 + 右栏选中主题命中结果。
旧 research 模块代码暂不删(Phase 3c 处理)。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3.8: 删除旧 research 文件 + 加 redirect

**Files:**
- Delete: `src/app/(dashboard)/research/topic-library-search.tsx`、`research/search-workbench-client.tsx`、`research/advanced-filters-sidebar.tsx`、`research/advanced-search-builder.tsx`、`research/search-mode-types.ts`、`research/admin/topics/topics-client.tsx`
- Modify: `src/app/(dashboard)/research/page.tsx`（改 redirect）
- Modify: `src/app/(dashboard)/research/admin/topics/page.tsx`（改 redirect）

- [ ] **Step 1: 改 `/research/page.tsx` 为 redirect**

```tsx
import { redirect } from "next/navigation";

interface ResearchPageProps {
  searchParams: Promise<{ mode?: string; tab?: string }>;
}

export default async function ResearchRedirect({ searchParams }: ResearchPageProps) {
  const { mode, tab } = await searchParams;
  if (mode === "topics" || tab === "topics") {
    redirect("/data-collection/topics");
  }
  redirect("/data-collection/content");
}
```

- [ ] **Step 2: 改 `/research/admin/topics/page.tsx` 为 redirect**

```tsx
import { redirect } from "next/navigation";
export default function ResearchAdminTopicsRedirect() {
  redirect("/data-collection/topics");
}
```

- [ ] **Step 3: 删除被替代的 client 组件**

```bash
git rm src/app/\(dashboard\)/research/topic-library-search.tsx \
       src/app/\(dashboard\)/research/search-workbench-client.tsx \
       src/app/\(dashboard\)/research/advanced-filters-sidebar.tsx \
       src/app/\(dashboard\)/research/advanced-search-builder.tsx \
       src/app/\(dashboard\)/research/search-mode-types.ts \
       src/app/\(dashboard\)/research/admin/topics/topics-client.tsx
```

- [ ] **Step 4: 类型检查 + build**

```bash
npx tsc --noEmit && npm run build
```

- [ ] **Step 5: 浏览器验证**

- `/research` → 跳到 `/data-collection/content`
- `/research?mode=topics` → 跳到 `/data-collection/topics`
- `/research/admin/topics` → 跳到 `/data-collection/topics`

- [ ] **Step 6: Phase 3c commit（删旧 + redirect）**

```bash
git add -A
git commit -m "feat(data-collection): Phase 3c 删除旧 research client + 加 redirect

删除被替代的 client 组件:
- research/topic-library-search.tsx
- research/search-workbench-client.tsx
- research/advanced-filters-sidebar.tsx
- research/advanced-search-builder.tsx
- research/search-mode-types.ts
- research/admin/topics/topics-client.tsx

/research/page.tsx 改 redirect(按 query 区分 topics tab vs default)。
/research/admin/topics/page.tsx 改 redirect 到 /data-collection/topics。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 4 · 采集池布局重排（图 1 风格）

**目标**：把 `/data-collection/content` 现有 filter 重排为图 1 那种"信息来源 chips 带计数 + 时间快捷段 + 媒体维度筛选行"布局。不引入新 DB 字段。

### Task 4.1: 拆 `filter-chips.tsx` 子组件

**Files:**
- Create: `src/app/(dashboard)/data-collection/content/filter-chips.tsx`

- [ ] **Step 1: 写 chips 组件**

```tsx
"use client";
import { cn } from "@/lib/utils";

export interface ChipOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterChipsProps {
  label: string;
  options: ChipOption[];
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  className?: string;
}

export function FilterChips({ label, options, value, onChange, className }: FilterChipsProps) {
  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(value === opt.value ? undefined : opt.value)}
          className={cn(
            "inline-flex items-center px-3 py-1 text-xs rounded-md transition-colors border-0",
            value === opt.value
              ? "bg-primary/15 text-primary font-medium"
              : "text-muted-foreground hover:bg-accent",
          )}
        >
          {opt.label}
          {opt.count !== undefined && (
            <span className="ml-1 text-[10px] opacity-60">({opt.count.toLocaleString()})</span>
          )}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit
```

---

### Task 4.2: 重排 `content-client.tsx` 顶部 filter 区

**Files:**
- Modify: `src/app/(dashboard)/data-collection/content/content-client.tsx`

- [ ] **Step 1: 在顶部插入 4 行筛选**

第 1 行：信息来源 chips（platform / firstSeenChannel 聚合，带计数）。计数来自 `loadCollectedItemsAction` 的扩展（或新增轻量 `countByChannelAction`）。

第 2 行：监测时间快捷段（今日 / 昨日 / 24h / 近 3 日 / 近 7 日 / 近 30 日 / 自定义）。

第 3 行：媒体维度（outletTier chips、outletRegion 下拉、category chips）。

第 4 行：关键词搜索框（`<SearchInput>`）+ `重置` + `查询` 按钮。

- [ ] **Step 2: 移除现有冗余 filter UI**

老的 `Select` / 自定义 chip 等去掉，统一用 `<FilterChips>` 和现有 shared primitives。

- [ ] **Step 3: chips 计数查询（server-side only）**

只走 server page (`content/page.tsx`)：用 Drizzle 一次性聚合查询，传 `channelCounts: Record<string, number>` 给 client。

参考代码：
```ts
const counts = await db
  .select({ ch: collectedItems.firstSeenChannel, n: sql<number>`count(*)::int` })
  .from(collectedItems)
  .where(eq(collectedItems.organizationId, orgId))
  .groupBy(collectedItems.firstSeenChannel);
const channelCounts: Record<string, number> = {};
for (const { ch, n } of counts) channelCounts[ch] = n;
```

**不要**在 client 端用 useEffect 拉一次 — 服务端 fetch + 静态 props 是单一来源。

- [ ] **Step 4: 浏览器验证**

`/data-collection/content` 顶部布局接近图 1。点 chip 切换 filter，结果区刷新。

- [ ] **Step 5: Phase 4 commit**

```bash
git add -A
git commit -m "feat(data-collection): Phase 4 采集池布局重排为图 1 风格

新增 filter-chips.tsx 子组件。
顶部 filter 区重排为 4 行(信息来源 chips+计数 / 监测时间 / 媒体维度 / 关键词)。
不引入新 DB 字段,仅使用现有 LoadCollectedItemsFilters。
chips 计数走 server page GROUP BY firstSeenChannel 一次性查询。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 5 · 采集配置 sub-tab

**目标**：在 `/sources` 和 `/outlets` 内部插 sub-tab，顶部一级 tab 合并显示"采集配置"。

### Task 5.1: 创建 `config-subtabs.tsx`

**Files:**
- Create: `src/app/(dashboard)/data-collection/config-subtabs.tsx`

- [ ] **Step 1: 写 sub-tab 组件**

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const SUB_TABS = [
  { href: "/data-collection/sources", label: "源管理" },
  { href: "/data-collection/outlets", label: "媒体字典" },
];

export function ConfigSubtabs() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-2 mb-4">
      {SUB_TABS.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href}
            className={cn(
              "px-3 py-1.5 text-sm rounded-md transition-colors border-0",
              active ? "bg-primary/10 text-primary font-medium"
                     : "text-muted-foreground hover:bg-accent",
            )}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: 类型检查**

---

### Task 5.2: 在 sources / outlets 页面顶部插入 sub-tab

**Files:**
- Modify: `src/app/(dashboard)/data-collection/sources/page.tsx`
- Modify: `src/app/(dashboard)/data-collection/outlets/page.tsx`

- [ ] **Step 1: 在两个 page 的 JSX 顶层插入 `<ConfigSubtabs />`**

例：
```tsx
return (
  <>
    <ConfigSubtabs />
    <SourcesClient ... />
  </>
);
```

- [ ] **Step 2: 浏览器验证**

进入 `/sources`：顶部一级 tab "采集配置"高亮，内部 sub-tab 显示，「源管理」高亮。点击「媒体字典」跳到 `/outlets`，顶部 tab 仍是「采集配置」，sub-tab「媒体字典」高亮。

- [ ] **Step 3: Phase 5 commit**

```bash
git add -A
git commit -m "feat(data-collection): Phase 5 采集配置 sub-tab

源管理 + 媒体字典 合并为一个一级 tab '采集配置',
内部用 sub-tab 切换,URL 保留 /sources 和 /outlets 不动。
新增 config-subtabs.tsx,在两个 page.tsx 顶部挂载。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 6 · 监控面板业务看板

**目标**：监控面板内部 sub-tab 「业务看板 / 采集运维」。业务看板用真实 collected_items 数据。

### Task 6.1: 新 DAL `monitoring-business.ts`

**Files:**
- Create: `src/lib/dal/monitoring-business.ts`

- [ ] **Step 1: 写聚合查询函数（用 Drizzle）**

3 个函数 + 一个共享 filter 类型。下面给一个完整的可拷贝实现示例（其余两个函数类比写）。

```ts
import { db } from "@/db";
import { collectedItems } from "@/db/schema/collection";
import { researchCollectedItemTopics } from "@/db/schema/research/annotations";
import { and, eq, gte, inArray, sql } from "drizzle-orm";

export interface BusinessFilters {
  topicIds?: string[];
  channels?: string[];
  since?: Date;
  until?: Date;
}

export interface BusinessSummary {
  postCount: { total: number; sensitive: number; nonSensitive: number; neutral: number };
  engagement: { total: number; likes: number; reposts: number; comments: number; favorites: number; views: number };
  influence: { authorCount: number; followerSum: number };
}

// 公共 where 构造,所有 3 个函数共用
function buildWhere(orgId: string, f: BusinessFilters) {
  const clauses = [eq(collectedItems.organizationId, orgId)];
  if (f.since) clauses.push(gte(collectedItems.firstSeenAt, f.since));
  if (f.until) clauses.push(sql`${collectedItems.firstSeenAt} <= ${f.until}`);
  if (f.channels?.length) clauses.push(inArray(collectedItems.firstSeenChannel, f.channels));
  return and(...clauses);
}

export async function getBusinessSummary(
  orgId: string, f: BusinessFilters,
): Promise<BusinessSummary> {
  // 主聚合 query
  let q = db.select({
    total: sql<number>`count(*)::int`,
    sensitive: sql<number>`count(*) FILTER (WHERE sentiment = 'sensitive')::int`,
    nonSensitive: sql<number>`count(*) FILTER (WHERE sentiment = 'non_sensitive')::int`,
    neutral: sql<number>`count(*) FILTER (WHERE sentiment = 'neutral')::int`,
    likes: sql<number>`coalesce(sum(like_count), 0)::int`,
    reposts: sql<number>`coalesce(sum(share_count), 0)::int`,
    comments: sql<number>`coalesce(sum(comment_count), 0)::int`,
    favorites: sql<number>`coalesce(sum(favorite_count), 0)::int`,
    views: sql<number>`coalesce(sum(view_count), 0)::int`,
    replies: sql<number>`coalesce(sum(reply_count), 0)::int`,
    authorCount: sql<number>`count(distinct author)::int`,
    followerSum: sql<number>`coalesce(sum(author_follower_count), 0)::int`,
  }).from(collectedItems).$dynamic();

  if (f.topicIds?.length) {
    q = q.innerJoin(
      researchCollectedItemTopics,
      eq(researchCollectedItemTopics.collectedItemId, collectedItems.id),
    ).where(and(buildWhere(orgId, f)!, inArray(researchCollectedItemTopics.topicId, f.topicIds)));
  } else {
    q = q.where(buildWhere(orgId, f)!);
  }

  const [r] = await q;
  return {
    postCount: { total: r.total, sensitive: r.sensitive, nonSensitive: r.nonSensitive, neutral: r.neutral },
    engagement: {
      total: r.likes + r.reposts + r.comments + r.favorites + r.views + r.replies,
      likes: r.likes, reposts: r.reposts, comments: r.comments,
      favorites: r.favorites, views: r.views,
    },
    influence: { authorCount: r.authorCount, followerSum: r.followerSum },
  };
}

export interface ChannelTrendPoint {
  ts: string; // ISO truncated to hour or day
  channel: string;
  count: number;
}

export async function getChannelTrend(
  orgId: string, f: BusinessFilters, granularity: "hour" | "day",
): Promise<ChannelTrendPoint[]> {
  const trunc = granularity === "hour" ? sql`date_trunc('hour', first_seen_at)` : sql`date_trunc('day', first_seen_at)`;
  const rows = await db.select({
    ts: sql<string>`${trunc}::text`,
    channel: collectedItems.firstSeenChannel,
    count: sql<number>`count(*)::int`,
  }).from(collectedItems)
    .where(buildWhere(orgId, f)!)
    .groupBy(trunc, collectedItems.firstSeenChannel)
    .orderBy(trunc);
  return rows;
}

export async function getRecentItems(
  orgId: string, f: BusinessFilters, limit: number,
) {
  return db.select().from(collectedItems)
    .where(buildWhere(orgId, f)!)
    .orderBy(sql`${collectedItems.firstSeenAt} desc`)
    .limit(limit);
}
```

> **Sentiment 字段值映射**：当前 `collected_items.sentiment` 是 `text` 自由列。若实际数据用 `positive/negative/neutral` 而非 `sensitive/non_sensitive/neutral`，需调整 FILTER 子句。执行前抽样查一下：`SELECT distinct sentiment FROM collected_items LIMIT 5;`

- [ ] **Step 2: 类型检查**

---

### Task 6.2: 业务看板组件 `business-dashboard.tsx`

**Files:**
- Create: `src/app/(dashboard)/data-collection/monitoring/business-dashboard.tsx`

- [ ] **Step 1: 写组件**

约 300 行客户端组件。布局：
- 顶部 filter 行（主题方案多选 + 信息来源 chips + 监测时间）
- 三个指标卡（用 GlassCard 包裹）
- 信息来源走势折线图（Recharts `<LineChart>`）
- 右侧最近信息卡片列表

- [ ] **Step 2: 浏览器验证**

`/data-collection/monitoring?tab=business`（或类似）显示业务看板，能看到真实数据。

---

### Task 6.3: 拆 operations-panel + 重写 monitoring-client 为 sub-tab 壳

**Files:**
- Create: `src/app/(dashboard)/data-collection/monitoring/operations-panel.tsx`
- Modify: `src/app/(dashboard)/data-collection/monitoring/monitoring-client.tsx`
- Modify: `src/app/(dashboard)/data-collection/monitoring/page.tsx`

- [ ] **Step 1: 把现有 monitoring-client 内容搬到 operations-panel.tsx**

整体复制现有组件内容到新文件，rename 组件为 `OperationsPanel`，props 不变。

- [ ] **Step 2: 重写 monitoring-client 为 sub-tab 壳**

```tsx
"use client";
import { useState } from "react";
import { OperationsPanel } from "./operations-panel";
import { BusinessDashboard } from "./business-dashboard";

export function MonitoringClient({ /* 所有 props */ }) {
  const [tab, setTab] = useState<"business" | "ops">("business");
  return (
    <div>
      <nav className="flex gap-2 mb-4">
        <button onClick={() => setTab("business")} className={tabBtnCls(tab === "business")}>业务看板</button>
        <button onClick={() => setTab("ops")} className={tabBtnCls(tab === "ops")}>采集运维</button>
      </nav>
      {tab === "business" ? <BusinessDashboard ... /> : <OperationsPanel ... />}
    </div>
  );
}
```

按钮**不带边框**。

- [ ] **Step 3: page.tsx 加载两个 sub-tab 各自所需的数据**

server-side 一次性 `Promise.all` 拉运维 summary + 业务 summary，分别传给 client。

- [ ] **Step 4: 浏览器验证**

`/data-collection/monitoring`：默认显示业务看板。切到「采集运维」显示原来的成功率/错误源/成本看板。

- [ ] **Step 5: Phase 6 commit**

```bash
git add -A
git commit -m "feat(data-collection): Phase 6 监控面板 sub-tab 业务看板

新增 src/lib/dal/monitoring-business.ts(3 个聚合查询)。
拆 monitoring-client.tsx 为 sub-tab 壳:
- operations-panel(原内容)
- business-dashboard(新建,3 指标卡+走势图+列表)
业务看板全部指标用 collected_items 真实字段计算,不引入新 schema。
主题/方案过滤走 research_collected_item_topics 桥接表。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 7 · 清理 + 收尾

**目标**：删除 `/research/*` 残留代码（除 redirect 薄壳），处理 RBAC，跑最终验证。

### Task 7.1: 改 `/research/reports/*` 为 redirect

**Files:**
- Modify: `src/app/(dashboard)/research/reports/page.tsx`
- Modify: `src/app/(dashboard)/research/reports/[id]/page.tsx`

- [ ] **Step 1: 改成 redirect**

`/research/reports/page.tsx`：
```tsx
import { redirect } from "next/navigation";
export default function ResearchReportsRedirect() {
  redirect("/data-collection/reports");
}
```

`/research/reports/[id]/page.tsx`：
```tsx
import { redirect } from "next/navigation";
export default async function ResearchReportDetailRedirect({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/data-collection/reports/${id}`);
}
```

- [ ] **Step 2: 浏览器验证**

`/research/reports/<some-id>` 应 302 跳到 `/data-collection/reports/<some-id>`。

---

### Task 7.2: 清理 `MENU_RESEARCH` permission 映射

**Files:**
- Modify: `src/lib/rbac-constants.ts`

**注意：** 当前 `/data-collection` 没有 permission 映射（即对所有人可见）。本次重构**不**新增 `MENU_DATA_COLLECTION` permission（避免给已登录用户引入权限墙）。仅清理 `/research` 相关的 PERMISSION_MAP 条目。

- [ ] **Step 1: 删除 `/research` 映射条目**

把：
```ts
"/research": PERMISSIONS.MENU_RESEARCH,
"/research/admin/topics": PERMISSIONS.RESEARCH_TOPIC_MANAGE,
```
删掉。

- [ ] **Step 2: 给 `MENU_RESEARCH` 加 deprecated 注释**

```ts
/** @deprecated 2026-05-18 — /research 路径已迁到 /data-collection/*,此 permission 不再生效。
 * 保留常量避免破坏老的 role_permissions 行。下个 release 可彻底删除 + DB cleanup. */
MENU_RESEARCH: "menu:research",
```

- [ ] **Step 3: 删除 PERMISSIONS_CONFIG label**（如有，第 255 行附近）

```ts
{ key: PERMISSIONS.MENU_RESEARCH, label: "查看新闻研究模块" },
```
删掉。

- [ ] **Step 4: 类型检查 + 浏览器验证**

确保 build 通过。模拟一个之前依赖 MENU_RESEARCH 的角色登录，能访问 `/data-collection/topics`。

---

### Task 7.3: 清理 `/research` 残留目录

**Files:**
- Modify: `src/app/(dashboard)/research/page.tsx`（已在 Phase 3 改成 redirect，确认存在）
- Delete: `src/app/(dashboard)/research/layout.tsx`（如内容为空）
- Modify: `src/app/(dashboard)/research/admin/topics/page.tsx`（Phase 3 已改 redirect）

- [ ] **Step 1: 检查 layout.tsx 是否仍有用**

```bash
cat src/app/\(dashboard\)/research/layout.tsx
```

如果内容只是 `<>{children}</>` 这种 passthrough，删除：
```bash
git rm src/app/\(dashboard\)/research/layout.tsx
```

- [ ] **Step 2: 确认所有 /research/* 路径都返回 redirect**

```bash
for p in /research /research/admin/topics /research/reports /research/reports/123; do
  curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "http://localhost:3000$p"
done
```
Expected: 全部 307 or 308，redirect_url 指向 `/data-collection/*`。

---

### Task 7.4: 最终验证 + Phase 7 commit

- [ ] **Step 1: 全量测试**

```bash
npm test
```
Expected: 全部 pass。

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 生产 build**

```bash
npm run build
```

- [ ] **Step 4: 浏览器烟测**

依次访问下面路径，验证行为：

| 路径 | 期望 |
|---|---|
| `/data-collection/content` | 采集池新布局,5 个一级 tab |
| `/data-collection/sources` | 采集配置 tab 高亮,sub-tab「源管理」 |
| `/data-collection/outlets` | 同上 sub-tab「媒体字典」 |
| `/data-collection/topics` | 主从布局,左主题列表右命中 |
| `/data-collection/reports` | 报告列表 |
| `/data-collection/reports/[id]` | 报告详情,面包屑指向 `/data-collection/reports` |
| `/data-collection/monitoring` | 业务看板默认显示,sub-tab 可切到运维 |
| `/research` | redirect → `/data-collection/content` |
| `/research?mode=topics` | redirect → `/data-collection/topics` |
| `/research/admin/topics` | redirect → `/data-collection/topics` |
| `/research/reports` | redirect → `/data-collection/reports` |
| `/research/reports/<id>` | redirect → `/data-collection/reports/<id>` |

- [ ] **Step 5: Phase 7 commit**

```bash
git add -A
git commit -m "feat(data-collection): Phase 7 清理 — /research/* redirect + RBAC

把 /research/reports + /research/reports/[id] 改为 redirect 薄壳。
删除 src/app/(dashboard)/research/layout.tsx(若空)。
从 MENU_PERMISSION_MAP 删除 /research 与 /research/admin/topics 条目。
MENU_RESEARCH 常量保留并标 @deprecated,不做侵入式 db migration
(避免给已登录用户引入新权限墙,/data-collection 当前默认对所有人可见)。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## 总验收 Checklist（每个 Phase 收尾 + 最终）

每个 Phase commit 前：
- [ ] `npx tsc --noEmit` 零错误
- [ ] `npm run build` 通过
- [ ] dev server 启动正常，对应路径浏览器烟测
- [ ] commit 信息中文，包含「为什么」（不仅是「做了什么」）

最终（Phase 7 之后）：
- [ ] 全部测试 `npm test` 通过
- [ ] 7 个 commit 各自可独立 build（用 `git log --oneline` + 抽查一两个 commit 跑 build 验证）
- [ ] 所有旧 URL 都 redirect 到新路径
- [ ] 已绑定 MENU_RESEARCH 的角色登录后仍能访问采集相关页面（因 `/data-collection/*` 默认无权限墙）

---

## 风险与回滚

| 风险 | 缓解 |
|---|---|
| Phase 3 主从布局拆组件丢功能 | 在 Phase 3 第一步先列出 `topics-client.tsx`(647) + `topic-library-search.tsx`(417) 所有功能 checklist,逐项搬完打勾才进 commit |
| `research_topics.group_name` migration 失败 | migration 用 `IF NOT EXISTS` 幂等;失败时回滚为 `ALTER TABLE research_topics DROP COLUMN IF EXISTS group_name` |
| chips 计数查询慢 | 用已有索引 `collected_items_org_first_seen_idx` + `collected_items_org_platform_idx`,SQL 单 `GROUP BY firstSeenChannel`;如慢则改为前端 lazy fetch |
| Phase 7 删 MENU_RESEARCH 后旧 role 报错 | 不删 PERMISSIONS 常量,只删 PERMISSION_MAP 条目,常量保留供 db 老行兼容 |
| 浏览器烟测发现 redirect 丢 query | redirect 用 `redirect(url)` 时手动透传 query string(`new URL(...).search`) |
| Phase 2 物理 mv 后 Link 漏改 | Phase 2 Task 2.2 收尾必须 `grep -rn "/research/reports" src/` 确认零残留 |

Phase 失败回滚：每个 Phase 单独 commit，回滚就是 `git revert <phase-commit-hash>`。Phase 3 含 schema migration 的特殊处理：先 revert 代码 commit，再手动跑反向 SQL 删字段。
