import type { TikhubConfig } from "./config";
import pricingJson from "./pricing.json";

const PRICING = pricingJson as unknown as Record<string, { basePrice: number }>;

export function estimateCost(config: TikhubConfig, endpoint: string): number {
  const pricePerCall = PRICING[endpoint]?.basePrice ?? 0.005;
  // keyword 模式: keywords.length × maxPagesPerRun;
  // account 模式: 1 个账号 × maxPagesPerRun
  const callsPerRun =
    config.mode === "keyword"
      ? config.keywords.length * config.maxPagesPerRun
      : config.maxPagesPerRun;
  return callsPerRun * pricePerCall;
}

export interface BudgetCheckResult {
  ok: boolean;
  reason?: "monthly_budget_exceeded";
  warnAt80Percent?: boolean;
  newAccumulated: number;
}

export function checkBudget(
  currentAccumulated: number,
  addCost: number,
  monthlyBudget: number,
): BudgetCheckResult {
  const newAccumulated = currentAccumulated + addCost;
  if (newAccumulated > monthlyBudget) {
    return { ok: false, reason: "monthly_budget_exceeded", newAccumulated };
  }
  const warnAt80Percent =
    currentAccumulated < monthlyBudget * 0.8 && newAccumulated >= monthlyBudget * 0.8;
  return { ok: true, warnAt80Percent, newAccumulated };
}
