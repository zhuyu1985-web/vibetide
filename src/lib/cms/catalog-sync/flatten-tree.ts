import type { CmsCatalogNode } from "../types";

/**
 * flattenTree 输出的一条记录。字段与 DAL cms-catalogs.CmsCatalogFields 对齐。
 */
export interface FlatCatalogRow {
  cmsCatalogId: number;
  appId: number;
  siteId: number;
  name: string;
  parentId: number;
  innerCode: string;
  alias: string;
  treeLevel: number;
  isLeaf: boolean;
  catalogType: number;
  videoPlayer?: string;
  audioPlayer?: string;
  livePlayer?: string;
  vlivePlayer?: string;
  h5Preview?: string;
  pcPreview?: string;
  url?: string;
}

/**
 * 深度优先递归扁平化 CMS 栏目树。
 *
 * @param nodes        getCatalogTree 返回的一级 node 列表
 * @param appId        归属的 app.id（fallback）
 * @param fallbackSiteId  当 node.siteId 缺失时的 fallback
 */
export function flattenTree(
  nodes: CmsCatalogNode[],
  appId: number,
  fallbackSiteId: number,
): FlatCatalogRow[] {
  const out: FlatCatalogRow[] = [];
  walk(nodes, out, appId, fallbackSiteId);
  return out;
}

function walk(
  nodes: CmsCatalogNode[],
  out: FlatCatalogRow[],
  appId: number,
  fallbackSiteId: number,
): void {
  for (const node of nodes) {
    out.push({
      cmsCatalogId: node.id,
      appId,
      siteId: node.siteId ?? fallbackSiteId,
      name: node.name,
      parentId: node.parentId,
      innerCode: node.innerCode,
      alias: node.alias,
      treeLevel: node.treeLevel,
      isLeaf: node.isLeaf === 1,
      catalogType: node.type,
      videoPlayer: node.videoPlayer,
      audioPlayer: node.audioPlayer,
      livePlayer: node.livePlayer,
      vlivePlayer: node.vlivePlayer,
      h5Preview: node.h5Preview,
      pcPreview: node.pcPreview,
      url: node.url,
    });

    if (node.childCatalog && node.childCatalog.length > 0) {
      walk(node.childCatalog, out, appId, fallbackSiteId);
    }
  }
}
