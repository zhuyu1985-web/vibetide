import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { cmsCatalogs, organizations } from "@/db/schema";
import {
  insertCmsCatalog,
  updateCmsCatalog,
  softDeleteCmsCatalog,
  listCmsCatalogsByApp,
  findCmsCatalogByCmsId,
} from "../cms-catalogs";
import { eq } from "drizzle-orm";

describe("DAL cms-catalogs", () => {
  const orgId = randomUUID();

  beforeAll(async () => {
    // cms_catalogs.organization_id 有 FK 约束引用 organizations(id)，
    // 随机 UUID 必须先在 organizations 表里存在，否则 insert 会 FK 违例。
    const stamp = Date.now();
    await db
      .insert(organizations)
      .values([
        { id: orgId, name: "cms-catalogs-test", slug: `cms-catalogs-test-${stamp}` },
      ])
      .onConflictDoNothing();
  });

  beforeEach(async () => {
    await db.delete(cmsCatalogs).where(eq(cmsCatalogs.organizationId, orgId));
  });

  afterAll(async () => {
    await db.delete(cmsCatalogs).where(eq(cmsCatalogs.organizationId, orgId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
  });

  const baseCatalog = {
    cmsCatalogId: 9369,
    appId: 10,
    siteId: 81,
    name: "新闻栏目",
    parentId: 0,
    innerCode: "009887",
    alias: "news",
    treeLevel: 1,
    isLeaf: true,
    catalogType: 1,
  };

  it("insertCmsCatalog creates record", async () => {
    await insertCmsCatalog(orgId, baseCatalog);
    const found = await findCmsCatalogByCmsId(orgId, 9369);
    expect(found?.name).toBe("新闻栏目");
    expect(found?.deletedAt).toBeNull();
  });

  it("updateCmsCatalog modifies an existing record", async () => {
    await insertCmsCatalog(orgId, baseCatalog);
    await updateCmsCatalog(orgId, 9369, { name: "重命名后" });
    const found = await findCmsCatalogByCmsId(orgId, 9369);
    expect(found?.name).toBe("重命名后");
  });

  it("softDeleteCmsCatalog sets deletedAt but keeps the row", async () => {
    await insertCmsCatalog(orgId, baseCatalog);
    await softDeleteCmsCatalog(orgId, 9369);
    const found = await findCmsCatalogByCmsId(orgId, 9369);
    expect(found?.deletedAt).toBeInstanceOf(Date);
  });

  it("listCmsCatalogsByApp excludes soft-deleted by default", async () => {
    await insertCmsCatalog(orgId, baseCatalog);
    await insertCmsCatalog(orgId, { ...baseCatalog, cmsCatalogId: 9370, name: "B" });
    await softDeleteCmsCatalog(orgId, 9370);

    const active = await listCmsCatalogsByApp(orgId, 10);
    expect(active).toHaveLength(1);
    expect(active[0].cmsCatalogId).toBe(9369);

    const includeDeleted = await listCmsCatalogsByApp(orgId, 10, { includeDeleted: true });
    expect(includeDeleted).toHaveLength(2);
  });
});
