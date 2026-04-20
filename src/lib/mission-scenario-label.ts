/**
 * 给任意 mission 行（可能含或不含 workflow_template 关联）产出统一的显示信息。
 *
 * 目的：UI 层所有 SCENARIO_CONFIG / ADVANCED_SCENARIO_CONFIG 消费点替换成这个 helper，
 * 等 Phase 3 删除常量时只改 fallback 实现一处。
 *
 * 推荐用法：
 * - Server 组件：查 mission 时带上 `with: { workflowTemplate: true }`，然后对每行调用
 *   `resolveMissionScenarioLabel(row, row.workflowTemplate)`，把 label 注入到传给 client
 *   组件的 props 里。
 * - Client 组件：如果 server 已经注入了 `scenarioLabel` 字段，直接读。若实在拿不到
 *   template，降级为 `resolveMissionScenarioLabel(mission)` 只靠 `mission.scenario`
 *   文本兜底（历史数据或 pre-B.1 mission）。
 * - Executor / Inngest 路径：用异步 `loadScenarioLabel(mission)`，内部自己 DB 查
 *   template.name；专门喂给 `executeAgent({ scenario })` 作为 LLM prompt 里的显示名。
 */
import { db } from "@/db";
import { workflowTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { WorkflowTemplateRow } from "@/db/types";

export interface MissionScenarioInfo {
  /** 显示名，如“热点快讯”“直播赛事” */
  label: string;
  /** 分类，用于筛选/统计（如 news / deep / video / livelihood） */
  category?: string;
  /** lucide icon 名（字符串），UI 层用 icon map 映射成组件 */
  icon?: string;
  /** 原 scenario slug（legacy_scenario_key 或 template.id / custom_xxx） */
  slug: string;
  /** template 数据库主键（若通过 template 解析而来） */
  templateId?: string;
}

export function resolveMissionScenarioLabel(
  mission: { scenario?: string | null; title?: string | null },
  template?: WorkflowTemplateRow | null
): MissionScenarioInfo {
  // 优先级 1：有 template 关联 → 权威来源
  if (template) {
    return {
      label: template.name,
      category: template.category ?? undefined,
      icon: template.icon ?? undefined,
      slug: template.legacyScenarioKey ?? template.id,
      templateId: template.id,
    };
  }

  // 优先级 2：mission.scenario 作为 legacy slug / denormalized 名称兜底
  const slug = mission.scenario ?? "custom";

  // custom_xxxxxx 类型的 slug 没有常量可查，显示 title 更友好
  if (slug === "custom" || slug.startsWith("custom_")) {
    return {
      label: mission.title ?? "自定义任务",
      slug,
    };
  }

  // 其他 legacy slug（breaking_news / lianghui_coverage / ...）直接透传，
  // 等 Phase 3 删常量后这里可再接更高级兜底（或直接 DB 查 legacy_scenario_key）。
  return {
    label: slug,
    slug,
  };
}

/**
 * 异步版：根据 mission 的 workflowTemplateId 去 DB 查模板名，回退到 scenario slug。
 * 专门给 mission-executor / Inngest 消费者作为 `executeAgent({ scenario })` 的显示名。
 */
export async function loadScenarioLabel(mission: {
  workflowTemplateId: string | null;
  scenario: string | null;
}): Promise<string> {
  if (mission.workflowTemplateId) {
    const tpl = await db.query.workflowTemplates.findFirst({
      where: eq(workflowTemplates.id, mission.workflowTemplateId),
      columns: { name: true },
    });
    if (tpl?.name) return tpl.name;
  }
  return mission.scenario ?? "通用任务";
}
