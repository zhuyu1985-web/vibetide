-- 0038_scheduled_jobs.sql
-- 新增 scheduled_jobs 表 —— 全项目 cron 任务统一配置中心
-- 设计文档:src/db/schema/scheduled-jobs.ts
--
-- 注意:本 migration 是窄 scope 手写,只含 scheduled_jobs。
-- 项目存在历史 schema drift(代码里有 9 张表 + 部分 ALTER 但 _journal 没记录),
-- 留待后续独立 plan 清理(不在本次任务 scope 内)。

CREATE TABLE IF NOT EXISTS "scheduled_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "display_name" text NOT NULL,
  "description" text,
  "event_name" text NOT NULL,
  "cron_expression" text NOT NULL,
  "timezone" text NOT NULL DEFAULT 'Asia/Shanghai',
  "enabled" boolean NOT NULL DEFAULT true,
  "category" text NOT NULL DEFAULT 'misc',
  "last_run_at" timestamp with time zone,
  "last_run_status" text,
  "last_run_duration_ms" integer,
  "next_run_at" timestamp with time zone,
  "total_runs" bigint NOT NULL DEFAULT 0,
  "total_failures" bigint NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "scheduled_jobs_name_unique" UNIQUE("name")
);

-- 查询索引:scheduler 每分钟扫表用 (enabled, next_run_at)
CREATE INDEX IF NOT EXISTS "scheduled_jobs_enabled_next_run_idx"
  ON "scheduled_jobs" ("enabled", "next_run_at");
