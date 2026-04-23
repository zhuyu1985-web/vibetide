# 首页工作流模版 拖拽排序 + 置顶 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让管理员在首页 9 个共享 tab（featured + 8 员工）里对 workflow 模版卡拖拽重排 / 置顶；普通用户只看结果；`custom` tab 保持原样。

**Architecture:** 新建 `workflow_template_tab_order` 表存 per-tab 的 pin/sort；DAL 用 `LEFT JOIN` + `pinned_at DESC / sort_order ASC` 排序；3 个 server actions（admin-gated）写入；UI 用已有的 `framer-motion` `Reorder.Group`，管理员点"整理顺序"进入单列编辑态拖拽。置顶视觉全部 Lucide 图标 + sky 色系，无 emoji。

**Tech Stack:** Next.js 16 App Router + React 19、Drizzle ORM 0.45（postgres-js driver）、Supabase Auth、shadcn/ui + Tailwind v4、framer-motion v12（Reorder.Group / Reorder.Item）、vitest。

**Spec:** `docs/superpowers/specs/2026-04-24-homepage-template-drag-pin-design.md`

---

## 文件清单总览

| # | 文件 | 动作 | 职责 |
|---|---|---|---|
| 1 | `src/db/schema/workflows.ts` | 修改 | 新增 `workflowTemplateTabOrder` 表定义 + 2 个 index |
| 2 | `supabase/migrations/<ts>_add_homepage_template_order.sql` | 新建（`db:generate` 产出） | DDL |
| 3 | `src/db/schema/index.ts` | 修改 | 导出新表（若该文件是统一 re-export 口） |
| 4 | `src/lib/dal/workflow-templates-listing.ts` | 修改 | `listTemplatesForHomepageByTab` 加 LEFT JOIN + 新 ORDER BY（仅 9 共享 tab） |
| 5 | `src/lib/dal/__tests__/workflow-templates-listing.test.ts` | 修改 | 为新排序逻辑加单测 |
| 6 | `src/app/actions/homepage-template-order.ts` | 新建 | 3 个 server actions + admin guard + tab 白名单 |
| 7 | `src/app/actions/__tests__/homepage-template-order.test.ts` | 新建 | action 权限 / tab 白名单 / 事务竞态单测 |
| 8 | `src/app/(dashboard)/home/page.tsx` | 修改 | 查 role，算 `canManageHomepage`，透传 |
| 9 | `src/app/(dashboard)/home/home-client.tsx` | 修改 | 透传 `canManageHomepage` 到 `<ScenarioGrid>` |
| 10 | `src/components/home/scenario-grid.tsx` | 修改 | 编辑态、`Reorder.Group`、Pin/Unpin、拖拽手柄、乐观更新、置顶视觉 |

---

## Task 1: Schema & Migration

**Files:**
- Modify: `src/db/schema/workflows.ts` (end of file，追加新表定义)
- Create (via `db:generate`): `supabase/migrations/<ts>_add_homepage_template_order.sql`

- [ ] **Step 1: 加新表定义到 `src/db/schema/workflows.ts` 末尾（紧接 `workflowTemplates` 之后，在 `workflowArtifacts` 之前或末尾——选最后，避免顶部 import 顺序变动）**

```typescript
// ─── Homepage Template Tab Order (per-tab drag / pin state for /home) ───

export const workflowTemplateTabOrder = pgTable(
  "workflow_template_tab_order",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // tab_key: "featured" | EmployeeId (xiaolei|xiaoce|xiaozi|xiaowen|xiaojian|xiaoshen|xiaofa|xiaoshu)
    // 不用 enum：保持字符串 + 应用层 guard，避免 enum 迁移扰动。
    tabKey: text("tab_key").notNull(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => workflowTemplates.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    pinnedAt: timestamp("pinned_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // (org_id, tab_key, template_id) 唯一 — upsert conflict target
    orgTabTemplateUidx: uniqueIndex(
      "workflow_template_tab_order_org_tab_template_uidx",
    ).on(table.organizationId, table.tabKey, table.templateId),
    // 读路径热点：按 org + tab 取一批，已经 pinned_at DESC / sort_order ASC 排序
    orgTabOrderIdx: index("idx_homepage_order_org_tab").on(
      table.organizationId,
      table.tabKey,
    ),
  }),
);
```

> 注意：`pgTable` 不用 `notNull()` 给 `pinnedAt`，保留 nullable 是语义必须的。

- [ ] **Step 2: 检查 `src/db/schema/index.ts`（若存在）是否需要 re-export**

Run: `grep -n workflowTemplates /Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/index.ts 2>/dev/null || echo 'no index.ts re-export'`

如输出含 `workflowTemplates`，则在同文件追加 `export { workflowTemplateTabOrder } from "./workflows";`（或 barrel re-export 风格）；如 "no index.ts re-export" 则跳过。

- [ ] **Step 3: 生成迁移 SQL**

Run: `npm run db:generate`

Expected: 在 `supabase/migrations/` 下新增一个 `<timestamp>_<autoname>.sql`，内容应含：
- `CREATE TABLE "workflow_template_tab_order"`
- `ALTER TABLE ... REFERENCES "organizations"(...) ON DELETE CASCADE`
- `ALTER TABLE ... REFERENCES "workflow_templates"(...) ON DELETE CASCADE`
- `CREATE UNIQUE INDEX "workflow_template_tab_order_org_tab_template_uidx"`
- `CREATE INDEX "idx_homepage_order_org_tab"`

若迁移器没有生成 CASCADE，**手动编辑 SQL 补齐 `ON DELETE CASCADE`**（Drizzle 对 FK 选项的 codegen 有时缺失，需人眼复核）。

- [ ] **Step 4: 推库**

Run: `npm run db:push`

Expected: 无错误；psql 进 supabase 验证 `\d workflow_template_tab_order` 能看到表和 2 个 index。

- [ ] **Step 5: 类型检查**

Run: `npx tsc --noEmit`

Expected: PASS。`workflowTemplateTabOrder` 被 Drizzle 自动推导出 `InferSelectModel` / `InferInsertModel` 类型（若项目的 `src/db/types.ts` 里枚举导出，需加一行——先检查 `grep workflowTemplates src/db/types.ts`，按现有风格补）。

