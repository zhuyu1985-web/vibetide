// site-scraper-discovery.ts — 2026-05-14
//
// 通用栏目发现:不依赖站点 URL 模式启发式,用 3 个真正通用的机制:
//   1. 用户手填 columnUrls (100% 准确,适配任何站)
//   2. Sitemap.xml (SEO 标准,主流站点几乎都有)
//   3. LLM 兜底 (Sitemap 失败时,让 DeepSeek 识别栏目)
//
// 这取代了之前的 buildSmartColumnFilter 启发式(每加一个站要改 regex)。

import { generateText, Output } from "ai";
import { z } from "zod";
import { getLanguageModel } from "@/lib/agent/model-router";

// ────────────────────────────────────────────────────────────────────────
// Sitemap.xml 发现
// ────────────────────────────────────────────────────────────────────────

/**
 * 尝试 ${siteUrl}/sitemap.xml,递归展开 sitemapindex,返回所有 URL。
 *
 * 失败(404 / 网络错误 / parse 失败)→ 返回空数组,不抛错。
 *
 * 限制:
 *   - 单 sitemap 文件最多 10MB(防爆内存)
 *   - sitemapindex 最多展开前 5 个子 sitemap(防递归爆炸)
 *   - 总 URL 取前 5000 条(scope 限制)
 */
export async function fetchSitemapUrls(siteUrl: string): Promise<string[]> {
  const base = siteUrl.replace(/\/$/, "");
  // 1. 先试 robots.txt 看是否声明了 sitemap (很多站用非标准路径如 /news_sitemap.xml)
  const robotsSitemaps = await fetchSitemapsFromRobots(base);
  const candidates = [
    ...robotsSitemaps,
    `${base}/sitemap.xml`,
    `${base}/sitemap_index.xml`,
    `${base}/sitemap-index.xml`,
    `${base}/news_sitemap.xml`,
    `${base}/sitemap_news.xml`,
  ];
  // 去重 + 限制最多探测 8 个候选
  const uniq = [...new Set(candidates)].slice(0, 8);

  for (const url of uniq) {
    try {
      const urls = await fetchSitemapRecursive(url, 0);
      if (urls.length > 0) return urls.slice(0, 5000);
    } catch {
      // continue to next candidate
    }
  }
  return [];
}

/** 从 robots.txt 提取所有 `Sitemap: <url>` 行 */
async function fetchSitemapsFromRobots(base: string): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(`${base}/robots.txt`, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 VibeTideBot/1.0 (+sitemap-discovery)" },
      });
      if (!res.ok) return [];
      const txt = await res.text();
      const out: string[] = [];
      const re = /^Sitemap:\s*(\S+)/gim;
      let m: RegExpExecArray | null;
      while ((m = re.exec(txt))) out.push(m[1]!.trim());
      return out;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return [];
  }
}

async function fetchSitemapRecursive(url: string, depth: number): Promise<string[]> {
  if (depth > 2) return []; // 防递归爆炸

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 VibeTideBot/1.0 (+sitemap-discovery)" },
    });
    if (!res.ok) return [];
    const contentLength = Number(res.headers.get("content-length") ?? "0");
    if (contentLength > 10 * 1024 * 1024) return []; // 超过 10MB 跳过
    const xml = await res.text();

    // sitemap index 检测:含 <sitemapindex> → 展开子 sitemap
    if (/<sitemapindex/i.test(xml)) {
      const childUrls = extractLocTags(xml).slice(0, 5);
      const all: string[] = [];
      for (const child of childUrls) {
        const sub = await fetchSitemapRecursive(child, depth + 1);
        all.push(...sub);
        if (all.length >= 5000) break;
      }
      return all;
    }

    // urlset:直接提取 <loc>
    return extractLocTags(xml);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function extractLocTags(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc>([^<]+)<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const url = m[1]!.trim();
    if (/^https?:\/\//i.test(url)) out.push(url);
  }
  return out;
}

