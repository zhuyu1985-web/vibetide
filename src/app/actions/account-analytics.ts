"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  myAccounts,
  benchmarkAccounts,
  mediaOutletDictionary,
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
import type { Channel } from "@/lib/media-outlet/channels";

/**
 * 查或建账号对应的 outlet —— 用于 toggle 开启或配置识别符两个入口共用。
 *
 * 关键：先按 (organizationId, outletName) 查同名 outlet；命中则复用，避免触发
 * media_outlet_dictionary_org_name_unique 约束（同公司多平台账号常重名）。
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
        args.accountSource === "benchmark" && args.level ? args.level : "city",
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
    return { success: false, error: `切换失败：${msg}` };
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
    return { success: false, error: `保存失败：${msg}` };
  }
}

/**
 * 触发账号即时抓取 —— 派发 crawl.requested 事件，函数内部找匹配的 collection_source
 * 并派发 collection/source.run-requested。
 */
export async function crawlAccountOnDemand(input: {
  accountId: string;
  accountSource: "my" | "benchmark";
  sinceDays?: number;
}): Promise<{ success: boolean; error?: string }> {
  const auth = await getCurrentUserAndOrg();
  if (!auth) {
    return { success: false, error: "未登录或缺少组织信息" };
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

  return { success: true };
}
