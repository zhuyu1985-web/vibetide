"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  myAccounts,
  benchmarkAccounts,
  mediaOutletDictionary,
  collectionRuns,
  collectionSources,
} from "@/db/schema";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { inngest } from "@/inngest/client";
import {
  getAccountReportFullDataPage,
  type FullDataRow,
} from "@/lib/dal/account-analytics";
import {
  parseProfileUrl,
  type SupportedPlatform,
} from "@/lib/account-analytics/parse-profile-url";
import { ensureTikHubAccountSource } from "@/lib/account-analytics/ensure-source";
import type { Channel } from "@/lib/media-outlet/channels";

/**
 * benchmark.level (pgEnum: central/provincial/city/industry/self_media)
 * → outletTier (zod enum: central/provincial_municipal/industry/district_media/government_self_media)
 *
 * 两套 enum 历史上独立维护，benchmark 偏行政级别，outletTier 偏媒体类型，
 * 必须映射。其它非法 / 未提供的值统一兜底为 district_media（最常见的区县融媒）。
 */
function mapBenchmarkLevelToOutletTier(
  level: string | null | undefined,
): "central" | "provincial_municipal" | "industry" | "district_media" | "government_self_media" {
  switch (level) {
    case "central":
      return "central";
    case "provincial":
      return "provincial_municipal";
    case "industry":
      return "industry";
    case "self_media":
      return "government_self_media";
    case "city":
    default:
      return "district_media";
  }
}

/**
 * 查或建账号对应的 outlet —— 用于 toggle 开启 / 配置识别符 / 绑定账号 三个入口共用。
 *
 * 关键：先按 (organizationId, outletName) 查同名 outlet；命中则复用，避免触发
 * media_outlet_dictionary_org_name_unique 约束（同公司多平台账号常重名）。
 *
 * outletTier 必须用合法的 zod enum 值，否则后续在媒体字典编辑表单提交时会被 zod 拒绝。
 */
async function ensureOutletForAccount(args: {
  organizationId: string;
  accountName: string;
  accountSource: "my" | "benchmark";
  level?: string | null;
  region?: string | null;
}): Promise<string> {
  const existing = await db.query.mediaOutletDictionary.findFirst({
    where: and(
      eq(mediaOutletDictionary.organizationId, args.organizationId),
      eq(mediaOutletDictionary.outletName, args.accountName),
    ),
    columns: { id: true },
  });
  if (existing) return existing.id;

  const [created] = await db
    .insert(mediaOutletDictionary)
    .values({
      organizationId: args.organizationId,
      outletName: args.accountName,
      outletTier:
        args.accountSource === "benchmark"
          ? mapBenchmarkLevelToOutletTier(args.level)
          : "district_media",
      outletRegion: args.region ?? null,
      isActive: true,
      channels: [],
    })
    .returning({ id: mediaOutletDictionary.id });
  return created.id;
}

/**
 * 客户端"加载更多"调用 —— 拿后 N 条完整数据。
 */
export async function loadReportFullDataPage(input: {
  reportId: string;
  offset: number;
  limit?: number;
}): Promise<
  | { success: true; rows: FullDataRow[]; total: number; hasMore: boolean }
  | { success: false; error: string }
> {
  const auth = await getCurrentUserAndOrg();
  if (!auth) {
    return { success: false, error: "未登录或缺少组织信息" };
  }
  try {
    const res = await getAccountReportFullDataPage(auth.organizationId, input.reportId, {
      offset: input.offset,
      limit: input.limit,
    });
    return { success: true, ...res };
  } catch (err) {
    console.error("[account-analytics] 加载更多失败:", err);
    return { success: false, error: "加载失败，请稍后重试" };
  }
}

/**
 * 触发账号报告生成 —— 派发 Inngest 事件，由 accountAnalyticsReportGenerator 异步处理。
 */
