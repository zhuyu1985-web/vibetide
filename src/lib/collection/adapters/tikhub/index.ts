import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { collectionSources } from "@/db/schema/collection";
import type { SourceAdapter, RawItem } from "../../types";
import { tikhubConfigSchema, type TikhubConfig, type TikhubPlatform } from "./config";
import { tikhubConfigFields } from "./config-fields";
import { tikhubFetch } from "./http-client";
import { estimateCost } from "./budget";

import { mapDouyinResponse, DOUYIN_ENDPOINT } from "./platforms/douyin";
import { mapWeiboResponse, WEIBO_ENDPOINT } from "./platforms/weibo";
import { mapXiaohongshuResponse, XHS_ENDPOINT } from "./platforms/xiaohongshu";
import { mapWechatChannelsResponse, WECHAT_CHANNELS_ENDPOINT } from "./platforms/wechat-channels";
import { mapZhihuResponse, ZHIHU_ENDPOINT } from "./platforms/zhihu";

// ─── Platform 路由表 ───────────────────────────────────────────────

const PLATFORM_ENDPOINTS: Record<TikhubPlatform, string> = {
  douyin: DOUYIN_ENDPOINT,
  weibo: WEIBO_ENDPOINT,
  xiaohongshu: XHS_ENDPOINT,
  wechat_channels: WECHAT_CHANNELS_ENDPOINT,
  zhihu: ZHIHU_ENDPOINT,
};

const PLATFORM_MAPPERS: Record<TikhubPlatform, (resp: unknown) => RawItem[]> = {
  douyin: mapDouyinResponse as (r: unknown) => RawItem[],
  weibo: mapWeiboResponse as (r: unknown) => RawItem[],
  xiaohongshu: mapXiaohongshuResponse as (r: unknown) => RawItem[],
  wechat_channels: mapWechatChannelsResponse as (r: unknown) => RawItem[],
  zhihu: mapZhihuResponse as (r: unknown) => RawItem[],
};

// ─── 参数构造 ──────────────────────────────────────────────────────

function buildPageParams(
  config: TikhubConfig,
  keyword: string,
  pageIndex: number,
): Record<string, string | number> {
  const base: Record<string, string | number> = {
    keyword,
    page: pageIndex + 1,
  };

  switch (config.platform) {
    case "douyin":
      return {
        keyword,
        offset: pageIndex * config.resultsPerPage,
        count: config.resultsPerPage,
      };
    case "xiaohongshu":
      return {
        ...base,
        sort: "general",
        noteType: "_0",
        noteTime:
          { day: "一天内", week: "一周内", halfYear: "半年内", all: "" }[config.timeWindow] ??
          "半年内",
      };
    case "weibo":
      return base;
    case "wechat_channels":
      // wechat_channels uses 'keywords' (plural), no 'page' param in API spec
      return { keywords: keyword };
    case "zhihu":
      return base;
    default:
      return base;
  }
}

// ─── 主 Adapter ────────────────────────────────────────────────────

export const tikhubAdapter: SourceAdapter<TikhubConfig> = {
  type: "tikhub",
  displayName: "tikhub.io 社媒搜索",
  description: "对接 tikhub.io 抓取抖音/微博/小红书/微信视频号/知乎 关键词搜索（半年内）",
  category: "search",
  configSchema: tikhubConfigSchema,
  configFields: tikhubConfigFields,

  async execute({ config, sourceId, organizationId, log }) {
    const items: RawItem[] = [];
    const partialFailures: { message: string; meta?: Record<string, unknown> }[] = [];
    let totalCost = 0;

    const endpoint = PLATFORM_ENDPOINTS[config.platform];
    const mapper = PLATFORM_MAPPERS[config.platform];

    // 预算硬阈值检查（按 estimate 提前检查，避免浪费 API 调用）
    const estimated = estimateCost(config, endpoint);
    log(
      "info",
      `tikhub estimated cost: $${estimated.toFixed(4)} for ${config.keywords.length} keywords × ${config.maxPagesPerRun} pages`,
    );
    if (estimated > config.monthlyBudgetUsd) {
      throw new Error(
        `estimated cost ($${estimated.toFixed(2)}) exceeds monthly budget ($${config.monthlyBudgetUsd})`,
      );
    }

    // 按关键词 + 分页抓取
    for (const keyword of config.keywords) {
      for (let p = 0; p < config.maxPagesPerRun; p++) {
        try {
          const params = buildPageParams(config, keyword, p);
          const result = await tikhubFetch({ endpoint, params });
          totalCost += result.costUsd;
          const mapped = mapper(result.data);
          items.push(...mapped);

          log(
            "info",
            `tikhub ${config.platform} keyword="${keyword}" page=${p + 1} → ${mapped.length} items`,
          );

          // 早停：当本页结果 < resultsPerPage * 0.5 时（已抓完所有结果）
          if (mapped.length < config.resultsPerPage * 0.5) break;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          partialFailures.push({ message, meta: { keyword, page: p + 1 } });
          log(
            "error",
            `tikhub ${config.platform} keyword="${keyword}" page=${p + 1} failed: ${message}`,
          );
          break; // 同一关键词当前页失败，跳过余下页
        }
      }
    }

    log(
      "info",
      `tikhub run complete. items: ${items.length}, totalCost: $${totalCost.toFixed(4)}`,
    );

    // 累加到 source.config.tikhubMonthlyAccumulatedUsd（仅在有真实 sourceId + orgId 时）
    if (totalCost > 0 && sourceId && organizationId) {
      try {
        await db
          .update(collectionSources)
          .set({
            config: sql`config || jsonb_build_object('tikhubMonthlyAccumulatedUsd', COALESCE((config->>'tikhubMonthlyAccumulatedUsd')::numeric, 0) + ${totalCost})`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(collectionSources.id, sourceId),
              eq(collectionSources.organizationId, organizationId),
            ),
          );

        // 读回最新累计值，检查是否需要 auto-disable
        const [updated] = await db
          .select({ config: collectionSources.config })
          .from(collectionSources)
          .where(eq(collectionSources.id, sourceId))
          .limit(1);

        const accumulated = Number(
          (updated?.config as { tikhubMonthlyAccumulatedUsd?: number })
            ?.tikhubMonthlyAccumulatedUsd ?? 0,
        );

        if (accumulated >= config.monthlyBudgetUsd) {
          // 超预算 100%：自动停用 source
          await db
            .update(collectionSources)
            .set({
              enabled: false,
              config: sql`config || jsonb_build_object('disabled_reason', 'monthly_budget_exceeded')`,
            })
            .where(eq(collectionSources.id, sourceId));
          log(
            "warn",
            `tikhub source ${sourceId} auto-disabled: accumulated $${accumulated.toFixed(4)} >= budget $${config.monthlyBudgetUsd}`,
          );
        } else if (accumulated >= config.monthlyBudgetUsd * 0.8) {
          // 超预算 80%：告警
          log(
            "warn",
            `tikhub source ${sourceId} reached 80% budget: $${accumulated.toFixed(4)} / $${config.monthlyBudgetUsd}`,
          );
        }
      } catch (dbErr) {
        // DB 更新失败不阻断主流程，只记录错误
        const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
        log("error", `tikhub budget update failed: ${msg}`);
      }
    }

    return {
      items,
      partialFailures,
      runMetadata: {
        tikhubCostUsd: totalCost,
        tikhubPlatform: config.platform,
      },
    };
  },
};
