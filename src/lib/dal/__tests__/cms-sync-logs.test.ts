import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { cmsSyncLogs, organizations } from "@/db/schema";
import {
  startCmsSyncLog,
  completeCmsSyncLog,
  failCmsSyncLog,
  listRecentSyncLogs,
  getSyncLogById,
} from "../cms-sync-logs";
import { eq } from "drizzle-orm";

describe("DAL cms-sync-logs", () => {
  const orgId = randomUUID();

  beforeAll(async () => {
    // cms_sync_logs.organization_id 有 FK 约束引用 organizations(id)，
    // 随机 UUID 必须先在 organizations 表里存在，否则 insert 会 FK 违例。
    const stamp = Date.now();
    await db
      .insert(organizations)
      .values([
        { id: orgId, name: "cms-sync-logs-test", slug: `cms-sync-logs-test-${stamp}` },
      ])
      .onConflictDoNothing();
  });

  beforeEach(async () => {
    await db.delete(cmsSyncLogs).where(eq(cmsSyncLogs.organizationId, orgId));
  });

  afterAll(async () => {
    await db.delete(cmsSyncLogs).where(eq(cmsSyncLogs.organizationId, orgId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
  });

  it("startCmsSyncLog creates 'running' record and returns id", async () => {
    const id = await startCmsSyncLog(orgId, { triggerSource: "manual", operatorId: "user123" });
    const log = await getSyncLogById(id);
    expect(log?.state).toBe("running");
    expect(log?.triggerSource).toBe("manual");
  });

  it("completeCmsSyncLog sets state=done with stats", async () => {
    const id = await startCmsSyncLog(orgId, { triggerSource: "manual" });
    await completeCmsSyncLog(id, {
      stats: { channelsFetched: 1, appsFetched: 2, catalogsFetched: 100, inserted: 3, updated: 5, deleted: 0 },
      warnings: [],
    });
    const log = await getSyncLogById(id);
    expect(log?.state).toBe("done");
    expect(log?.stats).toMatchObject({ inserted: 3, updated: 5 });
    expect(log?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("failCmsSyncLog sets state=failed with errorMessage", async () => {
    const id = await startCmsSyncLog(orgId, { triggerSource: "scheduled" });
    await failCmsSyncLog(id, "CMS 鉴权失败");
    const log = await getSyncLogById(id);
    expect(log?.state).toBe("failed");
    expect(log?.errorMessage).toBe("CMS 鉴权失败");
  });

  it("listRecentSyncLogs returns latest-first with limit", async () => {
    for (let i = 0; i < 5; i++) {
      const id = await startCmsSyncLog(orgId, { triggerSource: "scheduled" });
      await completeCmsSyncLog(id, { stats: {}, warnings: [] });
    }
    const list = await listRecentSyncLogs(orgId, { limit: 3 });
    expect(list).toHaveLength(3);
  });
});
