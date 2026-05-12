import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { collectionSources } from "@/db/schema/collection";
import { mediaOutletDictionary } from "@/db/schema/media-outlet-dictionary";
import type { SourceAdapter, RawItem } from "../../types";
import {
  tikhubConfigSchema,
  normalizeLegacyTikhubConfig,
  TIKHUB_ACCOUNT_PLATFORM_ENDPOINTS,
  type TikhubConfig,
  type TikhubKeywordConfig,
  type TikhubAccountConfig,
  type TikhubPlatform,
} from "./config";
import { tikhubConfigFields } from "./config-fields";
import { tikhubFetch } from "./http-client";
import { estimateCost } from "./budget";

import { mapDouyinResponse, DOUYIN_ENDPOINT } from "./platforms/douyin";
import { mapWeiboResponse, WEIBO_ENDPOINT } from "./platforms/weibo";
import { mapXiaohongshuResponse, XHS_ENDPOINT } from "./platforms/xiaohongshu";
import { mapWechatChannelsResponse, WECHAT_CHANNELS_ENDPOINT } from "./platforms/wechat-channels";
import { mapZhihuResponse, ZHIHU_ENDPOINT } from "./platforms/zhihu";

import { ACCOUNT_MAPPERS } from "./account-mappers";
import type { Channel } from "@/lib/media-outlet/channels";

// ─── Keyword 模式平台路由表 ──────────────────────────────────────────

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

// ─── Keyword 模式参数构造 ────────────────────────────────────────────

function buildKeywordPageParams(
  config: TikhubKeywordConfig,
  keyword: string,
  pageIndex: number,
): Record<string, string | number> {
  const base: Record<string, string | number> = { keyword, page: pageIndex + 1 };
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
      return { keywords: keyword };
    case "zhihu":
      return base;
    default:
      return base;
  }
}

// ─── Account 模式参数构造 ────────────────────────────────────────────

interface AccountFetchPlan {
  endpoint: string;
  params: Record<string, string | number>;
}

function buildAccountFetchPlan(
  cfg: TikhubAccountConfig,
  channel: Channel,
  pageIndex: number,
): AccountFetchPlan {
  const endpoint = TIKHUB_ACCOUNT_PLATFORM_ENDPOINTS[cfg.accountPlatform];

  switch (cfg.accountPlatform) {
    case "douyin": {
      if (channel.type !== "douyin") throw new Error("channel type mismatch");
      return {
        endpoint,
        params: {
          sec_user_id: channel.secUid,
          max_cursor: pageIndex * cfg.resultsPerPage,
          count: cfg.resultsPerPage,
        },
      };
    }
    case "weibo": {
      if (channel.type !== "weibo") throw new Error("channel type mismatch");
      return {
        endpoint,
        params: {
          uid: channel.uid,
          page: pageIndex + 1,
        },
      };
    }
    case "kuaishou": {
      if (channel.type !== "kuaishou") throw new Error("channel type mismatch");
      return {
        endpoint,
        params: {
          user_id: channel.userId,
          pcursor: pageIndex,
          count: cfg.resultsPerPage,
        },
      };
    }
    case "wechat_oa": {
      if (channel.type !== "wechat_oa") throw new Error("channel type mismatch");
      if (!channel.ghid) throw new Error("wechat_oa channel missing ghid");
      // 实测发现:tikhub fetch_mp_article_list 传 offset=0 会 400,只传 ghid 才能 200。
      // 翻页时(pageIndex > 0)再传 offset。首页(pageIndex=0)只传 ghid。
      const params: Record<string, string | number> = { ghid: channel.ghid };
      if (pageIndex > 0) {
        params.offset = pageIndex * cfg.resultsPerPage;
      }
      return { endpoint, params };
    }
  }
}