- [ ] **Step 6: Commit**

```bash
git add src/db/schema/workflows.ts src/db/types.ts src/db/schema/index.ts supabase/migrations/
git commit -m "$(cat <<'EOF'
feat(db): 新增 workflow_template_tab_order 表

首页工作流模版拖拽排序 + 置顶：per-tab 存 sort_order / pinned_at，
(org, tab, template) 唯一；FK 走 ON DELETE CASCADE。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: DAL —— 读路径排序

**Files:**
- Modify: `src/lib/dal/workflow-templates-listing.ts:164-208`（`listTemplatesForHomepageByTab`）
- Test: `src/lib/dal/__tests__/workflow-templates-listing.test.ts`（追加 describe 块）

### 背景

当前 DAL 仅 `orderBy(asc(workflowTemplates.createdAt))`。改动：仅 9 个共享 tab 走新 ORDER BY（LEFT JOIN 新表），`custom` tab 不变。

- [ ] **Step 1: 先写失败的单测**

在 `src/lib/dal/__tests__/workflow-templates-listing.test.ts` 末尾追加：

```typescript
import { workflowTemplateTabOrder, workflowTemplates } from "@/db/schema/workflows";

// 需要 mock db —— 项目已有 vitest，但 listTemplatesForHomepageByTab 直接打真库。
// 先确认现有 test 是怎么 mock 的：若 pure function pickDefaultHotTopicTemplate 是
// 纯函数测试（看到的就是这样），则 listTemplatesForHomepageByTab 的排序逻辑
// 我们通过「抽取纯函数」来测试，而不是 mock db。

// 抽取一个 sortTemplatesForHomepageTab 纯函数，见 Step 2。

describe("sortTemplatesForHomepageTab", () => {
  const mkOrder = (p: Partial<{ pinnedAt: Date | null; sortOrder: number }>) => ({
    pinnedAt: p.pinnedAt ?? null,
    sortOrder: p.sortOrder ?? 0,
  });

  it("置顶区（pinned_at DESC）排在非置顶区（sort_order ASC）前", () => {
    const rows = [
      {
        tpl: mk({ id: "a" }),
        order: mkOrder({ sortOrder: 0 }), // 非置顶，靠前
      },
      {
        tpl: mk({ id: "b" }),
        order: mkOrder({
          pinnedAt: new Date("2026-04-01"),
          sortOrder: 999,
        }), // 置顶，较早
      },
      {
        tpl: mk({ id: "c" }),
        order: mkOrder({
          pinnedAt: new Date("2026-04-20"),
        }), // 置顶，较晚 → 应在最顶
      },
      {
        tpl: mk({ id: "d" }),
        order: null, // 未入表，视为非置顶 + sort_order 无限大 → 落到最后
      },
    ];
    const sorted = sortTemplatesForHomepageTab(rows);
    expect(sorted.map((r) => r.tpl.id)).toEqual(["c", "b", "a", "d"]);
  });

  it("未入表的行按 createdAt ASC 兜底", () => {
    const rows = [
      {
        tpl: mk({ id: "new2", createdAt: new Date("2026-04-20") }),
        order: null,
      },
      {
        tpl: mk({ id: "new1", createdAt: new Date("2026-04-10") }),
        order: null,
      },
    ];
    const sorted = sortTemplatesForHomepageTab(rows);
    expect(sorted.map((r) => r.tpl.id)).toEqual(["new1", "new2"]);
  });

  it("非置顶区内，sort_order 相同则 createdAt ASC 兜底", () => {
    const rows = [
      {
        tpl: mk({ id: "x", createdAt: new Date("2026-04-20") }),
        order: mkOrder({ sortOrder: 10 }),
      },
      {
        tpl: mk({ id: "y", createdAt: new Date("2026-04-10") }),
        order: mkOrder({ sortOrder: 10 }),
      },
    ];
    const sorted = sortTemplatesForHomepageTab(rows);
    expect(sorted.map((r) => r.tpl.id)).toEqual(["y", "x"]);
  });
});
```

同时在测试文件顶部 import：

```typescript
import {
  sortTemplatesForHomepageTab,
} from "@/lib/dal/workflow-templates-listing";
```

- [ ] **Step 2: 运行测试确认它失败**

Run: `npx vitest run src/lib/dal/__tests__/workflow-templates-listing.test.ts`

Expected: FAIL，`sortTemplatesForHomepageTab` 未定义。

- [ ] **Step 3: 改 DAL —— 抽纯函数 + LEFT JOIN 查询**

打开 `src/lib/dal/workflow-templates-listing.ts`，在文件末尾新增导出：

```typescript
import { workflowTemplateTabOrder } from "@/db/schema/workflows";
import { desc, sql as sqlRaw } from "drizzle-orm"; // 补充 desc / sql 的 import

export type TemplateWithOrder = {
  tpl: WorkflowTemplateRow;
  order: {
    pinnedAt: Date | null;
    sortOrder: number;
  } | null;
};

/**
 * 纯排序函数 —— 输入带 order 元数据的模板行，按首页 tab 排序规则排好序输出。
 *
 * 规则：
 *   1. 置顶区（order.pinnedAt 非 null）优先
 *   2. 置顶区内：pinnedAt DESC（最近置顶的在顶）
 *   3. 非置顶区：sortOrder ASC
 *   4. 未入 order 表（order === null）视为 sortOrder = +∞，落到非置顶区末尾
 *   5. 所有前序相同 → createdAt ASC 兜底
 */
