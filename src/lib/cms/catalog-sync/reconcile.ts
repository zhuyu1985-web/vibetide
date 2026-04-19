import type { FlatCatalogRow } from "./flatten-tree";

interface ExistingCatalogRow {
  id: string;                // DB uuid
  cmsCatalogId: number;
  appId: number;
  siteId: number;
  name: string;
  parentId: number | null;
  innerCode: string | null;
  alias: string | null;
  treeLevel: number | null;
  isLeaf: boolean | null;
  catalogType: number | null;
  deletedAt: Date | null;
}

export interface CatalogUpdatePlan {
  id: string;                // DB uuid
  cmsCatalogId: number;
  diff: Partial<Record<keyof FlatCatalogRow | "deletedAt", { from: unknown; to: unknown }>>;
  /** 新值，便于上层直接作为 update set */
  patch: Partial<FlatCatalogRow> & { deletedAt?: Date | null };
}

export interface CatalogSoftDeletePlan {
  id: string;
  cmsCatalogId: number;
}

export interface ReconcileResult {
  inserts: FlatCatalogRow[];
  updates: CatalogUpdatePlan[];
  softDeletes: CatalogSoftDeletePlan[];
  unchanged: number;
  stats: {
    fetched: number;
    existing: number;
    inserted: number;
    updated: number;
    softDeleted: number;
    unchanged: number;
  };
}

export interface ReconcileInput {
  fetched: FlatCatalogRow[];
  existing: ExistingCatalogRow[];
  deleteMissing?: boolean;
}

const WATCHED_FIELDS: Array<keyof FlatCatalogRow> = [
  "appId", "siteId", "name", "parentId", "innerCode", "alias",
  "treeLevel", "isLeaf", "catalogType",
  "videoPlayer", "audioPlayer", "livePlayer", "vlivePlayer",
  "h5Preview", "pcPreview", "url",
];

/**
 * 对比"CMS 真相"与"本地快照"，产出 insert / update / soft-delete 三类计划。
 *
 * 纯函数 —— 不写库；上层 syncCmsCatalogs 基于返回值执行 DAL。
 */
export function reconcileCatalogs(input: ReconcileInput): ReconcileResult {
  const { fetched, existing } = input;
  const deleteMissing = input.deleteMissing ?? true;

  const existingMap = new Map(existing.map((r) => [r.cmsCatalogId, r]));
  const fetchedIds = new Set(fetched.map((r) => r.cmsCatalogId));

  const inserts: FlatCatalogRow[] = [];
  const updates: CatalogUpdatePlan[] = [];
  let unchanged = 0;

  for (const row of fetched) {
    const prev = existingMap.get(row.cmsCatalogId);

    if (!prev) {
      inserts.push(row);
      continue;
    }

    const diff: CatalogUpdatePlan["diff"] = {};
    const patch: CatalogUpdatePlan["patch"] = {};

    for (const field of WATCHED_FIELDS) {
      const prevVal = (prev as unknown as Record<string, unknown>)[field] ?? null;
      const newVal = row[field] ?? null;
      if (!shallowEqual(prevVal, newVal)) {
        diff[field] = { from: prevVal, to: newVal };
        (patch as Record<string, unknown>)[field] = newVal;
      }
    }

    // 如果本地标记删除但 CMS 又返回了 → 复活
    if (prev.deletedAt) {
      diff.deletedAt = { from: prev.deletedAt, to: null };
      patch.deletedAt = null;
    }

    if (Object.keys(diff).length > 0) {
      updates.push({ id: prev.id, cmsCatalogId: row.cmsCatalogId, diff, patch });
    } else {
      unchanged++;
    }
  }

  const softDeletes: CatalogSoftDeletePlan[] = deleteMissing
    ? existing
        .filter((r) => !fetchedIds.has(r.cmsCatalogId) && r.deletedAt === null)
        .map((r) => ({ id: r.id, cmsCatalogId: r.cmsCatalogId }))
    : [];

  return {
    inserts,
    updates,
    softDeletes,
    unchanged,
    stats: {
      fetched: fetched.length,
      existing: existing.length,
      inserted: inserts.length,
      updated: updates.length,
      softDeleted: softDeletes.length,
      unchanged,
    },
  };
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (typeof a !== typeof b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}
