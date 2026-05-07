-- A5 Phase 1: research_reports table for report export pipeline.
--
-- FK onDelete strategy:
--   organizations    cascade   (multi-tenant standard: org 删 → reports 级联删)
--   research_tasks   set null  (任务删后保留报告，研究痕迹不丢)
--   research_reports cascade   (self-FK 母版删 → 快照级联删)
--   user_profiles    set null  (生成者删后保留报告，仅丢审计署名)

CREATE TABLE "research_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,

  -- 来源
  "source_type" text NOT NULL,                                                                     -- "research_task" | "advanced_search"
  "research_task_id" uuid REFERENCES "research_tasks"("id") ON DELETE SET NULL,
  "search_snapshot" jsonb NOT NULL,

  -- 元数据
  "title" text NOT NULL,
  "topic_description" text,

  -- 内容
  "report_html" text,
  "aggregates_json" jsonb,

  -- 文件
  "word_file_url" text,
  "excel_file_url" text,
  "file_expires_at" timestamp with time zone,

  -- 快照（self-FK）
  "parent_report_id" uuid REFERENCES "research_reports"("id") ON DELETE CASCADE,
  "is_snapshot" boolean NOT NULL DEFAULT false,
  "snapshot_name" text,

  -- 状态机
  "status" text NOT NULL DEFAULT 'pending',                                                        -- pending/generating/ready/failed
  "current_step" text,
  "error_message" text,

  -- 审计
  "generated_by" uuid REFERENCES "user_profiles"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone
);

CREATE INDEX "research_reports_org_idx" ON "research_reports" ("organization_id", "created_at");
CREATE INDEX "research_reports_task_idx" ON "research_reports" ("research_task_id");
CREATE INDEX "research_reports_parent_idx" ON "research_reports" ("parent_report_id");
