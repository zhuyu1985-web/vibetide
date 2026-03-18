import { db } from "@/db";
import { hotTopics } from "@/db/schema/hot-topics";
import { eq, desc } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Trend prediction — 趋势预测 (M2.F29)
// ---------------------------------------------------------------------------

interface TrendPrediction {
  topicId: string;
  topicTitle: string;
  currentHeat: number;
  trend: string;
  prediction: {
    peakHeat: number;
    estimatedPeakHours: number;
    estimatedDeclineHours: number;
    estimatedRemainingHours: number;
    phase: "rising" | "peak" | "declining" | "expired";
    confidence: number;
  };
  heatCurve: { time: string; value: number }[];
}

/**
 * Simple linear regression helper.
 * Returns slope and intercept for y = slope * x + intercept
 */
function linearRegression(points: { x: number; y: number }[]): {
  slope: number;
  intercept: number;
  r2: number;
} {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y || 0, r2: 0 };

  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // R-squared
  const meanY = sumY / n;
  const ssTotal = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
  const ssResidual = points.reduce(
    (s, p) => s + (p.y - (slope * p.x + intercept)) ** 2,
    0
  );
  const r2 = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

  return { slope, intercept, r2 };
}

/**
 * Predict the trend lifecycle of a hot topic based on its heat curve.
 * Uses linear regression on recent heat data to estimate peak/decline timing.
 */
export async function predictTopicTrend(
  topicId: string
): Promise<TrendPrediction | null> {
  const topics = await db
    .select()
    .from(hotTopics)
    .where(eq(hotTopics.id, topicId))
    .limit(1);

  const topic = topics[0];

  if (!topic) return null;

  const heatCurve = (topic.heatCurve as { time: string; value: number }[]) || [];
  const currentHeat = topic.heatScore;

  // Convert heat curve to numerical points (hours from first point)
  const points = heatCurve.map((p, i) => ({
    x: i, // each point is one time unit
    y: p.value,
  }));

  // If not enough data, return basic prediction
  if (points.length < 3) {
    return {
      topicId: topic.id,
      topicTitle: topic.title,
      currentHeat,
      trend: topic.trend,
      prediction: {
        peakHeat: currentHeat * 1.2,
        estimatedPeakHours: 4,
        estimatedDeclineHours: 12,
        estimatedRemainingHours: 24,
        phase: topic.trend === "declining" ? "declining" : "rising",
        confidence: 0.3,
      },
      heatCurve,
    };
  }

  // Use recent half of data for trend analysis
  const recentHalf = points.slice(Math.floor(points.length / 2));
  const { slope, r2 } = linearRegression(recentHalf);

  // Determine current phase
  let phase: "rising" | "peak" | "declining" | "expired";
  if (slope > 2) {
    phase = "rising";
  } else if (slope > -1 && slope <= 2) {
    phase = "peak";
  } else if (slope > -5) {
    phase = "declining";
  } else {
    phase = "expired";
  }

  // Find max heat in curve
  const maxHeat = Math.max(...points.map((p) => p.y), currentHeat);

  // Estimate remaining lifecycle
  let estimatedPeakHours: number;
  let estimatedDeclineHours: number;
  let estimatedRemainingHours: number;
  let peakHeat: number;

  if (phase === "rising") {
    // Predict peak based on growth rate
    const growthRate = Math.max(slope, 0.1);
    estimatedPeakHours = Math.ceil(
      Math.max(1, (maxHeat * 1.3 - currentHeat) / growthRate)
    );
    estimatedDeclineHours = estimatedPeakHours + Math.ceil(estimatedPeakHours * 1.5);
    estimatedRemainingHours = estimatedDeclineHours + Math.ceil(estimatedPeakHours * 2);
    peakHeat = Math.min(100, currentHeat + growthRate * estimatedPeakHours);
  } else if (phase === "peak") {
    estimatedPeakHours = 0;
    estimatedDeclineHours = Math.ceil(Math.max(2, 8 - points.length * 0.5));
    estimatedRemainingHours = estimatedDeclineHours * 3;
    peakHeat = maxHeat;
  } else {
    estimatedPeakHours = 0;
    estimatedDeclineHours = 0;
    const declineRate = Math.max(Math.abs(slope), 0.5);
    estimatedRemainingHours = Math.ceil(
      Math.max(1, currentHeat / declineRate)
    );
    peakHeat = maxHeat;
  }

  // Confidence based on R² and data points
  const confidence = Math.min(
    0.95,
    Math.max(0.2, r2 * 0.6 + Math.min(points.length / 20, 0.4))
  );

  return {
    topicId: topic.id,
    topicTitle: topic.title,
    currentHeat,
    trend: topic.trend,
    prediction: {
      peakHeat: Math.round(peakHeat * 10) / 10,
      estimatedPeakHours,
      estimatedDeclineHours,
      estimatedRemainingHours,
      phase,
      confidence: Math.round(confidence * 100) / 100,
    },
    heatCurve,
  };
}

