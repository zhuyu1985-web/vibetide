import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * 组织信息（读模型）。
 *
 * `brandName` 是发布流程需要的品牌展示名（CMS `source` 字段兜底）。当前 DB schema
 * 的 `organizations` 表没有显式 `brand_name` 列，因此用 `name` 作为 Phase 1 的
 * 合理兜底；后续若在 `settings` jsonb 里存了 `brandName`，可在此扩展读取。
 */
export interface OrganizationInfo {
  id: string;
  /** 用于 CMS `source` 字段的品牌展示名（兜底为 organizations.name） */
  brandName: string | null;
}

export async function getOrganizationById(
  id: string,
): Promise<OrganizationInfo | null> {
  const row = await db.query.organizations.findFirst({
    where: eq(organizations.id, id),
  });
  if (!row) return null;

  const settingsBrandName =
    typeof (row.settings as Record<string, unknown> | null)?.brandName === "string"
      ? ((row.settings as Record<string, unknown>).brandName as string)
      : null;

  return {
    id: row.id,
    brandName: settingsBrandName ?? row.name ?? null,
  };
}
