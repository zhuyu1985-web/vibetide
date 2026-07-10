// src/lib/collection/adapters/tikhub/account-search.ts
//
// 抖音用户搜索 —— 把"中文媒体名称"解析成 secUid。
// 用于「采集源内联 Excel 批量导入」: 用户只填名称时,调本模块自动补 secUid,
// 再交给 account 模式按 sec_user_id 拉该账号 feed。
//
// ⚠️  tikhub 抖音用户搜索 endpoint 版本在持续迭代(V1/V2/V3 多有弃用)。下方
//     endpoint 路径与响应 JSON 路径为 best-effort 映射,**上线前必须**对照
//     tikhub 最新文档 + 用真实 TIKHUB_API_KEY 实测回归一轮(尤其确认候选列表
//     所在字段与 sec_uid / follower_count / 认证字段的精确路径),与
//     account-mappers.ts 的"实测验证"风格一致。mapper 对字段缺失全部容错。

import { tikhubFetch } from "./http-client";

/** 抖音"搜索用户"endpoint(实测锁定前的 best-effort 路径)。 */
export const DOUYIN_USER_SEARCH_ENDPOINT =
  "/api/v1/douyin/web/fetch_user_search_result_v2";

export interface DouyinUserCandidate {
  /** sec_user_id — account 模式 fetch_user_post_videos 的入参 */
  secUid: string;
  nickname: string;
  followerCount: number;
  /** 企业蓝V 或个人认证 → true */
  verified: boolean;
  avatarUrl?: string;
  uid?: string;
}

// ─── 响应映射(容错) ──────────────────────────────────────────────────
interface RawAvatar {
  url_list?: string[];
}
interface RawUserInfo {
  sec_uid?: string;
  uid?: string;
  nickname?: string;
  follower_count?: number;
  fans_count?: number;
  custom_verify?: string;
  enterprise_verify_reason?: string;
  avatar_thumb?: RawAvatar;
  avatar_medium?: RawAvatar;
  avatar_larger?: RawAvatar;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/**
 * 把抖音用户搜索响应映射为候选列表。
 * 候选列表在不同版本里可能落在 data.user_list / data.data / data.business_data,
 * 每项的用户信息可能直接在项上,也可能嵌在 user_info 字段 —— 全部兼容。
 */
export function mapDouyinUserSearch(resp: unknown): DouyinUserCandidate[] {
  const data = (resp as { data?: Record<string, unknown> })?.data;
  if (!data || typeof data !== "object") return [];

  const list =
    (asArray(data.user_list).length && asArray(data.user_list)) ||
    (asArray(data.data).length && asArray(data.data)) ||
    (asArray(data.business_data).length && asArray(data.business_data)) ||
    [];

  const out: DouyinUserCandidate[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const node = raw as Record<string, unknown>;
    const info = (node.user_info && typeof node.user_info === "object"
      ? node.user_info
      : node) as RawUserInfo;

    const secUid = typeof info.sec_uid === "string" ? info.sec_uid : "";
    if (!secUid) continue;

    const enterprise = (info.enterprise_verify_reason ?? "").trim();
    const custom = (info.custom_verify ?? "").trim();
    const follower =
      typeof info.follower_count === "number"
        ? info.follower_count
        : typeof info.fans_count === "number"
          ? info.fans_count
          : 0;

    out.push({
      secUid,
      nickname: typeof info.nickname === "string" ? info.nickname : "",
      followerCount: follower,
      verified: Boolean(enterprise || custom),
      avatarUrl:
        info.avatar_thumb?.url_list?.[0] ??
        info.avatar_medium?.url_list?.[0] ??
        info.avatar_larger?.url_list?.[0],
      uid: typeof info.uid === "string" ? info.uid : undefined,
    });
  }
  return out;
}

/** 选号策略: 已认证优先 → 同认证状态按粉丝降序 → 取第一。 */
export function pickBestCandidate(
  candidates: DouyinUserCandidate[],
): DouyinUserCandidate | null {
  if (candidates.length === 0) return null;
  const verified = candidates.filter((c) => c.verified);
  const pool = verified.length > 0 ? verified : candidates;
  return [...pool].sort((a, b) => b.followerCount - a.followerCount)[0] ?? null;
}

/** 按名称搜一次抖音用户,返回最佳候选 + 全部候选(供前端切换) + 本次花费。 */
export async function searchDouyinUser(name: string): Promise<{
  candidate: DouyinUserCandidate | null;
  allCandidates: DouyinUserCandidate[];
  costUsd: number;
}> {
  const keyword = name.trim();
  if (!keyword) return { candidate: null, allCandidates: [], costUsd: 0 };

  const result = await tikhubFetch({
    endpoint: DOUYIN_USER_SEARCH_ENDPOINT,
    params: { keyword, count: 10, offset: 0 },
  });
  const allCandidates = mapDouyinUserSearch(result.data);
  return {
    candidate: pickBestCandidate(allCandidates),
    allCandidates,
    costUsd: result.costUsd,
  };
}
