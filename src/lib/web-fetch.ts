// ---------------------------------------------------------------------------
// Shared web fetch utilities
// Web search has moved to `src/lib/search/`; this module now hosts only
// content-fetch helpers (Jina Reader, Cheerio fallback, truncation).
// Search-related types/helpers are re-exported below for compatibility.
// ---------------------------------------------------------------------------

import { stripJinaBoilerplate } from "@/lib/collection/strip-boilerplate";

export type {
  Credibility,
  NewsFeedItem,
  SearchEngine,
  SourceType,
  WebSearchTimeRange,
} from "@/lib/search";

export {
  DEFAULT_INCLUDE_DOMAINS,
  inferCredibility,
  inferSourceType,
  parseDate,
} from "@/lib/search";

// ---------------------------------------------------------------------------
// Jina Reader API (deep read)
// ---------------------------------------------------------------------------

const JINA_TIMEOUT_MS = 30_000;
const JINA_RETRY_ON_TIMEOUT = 1; // 超时后重试 1 次

export async function fetchViaJinaReader(url: string): Promise<{ title: string; content: string }> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= JINA_RETRY_ON_TIMEOUT; attempt++) {
    try {
      return await fetchViaJinaReaderOnce(url);
    } catch (err) {
      lastErr = err;
      // 只对"超时/中断"重试,4xx/5xx 业务错误直接抛
      const msg = err instanceof Error ? err.message : String(err);
      const isAbort = /abort|timeout/i.test(msg);
      if (!isAbort || attempt === JINA_RETRY_ON_TIMEOUT) throw err;
    }
  }
  // unreachable
  throw lastErr;
}

async function fetchViaJinaReaderOnce(url: string): Promise<{ title: string; content: string }> {
  const apiKey = process.env.JINA_API_KEY;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Return-Format": "markdown",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), JINA_TIMEOUT_MS);

  try {
    const response = await fetch(`https://r.jina.ai/${url}`, {
      headers,
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      // 401/402 = 鉴权/配额问题 — 用户能直接看懂的中文提示
      if (response.status === 401) {
        throw new Error(
          apiKey
            ? "Jina API key 无效,请到 https://jina.ai 检查 / 重新申请"
            : "Jina API key 缺失,请在 .env.local 配置 JINA_API_KEY",
        );
      }
      if (response.status === 402) {
        throw new Error(
          apiKey
            ? "Jina API 配额已用尽,请到 https://jina.ai 充值 / 升级套餐"
            : "Jina 匿名配额已用完,请在 .env.local 配置 JINA_API_KEY(https://jina.ai 注册即送免费额度)",
        );
      }
      throw new Error(`Jina Reader returned ${response.status}`);
    }

    const data = (await response.json()) as { data?: { title?: string; content?: string } };
    // 2026-05-14: 后处理裁掉 Jina 没识别出来的 navbar / footer / 相关推荐区
    const rawContent = data.data?.content || "";
    const cleanedContent = stripJinaBoilerplate(rawContent);
    return {
      title: data.data?.title || "",
      content: cleanedContent,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Cheerio HTML parsing (fallback)
// ---------------------------------------------------------------------------

export async function fetchViaCheerio(url: string): Promise<{ title: string; content: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 VibeTideBot/1.0",
        Accept: "text/html",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Fetch returned ${response.status}`);
    }

    const html = await response.text();
    const cheerio = await import("cheerio");
    const $ = cheerio.load(html);

    // Remove noise elements
    $("script, style, nav, header, footer, aside, iframe, .ad, .advertisement, .sidebar, .comment, .comments").remove();

    const title = $("title").text().trim() ||
      $('meta[property="og:title"]').attr("content") || "";

    // Try article/main first, then fall back to body
    let content = "";
    const selectors = ["article", "main", '[role="main"]', ".post-content", ".article-content", ".entry-content"];
    for (const selector of selectors) {
      const el = $(selector);
      if (el.length > 0) {
        content = el.text().trim();
        break;
      }
    }
    if (!content) {
      content = $("body").text().trim();
    }

    // Clean up whitespace
    content = content.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+/g, " ").trim();

    return { title, content };
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Content truncation
// ---------------------------------------------------------------------------

export function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;
  const truncated = content.slice(0, maxLength);
  const lastParagraph = truncated.lastIndexOf("\n\n");
  if (lastParagraph > maxLength * 0.7) {
    return truncated.slice(0, lastParagraph) + "\n\n[...内容已截断]";
  }
  const lastSentence = truncated.lastIndexOf("。");
  if (lastSentence > maxLength * 0.7) {
    return truncated.slice(0, lastSentence + 1) + "\n\n[...内容已截断]";
  }
  return truncated + "...\n\n[...内容已截断]";
}