/**
 * Return common trend patterns from historical topics.
 */
export async function getHistoricalTrendPatterns(orgId: string) {
  const topics = await db
    .select()
    .from(hotTopics)
    .where(eq(hotTopics.organizationId, orgId))
    .orderBy(desc(hotTopics.createdAt))
    .limit(50);

  // Classify historical topics by their trend patterns
  const patterns: Record<
    string,
    {
      label: string;
      count: number;
      avgDuration: number;
      avgPeakHeat: number;
      description: string;
    }
  > = {
    flash: {
      label: "闪爆型",
      count: 0,
      avgDuration: 4,
      avgPeakHeat: 0,
      description: "快速爆发、快速消退，持续时间短",
    },
    steady: {
      label: "稳增型",
      count: 0,
      avgDuration: 24,
      avgPeakHeat: 0,
      description: "缓慢增长、持续较长时间",
    },
    wave: {
      label: "波浪型",
      count: 0,
      avgDuration: 48,
      avgPeakHeat: 0,
      description: "多次波动，反复出现热度高峰",
    },
    longTail: {
      label: "长尾型",
      count: 0,
      avgDuration: 72,
      avgPeakHeat: 0,
      description: "热度缓慢下降，长期保持一定关注度",
    },
  };

  for (const topic of topics) {
    const heatCurve =
      (topic.heatCurve as { time: string; value: number }[]) || [];
    const peak = topic.heatScore;

    if (heatCurve.length < 3) {
      patterns.flash.count++;
      patterns.flash.avgPeakHeat += peak;
      continue;
    }

    // Classify by heat curve shape
    const firstHalf = heatCurve.slice(0, Math.floor(heatCurve.length / 2));
    const secondHalf = heatCurve.slice(Math.floor(heatCurve.length / 2));

    const firstAvg =
      firstHalf.reduce((s, p) => s + p.value, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((s, p) => s + p.value, 0) / secondHalf.length;

    if (peak > 80 && heatCurve.length <= 6) {
      patterns.flash.count++;
      patterns.flash.avgPeakHeat += peak;
    } else if (secondAvg > firstAvg * 0.8) {
      patterns.steady.count++;
      patterns.steady.avgPeakHeat += peak;
    } else if (heatCurve.length > 10) {
      patterns.longTail.count++;
      patterns.longTail.avgPeakHeat += peak;
    } else {
      patterns.wave.count++;
      patterns.wave.avgPeakHeat += peak;
    }
  }

  // Calculate averages
  for (const key of Object.keys(patterns)) {
    const p = patterns[key];
    if (p.count > 0) {
      p.avgPeakHeat = Math.round(p.avgPeakHeat / p.count);
    }
  }

  return {
    patterns: Object.entries(patterns).map(([key, p]) => ({
      key,
      ...p,
    })),
    totalTopicsAnalyzed: topics.length,
  };
}