/** 启动校验:从字典里找 outlet 并取对应平台的 channel(取第一个);失败抛错。 */
async function resolveAccountChannel(
  cfg: TikhubAccountConfig,
  organizationId: string,
): Promise<Channel> {
  const [outlet] = await db
    .select()
    .from(mediaOutletDictionary)
    .where(
      and(
        eq(mediaOutletDictionary.id, cfg.outletId),
        eq(mediaOutletDictionary.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (!outlet) {
    throw new Error(`outlet ${cfg.outletId} 不存在或跨 org`);
  }

  const channels = (outlet.channels ?? []) as Channel[];
  const ch = channels.find((c) => c.type === cfg.accountPlatform);
  if (!ch) {
    throw new Error(
      `outlet ${outlet.outletName} 在 ${cfg.accountPlatform} 平台没有配置 channel,请到媒体字典补全`,
    );
  }
  return ch;
}

// ─── 预算累加 / auto-disable ─────────────────────────────────────────

async function updateBudgetAndMaybeDisable(
  totalCost: number,
  sourceId: string | undefined,
  organizationId: string | undefined,
  budget: number,
  log: (level: "info" | "warn" | "error", msg: string) => void,
): Promise<void> {
  if (totalCost <= 0 || !sourceId || !organizationId) return;
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

    const [updated] = await db
      .select({ config: collectionSources.config })
      .from(collectionSources)
      .where(eq(collectionSources.id, sourceId))
      .limit(1);

    const accumulated = Number(
      (updated?.config as { tikhubMonthlyAccumulatedUsd?: number })
        ?.tikhubMonthlyAccumulatedUsd ?? 0,
    );

    if (accumulated >= budget) {
      await db
        .update(collectionSources)
        .set({
          enabled: false,
          config: sql`config || jsonb_build_object('disabled_reason', 'monthly_budget_exceeded')`,
        })
        .where(eq(collectionSources.id, sourceId));
      log(
        "warn",
        `tikhub source ${sourceId} auto-disabled: accumulated $${accumulated.toFixed(4)} >= budget $${budget}`,
      );
    } else if (accumulated >= budget * 0.8) {
      log(
        "warn",
        `tikhub source ${sourceId} reached 80% budget: $${accumulated.toFixed(4)} / $${budget}`,
      );
    }
  } catch (dbErr) {
    const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
    log("error", `tikhub budget update failed: ${msg}`);
  }
}

// ─── 主 Adapter ────────────────────────────────────────────────────

export const tikhubAdapter: SourceAdapter<TikhubConfig> = {
  type: "tikhub",
  displayName: "tikhub.io 社媒采集",
  description:
    "对接 tikhub.io 抓取社媒数据。关键词模式 5 平台(抖音/微博/小红书/视频号/知乎);账号模式 4 平台(抖音/微博/快手/公众号,按媒体字典账号 ID 拉 user-feed)",
  category: "search",
  configSchema: tikhubConfigSchema,
  configFields: tikhubConfigFields,

  async execute({ config, sourceId, organizationId, log }) {
    // 兼容历史 sources(DB 里 config 没有 mode 字段)→ 默认 keyword 模式
    const normalized = normalizeLegacyTikhubConfig(config);
    if (normalized.mode === "keyword") {
      return runKeywordMode(normalized, { sourceId, organizationId, log });
    }
    if (!organizationId) {
      throw new Error("account 模式需要 organizationId 才能查媒体字典");
    }
    return runAccountMode(normalized, { sourceId, organizationId, log });
  },
};

// ─── Keyword 模式执行 ────────────────────────────────────────────────

async function runKeywordMode(
  config: TikhubKeywordConfig,
  ctx: {
    sourceId: string | undefined;
    organizationId: string | undefined;
    log: (level: "info" | "warn" | "error", msg: string) => void;
  },
) {
  const items: RawItem[] = [];
  const partialFailures: { message: string; meta?: Record<string, unknown> }[] = [];
  let totalCost = 0;

  const endpoint = PLATFORM_ENDPOINTS[config.platform];
  const mapper = PLATFORM_MAPPERS[config.platform];

  const estimated = estimateCost(config, endpoint);
  ctx.log(
    "info",
    `tikhub keyword estimated cost: $${estimated.toFixed(4)} for ${config.keywords.length} kw × ${config.maxPagesPerRun} pages`,
  );
  if (estimated > config.monthlyBudgetUsd) {
    throw new Error(
      `estimated cost ($${estimated.toFixed(2)}) exceeds monthly budget ($${config.monthlyBudgetUsd})`,
    );
  }

  for (const keyword of config.keywords) {
    for (let p = 0; p < config.maxPagesPerRun; p++) {
      try {
        const params = buildKeywordPageParams(config, keyword, p);
        const result = await tikhubFetch({ endpoint, params });
        totalCost += result.costUsd;
        const mapped = mapper(result.data);
        items.push(...mapped);

        ctx.log(
          "info",
          `tikhub ${config.platform} keyword="${keyword}" page=${p + 1} → ${mapped.length} items`,
        );
        if (mapped.length < config.resultsPerPage * 0.5) break;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        partialFailures.push({ message, meta: { keyword, page: p + 1 } });
        ctx.log(
          "error",
          `tikhub ${config.platform} keyword="${keyword}" page=${p + 1} failed: ${message}`,
        );
        break;
      }
    }
  }

  ctx.log(
    "info",
    `tikhub keyword complete. items: ${items.length}, totalCost: $${totalCost.toFixed(4)}`,
  );
  await updateBudgetAndMaybeDisable(
    totalCost,
    ctx.sourceId,
    ctx.organizationId,
    config.monthlyBudgetUsd,
    ctx.log,
  );

  return {
    items,
    partialFailures,
    runMetadata: {
      tikhubCostUsd: totalCost,
      tikhubPlatform: config.platform,
      tikhubMode: "keyword",
    },
  };
}

// ─── Account 模式执行 ────────────────────────────────────────────────

async function runAccountMode(
  config: TikhubAccountConfig,
  ctx: {
    sourceId: string | undefined;
    organizationId: string;
    log: (level: "info" | "warn" | "error", msg: string) => void;
  },
) {
  const items: RawItem[] = [];
  const partialFailures: { message: string; meta?: Record<string, unknown> }[] = [];
  let totalCost = 0;

  // 1) 启动校验:取 outlet + 对应 channel
  const channel = await resolveAccountChannel(config, ctx.organizationId);
  ctx.log(
    "info",
    `tikhub account mode: outlet=${config.outletId} platform=${config.accountPlatform}`,
  );

  // 2) 预算预估(account 模式按 1 账号 × maxPagesPerRun 估算)
  const endpoint = TIKHUB_ACCOUNT_PLATFORM_ENDPOINTS[config.accountPlatform];
  const estimated = estimateCost(config, endpoint);
  ctx.log("info", `tikhub account estimated cost: $${estimated.toFixed(4)}`);
  if (estimated > config.monthlyBudgetUsd) {
    throw new Error(
      `estimated cost ($${estimated.toFixed(2)}) exceeds monthly budget ($${config.monthlyBudgetUsd})`,
    );
  }

  // 3) 按页拉取
  const mapper = ACCOUNT_MAPPERS[config.accountPlatform];
  for (let p = 0; p < config.maxPagesPerRun; p++) {
    try {
      const plan = buildAccountFetchPlan(config, channel, p);
      const result = await tikhubFetch({ endpoint: plan.endpoint, params: plan.params });
      totalCost += result.costUsd;
      const mapped = mapper(result.data);
      items.push(...mapped);

      ctx.log(
        "info",
        `tikhub ${config.accountPlatform} page=${p + 1} → ${mapped.length} items`,
      );
      // 早停:页结果远低于预期就停
      if (mapped.length < config.resultsPerPage * 0.3) break;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      partialFailures.push({ message, meta: { page: p + 1 } });
      ctx.log(
        "error",
        `tikhub ${config.accountPlatform} page=${p + 1} failed: ${message}`,
      );
      break;
    }
  }

  ctx.log(
    "info",
    `tikhub account complete. items: ${items.length}, totalCost: $${totalCost.toFixed(4)}`,
  );
  await updateBudgetAndMaybeDisable(
    totalCost,
    ctx.sourceId,
    ctx.organizationId,
    config.monthlyBudgetUsd,
    ctx.log,
  );

  return {
    items,
    partialFailures,
    runMetadata: {
      tikhubCostUsd: totalCost,
      tikhubMode: "account",
      tikhubAccountPlatform: config.accountPlatform,
      tikhubOutletId: config.outletId,
    },
  };
}
