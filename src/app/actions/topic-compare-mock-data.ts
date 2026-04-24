"use server";

import { db } from "@/db";
import {
  myAccounts,
  myPosts,
  myPostDistributions,
  benchmarkAccounts,
  benchmarkPosts,
} from "@/db/schema";
import { userProfiles } from "@/db/schema/users";
import { and, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import crypto from "node:crypto";

async function requireUserAndOrg() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("未登录");

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile?.organizationId) throw new Error("用户未关联组织");
  return { userId: user.id, orgId: profile.organizationId };
}

function computeFingerprint(title: string): string {
  const normalized = title
    .replace(/[\s\u3000]+/g, "")
    .replace(/[，。、：；！？（）【】《》""''—\-,.!?()\[\]<>:"]/g, "")
    .slice(0, 40);
  return crypto.createHash("md5").update(normalized).digest("hex").slice(0, 16);
}

// ---------------------------------------------------------------------------
// 批量导入 my_posts（给一个 my_account 添加帖子）
// ---------------------------------------------------------------------------

export interface MyPostImportItem {
  title: string;
  summary?: string;
  body?: string;
  topic?: string;
  publishedUrl?: string;
  publishedAt?: string; // ISO
  views?: number;
  likes?: number;
  shares?: number;
  comments?: number;
}

export async function importMyPostsForAccount(input: {
  accountId: string;
  items: MyPostImportItem[];
}): Promise<{ success: boolean; inserted?: number; error?: string }> {
  try {
    const { orgId } = await requireUserAndOrg();

    const account = await db.query.myAccounts.findFirst({
      where: and(
        eq(myAccounts.id, input.accountId),
        eq(myAccounts.organizationId, orgId)
      ),
    });
    if (!account) return { success: false, error: "账号不存在或无权访问" };

    let inserted = 0;
    for (const item of input.items) {
      if (!item.title?.trim()) continue;

      const fingerprint = computeFingerprint(item.title);
      const publishedAt = item.publishedAt ? new Date(item.publishedAt) : new Date();

      // upsert my_post by (org, fingerprint)
      const [existingPost] = await db
        .select({ id: myPosts.id })
        .from(myPosts)
        .where(
          and(
            eq(myPosts.organizationId, orgId),
            eq(myPosts.contentFingerprint, fingerprint)
          )
        )
        .limit(1);

      let myPostId: string;
      if (existingPost) {
        myPostId = existingPost.id;
      } else {
        const [row] = await db
          .insert(myPosts)
          .values({
            organizationId: orgId,
            title: item.title.trim(),
            summary: item.summary ?? null,
            body: item.body ?? null,
            topic: item.topic ?? null,
            contentFingerprint: fingerprint,
            publishedAt,
            originalSourceUrl: item.publishedUrl ?? null,
            totalViews: item.views ?? 0,
            totalLikes: item.likes ?? 0,
            totalShares: item.shares ?? 0,
            totalComments: item.comments ?? 0,
          })
          .returning({ id: myPosts.id });
        myPostId = row.id;
      }

      // upsert distribution
      await db
        .insert(myPostDistributions)
        .values({
          myPostId,
          myAccountId: input.accountId,
          publishedUrl: item.publishedUrl ?? null,
          publishedAt,
          views: item.views ?? 0,
          likes: item.likes ?? 0,
          shares: item.shares ?? 0,
          comments: item.comments ?? 0,
        })
        .onConflictDoUpdate({
          target: [myPostDistributions.myPostId, myPostDistributions.myAccountId],
          set: {
            publishedUrl: item.publishedUrl ?? null,
            publishedAt,
            views: item.views ?? 0,
            likes: item.likes ?? 0,
            shares: item.shares ?? 0,
            comments: item.comments ?? 0,
            collectedAt: new Date(),
          },
        });

      inserted++;
    }

    // 刷新账号 postCount
    await db
      .update(myAccounts)
      .set({ postCount: inserted, lastCrawledAt: new Date() })
      .where(eq(myAccounts.id, input.accountId));

    revalidatePath("/topic-compare");
    revalidatePath("/topic-compare/accounts");
    return { success: true, inserted };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// 批量导入 benchmark_posts
// ---------------------------------------------------------------------------

export interface BenchmarkPostImportItem {
  title: string;
  summary?: string;
  body?: string;
  topic?: string;
  sourceUrl?: string;
  publishedAt?: string;
  views?: number;
  likes?: number;
  shares?: number;
  comments?: number;
}

export async function importBenchmarkPostsForAccount(input: {
  accountId: string;
  items: BenchmarkPostImportItem[];
}): Promise<{ success: boolean; inserted?: number; error?: string }> {
  try {
    await requireUserAndOrg();
    const account = await db.query.benchmarkAccounts.findFirst({
      where: eq(benchmarkAccounts.id, input.accountId),
    });
    if (!account) return { success: false, error: "账号不存在" };

    let inserted = 0;
    for (const item of input.items) {
      if (!item.title?.trim()) continue;
      const fingerprint = computeFingerprint(item.title);
      const publishedAt = item.publishedAt ? new Date(item.publishedAt) : new Date();

      await db.insert(benchmarkPosts).values({
        benchmarkAccountId: input.accountId,
        title: item.title.trim(),
        summary: item.summary ?? null,
        body: item.body ?? null,
        topic: item.topic ?? null,
        contentFingerprint: fingerprint,
        sourceUrl: item.sourceUrl ?? null,
        publishedAt,
        views: item.views ?? 0,
        likes: item.likes ?? 0,
        shares: item.shares ?? 0,
        comments: item.comments ?? 0,
      });
      inserted++;
    }

    await db
      .update(benchmarkAccounts)
      .set({ postCount: inserted, lastCrawledAt: new Date() })
      .where(eq(benchmarkAccounts.id, input.accountId));

    revalidatePath("/topic-compare");
    revalidatePath("/benchmark-accounts");
    return { success: true, inserted };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
