import { db } from "@/db";
import { benchmarkAccounts } from "@/db/schema";
import { and, eq, or, isNull, desc } from "drizzle-orm";

export interface BenchmarkAccountRow {
  id: string;
  platform: string;
  level: string;
  handle: string;
  name: string;
  avatarUrl: string | null;
  accountUrl: string | null;
  description: string | null;
  region: string | null;
  isPreset: boolean;
  isEnabled: boolean;
  postCount: number;
  organizationId: string | null;
  createdAt: string;
}

/**
 * 列出对标账号。返回全局 preset（org_id = null）+ 当前组织自建（org_id = orgId）的合集。
 */
export async function listBenchmarkAccounts(
  orgId: string,
  filters?: {
    platform?: string;
    level?: string;
    onlyEnabled?: boolean;
  }
): Promise<BenchmarkAccountRow[]> {
  const conditions = [
    or(isNull(benchmarkAccounts.organizationId), eq(benchmarkAccounts.organizationId, orgId)),
  ];
  if (filters?.platform) {
    conditions.push(eq(benchmarkAccounts.platform, filters.platform as never));
  }
  if (filters?.level) {
    conditions.push(eq(benchmarkAccounts.level, filters.level as never));
  }
  if (filters?.onlyEnabled) {
    conditions.push(eq(benchmarkAccounts.isEnabled, true));
  }

  const rows = await db
    .select()
    .from(benchmarkAccounts)
    .where(and(...conditions))
    .orderBy(desc(benchmarkAccounts.isPreset), desc(benchmarkAccounts.createdAt));

  return rows.map((r) => ({
    id: r.id,
    platform: r.platform,
    level: r.level,
    handle: r.handle,
    name: r.name,
    avatarUrl: r.avatarUrl,
    accountUrl: r.accountUrl,
    description: r.description,
    region: r.region,
    isPreset: r.isPreset,
    isEnabled: r.isEnabled,
    postCount: r.postCount ?? 0,
    organizationId: r.organizationId,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getBenchmarkAccountById(id: string) {
  const [row] = await db
    .select()
    .from(benchmarkAccounts)
    .where(eq(benchmarkAccounts.id, id))
    .limit(1);
  return row ?? null;
}
