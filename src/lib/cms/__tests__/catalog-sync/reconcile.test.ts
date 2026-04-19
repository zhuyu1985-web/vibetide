import { describe, it, expect } from "vitest";
import { reconcileCatalogs } from "../../catalog-sync/reconcile";
import type { FlatCatalogRow } from "../../catalog-sync/flatten-tree";

function flat(overrides: Partial<FlatCatalogRow>): FlatCatalogRow {
  return {
    cmsCatalogId: 1, appId: 10, siteId: 81, name: "n",
    parentId: 0, innerCode: "001", alias: "x",
    treeLevel: 1, isLeaf: true, catalogType: 1,
    ...overrides,
  };
}

function existing(overrides: Partial<any>): any {
  return {
    id: "uuid-1",
    cmsCatalogId: 1, appId: 10, siteId: 81, name: "n",
    parentId: 0, innerCode: "001", alias: "x",
    treeLevel: 1, isLeaf: true, catalogType: 1,
    deletedAt: null,
    ...overrides,
  };
}

describe("reconcileCatalogs", () => {
  it("identifies new catalogs (CMS has, local doesn't) as inserts", () => {
    const plan = reconcileCatalogs({
      fetched: [flat({ cmsCatalogId: 1 }), flat({ cmsCatalogId: 2 })],
      existing: [],
    });
    expect(plan.inserts).toHaveLength(2);
    expect(plan.updates).toHaveLength(0);
    expect(plan.softDeletes).toHaveLength(0);
  });

  it("identifies changed catalogs as updates (by name change)", () => {
    const plan = reconcileCatalogs({
      fetched: [flat({ cmsCatalogId: 1, name: "重命名" })],
      existing: [existing({ cmsCatalogId: 1, name: "原名" })],
    });
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].diff.name).toEqual({ from: "原名", to: "重命名" });
    expect(plan.inserts).toHaveLength(0);
  });

  it("ignores unchanged records (no-op)", () => {
    const plan = reconcileCatalogs({
      fetched: [flat({ cmsCatalogId: 1 })],
      existing: [existing({ cmsCatalogId: 1 })],
    });
    expect(plan.inserts).toHaveLength(0);
    expect(plan.updates).toHaveLength(0);
    expect(plan.softDeletes).toHaveLength(0);
    expect(plan.unchanged).toBe(1);
  });

  it("identifies missing-from-CMS records as soft-delete", () => {
    const plan = reconcileCatalogs({
      fetched: [flat({ cmsCatalogId: 1 })],
      existing: [existing({ cmsCatalogId: 1 }), existing({ cmsCatalogId: 2, id: "uuid-2" })],
    });
    expect(plan.softDeletes).toHaveLength(1);
    expect(plan.softDeletes[0].cmsCatalogId).toBe(2);
  });

  it("does NOT soft-delete when option disabled", () => {
    const plan = reconcileCatalogs({
      fetched: [flat({ cmsCatalogId: 1 })],
      existing: [existing({ cmsCatalogId: 1 }), existing({ cmsCatalogId: 2, id: "uuid-2" })],
      deleteMissing: false,
    });
    expect(plan.softDeletes).toHaveLength(0);
  });

  it("revives a previously soft-deleted catalog that reappears in CMS", () => {
    const plan = reconcileCatalogs({
      fetched: [flat({ cmsCatalogId: 1 })],
      existing: [existing({ cmsCatalogId: 1, deletedAt: new Date("2026-01-01") })],
    });
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].diff.deletedAt).toBeDefined();
  });

  it("detects isLeaf and treeLevel changes", () => {
    const plan = reconcileCatalogs({
      fetched: [flat({ cmsCatalogId: 1, isLeaf: false, treeLevel: 2 })],
      existing: [existing({ cmsCatalogId: 1, isLeaf: true, treeLevel: 1 })],
    });
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].diff.isLeaf).toBeDefined();
    expect(plan.updates[0].diff.treeLevel).toBeDefined();
  });

  it("stats summary counts correctly", () => {
    const plan = reconcileCatalogs({
      fetched: [
        flat({ cmsCatalogId: 1, name: "A-new" }),
        flat({ cmsCatalogId: 3 }),            // new
      ],
      existing: [
        existing({ cmsCatalogId: 1, name: "A-old" }),
        existing({ cmsCatalogId: 2, id: "uuid-2" }),   // missing → softDelete
      ],
    });
    expect(plan.stats).toMatchObject({
      inserted: 1,
      updated: 1,
      softDeleted: 1,
      unchanged: 0,
    });
  });
});
