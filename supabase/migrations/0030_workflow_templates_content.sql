-- Phase B.2+ — workflow_templates 加 Markdown 规格文档列
--
-- 新增 content 列，存 workflows/<slug>/SKILL.md 的正文（frontmatter 解析后的
-- body）。镜像 skills.content 的用法，作为场景级 baoyu 规范文档的数据库落库
-- 目标，供 /workflows/[id] 页面查看和编辑，供 skill-loader 运行时读取。
--
-- 默认空字符串，使用 sync-workflows-from-md.ts 从文件系统批量回填。

ALTER TABLE "workflow_templates"
  ADD COLUMN IF NOT EXISTS "content" text DEFAULT '';
