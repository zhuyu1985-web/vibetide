// site-scraper.ts — 整站采集 adapter (2026-05-14 重写,v2)
//
// 设计原则:**不依赖任何 site-specific URL 模式启发式**。
//   栏目发现走 3 层 fallback,通用、可扩展、用户可控:
//
//     1. 用户手填 columnUrls(优先级最高,100% 准确,适配任何站)
//     2. 抓 sitemap.xml(SEO 标准,主流站点几乎都有)
//     3. LLM 兜底(enableLlmFallback=true 时,让 DeepSeek 识别栏目)
//
// 不再有 buildSmartColumnFilter / COLUMN_PATH_SEG / NON_COLUMN_PATH 等 regex 黑魔法。
// 任何一层都能用就跳到执行;都失败才报错。

import { z } from "zod";
import type { SourceAdapter, RawItem } from "../types";
import { fetchViaJinaReader } from "@/lib/web-fetch";
import {
  buildSmartArticleFilter,
  extractTitleBeforeUrl,
} from "./list-scraper";
import {
  fetchSitemapUrls,
  pickColumnUrlsFromSitemap,
  discoverColumnsByLlm,
} from "./site-scraper-discovery";

// ─── Config Schema ──────────────────────────────────────────────────────────

const configSchema = z.object({
  siteUrl: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().replace(/^[`'"\s]+|[`'"\s]+$/g, "") : v),
    z.string().url("请填写合法的站点首页 URL"),
  ),
  /** 用户手填的栏目 URL 列表(可选)。填了就直接用,跳过 sitemap / LLM 自动发现。
   *  最强可靠 — 任何站都能用。 */
  columnUrls: z.preprocess(
    (v) => {
      if (Array.isArray(v)) return v;
      if (typeof v !== "string") return v;
      return v.split(/\r?\n|[,;]/g).map((s) => s.trim()).filter(Boolean);
    },
    z.array(z.string().url("含非法栏目 URL")).default([]),
  ),
  maxColumns: z.number().int().min(1).max(200).default(50),
  maxArticlesPerColumn: z.number().int().min(1).max(100).default(24),
  columnBlockPatterns: z.preprocess(
    (v) => {
      if (Array.isArray(v)) return v;
      if (typeof v !== "string") return v;
      return v.split(/\r?\n|[,;]/g).map((s) => s.trim()).filter(Boolean);
    },
    z.array(z.string()).default([]),
  ),
  fetchFullContent: z.boolean().default(true),
  skipEmptyContent: z.boolean().default(true),
  /** Sitemap 失败时启用 LLM 识别栏目(DeepSeek)。
   *  默认 true:实测中文媒体 sitemap 覆盖率 ~30%,LLM 才是真正通用解(~$0.001/次)。
   *  关掉只在已经手填了 columnUrls 或绝对不想花 LLM token 时。 */
  enableLlmFallback: z.boolean().default(true),
});

type SiteScraperConfig = z.infer<typeof configSchema>;

// ─── Adapter ─────────────────────────────────────────────────────────────────

export const siteScraperAdapter: SourceAdapter<SiteScraperConfig> = {
  type: "site_scraper",
  displayName: "整站采集",
  description:
    "输入站点首页 → 自动发现栏目 → 抓栏目里的所有文章详情。栏目发现:用户手填 → sitemap.xml → LLM 兜底,三层 fallback 通用任何站。",
  category: "list",
  configSchema,
  configFields: [
    {
      key: "siteUrl",
      label: "站点首页 URL",
      type: "url",
      required: true,
      help: "如 https://www.cbg.cn — 自动发现栏目时的根",
      pickFromOutletWebsite: true,
    },
    {
      key: "columnUrls",
      label: "栏目页 URL(可选,一行一个)",
      type: "textarea",
      help: "填了就直接用这些 URL 作为栏目入口,跳过自动发现。最准确,适合任何站。留空 → 自动 sitemap.xml 发现。",
    },
    {
      key: "maxColumns",
      label: "最多展开栏目数",
      type: "number",
      validation: { min: 1, max: 200 },
      help: "默认 50。Sitemap 可能返回上百栏目,这里截断",
    },
    {
      key: "maxArticlesPerColumn",
      label: "每栏目最多抓取条数",
      type: "number",
      validation: { min: 1, max: 100 },
      help: "默认 24(= 一页),增量模式后续 run 自动跳过已入库 URL",
    },
    {
      key: "columnBlockPatterns",
      label: "栏目排除正则(可选,一行一个)",
      type: "textarea",
      help: "对发现的栏目做最后过滤。示例: lesson(排除视频频道)、Public-(排除工具页)",
    },
    { key: "fetchFullContent", label: "深读正文(Jina)", type: "boolean" },
    {
      key: "skipEmptyContent",
      label: "跳过无正文条目",
      type: "boolean",
      help: "默认开。深读失败 / 抓回正文 < 50 字符时不入库",
    },
    {
      key: "enableLlmFallback",
      label: "LLM 兜底自动发现栏目",
      type: "boolean",
      help: "Sitemap 找不到栏目时,让 LLM 看首页识别栏目。每次 ~$0.001。默认开 — 中文媒体 sitemap 覆盖率仅 ~30%,LLM 是真正通用解。",
    },
  ],

  async execute({ config, log }) {
    const items: RawItem[] = [];
    const partialFailures: { message: string; meta?: Record<string, unknown> }[] = [];

    let baseHost = "unknown";
    try {
      baseHost = new URL(config.siteUrl).hostname.replace(/^www\./i, "");
    } catch {
      return { items, partialFailures: [{ message: "invalid siteUrl" }] };
    }
    const channel = `site/${baseHost}`;

    // ─── 1. 发现栏目(三层 fallback) ──────────────────────────────────────────
    const columns = await discoverColumns(config, log);
    if (columns.length === 0) {
      log("warn", "未发现任何栏目页", {
        siteUrl: config.siteUrl,
        hint: "试一下:(1) 手填 columnUrls;(2) 开启 enableLlmFallback;(3) 检查 sitemap.xml 是否可访问",
      });
      return {
        items,
        partialFailures: [
          {
            message:
              "未发现栏目。三层 fallback 全部失败 — 请手填 columnUrls 或开启 enableLlmFallback。",
          },
        ],
      };
    }

    // 用户 columnBlockPatterns 最后过滤
    const compiledBlocks: RegExp[] = [];
    for (const p of config.columnBlockPatterns) {
      try {
        compiledBlocks.push(new RegExp(p, "i"));
      } catch {
        /* skip invalid regex */
      }
    }
    const filteredColumns = columns.filter(
      (u) => !compiledBlocks.some((re) => re.test(u)),
    );
    const cappedColumns = filteredColumns.slice(0, config.maxColumns);
    log("info", `发现 ${columns.length} 个栏目(过滤后 ${filteredColumns.length}),处理前 ${cappedColumns.length} 个`, {
      total: columns.length,
      afterBlock: filteredColumns.length,
      processing: cappedColumns.length,
      samples: cappedColumns.slice(0, 5),
    });

    // ─── 2. 每栏目跑列表抓 + 详情 ──────────────────────────────────────────────
    const articleSeen = new Set<string>();
    let columnIdx = 0;
    for (const columnUrl of cappedColumns) {
      columnIdx++;
      try {
        const list = await fetchViaJinaReader(columnUrl);
        const articleFilter = buildSmartArticleFilter(columnUrl);
        const urlRegex = /https?:\/\/[^\s)<>"'\]]+/g;
        const candidates: { title: string; url: string }[] = [];
        let am: RegExpExecArray | null;
        while ((am = urlRegex.exec(list.content))) {
          const u = am[0];
          if (!articleFilter(u) || articleSeen.has(u)) continue;
          articleSeen.add(u);
          candidates.push({
            title: extractTitleBeforeUrl(list.content, am.index) || u,
            url: u,
          });
        }
        const capped = candidates.slice(0, config.maxArticlesPerColumn);
        log(
          "info",
          `栏目 ${columnIdx}/${cappedColumns.length}: 发现 ${candidates.length} 篇,处理 ${capped.length} 篇`,
          { columnUrl },
        );

        for (const entry of capped) {
          const item: RawItem = {
            title: entry.title,
            url: entry.url,
            channel,
            rawMetadata: { source: "site-scraper", discoveredFromColumn: columnUrl },
          };
          let deepReadFailed = false;
          if (config.fetchFullContent) {
            try {
              const full = await fetchViaJinaReader(entry.url);
              if (full.content && full.content.length >= 50) {
                item.content = full.content;
              }
              if (full.title) item.title = full.title;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              deepReadFailed = true;
              log("warn", `deep-read failed for ${entry.url}: ${msg}`);
              partialFailures.push({
                message: `article fetch failed: ${msg}`,
                meta: { url: entry.url },
              });
            }
            await sleep(1000);
          }

          if (config.skipEmptyContent && config.fetchFullContent) {
            const len = item.content?.length ?? 0;
            // 内容质量门槛 — 2026-05-14 反思:之前 50B 过低,大量栏目页 boilerplate(登录提示
            // 版权声明 ~ 100-200B)被入库当文章。提高到 250B + boilerplate 关键词检测。
            if (deepReadFailed) {
              log("info", `skip (deep-read failed): ${entry.url}`);
              continue;
            }
            if (len < 250) {
              log("info", `skip (content too short): ${entry.url}`, { contentLen: len });
              continue;
            }
            if (len < 800 && isBoilerplateContent(item.content!)) {
              log("info", `skip (boilerplate page): ${entry.url}`, {
                contentLen: len,
                preview: item.content!.slice(0, 60),
              });
              continue;
            }
          }
          items.push(item);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log("warn", `column scrape failed: ${msg}`, { columnUrl });
        partialFailures.push({ message: `column failed: ${msg}`, meta: { columnUrl } });
      }
      await sleep(1000);
    }

    log("info", `完成: ${items.length} 条 items, ${partialFailures.length} 条 partial failures`);
    return { items, partialFailures };
  },
};

// ─── Column discovery: 3 层 fallback ─────────────────────────────────────────

async function discoverColumns(
  config: SiteScraperConfig,
  log: (level: "info" | "warn" | "error", msg: string, meta?: Record<string, unknown>) => void,
): Promise<string[]> {
  // ── Layer 1: 用户手填 ──────────────────────────────────────────────────────
  if (config.columnUrls.length > 0) {
    log("info", `使用用户填写的 ${config.columnUrls.length} 个栏目 URL`);
    return [...new Set(config.columnUrls)];
  }

  // ── Layer 2: Sitemap ──────────────────────────────────────────────────────
  log("info", `尝试抓取 ${config.siteUrl}/sitemap.xml`);
  const sitemapUrls = await fetchSitemapUrls(config.siteUrl);
  if (sitemapUrls.length > 0) {
    const columns = pickColumnUrlsFromSitemap(sitemapUrls, config.siteUrl);
    log("info", `Sitemap 抓到 ${sitemapUrls.length} 个 URL,识别栏目 ${columns.length} 个`);
    if (columns.length > 0) return columns;
  } else {
    log("info", "Sitemap 不存在或为空");
  }

  // ── Layer 3: LLM 兜底 ─────────────────────────────────────────────────────
  if (!config.enableLlmFallback) {
    log("info", "LLM 兜底未启用 (enableLlmFallback=false),跳过");
    return [];
  }

  log("info", "使用 LLM 兜底识别栏目...");
  try {
    const home = await fetchViaJinaReader(config.siteUrl);
    if (!home.content || home.content.length < 100) {
      log("warn", "首页 markdown 太短,LLM 也无能为力");
      return [];
    }
    const llmColumns = await discoverColumnsByLlm(config.siteUrl, home.content);
    log("info", `LLM 识别栏目 ${llmColumns.length} 个`);
    return llmColumns;
  } catch (err) {
    log("warn", `LLM 兜底失败: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 启发式判断内容是否是"非文章 boilerplate"(登录页 / 版权页 / 栏目导航)。
 * 命中即视为非文章,site_scraper 会 skip 不入库。
 *
 * 命中条件:含至少 1 个 boilerplate 关键词 + 文本短(实际由 caller 用 len < 800 双重门槛)
 */
function isBoilerplateContent(content: string): boolean {
  // 含这些关键词的短文本几乎肯定不是真文章
  const markers = [
    "版权所有",
    "未经书面授权",
    "未经授权禁止使用",
    "请登录",
    "立即注册",
    "记住登录状态",
    "通行证",
    "股份有限公司版权所有",
    "Copyright ©",
    "All Rights Reserved",
    "联系邮箱:",
    "举报邮箱",
  ];
  let hits = 0;
  for (const m of markers) {
    if (content.includes(m)) hits++;
    if (hits >= 2) return true; // 命中 2 个就基本确定
  }
  return false;
}
