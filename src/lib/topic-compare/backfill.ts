/**
 * backfill.ts — 一次性 backfill 纯函数
 *
 * 给定一个账号（my 或 benchmark），调 TikHub 拉最近 30 条帖子，
 * 然后喂给 syncCollectedItems 落库，返回统计信息。
 *
 * 不产生 collection_run 记录（那是定期 cron 的职责），仅做快速回填。
 * 可被 server action 和 Inngest fn 共用。
 */

import { tikhubFetch } from "@/lib/collection/adapters/tikhub/http-client";
import { ACCOUNT_MAPPERS } from "@/lib/collection/adapters/tikhub/account-mappers";
import { TIKHUB_ACCOUNT_PLATFORM_ENDPOINTS } from "@/lib/collection/adapters/tikhub/config";
import type { RawItem } from "@/lib/collection/types";
import {
  syncCollectedItems,
  type SyncSourceBinding,
  type CollectedItemInput,
  type SyncResult,
} from "./sync-collected";
import { isTikhubAccountSupported } from "./constants";

// 平台 handle 参数名映射（backfill 直接按账号 handle 查，不需要 channel 对象）
const PLATFORM_HANDLE_PARAM: Record<string, string> = {
  douyin: "sec_user_id",
  weibo: "uid",
  kuaishou: "user_id",
  wechat_oa: "ghid",
  // wechat_mp 是 constants.ts 白名单用的面向用户名称，映射到 wechat_oa
  wechat_mp: "ghid",
};

/** constants.ts 中的用户平台名 → TikHub account mapper 平台名 */
const PLATFORM_TIKHUB_KEY: Record<string, string> = {
  douyin: "douyin",
  weibo: "weibo",
  kuaishou: "kuaishou",
  wechat_oa: "wechat_oa",
  wechat_mp: "wechat_oa",
};

const BACKFILL_LIMIT = 30;

export interface BackfillResult {
  /** 平台不在白名单时为 true，其余字段为默认值 */
  skipped: boolean;
  /** 实际从 TikHub 拿到的条目数（mapper 后） */
  itemsFetched: number;
  /** syncCollectedItems 的原始返回，skip 时为 null */
  syncResult: SyncResult | null;
  /** 本次首次入库的 my_posts.id 列表（benchmark 时永远为 [] ） */
  newMyPostIds: string[];
}

export async function backfillAccount(params: {
  organizationId: string;
  kind: "my" | "benchmark";
  accountId: string;
  /** 平台标识（与 constants.ts TIKHUB_ACCOUNT_SUPPORTED_PLATFORMS 对齐） */
  platform: string;
  /**
   * 账号在该平台的 handle / ID:
   * - douyin → sec_user_id
   * - weibo  → uid（数字字符串）
   * - kuaishou → user_id
   * - wechat_mp / wechat_oa → ghid
   */
  handle: string;
}): Promise<BackfillResult> {
  const { organizationId, kind, accountId, platform, handle } = params;

  if (!isTikhubAccountSupported(platform)) {
    return { skipped: true, itemsFetched: 0, syncResult: null, newMyPostIds: [] };
  }

  const tikhubKey = PLATFORM_TIKHUB_KEY[platform];
  const handleParam = PLATFORM_HANDLE_PARAM[platform];
  if (!tikhubKey || !handleParam) {
    // 理论上 isTikhubAccountSupported 过了就不会走到这里，防御性 skip
    return { skipped: true, itemsFetched: 0, syncResult: null, newMyPostIds: [] };
  }

  const endpoint =
    TIKHUB_ACCOUNT_PLATFORM_ENDPOINTS[tikhubKey as keyof typeof TIKHUB_ACCOUNT_PLATFORM_ENDPOINTS];

  const params_: Record<string, string | number> = {
    [handleParam]: handle,
    count: BACKFILL_LIMIT,
  };

  // 微博用 page 而非 count
  if (tikhubKey === "weibo") {
    delete params_.count;
    params_.page = 1;
  }

  const fetchResult = await tikhubFetch({ endpoint, params: params_ });

  const mapper =
    ACCOUNT_MAPPERS[tikhubKey as keyof typeof ACCOUNT_MAPPERS];
  const rawItems: RawItem[] = mapper(fetchResult.data);

  // RawItem → CollectedItemInput
  const items: CollectedItemInput[] = rawItems.map((it) => ({
    externalId: it.externalId ?? it.url ?? "",
    title: it.title,
    summary: it.summary ?? null,
    body: null,
    sourceUrl: it.url ?? null,
    publishedAt: it.publishedAt ?? null,
    views: it.viewCount ?? 0,
    likes: it.likeCount ?? 0,
    shares: it.shareCount ?? 0,
    comments: it.commentCount ?? 0,
    // contentFingerprint: 用 externalId（平台原生帖子 ID），my branch 必须有才能 dedup
    contentFingerprint: it.externalId ?? null,
    rawMetadata: it.rawMetadata ?? null,
  }));

  const binding: SyncSourceBinding =
    kind === "my"
      ? { kind: "my", platform, myAccountId: accountId }
      : { kind: "benchmark", platform, benchmarkAccountId: accountId };

  const syncResult = await syncCollectedItems({
    organizationId,
    binding,
    items,
  });

  return {
    skipped: false,
    itemsFetched: items.length,
    syncResult,
    newMyPostIds: syncResult.newMyPostIds,
  };
}
