/**
 * Web search tool stub.
 * In production, this should connect to a real search API
 * (e.g., Tavily, SerpAPI, or Bing Search).
 */
export async function webSearch(query: string, maxResults: number = 5) {
  return {
    query,
    results: Array.from({ length: Math.min(maxResults, 3) }, (_, i) => ({
      title: `[模拟] 搜索结果 ${i + 1}: ${query}`,
      snippet: `这是关于「${query}」的模拟搜索结果 #${i + 1}。`,
      url: `https://example.com/result/${i + 1}`,
      publishedAt: new Date().toISOString(),
    })),
  };
}
