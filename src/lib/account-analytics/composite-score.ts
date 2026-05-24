/**
 * Composite Score (综合得分) — 跨平台社交媒体内容加权打分公式。
 *
 * 默认权重：like*1 + comment*5 + share*5 + favorite*2
 * 来源：参考 BRTV HTML 报告样张反推（2026-05-13），与抖音 / 快手 / 视频号常用
 * 业内公式接近。view 暂不计入（很多平台不放出真实播放量）。
 *
 * 权重可在组织级覆盖：organizations.settings.accountAnalytics.compositeScoreWeights
 * （jsonb）。每份 report 生成时会把当时使用的权重快照到
 * account_analytics_reports.composite_score_formula_snapshot，便于复盘。
 */

export interface CompositeScoreWeights {
  like: number;
  comment: number;
  share: number;
  favorite: number;
  view: number;
}

export const DEFAULT_COMPOSITE_SCORE_WEIGHTS: CompositeScoreWeights = {
  like: 1,
  comment: 5,
  share: 5,
  favorite: 2,
  view: 0,
};

export interface InteractionMetrics {
  likes: number;
  comments: number;
  shares: number;
  favorites: number;
  views?: number;
}

/**
 * 计算单条内容的综合得分。
 *
 * @param metrics 互动指标（缺失字段按 0 计）
 * @param weights 加权配置，默认 DEFAULT_COMPOSITE_SCORE_WEIGHTS
 */
export function calculateCompositeScore(
  metrics: InteractionMetrics,
  weights: CompositeScoreWeights = DEFAULT_COMPOSITE_SCORE_WEIGHTS,
): number {
  const likes = Math.max(0, metrics.likes ?? 0);
  const comments = Math.max(0, metrics.comments ?? 0);
  const shares = Math.max(0, metrics.shares ?? 0);
  const favorites = Math.max(0, metrics.favorites ?? 0);
  const views = Math.max(0, metrics.views ?? 0);

  return (
    likes * weights.like +
    comments * weights.comment +
    shares * weights.share +
    favorites * weights.favorite +
    views * weights.view
  );
}

/**
 * 给一组内容按综合得分排序并取 Top N。
 */
export function rankByCompositeScore<T extends InteractionMetrics>(
  items: T[],
  topN: number,
  weights?: CompositeScoreWeights,
): Array<T & { compositeScore: number; rank: number }> {
  const scored = items.map((item) => ({
    ...item,
    compositeScore: calculateCompositeScore(item, weights),
  }));
  scored.sort((a, b) => b.compositeScore - a.compositeScore);
  return scored.slice(0, topN).map((item, idx) => ({ ...item, rank: idx + 1 }));
}
