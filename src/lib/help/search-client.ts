"use client";

export interface PagefindResult {
  url: string;
  meta: { title: string; description?: string; category?: string };
  excerpt: string;   // 带 <mark> 高亮的 HTML 片段
}

let pagefindPromise: Promise<any> | null = null;

async function loadPagefind() {
  if (!pagefindPromise) {
    pagefindPromise = import(/* webpackIgnore: true */ "/pagefind/pagefind.js" as any).catch((err) => {
      pagefindPromise = null;
      throw err;
    });
  }
  return pagefindPromise;
}

/**
 * pagefind 索引 root 是 .next/server/app/help,产物 url 是相对 root 的
 * "/workflows/start.html" 这种;前端跳转需要加 /help 前缀 + 去掉 .html
 * 例如:
 *   "/workflows/start-first-workflow.html" → "/help/workflows/start-first-workflow"
 *   "/faq.html" → "/help/faq"
 *   "/index.html" → "/help"
 */
function normalizePagefindUrl(rawUrl: string): string {
  let url = rawUrl;
  // 去 .html 后缀
  url = url.replace(/\.html$/, "");
  // /index → /
  url = url.replace(/\/index$/, "/");
  // 加 /help 前缀(避免重复加)
  if (!url.startsWith("/help")) {
    url = url === "/" ? "/help" : `/help${url}`;
  }
  return url;
}

export async function searchHelp(query: string, limit = 8): Promise<PagefindResult[]> {
  if (!query.trim()) return [];
  try {
    const pf = await loadPagefind();
    const { results } = await pf.search(query);
    const data = await Promise.all(results.slice(0, limit).map((r: any) => r.data()));
    return data.map((d: PagefindResult) => ({ ...d, url: normalizePagefindUrl(d.url) }));
  } catch (err) {
    console.warn("pagefind unavailable", err);
    return [];
  }
}
