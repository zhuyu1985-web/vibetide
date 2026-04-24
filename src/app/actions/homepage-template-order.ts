"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, max, sql } from "drizzle-orm";
import { db } from "@/db";
import { workflowTemplateTabOrder, workflowTemplates } from "@/db/schema/workflows";
// 本文件使用 getCurrentUserProfile 而非 cms.ts 里的 getCurrentUserAndOrg——
// 需要 role / isSuperAdmin 字段做管理员判定，后者只返回 userId+orgId。
import { getCurrentUserProfile } from "@/lib/dal/auth";
// Task 4 — `ALLOWED_TAB_KEYS` / `isAllowedTabKey` / `SHARED_HOMEPAGE_ACTION_ERROR`
// 均抽到 `src/lib/homepage-template-tabs.ts`：`"use server"` 文件只能 export
// async 函数，不能 export 常量；统一放在共享模块供 server action、client
// 组件、测试都 import。
import type { HomepageActionResult } from "@/lib/homepage-template-tabs";
import { isAllowedTabKey } from "@/lib/homepage-template-tabs";

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

// ─── Actions ────────────────────────────────────────────────────────

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
    return { ok: true };
  }

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