export function sortTemplatesForHomepageTab(
  rows: TemplateWithOrder[],
): TemplateWithOrder[] {
  const isPinned = (r: TemplateWithOrder) => r.order?.pinnedAt != null;
  const SENTINEL = Number.POSITIVE_INFINITY;
  const effectiveSort = (r: TemplateWithOrder) =>
    r.order?.pinnedAt != null
      ? -Number.MAX_SAFE_INTEGER // 置顶区不参与 sort_order 比较
      : r.order?.sortOrder ?? SENTINEL;

  return [...rows].sort((a, b) => {
    const ap = isPinned(a);
    const bp = isPinned(b);
    if (ap !== bp) return ap ? -1 : 1;
    if (ap && bp) {
      // 两者都置顶，按 pinnedAt DESC
      const at = a.order!.pinnedAt!.getTime();
      const bt = b.order!.pinnedAt!.getTime();
      if (at !== bt) return bt - at;
    } else {
      // 两者都非置顶，按 sortOrder ASC（null → +∞）
      const av = effectiveSort(a);
      const bv = effectiveSort(b);
      if (av !== bv) return av - bv;
    }
    // 兜底：createdAt ASC
    return (
      new Date(a.tpl.createdAt).getTime() -
      new Date(b.tpl.createdAt).getTime()
    );
  });
}
```

然后改 `listTemplatesForHomepageByTab`：在 `if (tab === "custom")` 分支完全不动；其他 9 个 tab 分支，将原来

```typescript
const rows = await db
  .select()
  .from(workflowTemplates)
  .where(and(...conds))
  .orderBy(asc(workflowTemplates.createdAt));
return rows as WorkflowTemplateRow[];
```

改为：

```typescript
if (tab === "custom") {
  // custom tab 不走新排序
  const rows = await db
    .select()
    .from(workflowTemplates)
    .where(and(...conds))
    .orderBy(asc(workflowTemplates.createdAt));
  return rows as WorkflowTemplateRow[];
}

// 9 个共享 tab：LEFT JOIN 顺序表
const joinedRows = await db
  .select({
    tpl: workflowTemplates,
    orderPinnedAt: workflowTemplateTabOrder.pinnedAt,
    orderSortOrder: workflowTemplateTabOrder.sortOrder,
  })
  .from(workflowTemplates)
  .leftJoin(
    workflowTemplateTabOrder,
    and(
      eq(workflowTemplateTabOrder.templateId, workflowTemplates.id),
      eq(workflowTemplateTabOrder.organizationId, orgId),
      eq(workflowTemplateTabOrder.tabKey, tab),
    ),
  )
  .where(and(...conds));

const withOrder: TemplateWithOrder[] = joinedRows.map((r) => ({
  tpl: r.tpl as WorkflowTemplateRow,
  order:
    r.orderPinnedAt == null && r.orderSortOrder == null
      ? null
      : {
          pinnedAt: r.orderPinnedAt,
          sortOrder: r.orderSortOrder ?? 0,
        },
}));

return sortTemplatesForHomepageTab(withOrder).map((r) => r.tpl);
```

> **为什么在应用层排序而不是在 SQL 里 ORDER BY？** 因为需要「null-sortOrder 当作 +∞」的语义，在 SQL 里要用 `NULLS LAST`（PostgreSQL 支持）；LEFT JOIN 下，`pinned_at IS NULL AND sort_order IS NULL` 表示未入表，我们要把它和"入表但 pinned_at=NULL"行为一致对待（都走非置顶区排序）。SQL 侧 `ORDER BY (pinned_at IS NULL) ASC, pinned_at DESC, sort_order ASC NULLS LAST, created_at ASC` 也可做到，但应用层排序更易测也更易读；结果集典型 <30 行，性能不是瓶颈。

如确实倾向 SQL 排序，可直接在 `.orderBy()` 里表达（两种写法等价，但 SQL 方案不需要 `sortTemplatesForHomepageTab` 导出，对应单测改为覆盖 DAL 整体行为，做成集成测）。**本计划采用"应用层 + 纯函数"路线，收益是可测性**。

- [ ] **Step 4: 运行单测确认通过**

Run: `npx vitest run src/lib/dal/__tests__/workflow-templates-listing.test.ts`

Expected: 全部 PASS（原有测试不变 + 3 个新测试）。

- [ ] **Step 5: 类型检查**

Run: `npx tsc --noEmit`

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add src/lib/dal/workflow-templates-listing.ts src/lib/dal/__tests__/workflow-templates-listing.test.ts
git commit -m "$(cat <<'EOF'
feat(dal): listTemplatesForHomepageByTab 支持 per-tab 置顶+排序

- 9 个共享 tab LEFT JOIN workflow_template_tab_order，按 pinned_at DESC + sort_order ASC 排
- 抽纯函数 sortTemplatesForHomepageTab 单独可测
- custom tab 保持 created_at ASC 不变

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Server Actions —— 写路径

**Files:**
- Create: `src/app/actions/homepage-template-order.ts`
- Test: `src/app/actions/__tests__/homepage-template-order.test.ts`

### 背景

3 个 actions（`pinHomepageTemplate` / `unpinHomepageTemplate` / `reorderHomepageTemplates`），全部 admin-gated + tab 白名单 + 事务。

- [ ] **Step 1: 先写失败的单测**（测纯函数 guard，不打真库）

`src/app/actions/__tests__/homepage-template-order.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import {
  ALLOWED_TAB_KEYS,
  isAllowedTabKey,
  SHARED_HOMEPAGE_ACTION_ERROR,
} from "@/app/actions/homepage-template-order";

describe("isAllowedTabKey", () => {
  it("包含 featured + 8 员工 slug", () => {
    expect(ALLOWED_TAB_KEYS).toEqual([
      "featured",
      "xiaolei",
      "xiaoce",
      "xiaozi",
      "xiaowen",
      "xiaojian",
      "xiaoshen",
      "xiaofa",
      "xiaoshu",
    ]);
  });

  it("custom 不在白名单", () => {
    expect(isAllowedTabKey("custom")).toBe(false);
  });

  it("任意其他字符串不在白名单", () => {
    expect(isAllowedTabKey("xiaoming")).toBe(false);
    expect(isAllowedTabKey("")).toBe(false);
  });

  it("9 个合法 tab 返回 true", () => {
    for (const t of ALLOWED_TAB_KEYS) {
      expect(isAllowedTabKey(t)).toBe(true);
    }
  });
});

