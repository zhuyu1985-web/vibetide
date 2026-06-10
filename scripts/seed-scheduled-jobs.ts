/**
 * 把项目所有原本硬编码 cron 的 Inngest 函数注册到 scheduled_jobs 表。
 *
 * 用法:npx tsx scripts/seed-scheduled-jobs.ts
 *
 * 幂等:用 onConflictDoNothing(name 唯一),已存在的不动 — 保留管理员手动改的 cron。
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { scheduledJobs, type NewScheduledJob } from "../src/db/schema";

const dburl = process.env.DATABASE_URL!.replace(/[?&]directConnection=true/i, "").replace(/\?$/, "");
const client = postgres(dburl, { prepare: false });
const db = drizzle(client, { schema });

const SEED_JOBS: NewScheduledJob[] = [
  // —— Account Analytics ——
  {
    name: "account-analytics-crawl",
    displayName: "账号分析 · 自动抓取",
    description: "遍历开启自动抓取的账号 → 调 tikhub 拉数据 → 等 5 分钟 → 派发周报生成事件",
    eventName: "scheduled-jobs/account-analytics-crawl.run",
    cronExpression: "0 5 * * *",
    timezone: "Asia/Shanghai",
    category: "account-analytics",
  },
  {
    name: "account-analytics-daily-snapshot",
    displayName: "账号分析 · 日报快照",
    description: "聚合昨日 collected_items 写 snapshot → 派发日报生成事件",
    eventName: "scheduled-jobs/account-analytics-daily-snapshot.run",
    cronExpression: "0 6 * * *",
    timezone: "Asia/Shanghai",
    category: "account-analytics",
  },
  {
    name: "account-analytics-annotate-posts",
    displayName: "账号分析 · AIGC 标注",
    description: "给账号 collected_items 跑 AIGC 内容分类标注",
    eventName: "scheduled-jobs/account-analytics-annotate-posts.run",
    cronExpression: "0 4 * * *",
    timezone: "Asia/Shanghai",
    category: "account-analytics",
  },
  {
    name: "account-analytics-weekly-report",
    displayName: "账号分析 · 周报",
    description: "每周一 07:00 SH 生成上一个完整自然周(上周一 ~ 上周日)的账号周报",
    eventName: "scheduled-jobs/account-analytics-weekly-report.run",
    cronExpression: "0 7 * * 1",
    timezone: "Asia/Shanghai",
    category: "account-analytics",
  },
  {
    name: "account-analytics-monthly-report",
    displayName: "账号分析 · 月报",
    description: "每月 1 号生成上个月完整自然月报告(覆盖上月 1 日 ~ 上月末日)",
    eventName: "scheduled-jobs/account-analytics-monthly-report.run",
    cronExpression: "0 5 1 * *",
    timezone: "Asia/Shanghai",
    category: "account-analytics",
  },

  // —— CMS ——
  {
    name: "cms-catalog-sync-daily",
    displayName: "CMS · 栏目同步",
    description: "每天同步华栖云 CMS 栏目树到本地 cms_catalogs 表",
    eventName: "scheduled-jobs/cms-catalog-sync-daily.run",
    cronExpression: "0 2 * * *",
    timezone: "Asia/Shanghai",
    category: "cms",
  },

  // —— Collection Hub ——
  {
    name: "collection-hot-topic-cron",
    displayName: "采集 · 热点轮询",
    description: "每小时跑一次,触发所有 hot_topics 类型采集源 (kr36 / 微博热搜 等)",
    eventName: "scheduled-jobs/collection-hot-topic-cron.run",
    cronExpression: "0 * * * *",
    timezone: "Asia/Shanghai",
    category: "collection",
  },
  {
    name: "collection-tikhub-budget-reset",
    displayName: "采集 · tikhub 月度预算重置",
    description: "每月 1 号 00:00 重置 tikhub source 的 tikhubMonthlyAccumulatedUsd 字段",
    eventName: "scheduled-jobs/collection-tikhub-budget-reset.run",
    cronExpression: "0 8 1 * *", // 00:00 UTC = 08:00 SH
    timezone: "Asia/Shanghai",
    category: "collection",
  },

  // —— 平台运营 ——
  {
    name: "weekly-analytics-report",
    displayName: "运营 · 周报分析",
    description: "每周一 09:00 跑组织级运营周报",
    eventName: "scheduled-jobs/weekly-analytics-report.run",
    cronExpression: "0 9 * * 1",
    timezone: "Asia/Shanghai",
    category: "platform",
  },
  {
    name: "skill-consistency-check",
    displayName: "运营 · 技能一致性检查",
    description: "每天 02:30 检查 employee_skills 与 skills 表的一致性",
    eventName: "scheduled-jobs/skill-consistency-check.run",
    cronExpression: "30 2 * * *",
    timezone: "Asia/Shanghai",
    category: "platform",
  },
  {
    name: "daily-hot-briefing",
    displayName: "运营 · 每日热点早报",
    description: "每天 08:00 SH 生成全局热点早报",
    eventName: "scheduled-jobs/daily-hot-briefing.run",
    cronExpression: "0 8 * * *",
    timezone: "Asia/Shanghai",
    category: "platform",
  },
  {
    name: "learning-engine",
    displayName: "AI 引擎 · 学习引擎",
    description: "每天 02:00 跑 cognitive learning engine 更新员工技能熟练度",
    eventName: "scheduled-jobs/learning-engine.run",
    cronExpression: "0 2 * * *",
    timezone: "Asia/Shanghai",
    category: "ai-engine",
  },
  {
    name: "daily-performance-snapshot",
    displayName: "AI 引擎 · 每日绩效快照",
    description: "每天 00:05 SH 给所有员工算昨日绩效写 performance_snapshots",
    eventName: "scheduled-jobs/daily-performance-snapshot.run",
    cronExpression: "5 0 * * *",
    timezone: "Asia/Shanghai",
    category: "ai-engine",
  },
  {
    name: "employee-status-guard",
    displayName: "AI 引擎 · 员工状态守护",
    description: "每 30 分钟扫描 missions / tasks,把超时未响应的员工拉回 idle",
    eventName: "scheduled-jobs/employee-status-guard.run",
    cronExpression: "*/30 * * * *",
    timezone: "Asia/Shanghai",
    category: "ai-engine",
  },
];

async function main() {
  console.log(`准备 seed ${SEED_JOBS.length} 个 scheduled jobs...`);

  let created = 0;
  let skipped = 0;
  for (const job of SEED_JOBS) {
    const res = await db.insert(scheduledJobs).values(job).onConflictDoNothing().returning({ id: scheduledJobs.id });
    if (res.length > 0) {
      created++;
      console.log(`  ✓ ${job.name} (${job.cronExpression})`);
    } else {
      skipped++;
      console.log(`  · ${job.name} 已存在,跳过`);
    }
  }

  console.log(`\n完成:新增 ${created} / 已存在 ${skipped}`);
  process.exit(0);
}

void main();
