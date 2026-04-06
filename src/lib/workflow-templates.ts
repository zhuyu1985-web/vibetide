import type { WorkflowStepDef } from "@/db/schema/workflows";

export interface BuiltinTemplate {
  name: string;
  description: string;
  category: "news" | "video" | "analytics" | "distribution" | "custom";
  triggerType: "manual" | "scheduled";
  triggerConfig?: { cron?: string; timezone?: string } | null;
  steps: WorkflowStepDef[];
}

function step(
  order: number,
  name: string,
  employeeSlug: string,
  skillSlug?: string
): WorkflowStepDef {
  return {
    id: `step-${order}`,
    order,
    dependsOn: order > 1 ? [`step-${order - 1}`] : [],
    name,
    type: "employee",
    config: { employeeSlug, skillSlug, parameters: {} },
  };
}

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    name: "突发新闻快速报道",
    description: "从热点发现到稿件发布的全流程自动化，适用于突发新闻的快速响应",
    category: "news",
    triggerType: "manual",
    steps: [
      step(1, "热点确认与信息采集", "xiaolei"),
      step(2, "快速选题策划", "xiaoce"),
      step(3, "稿件快速撰写", "xiaowen"),
      step(4, "质量审核", "xiaoshen"),
      step(5, "多渠道发布", "xiaofa"),
    ],
  },
  {
    name: "发布会追踪报道",
    description: "实时追踪发布会要点，自动生成报道并分发到各渠道",
    category: "news",
    triggerType: "manual",
    steps: [
      step(1, "发布会信息采集", "xiaolei"),
      step(2, "要点提取与稿件生成", "xiaowen"),
      step(3, "内容审核", "xiaoshen"),
      step(4, "全渠道分发", "xiaofa"),
    ],
  },
  {
    name: "每日热点早报",
    description: "每天早上自动聚合热点新闻，生成摘要早报",
    category: "news",
    triggerType: "scheduled",
    triggerConfig: { cron: "0 8 * * *", timezone: "Asia/Shanghai" },
    steps: [
      step(1, "全网热点聚合", "xiaolei"),
      step(2, "热点摘要生成", "xiaowen"),
    ],
  },
  {
    name: "短视频批量生产",
    description: "从选题到脚本到剪辑方案的短视频批量生产流程",
    category: "video",
    triggerType: "manual",
    steps: [
      step(1, "选题策划", "xiaoce"),
      step(2, "脚本生成", "xiaowen"),
      step(3, "剪辑计划", "xiaojian"),
      step(4, "质量审核", "xiaoshen"),
    ],
  },
  {
    name: "竞品监测周报",
    description: "每周自动抓取竞品动态，生成对比分析报告",
    category: "analytics",
    triggerType: "scheduled",
    triggerConfig: { cron: "0 9 * * 1", timezone: "Asia/Shanghai" },
    steps: [
      step(1, "竞品信息抓取", "xiaolei"),
      step(2, "数据对比分析", "xiaoshu"),
    ],
  },
  {
    name: "全渠道内容分发",
    description: "内容审核通过后，自动适配各渠道并分发，回收数据",
    category: "distribution",
    triggerType: "manual",
    steps: [
      step(1, "质量审核", "xiaoshen"),
      step(2, "渠道适配与发布", "xiaofa"),
      step(3, "数据回收分析", "xiaoshu"),
    ],
  },
  {
    name: "深度专题制作",
    description: "从调研到策划到写作到视频的完整深度专题制作流程",
    category: "news",
    triggerType: "manual",
    steps: [
      step(1, "深度调研", "xiaolei"),
      step(2, "专题策划", "xiaoce"),
      step(3, "长文写作", "xiaowen"),
      step(4, "视频制作方案", "xiaojian"),
      step(5, "质量审核", "xiaoshen"),
    ],
  },
];