export async function generateAccountReport(input: {
  accountId: string;
  accountSource: "my" | "benchmark";
  periodStart: string;
  periodEnd: string;
  reportType?: "daily" | "weekly" | "monthly" | "custom";
  forceRefresh?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const auth = await getCurrentUserAndOrg();
  if (!auth) {
    return { success: false, error: "未登录或缺少组织信息" };
  }

  try {
    await inngest.send({
      name: "account-analytics/daily-report.requested",
      data: {
        organizationId: auth.organizationId,
        accountId: input.accountId,
        accountSource: input.accountSource,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        reportType: input.reportType ?? "daily",
        forceRefresh: input.forceRefresh,
      },
    });
  } catch (err) {
    console.error("[account-analytics] 派发报告生成事件失败:", err);
    return { success: false, error: "事件派发失败，请稍后重试" };
  }

  revalidatePath(`/account-analytics/${input.accountId}`);
  return { success: true };
}

/**
 * 仅重跑指定报告的 LLM 归因 —— 派发 reanalyze 事件，函数内部会以 forceRefresh=true
 * 重新走一遍 report-generator pipeline。
 */
export async function regenerateReportAnalysis(
  reportId: string,
): Promise<{ success: boolean; error?: string }> {
  const auth = await getCurrentUserAndOrg();
  if (!auth) {
    return { success: false, error: "未登录或缺少组织信息" };
  }

  try {
    await inngest.send({
      name: "account-analytics/report.reanalyze",
      data: {
        organizationId: auth.organizationId,
        reportId,
      },
    });
  } catch (err) {
    console.error("[account-analytics] 派发重分析事件失败:", err);
    return { success: false, error: "事件派发失败，请稍后重试" };
  }

  return { success: true };
}

/**
 * 切换某账号的"定时自动抓取"开关。
 *
 * - UPDATE crawl_cron_enabled
 * - 如果开启时账号还没绑 outlet → 自动 ensure 一个占位 outlet（仅注册账号身份，
 *   channels[] 留空。用户后续在媒体字典补 secUid 后 cron 才能真正抓到内容）
 */
export async function toggleAccountCrawlCron(input: {
  accountId: string;
  accountSource: "my" | "benchmark";
  enabled: boolean;
}): Promise<{
  success: boolean;
  error?: string;
  needsSecUid?: boolean;
  outletId?: string;
}> {
  const auth = await getCurrentUserAndOrg();
  if (!auth) {
    return { success: false, error: "未登录或缺少组织信息" };
  }

  try {
    // 1. 加载账号当前状态
    const accountRow =
      input.accountSource === "my"
        ? await db.query.myAccounts.findFirst({
            where: and(
              eq(myAccounts.id, input.accountId),
              eq(myAccounts.organizationId, auth.organizationId),
            ),
          })
        : await db.query.benchmarkAccounts.findFirst({
            where: eq(benchmarkAccounts.id, input.accountId),
          });

    if (!accountRow) {
      return { success: false, error: "账号不存在或无权访问" };
    }

    let outletId = accountRow.outletId;
    let needsSecUid = false;

    // 2. 开启时若无 outlet → 查或建 outlet 后回填 outlet_id
    if (input.enabled && !outletId) {
      outletId = await ensureOutletForAccount({
        organizationId: auth.organizationId,
        accountName: accountRow.name,
        accountSource: input.accountSource,
        level:
          "level" in accountRow && typeof accountRow.level === "string"
            ? accountRow.level
            : null,
        region:
          "region" in accountRow && typeof accountRow.region === "string"
            ? accountRow.region
            : null,
      });
      needsSecUid = true;
    }

    // 3. 写回 crawl_cron_enabled + outlet_id
    if (input.accountSource === "my") {
      await db
        .update(myAccounts)
        .set({
          crawlCronEnabled: input.enabled,
          outletId,
          updatedAt: new Date(),
        })
        .where(eq(myAccounts.id, input.accountId));
    } else {
      await db
        .update(benchmarkAccounts)
        .set({
          crawlCronEnabled: input.enabled,
          outletId,
          updatedAt: new Date(),
        })
        .where(eq(benchmarkAccounts.id, input.accountId));
    }

    revalidatePath("/account-analytics");
    revalidatePath(`/account-analytics/${input.accountId}`);
    return {
      success: true,
      needsSecUid,
      outletId: outletId ?? undefined,
    };
  } catch (err) {
    console.error("[account-analytics] toggleAccountCrawlCron 失败:", err);
    const msg = err instanceof Error ? err.message : "切换失败，请稍后重试";
    return { success: false, error: msg };
  }
}

/**
 * 给账号绑定的 outlet 写入平台识别符（secUid/uid/userId/ghid）。
 *
 * 流程：
 *   1. 加载 account → 拿到 outletId
 *   2. parseProfileUrl 解析用户粘贴的 URL/裸 ID
 *   3. UPDATE outlet.channels[type=platform] 的对应 identifier 字段
 *   4. 若 outlet 还没有该 platform 的 channel → 自动加一个
 */
export async function setAccountChannelIdentifier(input: {
  accountId: string;
  accountSource: "my" | "benchmark";
  /** 用户粘贴的主页 URL 或裸 ID */
  raw: string;
}): Promise<{ success: boolean; error?: string; identifier?: string }> {
  const auth = await getCurrentUserAndOrg();
  if (!auth) return { success: false, error: "未登录或缺少组织信息" };

  try {
    // 1. 加载账号
    const account =
      input.accountSource === "my"
        ? await db.query.myAccounts.findFirst({
            where: and(
              eq(myAccounts.id, input.accountId),
              eq(myAccounts.organizationId, auth.organizationId),
            ),
          })
        : await db.query.benchmarkAccounts.findFirst({
            where: eq(benchmarkAccounts.id, input.accountId),
          });

    if (!account) return { success: false, error: "账号不存在" };

    // 2. 解析 URL/ID
    const supported = ["douyin", "weibo", "kuaishou", "wechat_oa"];
    if (!supported.includes(account.platform)) {
      return {
        success: false,
        error: `平台 ${account.platform} 不支持配置识别符（无需 cron 抓取）`,
      };
    }
    const parsed = parseProfileUrl(
      account.platform as SupportedPlatform,
      input.raw,
    );
    if (!parsed.ok) return { success: false, error: parsed.error };

    // 3. 若账号还没绑定 outlet → 查或建一个并回填 outlet_id
    let outletId = account.outletId;
    if (!outletId) {
      outletId = await ensureOutletForAccount({
        organizationId: auth.organizationId,
        accountName: account.name,
        accountSource: input.accountSource,
        level:
          "level" in account && typeof account.level === "string"
            ? account.level
            : null,
        region:
          "region" in account && typeof account.region === "string"
            ? account.region
            : null,
      });
      if (input.accountSource === "my") {
        await db
          .update(myAccounts)
          .set({ outletId, updatedAt: new Date() })
          .where(eq(myAccounts.id, input.accountId));
      } else {
        await db
          .update(benchmarkAccounts)
          .set({ outletId, updatedAt: new Date() })
          .where(eq(benchmarkAccounts.id, input.accountId));
      }
    }

    // 4. 更新 outlet.channels[type=platform]
    const outlet = await db.query.mediaOutletDictionary.findFirst({
      where: eq(mediaOutletDictionary.id, outletId),
    });
    if (!outlet) return { success: false, error: "outlet 已被删除" };

    const channels = (outlet.channels ?? []) as Channel[];
    const idx = channels.findIndex((c) => c.type === account.platform);
    const idField =
      account.platform === "douyin"
        ? "secUid"
        : account.platform === "weibo"
          ? "uid"
          : account.platform === "kuaishou"
            ? "userId"
            : "ghid";

    if (idx >= 0) {
      // 已存在 channel：UPDATE 对应字段
      const ch = channels[idx] as Channel & Record<string, unknown>;
      const merged = {
        ...ch,
        [idField]: parsed.identifier,
        nickname: ("nickname" in ch && typeof ch.nickname === "string"
          ? ch.nickname
          : account.name) as string,
      };
      channels[idx] = merged as unknown as Channel;
    } else {
      // 新增 channel skeleton
      channels.push({
        type: account.platform,
        nickname: account.name,
        [idField]: parsed.identifier,
      } as unknown as Channel);
    }

    await db
      .update(mediaOutletDictionary)
      .set({ channels, updatedAt: new Date() })
      .where(eq(mediaOutletDictionary.id, outletId));

    revalidatePath("/account-analytics");
    revalidatePath(`/account-analytics/${input.accountId}`);
    return { success: true, identifier: parsed.identifier };
  } catch (err) {
    console.error("[account-analytics] setAccountChannelIdentifier 失败:", err);
    const msg = err instanceof Error ? err.message : "保存失败，请稍后重试";
    return { success: false, error: msg };
  }
}

/**
 * 触发账号即时抓取 —— 先同步校验 outlet/识别符（避免静默 skip），再派发
 * crawl.requested 事件，函数内部找匹配的 collection_source 并派发
 * collection/source.run-requested。
 */
export async function crawlAccountOnDemand(input: {
  accountId: string;
  accountSource: "my" | "benchmark";
  sinceDays?: number;
}): Promise<{ success: boolean; error?: string; sourceId?: string }> {
  const auth = await getCurrentUserAndOrg();
  if (!auth) {
    return { success: false, error: "未登录或缺少组织信息" };
  }

  // 1. 加载账号 + 同步校验 outlet/channels[].uid 是否已配齐
  const account =
    input.accountSource === "my"
      ? await db.query.myAccounts.findFirst({
          where: and(
            eq(myAccounts.id, input.accountId),
            eq(myAccounts.organizationId, auth.organizationId),
          ),
        })
      : await db.query.benchmarkAccounts.findFirst({
          where: eq(benchmarkAccounts.id, input.accountId),
        });
  if (!account) return { success: false, error: "账号不存在或无权访问" };
  if (!account.outletId) {
    return {
      success: false,
      error: "该账号还未绑定 outlet（媒体字典），请先在媒体字典补全",
    };
  }

  const ensured = await ensureTikHubAccountSource({
    organizationId: auth.organizationId,
    accountId: account.id,
    accountName: account.name,
    accountSource: input.accountSource,
    platform: account.platform,
    outletId: account.outletId,
  });
  if (!ensured.ok) {
    return { success: false, error: ensured.skipReason };
  }

  try {
    await inngest.send({
      name: "account-analytics/crawl.requested",
      data: {
        organizationId: auth.organizationId,
        accountId: input.accountId,
        accountSource: input.accountSource,
        sinceDays: input.sinceDays,
      },
    });
  } catch (err) {
    console.error("[account-analytics] 派发抓取事件失败:", err);
    return { success: false, error: "事件派发失败，请稍后重试" };
  }

  return { success: true, sourceId: ensured.sourceId };
}

/**
 * 给账号详情页的"抓取进度卡"轮询用 —— 返回最近一次 collection_run 状态。
 * 不存在 source / 还没跑过 → 返回 null。
 */
export async function getAccountCrawlStatus(input: {
  accountId: string;
  accountSource: "my" | "benchmark";
}): Promise<
  | {
      success: true;
      latestRun: {
        runId: string;
        status: "running" | "success" | "partial" | "failed";
        startedAt: string;
        finishedAt: string | null;
        itemsInserted: number;
        itemsMerged: number;
        itemsFailed: number;
        errorSummary: string | null;
        trigger: string;
      } | null;
      hasSource: boolean;
    }
  | { success: false; error: string }
> {
  const auth = await getCurrentUserAndOrg();
  if (!auth) return { success: false, error: "未登录或缺少组织信息" };

  const account =
    input.accountSource === "my"
      ? await db.query.myAccounts.findFirst({
          where: and(
            eq(myAccounts.id, input.accountId),
            eq(myAccounts.organizationId, auth.organizationId),
          ),
          columns: { id: true, name: true, platform: true },
        })
      : await db.query.benchmarkAccounts.findFirst({
          where: eq(benchmarkAccounts.id, input.accountId),
          columns: { id: true, name: true, platform: true },
        });
  if (!account) return { success: false, error: "账号不存在" };

  const sourceName = `Account Analytics · ${account.name} · ${account.platform}`;
  const source = await db.query.collectionSources.findFirst({
    where: and(
      eq(collectionSources.organizationId, auth.organizationId),
      eq(collectionSources.name, sourceName),
    ),
    columns: { id: true },
  });
  if (!source) {
    return { success: true, latestRun: null, hasSource: false };
  }

  const latest = await db.query.collectionRuns.findFirst({
    where: eq(collectionRuns.sourceId, source.id),
    orderBy: [desc(collectionRuns.startedAt)],
  });

  return {
    success: true,
    hasSource: true,
    latestRun: latest
      ? {
          runId: latest.id,
          status: latest.status as "running" | "success" | "partial" | "failed",
          startedAt: latest.startedAt.toISOString(),
          finishedAt: latest.finishedAt?.toISOString() ?? null,
          itemsInserted: latest.itemsInserted,
          itemsMerged: latest.itemsMerged,
          itemsFailed: latest.itemsFailed,
          errorSummary: latest.errorSummary,
          trigger: latest.trigger,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Phase 2 —— "绑定账号" 流程
//
// 业务规则：
//   1) bindExistingOutletToAccount  从媒体字典已有 outlet 一键反向同步出一个
//      my_account 或 benchmark_account；handle 优先取 channel.nickname,
//      其次 channel 标识符（uid/secUid/userId/ghid）, 兜底用 outlet.outletName。
//   2) createAccountWithOutlet       手动添加账号 + 同时建/复用同名 outlet,
//      若提供主页 URL 则解析识别符写入 outlet.channels。
// ---------------------------------------------------------------------------

/**
 * 当前 Phase 2 "绑定账号" 支持的三大短视频/社交平台。
 * 选这三个是因为：
 *   1) my_accounts.platform pgEnum 和 channels union 同时支持
 *   2) tikhub adapter 已实现对应 endpoint
 *   3) 99% 的账号分析需求都集中在这三家
 *
 * 微信公众号 (wechat_oa) 的命名空间冲突 (my_accounts 用 "wechat"，channels 用 "wechat_oa")
 * 留待后续单独做映射层处理。
 */
type SupportedAccountPlatform = "douyin" | "weibo" | "kuaishou";

/** 取 channel 上对应平台的"显示性 handle"，给 my/benchmark_accounts.handle 用 */
function deriveHandleFromChannel(
  ch: (Channel & Record<string, unknown>) | undefined,
  fallback: string,
): string {
  if (!ch) return fallback;
  if (typeof ch.nickname === "string" && ch.nickname.trim()) return ch.nickname.trim();
  if (ch.type === "douyin" && typeof ch.secUid === "string") return ch.secUid;
  if (ch.type === "weibo" && typeof ch.uid === "string") return ch.uid;
  if (ch.type === "kuaishou" && typeof ch.userId === "string") return ch.userId;
  if (ch.type === "wechat_oa" && typeof ch.ghid === "string") return ch.ghid;
  return fallback;
}

export async function bindExistingOutletToAccount(input: {
  outletId: string;
  source: "my" | "benchmark";
  platform: SupportedAccountPlatform;
  /** benchmark 必填 (pgEnum)；my 不需要 */
  level?: "central" | "provincial" | "city" | "industry" | "self_media";
}): Promise<{
  success: boolean;
  accountId?: string;
  error?: string;
  alreadyExists?: boolean;
}> {
  const auth = await getCurrentUserAndOrg();
  if (!auth) return { success: false, error: "未登录或缺少组织信息" };

  if (input.source === "benchmark" && !input.level) {
    return { success: false, error: "绑定对标账号必须选择级别 (level)" };
  }

  try {
    // 1. 加载 outlet 确认归属本 org
    const outlet = await db.query.mediaOutletDictionary.findFirst({
      where: and(
        eq(mediaOutletDictionary.id, input.outletId),
        eq(mediaOutletDictionary.organizationId, auth.organizationId),
      ),
    });
    if (!outlet) return { success: false, error: "outlet 不存在或无权访问" };

    const channels = (outlet.channels ?? []) as Array<Channel & Record<string, unknown>>;
    const ch = channels.find((c) => c.type === input.platform);

    // 2. 推导 handle —— 优先 channel.nickname，其次 channel 上的 identifier
    const handle = deriveHandleFromChannel(ch, outlet.outletName);
    const displayName = outlet.outletName;

    // 3. 查重 + INSERT or UPDATE
    if (input.source === "my") {
      const existing = await db.query.myAccounts.findFirst({
        where: and(
          eq(myAccounts.organizationId, auth.organizationId),
          eq(myAccounts.platform, input.platform),
          eq(myAccounts.handle, handle),
        ),
        columns: { id: true, outletId: true },
      });
      if (existing) {
        if (existing.outletId !== outlet.id) {
          await db
            .update(myAccounts)
            .set({ outletId: outlet.id, updatedAt: new Date() })
            .where(eq(myAccounts.id, existing.id));
        }
        revalidatePath("/account-analytics");
        return { success: true, accountId: existing.id, alreadyExists: true };
      }
      const [created] = await db
        .insert(myAccounts)
        .values({
          organizationId: auth.organizationId,
          platform: input.platform,
          handle,
          name: displayName,
          outletId: outlet.id,
          isEnabled: true,
        })
        .returning({ id: myAccounts.id });
      revalidatePath("/account-analytics");
      return { success: true, accountId: created.id };
    }

    // benchmark
    const existing = await db.query.benchmarkAccounts.findFirst({
      where: and(
        eq(benchmarkAccounts.organizationId, auth.organizationId),
        eq(benchmarkAccounts.platform, input.platform),
        eq(benchmarkAccounts.handle, handle),
      ),
      columns: { id: true, outletId: true },
    });
    if (existing) {
      if (existing.outletId !== outlet.id) {
        await db
          .update(benchmarkAccounts)
          .set({ outletId: outlet.id, updatedAt: new Date() })
          .where(eq(benchmarkAccounts.id, existing.id));
      }
      revalidatePath("/account-analytics");
      return { success: true, accountId: existing.id, alreadyExists: true };
    }
    const [created] = await db
      .insert(benchmarkAccounts)
      .values({
        organizationId: auth.organizationId,
        platform: input.platform,
        level: input.level!,
        handle,
        name: displayName,
        region: outlet.outletRegion ?? null,
        outletId: outlet.id,
        isEnabled: true,
      })
      .returning({ id: benchmarkAccounts.id });
    revalidatePath("/account-analytics");
    return { success: true, accountId: created.id };
  } catch (err) {
    console.error("[account-analytics] bindExistingOutletToAccount 失败:", err);
    const msg = err instanceof Error ? err.message : "绑定失败";
    return { success: false, error: msg };
  }
}

export async function createAccountWithOutlet(input: {
  source: "my" | "benchmark";
  platform: SupportedAccountPlatform;
  name: string;
  handle: string;
  /** 可选：用户粘贴的主页 URL；用于自动提取 identifier 写到 outlet.channels */
  profileUrl?: string;
  /** benchmark 必填 */
  level?: "central" | "provincial" | "city" | "industry" | "self_media";
  region?: string;
}): Promise<{
  success: boolean;
  accountId?: string;
  outletId?: string;
  error?: string;
}> {
  const auth = await getCurrentUserAndOrg();
  if (!auth) return { success: false, error: "未登录或缺少组织信息" };

  if (input.source === "benchmark" && !input.level) {
    return { success: false, error: "新建对标账号必须选择级别 (level)" };
  }
  if (!input.name.trim() || !input.handle.trim()) {
    return { success: false, error: "账号名称和 handle 不能为空" };
  }

  try {
    // 1. 查或建 outlet
    const outletId = await ensureOutletForAccount({
      organizationId: auth.organizationId,
      accountName: input.name.trim(),
      accountSource: input.source,
      level: input.level ?? null,
      region: input.region ?? null,
    });

    // 2. 若提供 profileUrl 且平台支持 → 解析 identifier 写 outlet.channels
    const idCapablePlatforms: SupportedPlatform[] = [
      "douyin",
      "weibo",
      "kuaishou",
      "wechat_oa",
    ];
    if (
      input.profileUrl &&
      input.profileUrl.trim() &&
      (idCapablePlatforms as string[]).includes(input.platform)
    ) {
      const parsed = parseProfileUrl(
        input.platform as SupportedPlatform,
        input.profileUrl.trim(),
      );
      if (parsed.ok) {
        const outlet = await db.query.mediaOutletDictionary.findFirst({
          where: eq(mediaOutletDictionary.id, outletId),
        });
        if (outlet) {
          const channels = (outlet.channels ?? []) as Channel[];
          const idx = channels.findIndex((c) => c.type === input.platform);
          const idField =
            input.platform === "douyin"
              ? "secUid"
              : input.platform === "weibo"
                ? "uid"
                : input.platform === "kuaishou"
                  ? "userId"
                  : "ghid";
          if (idx >= 0) {
            const ch = channels[idx] as Channel & Record<string, unknown>;
            channels[idx] = {
              ...ch,
              [idField]: parsed.identifier,
              nickname:
                typeof ch.nickname === "string" && ch.nickname.trim()
                  ? ch.nickname
                  : input.name.trim(),
            } as unknown as Channel;
          } else {
            channels.push({
              type: input.platform,
              nickname: input.name.trim(),
              [idField]: parsed.identifier,
            } as unknown as Channel);
          }
          await db
            .update(mediaOutletDictionary)
            .set({ channels, updatedAt: new Date() })
            .where(eq(mediaOutletDictionary.id, outletId));
        }
      }
    }

    // 3. INSERT account，碰到 unique 冲突视为已存在 → UPDATE outletId
    if (input.source === "my") {
      const existing = await db.query.myAccounts.findFirst({
        where: and(
          eq(myAccounts.organizationId, auth.organizationId),
          eq(myAccounts.platform, input.platform),
          eq(myAccounts.handle, input.handle.trim()),
        ),
        columns: { id: true, outletId: true },
      });
      if (existing) {
        if (existing.outletId !== outletId) {
          await db
            .update(myAccounts)
            .set({ outletId, updatedAt: new Date() })
            .where(eq(myAccounts.id, existing.id));
        }
        revalidatePath("/account-analytics");
        return { success: true, accountId: existing.id, outletId };
      }
      const [row] = await db
        .insert(myAccounts)
        .values({
          organizationId: auth.organizationId,
          platform: input.platform,
          handle: input.handle.trim(),
          name: input.name.trim(),
          accountUrl: input.profileUrl?.trim() ?? null,
          outletId,
          isEnabled: true,
        })
        .returning({ id: myAccounts.id });
      revalidatePath("/account-analytics");
      return { success: true, accountId: row.id, outletId };
    }

    // benchmark
    const existing = await db.query.benchmarkAccounts.findFirst({
      where: and(
        eq(benchmarkAccounts.organizationId, auth.organizationId),
        eq(benchmarkAccounts.platform, input.platform),
        eq(benchmarkAccounts.handle, input.handle.trim()),
      ),
      columns: { id: true, outletId: true },
    });
    if (existing) {
      if (existing.outletId !== outletId) {
        await db
          .update(benchmarkAccounts)
          .set({ outletId, updatedAt: new Date() })
          .where(eq(benchmarkAccounts.id, existing.id));
      }
      revalidatePath("/account-analytics");
      return { success: true, accountId: existing.id, outletId };
    }
    const [row] = await db
      .insert(benchmarkAccounts)
      .values({
        organizationId: auth.organizationId,
        platform: input.platform,
        level: input.level!,
        handle: input.handle.trim(),
        name: input.name.trim(),
        region: input.region ?? null,
        accountUrl: input.profileUrl?.trim() ?? null,
        outletId,
        isEnabled: true,
      })
      .returning({ id: benchmarkAccounts.id });
    revalidatePath("/account-analytics");
    return { success: true, accountId: row.id, outletId };
  } catch (err) {
    console.error("[account-analytics] createAccountWithOutlet 失败:", err);
    const msg = err instanceof Error ? err.message : "创建失败";
    return { success: false, error: msg };
  }
}

/**
 * 清理 media_outlet_dictionary 表里 outlet_tier 字段历史脏数据。
 *
 * 早期 ensureOutletForAccount 用了不在 OUTLET_TIER_VALUES 里的兜底值（"city"），
 * 加上其它来源可能写入 benchmark.level 的旧值（provincial/self_media），
 * 导致媒体字典编辑表单加载这些 outlet 时 zod 校验失败、无法保存。
 *
 * 本函数把不合法值批量映射到合法值：
 *   city          → district_media
 *   provincial    → provincial_municipal
 *   self_media    → government_self_media
 *   其它非法值     → district_media
 *
 * 仅修改当前 org 范围内的 outlet。
 */
export async function cleanupInvalidOutletTiers(): Promise<{
  success: boolean;
  fixed?: number;
  error?: string;
}> {
  const auth = await getCurrentUserAndOrg();
  if (!auth) return { success: false, error: "未登录或缺少组织信息" };

  const { sql } = await import("drizzle-orm");
  try {
    const result = await db.execute(sql`
      UPDATE media_outlet_dictionary
      SET outlet_tier = CASE outlet_tier
        WHEN 'city' THEN 'district_media'
        WHEN 'provincial' THEN 'provincial_municipal'
        WHEN 'self_media' THEN 'government_self_media'
        ELSE 'district_media'
      END,
      updated_at = NOW()
      WHERE organization_id = ${auth.organizationId}
        AND outlet_tier NOT IN (
          'central', 'provincial_municipal', 'industry',
          'district_media', 'government_self_media'
        )
    `);
    const fixed = (result as unknown as { rowCount?: number }).rowCount ?? 0;
    revalidatePath("/data-collection/outlets");
    revalidatePath("/account-analytics");
    return { success: true, fixed };
  } catch (err) {
    console.error("[account-analytics] cleanupInvalidOutletTiers 失败:", err);
    const msg = err instanceof Error ? err.message : "清理失败";
    return { success: false, error: msg };
  }
}