describe("SHARED_HOMEPAGE_ACTION_ERROR", () => {
  it("暴露 403/400/409 三种错误 code", () => {
    expect(SHARED_HOMEPAGE_ACTION_ERROR.FORBIDDEN).toBe("FORBIDDEN");
    expect(SHARED_HOMEPAGE_ACTION_ERROR.INVALID_TAB).toBe("INVALID_TAB");
    expect(SHARED_HOMEPAGE_ACTION_ERROR.CONFLICT).toBe("CONFLICT");
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/app/actions/__tests__/homepage-template-order.test.ts`

Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 action 文件**

`src/app/actions/homepage-template-order.ts`：

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, max, sql } from "drizzle-orm";
import { db } from "@/db";
import { workflowTemplateTabOrder, workflowTemplates } from "@/db/schema/workflows";
import { getCurrentUserProfile } from "@/lib/dal/auth";

// ─── 共享常量 / 工具 ───────────────────────────────────────────────────

export const ALLOWED_TAB_KEYS = [
  "featured",
  "xiaolei",
  "xiaoce",
  "xiaozi",
  "xiaowen",
  "xiaojian",
  "xiaoshen",
  "xiaofa",
  "xiaoshu",
] as const;

export type AllowedTabKey = (typeof ALLOWED_TAB_KEYS)[number];

export function isAllowedTabKey(key: string): key is AllowedTabKey {
  return (ALLOWED_TAB_KEYS as readonly string[]).includes(key);
}

export const SHARED_HOMEPAGE_ACTION_ERROR = {
  FORBIDDEN: "FORBIDDEN",
  INVALID_TAB: "INVALID_TAB",
  CONFLICT: "CONFLICT",
} as const;

export type HomepageActionResult =
  | { ok: true }
  | { ok: false; error: keyof typeof SHARED_HOMEPAGE_ACTION_ERROR; message?: string };

async function requireAdminContext(): Promise<
  | { ok: true; userId: string; organizationId: string }
  | { ok: false; error: "FORBIDDEN" }
> {
  const ctx = await getCurrentUserProfile();
  if (!ctx) return { ok: false, error: "FORBIDDEN" };
  if (ctx.isSuperAdmin || ctx.role === "admin" || ctx.role === "owner") {
    return {
      ok: true,
      userId: ctx.userId,
      organizationId: ctx.organizationId,
    };
  }
  return { ok: false, error: "FORBIDDEN" };
}

// ─── 3 个 Actions ─────────────────────────────────────────────────────

export async function pinHomepageTemplate(input: {
  tab: string;
  templateId: string;
}): Promise<HomepageActionResult> {
  const { tab, templateId } = input;
  if (!isAllowedTabKey(tab)) {
    return { ok: false, error: "INVALID_TAB" };
  }
  const auth = await requireAdminContext();
  if (!auth.ok) return { ok: false, error: "FORBIDDEN" };

  // 确认模板属于该 org（防越权）
  const tpl = await db
    .select({ id: workflowTemplates.id })
    .from(workflowTemplates)
    .where(
      and(
        eq(workflowTemplates.id, templateId),
        eq(workflowTemplates.organizationId, auth.organizationId),
      ),
    )
    .limit(1);
  if (tpl.length === 0) {
    return { ok: false, error: "FORBIDDEN" };
  }

  await db
    .insert(workflowTemplateTabOrder)
    .values({
      organizationId: auth.organizationId,
      tabKey: tab,
      templateId,
      pinnedAt: new Date(),
      sortOrder: 0,
    })
    .onConflictDoUpdate({
      target: [
        workflowTemplateTabOrder.organizationId,
        workflowTemplateTabOrder.tabKey,
        workflowTemplateTabOrder.templateId,
      ],
      set: {
        pinnedAt: new Date(),
        sortOrder: 0,
        updatedAt: new Date(),
      },
    });

  revalidatePath("/home");
  return { ok: true };
}

export async function unpinHomepageTemplate(input: {
  tab: string;
  templateId: string;
}): Promise<HomepageActionResult> {
  const { tab, templateId } = input;
  if (!isAllowedTabKey(tab)) {
    return { ok: false, error: "INVALID_TAB" };
  }
  const auth = await requireAdminContext();
  if (!auth.ok) return { ok: false, error: "FORBIDDEN" };

  const tpl = await db
    .select({ id: workflowTemplates.id })
    .from(workflowTemplates)
    .where(
      and(
        eq(workflowTemplates.id, templateId),
        eq(workflowTemplates.organizationId, auth.organizationId),
      ),
    )
    .limit(1);
  if (tpl.length === 0) return { ok: false, error: "FORBIDDEN" };

  await db.transaction(async (tx) => {
    // 非置顶区当前最大 sort_order
    const rows = await tx
      .select({ m: max(workflowTemplateTabOrder.sortOrder) })
      .from(workflowTemplateTabOrder)
      .where(
        and(
          eq(workflowTemplateTabOrder.organizationId, auth.organizationId),
          eq(workflowTemplateTabOrder.tabKey, tab),
          sql`${workflowTemplateTabOrder.pinnedAt} IS NULL`,
        ),
      );
    const nextSort = (rows[0]?.m ?? 0) + 10;

    await tx
      .insert(workflowTemplateTabOrder)
      .values({
        organizationId: auth.organizationId,
        tabKey: tab,
        templateId,
        pinnedAt: null,
        sortOrder: nextSort,
      })
      .onConflictDoUpdate({
        target: [
          workflowTemplateTabOrder.organizationId,
          workflowTemplateTabOrder.tabKey,
          workflowTemplateTabOrder.templateId,
        ],
        set: {
          pinnedAt: null,
          sortOrder: nextSort,
          updatedAt: new Date(),
        },
      });
  });

  revalidatePath("/home");
  return { ok: true };
}

export async function reorderHomepageTemplates(input: {
  tab: string;
  orderedUnpinnedIds: string[];
}): Promise<HomepageActionResult> {
  const { tab, orderedUnpinnedIds } = input;
  if (!isAllowedTabKey(tab)) {
    return { ok: false, error: "INVALID_TAB" };
  }
  const auth = await requireAdminContext();
  if (!auth.ok) return { ok: false, error: "FORBIDDEN" };

  if (orderedUnpinnedIds.length === 0) {
    return { ok: true }; // 空列表合法（无非置顶卡可排）
  }

  // 预校验：所有 id 都在该 org 下
  const tpls = await db
    .select({ id: workflowTemplates.id })
    .from(workflowTemplates)
    .where(
      and(
        inArray(workflowTemplates.id, orderedUnpinnedIds),
        eq(workflowTemplates.organizationId, auth.organizationId),
      ),
    );
  if (tpls.length !== orderedUnpinnedIds.length) {
    return { ok: false, error: "FORBIDDEN" };
  }

  try {
    await db.transaction(async (tx) => {
      // 事务内二次校验：这批 id 当前都不是置顶（与 spec §5.3 Step 2 对齐）
      const currentPinned = await tx
        .select({ templateId: workflowTemplateTabOrder.templateId })
        .from(workflowTemplateTabOrder)
        .where(
          and(
            eq(workflowTemplateTabOrder.organizationId, auth.organizationId),
            eq(workflowTemplateTabOrder.tabKey, tab),
            inArray(workflowTemplateTabOrder.templateId, orderedUnpinnedIds),
            sql`${workflowTemplateTabOrder.pinnedAt} IS NOT NULL`,
          ),
        );
      if (currentPinned.length > 0) {
        throw new Error("CONFLICT");
      }

      // 依序 upsert
      for (let i = 0; i < orderedUnpinnedIds.length; i++) {
        const templateId = orderedUnpinnedIds[i];
        const sortOrder = i * 10;
        await tx
          .insert(workflowTemplateTabOrder)
          .values({
            organizationId: auth.organizationId,
            tabKey: tab,
            templateId,
            pinnedAt: null,
            sortOrder,
          })
          .onConflictDoUpdate({
            target: [
              workflowTemplateTabOrder.organizationId,
              workflowTemplateTabOrder.tabKey,
              workflowTemplateTabOrder.templateId,
            ],
            set: {
              pinnedAt: null,
              sortOrder,
              updatedAt: new Date(),
            },
          });
      }
    });
  } catch (e) {
    if (e instanceof Error && e.message === "CONFLICT") {
      return { ok: false, error: "CONFLICT", message: "已有其他人操作，请刷新" };
    }
    throw e;
  }

  revalidatePath("/home");
  return { ok: true };
}
```

- [ ] **Step 4: 运行单测确认 guard 测试通过**

Run: `npx vitest run src/app/actions/__tests__/homepage-template-order.test.ts`

Expected: 全部 PASS（常量 + `isAllowedTabKey`）。

> **关于 action 的 DB 行为测试**：真库集成测试成本较高（需要事务 + fixture）。本期仅覆盖纯函数 guard。DB 路径用 QA 手测 + 下游 DAL 单测兜底——在 Task 2 的测试里已经覆盖了"表中有行" vs "表中无行"的读路径行为。若未来冲突频发，可补 Testcontainers-based 集成测试。

- [ ] **Step 5: 类型检查**

Run: `npx tsc --noEmit`

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/homepage-template-order.ts src/app/actions/__tests__/homepage-template-order.test.ts
git commit -m "$(cat <<'EOF'
feat(actions): 首页模版 pin/unpin/reorder 三个 server action

- admin/owner/superadmin 可操作；其他 role 返回 FORBIDDEN
- custom tab 进入即返回 INVALID_TAB
- reorder 事务内二次校验置顶状态，竞态返回 CONFLICT
- 成功后 revalidatePath('/home')

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 首页 `canManageHomepage` 透传

**Files:**
- Modify: `src/app/(dashboard)/home/page.tsx`
- Modify: `src/app/(dashboard)/home/home-client.tsx`

- [ ] **Step 1: `page.tsx` 查 role 算 flag**

在 `HomePage()` 内部，与 `employeeDbIdMap` 并列处新增：

```typescript
import { getCurrentUserProfile } from "@/lib/dal/auth";

// …

let canManageHomepage = false;

try {
  const profile = await getCurrentUserProfile();
  if (profile) {
    canManageHomepage =
      profile.isSuperAdmin ||
      profile.role === "admin" ||
      profile.role === "owner";
  }
} catch {
  // 静默降级，普通用户视图
}
```

然后在 `<HomeClient>` 的 props 里多传：

```tsx
<HomeClient
  recentMissions={recentMissions}
  recentConversations={recentConversations}
  scenarioMap={scenarioMap}
  employeeDbIdMap={employeeDbIdMap}
  templatesByTab={templatesByTab}
  canManageHomepage={canManageHomepage}
/>
```

- [ ] **Step 2: `home-client.tsx` 接收并透传**

在 props interface 里加 `canManageHomepage?: boolean`（默认 `false`），在 destructure 处加 `canManageHomepage = false`。

然后在渲染 `<ScenarioGrid>` 的那行加 prop：

```tsx
<ScenarioGrid
  templatesByTab={templatesByTab}
  canManageHomepage={canManageHomepage}
/>
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`

Expected: `scenario-grid.tsx` 会报 `canManageHomepage` prop 不存在 —— 这是预期，在 Task 5 修。Task 4 阶段可容忍。
若希望零报错提交，可把 `<ScenarioGrid>` 调用暂时改为 `<ScenarioGrid templatesByTab={templatesByTab} /* TODO canManageHomepage */ />`，延迟到 Task 5 传。

**本计划建议：** 直接把 Task 4 和 Task 5/6 合并为一个 commit，避免跨 commit 失败。见 Step 5。

- [ ] **Step 4: 暂不 commit，等 Task 5/6 完成后一起提交**

跳到 Task 5。

---

## Task 5: UI —— 编辑态 + Reorder.Group

**Files:**
- Modify: `src/components/home/scenario-grid.tsx`

### 目标

- 新增 `canManageHomepage` prop
- 每个 tab 有独立的 `editing` state
- 编辑态：置顶区和非置顶区都切为 `grid-cols-1`（spec §7.2），非置顶区包在 `Reorder.Group` 里
- 拖拽乐观更新 → 调 `reorderHomepageTemplates` → 失败回滚 + 控制台 warn

- [ ] **Step 1: 顶部 import 补齐**

```typescript
import { Reorder } from "framer-motion";
import {
  FileText,
  GripVertical,
  Pin,
  PinOff,
  Settings2,
  Workflow,
  ArrowUpDown,
  type LucideIcon,
} from "lucide-react";
import {
  reorderHomepageTemplates,
  pinHomepageTemplate,
  unpinHomepageTemplate,
  isAllowedTabKey,
} from "@/app/actions/homepage-template-order";
```

- [ ] **Step 2: props 扩展 + 本地 state**

```typescript
interface ScenarioGridProps {
  templatesByTab: Record<string, WorkflowTemplateRow[]>;
  canManageHomepage?: boolean;
}

export function ScenarioGrid({
  templatesByTab,
  canManageHomepage = false,
}: ScenarioGridProps) {
  const router = useRouter();
  const [launching, setLaunching] =
    React.useState<WorkflowTemplateRow | null>(null);
  const [directStartingId, setDirectStartingId] = React.useState<string | null>(
    null,
  );
  const [directError, setDirectError] = React.useState<string | null>(null);

  // tab → editing flag
  const [editingTab, setEditingTab] = React.useState<string | null>(null);

  // 乐观 override：tab → 当前非置顶顺序（id 数组）。为 null 时用 props 顺序。
  // 置顶状态（pinned_at）也可以乐观——但为了简化，我们 pin/unpin 成功后直接 router.refresh()。
  const [localUnpinnedOrder, setLocalUnpinnedOrder] = React.useState<
    Record<string, string[] | undefined>
  >({});

  // 实际的置顶判定 helper。项目里 WorkflowTemplateRow 自身没 pinnedAt 字段，
  // 我们靠「服务端已按 pinned 优先排」这个契约 + 从另一个来源拿置顶标记。
  // 见 Step 2.5。
```

- [ ] **Step 2.5: 携带置顶标记的问题**

`WorkflowTemplateRow` 本身不包含 `pinnedAt`。要么：
- (a) 在 DAL 层多返回一个字段（修改 `TemplateWithOrder` → 暴露给页面）
- (b) 在前端通过 "列表中排在最前的 N 个有 `ring-sky-300/40` 视觉" 推断——脆弱
- (c) 在 DAL 返回之前，把 `pinnedAt` 挂到模板对象上（非持久字段）

**选 (c)**：最小侵入，对现有调用方透明。

改 `src/lib/dal/workflow-templates-listing.ts` 的 `listTemplatesForHomepageByTab`：最后的 `return` 改为

```typescript
return sortTemplatesForHomepageTab(withOrder).map((r) => ({
  ...r.tpl,
  // Non-persistent decoration: homepage 客户端用来判定置顶视觉。
  // 类型上不加到 WorkflowTemplateRow；消费端按需读取。
  __homepagePinnedAt: r.order?.pinnedAt ?? null,
})) as (WorkflowTemplateRow & { __homepagePinnedAt?: Date | null })[];
```

然后在 scenario-grid.tsx 顶部声明扩展类型：

```typescript
type TplWithPin = WorkflowTemplateRow & { __homepagePinnedAt?: Date | null };

const isPinned = (t: TplWithPin) => t.__homepagePinnedAt != null;
```

**注意**：`page.tsx` 里 `templatesByTab: Record<string, WorkflowTemplateRow[]>` 的类型声明要放宽为 `Record<string, TplWithPin[]>`，或者在 `home-client.tsx` / `scenario-grid.tsx` 里以 `as TplWithPin[]` 强转读出。本计划选**放宽 props 类型**：在 `ScenarioGridProps` 里把类型改成：

```typescript
templatesByTab: Record<string, (WorkflowTemplateRow & { __homepagePinnedAt?: Date | null })[]>;
```

对上游（`home-client.tsx` → `home/page.tsx`）做同样的类型调整。因 `__homepagePinnedAt` 是可选字段，不影响其他 tab（如 `custom`）的渲染。

- [ ] **Step 3: 拖拽 + pin/unpin handlers**

在 `ScenarioGrid` 内：

```typescript
const handleReorder = React.useCallback(
  async (tab: string, next: TplWithPin[]) => {
    const unpinnedIds = next.filter((t) => !isPinned(t)).map((t) => t.id);

    // 乐观更新
    setLocalUnpinnedOrder((prev) => ({ ...prev, [tab]: unpinnedIds }));

    const res = await reorderHomepageTemplates({
      tab,
      orderedUnpinnedIds: unpinnedIds,
    });
    if (!res.ok) {
      // 回滚
      setLocalUnpinnedOrder((prev) => {
        const copy = { ...prev };
        delete copy[tab];
        return copy;
      });
      console.warn("[homepage-reorder]", res.error, res.message);
    } else {
      router.refresh(); // 让服务端顺序对齐乐观值
    }
  },
  [router],
);

const handleTogglePin = React.useCallback(
  async (tab: string, tpl: TplWithPin) => {
    const action = isPinned(tpl)
      ? unpinHomepageTemplate
      : pinHomepageTemplate;
    const res = await action({ tab, templateId: tpl.id });
    if (res.ok) {
      router.refresh();
    } else {
      console.warn("[homepage-pin]", res.error, res.message);
    }
  },
  [router],
);
```

- [ ] **Step 4: `TabsContent` 渲染改造**

在 `TAB_ORDER.map((tab) => { ... })` 的 `TabsContent` 里，替换掉原来的 grid 渲染。新版（含置顶区分离 + 编辑态 + Reorder）：

```tsx
{TAB_ORDER.map((tab) => {
  const rawList = (templatesByTab[tab.key] ?? []) as TplWithPin[];
  const isSharedTab = isAllowedTabKey(tab.key); // custom 返回 false
  const showEditing = isSharedTab && canManageHomepage && editingTab === tab.key;

  // 拆分置顶 / 非置顶
  const pinned = rawList.filter(isPinned);
  const unpinnedServer = rawList.filter((t) => !isPinned(t));

  // 应用乐观顺序
  const localIds = localUnpinnedOrder[tab.key];
  const unpinned =
    localIds && localIds.length > 0
      ? localIds
          .map((id) => unpinnedServer.find((t) => t.id === id))
          .filter((t): t is TplWithPin => !!t)
          .concat(
            // 避免遗漏
            unpinnedServer.filter((t) => !localIds.includes(t.id)),
          )
      : unpinnedServer;

  const gridCls = showEditing
    ? "grid grid-cols-1 gap-3"
    : "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3";

  return (
    <TabsContent key={tab.key} value={tab.key} className="mt-1">
      {/* 操作条（仅 shared tab + admin） */}
      {isSharedTab && canManageHomepage && (
        <div className="mb-3 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setEditingTab((cur) => (cur === tab.key ? null : tab.key))
            }
          >
            <ArrowUpDown size={14} className="mr-1" />
            {showEditing ? "完成" : "整理顺序"}
          </Button>
        </div>
      )}

      {rawList.length === 0 ? (
        <div className="rounded-xl border border-dashed border-sky-200 p-8 text-center text-sm text-muted-foreground">
          <p>
            {tab.key === "custom"
              ? "还没有自定义工作流"
              : `${tab.label} 暂无预设工作流`}
          </p>
          <Button variant="link" asChild className="mt-2">
            <Link href="/workflows">前往工作流模块查看</Link>
          </Button>
        </div>
      ) : (
        <>
          {/* 置顶区 —— 静态 */}
          {pinned.length > 0 && (
            <div className={`${gridCls} mb-3`}>
              {pinned.map((tpl, index) => (
                <TemplateCard
                  key={tpl.id}
                  tpl={tpl}
                  index={index}
                  pinned
                  editing={showEditing}
                  canManage={canManageHomepage && isSharedTab}
                  isDirectStarting={directStartingId === tpl.id}
                  onClickCard={() => handleCardClick(tpl)}
                  onTogglePin={() => handleTogglePin(tab.key, tpl)}
                />
              ))}
            </div>
          )}

          {/* 非置顶区 */}
          {showEditing && unpinned.length > 0 ? (
            <Reorder.Group
              axis="y"
              values={unpinned}
              onReorder={(next) => handleReorder(tab.key, next)}
              className={gridCls}
              as="div"
            >
              {unpinned.map((tpl, index) => (
                <Reorder.Item
                  key={tpl.id}
                  value={tpl}
                  as="div"
                  className="list-none"
                >
                  <TemplateCard
                    tpl={tpl}
                    index={index}
                    pinned={false}
                    editing
                    canManage={canManageHomepage && isSharedTab}
                    isDirectStarting={directStartingId === tpl.id}
                    onClickCard={() => handleCardClick(tpl)}
                    onTogglePin={() => handleTogglePin(tab.key, tpl)}
                  />
                </Reorder.Item>
              ))}
            </Reorder.Group>
          ) : (
            <div className={gridCls}>
              {unpinned.map((tpl, index) => (
                <TemplateCard
                  key={tpl.id}
                  tpl={tpl}
                  index={index}
                  pinned={false}
                  editing={false}
                  canManage={canManageHomepage && isSharedTab}
                  isDirectStarting={directStartingId === tpl.id}
                  onClickCard={() => handleCardClick(tpl)}
                  onTogglePin={() => handleTogglePin(tab.key, tpl)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </TabsContent>
  );
})}
```

- [ ] **Step 5: 抽出 `TemplateCard` 子组件**（Task 6 会在这里加 Pin 按钮与视觉）

在 `scenario-grid.tsx` 文件内，紧接 `ScenarioGrid` 之前：

```tsx
interface TemplateCardProps {
  tpl: TplWithPin;
  index: number;
  pinned: boolean;
  editing: boolean;
  canManage: boolean;
  isDirectStarting: boolean;
  onClickCard: () => void;
  onTogglePin: () => void;
}

function TemplateCard({
  tpl,
  index,
  pinned,
  editing,
  canManage,
  isDirectStarting,
  onClickCard,
  onTogglePin,
}: TemplateCardProps) {
  const Icon = resolveLucideIcon(tpl.icon);
  const team = (tpl.defaultTeam ?? []) as EmployeeId[];

  // 编辑态下禁入场动画，避免和 Reorder 的 layout 动画互踩（spec §9）
  const motionProps = editing
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.3, delay: index * 0.04, ease: "easeOut" as const },
      };

  return (
    <motion.div {...motionProps} className="h-full">
      <GlassCard
        padding="md"
        hover={!editing}
        className={[
          "relative flex h-full flex-col",
          editing ? "cursor-default" : "cursor-pointer",
          pinned ? "ring-1 ring-sky-300/40" : "",
        ].join(" ")}
        onClick={editing ? undefined : onClickCard}
      >
        {/* 置顶渐变带 */}
        {pinned && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[2px] rounded-t-[inherit] bg-gradient-to-r from-sky-400/80 via-sky-300/60 to-transparent"
          />
        )}

        <div className="flex items-start justify-between gap-2">
          {/* 编辑态拖拽手柄 —— 仅非置顶卡显示。用 <div> 而非 <button>：
              Reorder.Item 整项可拖，手柄只是视觉线索；不是独立语义按钮。
              同时避开 ESLint no-restricted-syntax 对 raw <button> 的拦截。 */}
          {editing && !pinned && (
            <div
              role="presentation"
              aria-label="拖动排序"
              className="mt-1 -ml-1 flex h-8 w-6 shrink-0 cursor-grab items-center justify-center text-muted-foreground/60 transition-colors hover:text-sky-500 active:cursor-grabbing"
            >
              <GripVertical size={16} />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="mb-1.5">
              <Icon size={22} className="text-sky-500" />
            </div>
            <h3 className="flex items-center gap-1.5 truncate text-base font-medium">
              {tpl.name}
              {pinned && (
                <Pin
                  size={14}
                  className="shrink-0 rotate-[30deg] text-sky-500/80"
                  aria-label="已置顶"
                />
              )}
            </h3>
            {tpl.description && (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {tpl.description}
              </p>
            )}
          </div>

          {/* 置顶/取消置顶按钮 —— admin 可见。用 <Button variant="ghost" size="icon-sm">
              (size="icon-sm" = size-8) 遵循 CLAUDE.md 「按钮用 <Button>」硬规。
              className 仅处理定位 + 圆角，不覆盖颜色（shared button 已是 ghost 透明底）。 */}
          {canManage && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={pinned ? "取消置顶" : "置顶"}
              className="absolute right-2 top-2 rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin();
              }}
            >
              {pinned ? <PinOff size={14} /> : <Pin size={14} />}
            </Button>
          )}
        </div>

        {team.length > 0 && (
          <div className="mt-3 flex items-center -space-x-1">
            {team.slice(0, 5).map((memberId) => (
              <EmployeeAvatar key={memberId} employeeId={memberId} size="sm" />
            ))}
            {team.length > 5 && (
              <span className="ml-1 text-[10px] text-muted-foreground">
                +{team.length - 5}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto flex justify-end pt-4">
          <Button
            size="sm"
            disabled={isDirectStarting || editing}
            onClick={(e) => {
              e.stopPropagation();
              if (!editing) onClickCard();
            }}
          >
            {isDirectStarting ? "启动中…" : "启动"}
          </Button>
        </div>
      </GlassCard>
    </motion.div>
  );
}
```

> 注意：遵循 CLAUDE.md "所有可点击按钮不要带边框"——所有新增 `<button>` 都带 `border-0`，Pin/Unpin 按钮用 `hover:bg-sky-50/60` 暗示可点击。

- [ ] **Step 6: 类型检查 + 构建**

Run: `npx tsc --noEmit`
Expected: PASS

Run: `npm run build`
Expected: PASS（首屏 `/home` 能 build 通过；若失败查 `page.tsx` / `home-client.tsx` 的 prop 类型是否放宽了 `__homepagePinnedAt`）。

- [ ] **Step 7: 手动验证（dev server）**

Run: `npm run dev`

验证清单：
- 普通用户（role 非 admin/owner）访问 `/home`：
  - [ ] 9 tab 卡片顺序正常，无"整理顺序"按钮、无 Pin 按钮、无拖拽手柄
  - [ ] 置顶卡的渐变带 + 标题右 Pin 图标 + ring 可见（若数据库已有置顶行）
- admin 访问 `/home`：
  - [ ] 任一共享 tab 看到"整理顺序"按钮和卡片右上角 Pin 按钮
  - [ ] 点击 Pin：卡升到置顶区顶；再点：回到非置顶末尾
  - [ ] 点击"整理顺序"进入单列编辑态；拖拽重排；点"完成"退回 grid；刷新顺序保留
  - [ ] "我的工作流"tab：admin 也看不到"整理顺序" / Pin 按钮（`isSharedTab` 为 false）
  - [ ] 拖拽后快速连续拖多次：不卡顿、最终一致

若任一失败，回到相应 Step 修复后重测。

- [ ] **Step 8: Commit（把 Task 4 + 5 + 6 合为一个 commit，保证跨文件一致）**

```bash
git add \
  src/lib/dal/workflow-templates-listing.ts \
  src/app/(dashboard)/home/page.tsx \
  src/app/(dashboard)/home/home-client.tsx \
  src/components/home/scenario-grid.tsx
git commit -m "$(cat <<'EOF'
feat(home): 首页模版拖拽排序 + 置顶 UI

- 9 共享 tab 下 admin 可点"整理顺序"进入单列编辑态拖拽
- 任一卡（admin 可见）可 Pin/Unpin；置顶卡有 sky 渐变带 + Pin 图标 + ring
- 乐观更新；失败回滚；成功 router.refresh() 对齐服务端
- custom tab 无编辑入口；普通用户仅只读
- DAL 附带 __homepagePinnedAt 非持久字段供客户端判定

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: （已合并到 Task 5 Step 5）Pin 视觉 & Pin/Unpin 按钮

上面 `TemplateCard` 已经把 Pin 视觉（渐变带 / 标题 Pin 图标 / ring）和 Pin/Unpin 按钮都实现了。**本任务无独立 Step，标记为 N/A——保留此锚点便于追溯 spec §7.3。**

---

## Task 7: 最终验收

- [ ] **Step 1: 全量类型检查**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 2: 全量单测**

Run: `npx vitest run`
Expected: 全部 PASS（新增的 DAL 排序 + action guard 测试都绿；若 CMS 那条预存 bug 仍在失败，属 out-of-scope，不阻塞本 feature）。

- [ ] **Step 3: 生产构建**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: 无新增 warn/error

- [ ] **Step 5: 最终 E2E 手测**

用两个浏览器窗口（同一 admin 账号）：
- 窗口 A 拖拽 / 置顶
- 窗口 B 手动刷新 `/home` → 能看到新顺序
- 普通用户在第三个窗口访问 → 看到相同置顶与顺序，但无编辑入口

- [ ] **Step 6: 若前面均 PASS → 宣告完成，unstaged 文件应全部已入 commit**

```bash
git status
```

Expected: working tree clean（除了预存的全局 M 改动）。

---

## 风险 & 回退

- **迁移无损**：新表，不影响现有行为。`db:push` 失败 → 直接删表重来。
- **DAL 退化**：若新排序逻辑有 bug，所有共享 tab 退化到"置顶在前、非置顶按 createdAt ASC"——仍可用。最坏情况：`git revert` DAL 那个 commit，行为恢复为旧逻辑。
- **UI 退化**：若 `framer-motion` `Reorder` 在生产构建遇到 SSR 问题，退回用条件渲染：`{typeof window !== 'undefined' && <Reorder.Group ...>}` 包一层。当前项目 scenario-grid 已是 `"use client"`，风险很低。
- **竞态处理**：在多 admin 同时拖时，后提交者覆盖前者（spec §9 已决策）；reorder 与 pin 的交叉竞态走 409 CONFLICT 前端刷新。

---

## 与 Spec 的交叉索引

| Spec 章节 | Plan 任务 |
|---|---|
| §3 数据模型 | Task 1 |
| §4 读路径排序 | Task 2 |
| §5 三个动作 | Task 3 |
| §6 权限 | Task 3（server guard）+ Task 4（客户端 flag 透传）|
| §7 UI | Task 5（含 Task 6 合并）|
| §9 边界情况 | Task 5 + Task 7 手测 |
| §10 测试点 | Task 2 / Task 3 / Task 5 Step 7 / Task 7 |
| §11 不在本期 | 全部尊重；本 plan 不实现任何未列事项 |
