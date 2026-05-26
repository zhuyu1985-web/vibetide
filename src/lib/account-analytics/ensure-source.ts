/**
 * 给一个账号确保 dedicated TikHub Account 模式 source 存在 + enabled。
 *
 * 设计：每个被自动抓取的账号都有一条专属 collection_source
 * （name = "Account Analytics · <账号名> · <平台>"），方便排错和按账号查 runs。
 *
 * 调用方：
 *   - accountAnalyticsCrawlCron (定时任务每天 05:00 SH)
 *   - accountAnalyticsCrawlOnDemand (event-driven 即时触发)
 */
import { db } from "@/db";
import { collectionSources, mediaOutletDictionary } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export type TikHubAccountPlatform =
  | "douyin"
  | "kuaishou"
  | "weibo"
  | "wechat_oa"
  | "xiaohongshu";

export interface EnsureSourceInput {
  organizationId: string;
  accountId: string;
  accountName: string;
  accountSource: "my" | "benchmark";
  platform: string;
  outletId: string;
  /** 7 天窗口足够覆盖大多数账号 daily 发布频次 + 安全边界 */
  maxPagesPerRun?: number;
  resultsPerPage?: number;
  monthlyBudgetUsd?: number;
}

export type EnsureSourceResult =
  | { ok: true; sourceId: string; created: boolean }
  | { ok: false; skipReason: string };

/**
 * @returns ok=false 当 outlet 不存在 / outlet.channels[] 缺平台对应识别符（如 douyin 缺 secUid）
 */
export async function ensureTikHubAccountSource(
  input: EnsureSourceInput,
): Promise<EnsureSourceResult> {
  const {
    organizationId,
    accountName,
    accountSource,
    platform,
    outletId,
    maxPagesPerRun = 3,
    resultsPerPage = 20,
    monthlyBudgetUsd = 3,
  } = input;

  // 1. 检查 outlet 存在且 channels[] 包含该平台 + 必填识别符
  const outlet = await db.query.mediaOutletDictionary.findFirst({
    where: eq(mediaOutletDictionary.id, outletId),
    columns: { id: true, channels: true, isActive: true },
  });
  if (!outlet) return { ok: false, skipReason: `outlet ${outletId} 不存在` };
  if (!outlet.isActive) return { ok: false, skipReason: `outlet 已禁用` };

  const channels = (outlet.channels ?? []) as unknown as Array<Record<string, unknown>>;
  const ch = channels.find((c) => c.type === platform);
  if (!ch) {
    return { ok: false, skipReason: `outlet.channels[] 缺 ${platform} 配置` };
  }
  // 校验识别符
  if (platform === "douyin" && !ch.secUid) {
    return { ok: false, skipReason: "douyin channel 缺 secUid" };
  }
  if (platform === "weibo" && !ch.uid) {
    return { ok: false, skipReason: "weibo channel 缺 uid" };
  }
  if (platform === "kuaishou" && !ch.userId) {
    return { ok: false, skipReason: "kuaishou channel 缺 userId" };
  }
  if (platform === "wechat_oa" && !ch.ghid) {
    return { ok: false, skipReason: "wechat_oa channel 缺 ghid" };
  }

  // 2. 查现有 source（按 unique name 唯一）
  const sourceName = `Account Analytics · ${accountName} · ${platform}`;
  const existing = await db.query.collectionSources.findFirst({
    where: and(
      eq(collectionSources.organizationId, organizationId),
      eq(collectionSources.name, sourceName),
    ),
  });

  const cfg = {
    mode: "account" as const,
    outletIds: [outletId],
    accountPlatforms: [platform],
    maxPagesPerRun,
    resultsPerPage,
    monthlyBudgetUsd,
  };

  if (existing) {
    // 已存在 → 确保 enabled + config 最新 + outlet_id 列回填（治理历史 source）
    if (
      !existing.enabled ||
      JSON.stringify(existing.config) !== JSON.stringify(cfg) ||
      existing.outletId !== outletId
    ) {
      await db
        .update(collectionSources)
        .set({
          enabled: true,
          config: cfg,
          outletId,
          updatedAt: new Date(),
        })
        .where(eq(collectionSources.id, existing.id));
    }
    return { ok: true, sourceId: existing.id, created: false };
  }

  // 3. 创建新 source
  const [row] = await db
    .insert(collectionSources)
    .values({
      organizationId,
      sourceType: "tikhub",
      name: sourceName,
      enabled: true,
      config: cfg,
      outletId,
      targetModules: ["hot_topics"],
      defaultTags: [`account-analytics:${accountSource}`],
    })
    .returning({ id: collectionSources.id });
  return { ok: true, sourceId: row.id, created: true };
}
