import { db } from "@/db";
import { myAccounts, myPosts, myPostDistributions } from "@/db/schema";
import { and, eq, desc, sql } from "drizzle-orm";

export interface MyAccountRow {
  id: string;
  platform: string;
  handle: string;
  name: string;
  avatarUrl: string | null;
  accountUrl: string | null;
  description: string | null;
  crawlStatus: string | null;
  lastCrawledAt: string | null;
  postCount: number;
  followerCount: number | null;
  isEnabled: boolean;
  createdAt: string;
}

export async function listMyAccounts(orgId: string): Promise<MyAccountRow[]> {
  const rows = await db
    .select()
    .from(myAccounts)
    .where(eq(myAccounts.organizationId, orgId))
    .orderBy(desc(myAccounts.createdAt));

  return rows.map((r) => ({
    id: r.id,
    platform: r.platform,
    handle: r.handle,
    name: r.name,
    avatarUrl: r.avatarUrl,
    accountUrl: r.accountUrl,
    description: r.description,
    crawlStatus: r.crawlStatus,
    lastCrawledAt: r.lastCrawledAt?.toISOString() ?? null,
    postCount: r.postCount ?? 0,
    followerCount: r.followerCount,
    isEnabled: r.isEnabled,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getMyAccountById(orgId: string, id: string) {
  const [row] = await db
    .select()
    .from(myAccounts)
    .where(and(eq(myAccounts.id, id), eq(myAccounts.organizationId, orgId)))
    .limit(1);
  return row ?? null;
}

/**
 * 刷新某账号的 postCount 统计（通过 distributions 关联的 post 数）。
 */
export async function refreshAccountPostCount(accountId: string): Promise<void> {
  const [row] = await db
    .select({ cnt: sql<number>`count(*)::int` })
    .from(myPostDistributions)
    .where(eq(myPostDistributions.myAccountId, accountId));

  await db
    .update(myAccounts)
    .set({ postCount: row?.cnt ?? 0, lastCrawledAt: new Date() })
    .where(eq(myAccounts.id, accountId));
}
