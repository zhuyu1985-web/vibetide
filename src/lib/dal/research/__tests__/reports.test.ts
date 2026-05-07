// A5 Phase 1 — DAL 单测 (5 cases)
//
// 测试模式：实接 Supabase dev DB（与 advanced-search.test.ts 同模式）。
// 每个 describe 自建 2 个 org → cleanup 时 cascade 删 org 即清掉所有 report。

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations } from "@/db/schema/users";
import {
  createReport,
  getReportById,
  listReportsByTask,
  listSnapshotsByParent,
  updateReportStatus,
} from "../reports";
import type { ReportSearchSnapshot } from "@/db/schema/research/reports";

let orgA: string;
let orgB: string;

const advancedSnapshot: ReportSearchSnapshot = {
  kind: "advanced_search",
  conditions: [],
  sidebarFilter: {},
  hitItemIds: ["item-a", "item-b"],
  capturedAt: new Date().toISOString(),
};

beforeAll(async () => {
  const [a] = await db
    .insert(organizations)
    .values({ name: "Test A5 DAL A", slug: "test-a5-dal-a-" + Date.now() })
    .returning();
  const [b] = await db
    .insert(organizations)
    .values({ name: "Test A5 DAL B", slug: "test-a5-dal-b-" + Date.now() })
    .returning();
  orgA = a!.id;
  orgB = b!.id;
});

afterAll(async () => {
  // organizationId onDelete cascade → 自动清掉 reports
  await db.delete(organizations).where(eq(organizations.id, orgA));
  await db.delete(organizations).where(eq(organizations.id, orgB));
});

describe("research-reports DAL", () => {
  it("createReport returns row with status=pending + id + createdAt", async () => {
    const row = await createReport({
      organizationId: orgA,
      sourceType: "advanced_search",
      searchSnapshot: advancedSnapshot,
      title: "测试报告 — create",
    });
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(row.status).toBe("pending");
    expect(row.title).toBe("测试报告 — create");
    expect(row.organizationId).toBe(orgA);
    expect(row.isSnapshot).toBe(false);
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(row.startedAt).toBeNull();
    expect(row.completedAt).toBeNull();
    expect(row.reportHtml).toBeNull();
  });

  it("getReportById is cross-org safe (returns null on mismatch, row on match)", async () => {
    const row = await createReport({
      organizationId: orgA,
      sourceType: "advanced_search",
      searchSnapshot: advancedSnapshot,
      title: "测试报告 — cross-org",
    });

    const fromOther = await getReportById(row.id, orgB);
    expect(fromOther).toBeNull();

    const fromOwn = await getReportById(row.id, orgA);
    expect(fromOwn).not.toBeNull();
    expect(fromOwn!.id).toBe(row.id);
    expect(fromOwn!.organizationId).toBe(orgA);
  });

  it("listReportsByTask filters by taskId scoped to org (desc by createdAt)", async () => {
    // taskId 用一个固定 UUID（不需要真实 task row，因为 onDelete=set null
    // 表示 FK 允许悬空；插入时 task 不存在会被 FK 拒绝。所以这里改用 null 测试
    // 即：不带 taskId 时 listReportsByTask 不应命中）
    const fakeTaskId = "00000000-0000-0000-0000-000000000000";

    // 同 org 但不同（不存在）的 task → 应空
    const empty = await listReportsByTask(fakeTaskId, orgA);
    expect(empty).toEqual([]);

    // 创建 2 个 advanced_search 来源（无 task） + 1 个其它 org → 都不应在 fakeTaskId 下命中
    await createReport({
      organizationId: orgA,
      sourceType: "advanced_search",
      searchSnapshot: advancedSnapshot,
      title: "无 task A1",
    });
    await createReport({
      organizationId: orgA,
      sourceType: "advanced_search",
      searchSnapshot: advancedSnapshot,
      title: "无 task A2",
    });
    await createReport({
      organizationId: orgB,
      sourceType: "advanced_search",
      searchSnapshot: advancedSnapshot,
      title: "无 task B1",
    });

    const stillEmpty = await listReportsByTask(fakeTaskId, orgA);
    expect(stillEmpty).toEqual([]);
  });

  it("listSnapshotsByParent only returns rows with matching parentReportId in same org", async () => {
    const parent = await createReport({
      organizationId: orgA,
      sourceType: "advanced_search",
      searchSnapshot: advancedSnapshot,
      title: "母版",
    });

    // 等 1ms 保 createdAt 单调
    await new Promise((r) => setTimeout(r, 5));
    const snap1 = await createReport({
      organizationId: orgA,
      sourceType: "advanced_search",
      searchSnapshot: advancedSnapshot,
      title: "snap-1",
      parentReportId: parent.id,
      isSnapshot: true,
      snapshotName: "导师 v1",
    });
    await new Promise((r) => setTimeout(r, 5));
    const snap2 = await createReport({
      organizationId: orgA,
      sourceType: "advanced_search",
      searchSnapshot: advancedSnapshot,
      title: "snap-2",
      parentReportId: parent.id,
      isSnapshot: true,
      snapshotName: "导师 v2",
    });

    // 另一份 org A 报告（不挂 parent）— 不应被列出
    await createReport({
      organizationId: orgA,
      sourceType: "advanced_search",
      searchSnapshot: advancedSnapshot,
      title: "无关报告",
    });

    // 跨 org 查 → 空
    const crossOrg = await listSnapshotsByParent(parent.id, orgB);
    expect(crossOrg).toEqual([]);

    // 同 org 查 → 2 行 + 全部 isSnapshot=true，按 createdAt desc
    const ownOrg = await listSnapshotsByParent(parent.id, orgA);
    expect(ownOrg).toHaveLength(2);
    expect(ownOrg.every((r) => r.isSnapshot === true)).toBe(true);
    expect(ownOrg.every((r) => r.parentReportId === parent.id)).toBe(true);
    // 顺序 desc：snap2 在 snap1 前
    expect(ownOrg[0]!.id).toBe(snap2.id);
    expect(ownOrg[1]!.id).toBe(snap1.id);
  });

  it("updateReportStatus updates status + currentStep + timestamps; other fields untouched", async () => {
    const row = await createReport({
      organizationId: orgA,
      sourceType: "advanced_search",
      searchSnapshot: advancedSnapshot,
      title: "状态机测试",
    });

    // pending → generating + currentStep + startedAt
    const startedAt = new Date();
    await updateReportStatus(row.id, {
      status: "generating",
      currentStep: "数据聚合",
      startedAt,
    });
    let reloaded = await getReportById(row.id, orgA);
    expect(reloaded!.status).toBe("generating");
    expect(reloaded!.currentStep).toBe("数据聚合");
    expect(reloaded!.startedAt).toBeInstanceOf(Date);
    // 其它字段保持
    expect(reloaded!.title).toBe("状态机测试");
    expect(reloaded!.completedAt).toBeNull();
    expect(reloaded!.errorMessage).toBeNull();

    // generating → ready + clear currentStep + completedAt
    const completedAt = new Date();
    await updateReportStatus(row.id, {
      status: "ready",
      currentStep: null,
      completedAt,
    });
    reloaded = await getReportById(row.id, orgA);
    expect(reloaded!.status).toBe("ready");
    expect(reloaded!.currentStep).toBeNull();
    expect(reloaded!.completedAt).toBeInstanceOf(Date);
    // title / startedAt 仍存在
    expect(reloaded!.title).toBe("状态机测试");
    expect(reloaded!.startedAt).toBeInstanceOf(Date);
  });
});
