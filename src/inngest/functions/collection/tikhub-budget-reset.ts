import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * 月初累计重置 cron（每月 1 号 00:00 UTC）
 *
 * 1. 把所有 source_type='tikhub' 的 source.config.tikhubMonthlyAccumulatedUsd 清零
 * 2. 重新 enable 上月因超预算被 auto-disabled 的 source（disabled_reason='monthly_budget_exceeded'）
 */
export const tikhubBudgetReset = inngest.createFunction(
  { id: "collection-tikhub-budget-reset" },
  { cron: "0 0 1 * *" }, // 每月 1 号 00:00 UTC
  async ({ step }) => {
    // 步骤 1：重置月度累计费用
    const resetResult = await step.run("reset-accumulated", async () => {
      return db.execute(sql`
        UPDATE collection_sources
        SET
          config = jsonb_set(config, '{tikhubMonthlyAccumulatedUsd}', '0'::jsonb),
          updated_at = NOW()
        WHERE source_type = 'tikhub'
      `);
    });

    // 步骤 2：重新 enable 上月超预算被停用的 source
    const reenableResult = await step.run("reenable-budget-exceeded", async () => {
      return db.execute(sql`
        UPDATE collection_sources
        SET
          enabled = true,
          config = config - 'disabled_reason',
          updated_at = NOW()
        WHERE source_type = 'tikhub'
          AND enabled = false
          AND config->>'disabled_reason' = 'monthly_budget_exceeded'
      `);
    });

    const resetCount = (resetResult as { rowCount?: number }).rowCount ?? 0;
    const reenableCount = (reenableResult as { rowCount?: number }).rowCount ?? 0;

    return { resetCount, reenableCount };
  },
);
