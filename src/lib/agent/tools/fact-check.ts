/**
 * Fact checking tool stub.
 * In production, this should cross-reference claims against
 * knowledge bases and authoritative sources.
 */
export async function factCheck(
  text: string,
  claims?: string[]
) {
  const claimResults = (claims ?? [text.slice(0, 100)]).map((claim) => ({
    claim,
    verified: true,
    confidence: 0.85,
    sources: ["模拟来源"],
  }));

  return {
    overallScore: 85,
    claimResults,
    issues: [] as string[],
    summary: `已完成事实核查，整体可信度评分: 85/100。共检查 ${claimResults.length} 条声明。`,
  };
}
