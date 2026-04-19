import { describe, it, expect } from "vitest";
import { flattenTree } from "../../catalog-sync/flatten-tree";
import type { CmsCatalogNode } from "../../types";

function node(overrides: Partial<CmsCatalogNode>): CmsCatalogNode {
  return {
    id: 1,
    appid: 10,
    siteId: 81,
    name: "n",
    parentId: 0,
    innerCode: "001",
    alias: "x",
    treeLevel: 1,
    isLeaf: 1,
    type: 1,
    childCatalog: [],
    ...overrides,
  };
}

describe("flattenTree", () => {
  it("flattens a single leaf node", () => {
    const rows = flattenTree([node({ id: 1 })], 10, 81);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ cmsCatalogId: 1, appId: 10, siteId: 81 });
  });

  it("recursively flattens nested children", () => {
    const tree = [
      node({
        id: 1, isLeaf: 0,
        childCatalog: [
          node({ id: 2, parentId: 1, treeLevel: 2, isLeaf: 0,
            childCatalog: [node({ id: 3, parentId: 2, treeLevel: 3 })] }),
          node({ id: 4, parentId: 1, treeLevel: 2 }),
        ],
      }),
    ];
    const rows = flattenTree(tree, 10, 81);
    expect(rows.map((r) => r.cmsCatalogId).sort()).toEqual([1, 2, 3, 4]);
  });

  it("preserves parentId and treeLevel from source", () => {
    const tree = [
      node({ id: 1, parentId: 0, treeLevel: 1,
        childCatalog: [node({ id: 2, parentId: 1, treeLevel: 2 })] }),
    ];
    const rows = flattenTree(tree, 10, 81);
    const child = rows.find((r) => r.cmsCatalogId === 2)!;
    expect(child.parentId).toBe(1);
    expect(child.treeLevel).toBe(2);
  });

  it("maps isLeaf=1 to true, 0 to false", () => {
    const rows = flattenTree(
      [node({ id: 1, isLeaf: 1 }), node({ id: 2, isLeaf: 0 })],
      10, 81,
    );
    expect(rows.find((r) => r.cmsCatalogId === 1)?.isLeaf).toBe(true);
    expect(rows.find((r) => r.cmsCatalogId === 2)?.isLeaf).toBe(false);
  });

  it("uses node.siteId when present, falls back to fallback siteId otherwise", () => {
    const tree = [node({ id: 1, siteId: 99 })];
    const rows = flattenTree(tree, 10, 81);
    expect(rows[0].siteId).toBe(99);
  });

  it("copies player and preview fields", () => {
    const tree = [node({
      id: 1,
      videoPlayer: "vp", audioPlayer: "ap",
      livePlayer: "lp", vlivePlayer: "vlp",
      h5Preview: "h5", pcPreview: "pc",
      url: "/a/b/",
    })];
    const rows = flattenTree(tree, 10, 81);
    expect(rows[0]).toMatchObject({
      videoPlayer: "vp", audioPlayer: "ap",
      livePlayer: "lp", vlivePlayer: "vlp",
      h5Preview: "h5", pcPreview: "pc",
      url: "/a/b/",
    });
  });

  it("returns empty array for empty input", () => {
    expect(flattenTree([], 10, 81)).toEqual([]);
  });
});
