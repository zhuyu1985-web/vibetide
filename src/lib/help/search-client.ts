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

export async function searchHelp(query: string, limit = 8): Promise<PagefindResult[]> {
  if (!query.trim()) return [];
  try {
    const pf = await loadPagefind();
    const { results } = await pf.search(query);
    return await Promise.all(results.slice(0, limit).map((r: any) => r.data()));
  } catch (err) {
    console.warn("pagefind unavailable", err);
    return [];
  }
}
