// ---------------------------------------------------------------------------
// Shared web fetch utilities
// Web search has moved to `src/lib/search/`; this module now hosts only
// content-fetch helpers (Jina Reader, Cheerio fallback, truncation).
// Search-related types/helpers are re-exported below for compatibility.
// ---------------------------------------------------------------------------

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

export async function fetchViaJinaReader(url: string): Promise<{ title: string; content: string }> {
  const apiKey = process.env.JINA_API_KEY;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Return-Format": "markdown",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`https://r.jina.ai/${url}`, {
      headers,
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Jina Reader returned ${response.status}`);
    }

    const data = (await response.json()) as { data?: { title?: string; content?: string } };
    return {
      title: data.data?.title || "",
      content: data.data?.content || "",
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
