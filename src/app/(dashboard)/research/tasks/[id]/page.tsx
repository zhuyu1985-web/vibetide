// src/app/(dashboard)/research/tasks/[id]/page.tsx
//
// A5 Phase 8 — 研究任务详情（用户态）+ "生成报告"入口 1
//
// 与 admin/tasks/[id]（管理员快照详情）不同：
//   - 此页针对"完成态"任务，仅暴露"生成报告" / "查看 / 重新生成报告"按钮
//   - 在 Server Component 内用 Drizzle 查询构建器（无 raw SQL 拼接，避免注入）
//     计算 hitItemIds：org 隔离 + 时间窗 + topicIds/districtIds EXISTS 子查询
//     + LIMIT 500（spec §3.2 数据漂移上限硬限制）
//   - 列出该任务下已存在的 reports（含母版+快照），传给客户端组件渲染

import { notFound } from "next/navigation";
import { and, between, eq, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { collectedItems } from "@/db/schema/collection";
import { researchTasks } from "@/db/schema/research/research-tasks";
import {
  researchCollectedItemDistricts,
  researchCollectedItemTopics,
} from "@/db/schema/research/annotations";
import { listReportsByTask } from "@/lib/dal/research/reports";
import { PERMISSIONS, requirePermission } from "@/lib/rbac";

import { TaskReportEntryClient } from "./task-report-entry-client";

export const dynamic = "force-dynamic";

const HIT_LIMIT = 500;

export default async function ResearchTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organizationId } = await requirePermission(PERMISSIONS.MENU_RESEARCH);

  const [task] = await db
    .select()
    .from(researchTasks)
    .where(
      and(
        eq(researchTasks.id, id),
        eq(researchTasks.organizationId, organizationId),
      ),
    );
  if (!task) notFound();

  // 计算命中 items：用 EXISTS 子查询保证不重复 + Drizzle 参数化避免 SQL 注入。
  const topicIds = task.topicIds ?? [];
  const districtIds = task.districtIds ?? [];

  const matchExprs: SQL[] = [];
  if (topicIds.length > 0) {
    matchExprs.push(
      sql`EXISTS (SELECT 1 FROM ${researchCollectedItemTopics} cit WHERE cit.collected_item_id = ${collectedItems.id} AND cit.topic_id IN (${sql.join(
        topicIds.map((tid) => sql`${tid}::uuid`),
        sql`, `,
      )}))`,
    );
  }
  if (districtIds.length > 0) {
    matchExprs.push(
      sql`EXISTS (SELECT 1 FROM ${researchCollectedItemDistricts} cid WHERE cid.collected_item_id = ${collectedItems.id} AND cid.district_id IN (${sql.join(
        districtIds.map((did) => sql`${did}::uuid`),
        sql`, `,
      )}))`,
    );
  }

  let hitItemIds: string[] = [];
  if (matchExprs.length > 0) {
    const annotationExpr =
      matchExprs.length === 1 ? matchExprs[0]! : or(...matchExprs)!;
    const hits = await db
      .select({ id: collectedItems.id })
      .from(collectedItems)
      .where(
        and(
          eq(collectedItems.organizationId, organizationId),
          between(
            collectedItems.publishedAt,
            task.timeRangeStart,
            task.timeRangeEnd,
          ),
          annotationExpr,
        ),
      )
      .orderBy(sql`${collectedItems.publishedAt} DESC NULLS LAST`)
      .limit(HIT_LIMIT);
    hitItemIds = hits.map((r) => r.id);
  }

  const reports = await listReportsByTask(task.id, organizationId);

  return (
    <TaskReportEntryClient
      task={{
        id: task.id,
        name: task.name,
        status: task.status,
        timeRangeStart: task.timeRangeStart.toISOString(),
        timeRangeEnd: task.timeRangeEnd.toISOString(),
      }}
      hitItemIds={hitItemIds}
      hitLimit={HIT_LIMIT}
      existingReports={reports.map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        isSnapshot: r.isSnapshot,
        snapshotName: r.snapshotName,
        createdAt: r.createdAt.toISOString(),
      }))}
    />
  );
}
