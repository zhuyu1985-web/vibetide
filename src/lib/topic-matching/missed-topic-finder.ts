import crypto from "node:crypto";
import { db } from "@/db";
import {
  benchmarkPosts,
  benchmarkAccounts,
  myPosts,
  topicMatches,
  missedTopics,
} from "@/db/schema";
import { and, eq, gte, ilike, desc, inArray, sql, or, isNull } from "drizzle-orm";

/**
 * 漏题识别（反向）：
 *   找出对标账号发过、我方没有任何 my_post 能对上的话题。
 *
 * 算法：
 *   1. 取最近 N 天的 benchmark_posts（对标发过的）
 *   2. 排除已经被 topic_matches 关联的（已覆盖）
 *   3. 按 content_fingerprint 归并去重
 *   4. 尝试与 my_posts 标题关键词软匹配，若命中 → decision=covered；否则 suspected
 *   5. upsert 到 missed_topics
 */

function normalizeTitle(title: string): string {
  return title
    .replace(/[\s\u3000]+/g, "")
    .replace(/[，。、：；！？（）【】《》""''—\-,.!?()\[\]<>:"]/g, "")
    .slice(0, 40);
}

function computeFingerprint(orgId: string, title: string): string {
  const normalized = normalizeTitle(title);
  return crypto
    .createHash("md5")
    .update(`${orgId}:${normalized}`)
    .digest("hex")
    .slice(0, 24);
}

export async function detectMissedTopicsForOrg(params: {
  orgId: string;
  sinceDays?: number;
  limitPerFingerprint?: number;
}): Promise<{ scanned: number; created: number; covered: number }> {
  const { orgId, sinceDays = 14, limitPerFingerprint = 1000 } = params;
  const since = new Date(Date.now() - sinceDays * 24 * 3600 * 1000);

  // 所有已被我方通过 topic_matches 关联的 benchmark_post_id
  const matches = await db
    .select({ benchmarkPostIds: topicMatches.benchmarkPostIds })
    .from(topicMatches)
    .where(eq(topicMatches.organizationId, orgId));

  const coveredSet = new Set<string>();
  for (const m of matches) {
    for (const id of (m.benchmarkPostIds as string[]) ?? []) {
      coveredSet.add(id);
    }
  }

  // 取最近 N 天 benchmark posts（全局 preset + 本组织）
  const rows = await db
    .select({
      id: benchmarkPosts.id,
      title: benchmarkPosts.title,
      summary: benchmarkPosts.summary,
      publishedAt: benchmarkPosts.publishedAt,
      views: benchmarkPosts.views,
      likes: benchmarkPosts.likes,
      accountId: benchmarkAccounts.id,
      accountName: benchmarkAccounts.name,
      accountLevel: benchmarkAccounts.level,
      accountPlatform: benchmarkAccounts.platform,
      accountOrgId: benchmarkAccounts.organizationId,
    })
    .from(benchmarkPosts)
    .innerJoin(
      benchmarkAccounts,
      eq(benchmarkPosts.benchmarkAccountId, benchmarkAccounts.id)
    )
    .where(
      and(
        or(
          isNull(benchmarkAccounts.organizationId),
          eq(benchmarkAccounts.organizationId, orgId)
        ),
        eq(benchmarkAccounts.isEnabled, true),
        gte(benchmarkPosts.publishedAt, since)
      )
    )
    .orderBy(desc(benchmarkPosts.publishedAt))
    .limit(limitPerFingerprint);

  // 按 fingerprint 归并（不同账号同题只生成一条漏题，其余作为 related）
  const byFp = new Map<
    string,
    {
      primary: (typeof rows)[number];
      related: (typeof rows)[number][];
    }
  >();

  for (const row of rows) {
    if (coveredSet.has(row.id)) continue; // 已被 topic_matches 覆盖
    const fp = computeFingerprint(orgId, row.title);
    if (!byFp.has(fp)) {
      byFp.set(fp, { primary: row, related: [] });
    } else {
      byFp.get(fp)!.related.push(row);
    }
  }

  // 加载所有我方 posts 的标题做软匹配
  const myPostRows = await db
    .select({ id: myPosts.id, title: myPosts.title })
    .from(myPosts)
    .where(eq(myPosts.organizationId, orgId));

  function findCoveringMyPost(title: string): { id: string; title: string } | null {
    const normalizedKey = normalizeTitle(title).slice(0, 10);
    if (normalizedKey.length < 4) return null;
    for (const mp of myPostRows) {
      if (mp.title.includes(normalizedKey) || normalizeTitle(mp.title).slice(0, 10) === normalizedKey) {
        return mp;
      }
    }
    return null;
  }

  let created = 0;
  let covered = 0;
  for (const [fp, { primary, related }] of byFp) {
    const coveringMy = findCoveringMyPost(primary.title);
    const decision: "covered" | "suspected" = coveringMy ? "covered" : "suspected";
    if (decision === "covered") covered++;

    // heat score：粗略按 views + likes*10 归一到 0-100
    const heatRaw = (primary.views ?? 0) + (primary.likes ?? 0) * 10;
    const heatScore = Math.min(100, Math.floor(heatRaw / 1000));

    await db
      .insert(missedTopics)
      .values({
        organizationId: orgId,
        primaryBenchmarkPostId: primary.id,
        relatedBenchmarkPostIds: related.map((r) => r.id),
        title: primary.title,
        topic: primary.summary?.slice(0, 80) ?? null,
        contentFingerprint: fp,
        discoveredAt: primary.publishedAt ?? new Date(),
        heatScore,
        decision,
        matchedMyPostId: coveringMy?.id ?? null,
        matchedMyPostTitleSnapshot: coveringMy?.title ?? null,
      })
      .onConflictDoUpdate({
        target: [missedTopics.organizationId, missedTopics.contentFingerprint],
        set: {
          relatedBenchmarkPostIds: related.map((r) => r.id),
          heatScore,
          updatedAt: new Date(),
          // 不覆盖人工决定
        },
      });
    created++;
  }

  return { scanned: rows.length, created, covered };
}