/**
 * 从 sitemap 拉到的所有 URL 里筛"看起来像栏目"的:
 *   - 路径短(<= 3 段)
 *   - 末段是 index.html / index.shtml / index.htm
 *   - 子域名根路径(host !== baseHost 且 path 是 / 或为空)
 *
 * 这不是 "URL 模式启发式",这是基础 URL 结构判断,通用,不依赖具体站点。
 */
export function pickColumnUrlsFromSitemap(
  allUrls: string[],
  siteUrl: string,
): string[] {
  let baseHost: string;
  try {
    baseHost = new URL(siteUrl).hostname.replace(/^www\./i, "");
  } catch {
    return [];
  }

  const candidates = new Set<string>();
  for (const u of allUrls) {
    try {
      const parsed = new URL(u);
      const host = parsed.hostname.replace(/^www\./i, "");
      // 必须同 baseHost 或子域名
      if (host !== baseHost && !host.endsWith("." + baseHost)) continue;
      const segs = parsed.pathname.split("/").filter(Boolean);

      // 子域名根路径(强信号:门户站点经典栏目结构)
      if (host !== baseHost && segs.length === 0) {
        candidates.add(u);
        continue;
      }
      // 浅路径 + index.* (人民网经典:/GB/172318/index.html)
      const lastSeg = segs[segs.length - 1] ?? "";
      if (segs.length <= 3 && /^index\.(html?|shtml?|php|aspx?)$/i.test(lastSeg)) {
        candidates.add(u);
        continue;
      }
      // 路径只有 1 段且不是文件名(www.x.com/news/ 这种)
      if (segs.length === 1 && !/\.[a-z]{2,4}$/i.test(segs[0]!)) {
        candidates.add(u);
        continue;
      }
    } catch {
      // skip invalid url
    }
  }
  return Array.from(candidates);
}

// ────────────────────────────────────────────────────────────────────────
// LLM 兜底发现
// ────────────────────────────────────────────────────────────────────────

const llmResponseSchema = z.object({
  columns: z
    .array(
      z.object({
        url: z.string(),
        title: z.string().optional(),
      }),
    )
    .max(80),
});

/**
 * 把首页 markdown 喂给 DeepSeek,让它返回栏目页 URL 列表。
 *
 * 失败时返回空数组,不阻塞主流程。
 */
export async function discoverColumnsByLlm(
  siteUrl: string,
  homepageMarkdown: string,
): Promise<string[]> {
  if (!homepageMarkdown || homepageMarkdown.length < 100) return [];

  const model = getLanguageModel({
    provider: "openai",
    model: process.env.OPENAI_MODEL || "deepseek-chat",
    temperature: 0.2,
    maxTokens: 2048,
  });

  // 截断超长 markdown(LLM token 限制,首页一般不大但保护下)
  const truncated = homepageMarkdown.slice(0, 30_000);

  try {
    // AI SDK v6: 用 generateText + Output.object 拿结构化输出(替代 v5 的 generateObject)
    const { output } = await generateText({
      model,
      output: Output.object({ schema: llmResponseSchema }),
      prompt: `你是网站结构分析专家。下面是网站 "${siteUrl}" 的首页 Markdown。请识别出该站的"栏目页 / 频道入口 URL"(例如「财经」「社会」「科技」这些频道的入口页,通常会列出多篇文章)。

要求:
1. 只返回栏目入口 URL,不要返回单篇文章 URL
2. 不要返回登录页、关于我们、联系方式等辅助页
3. 不要返回外站链接,只要 ${siteUrl} 本站及其子域名的栏目
4. 最多返回 80 个

Markdown:
${truncated}`,
    });
    return output.columns.map((c) => c.url).filter((u) => /^https?:\/\//i.test(u));
  } catch (err) {
    console.error("[site-scraper] LLM column discovery failed:", err);
    return [];
  }
}
