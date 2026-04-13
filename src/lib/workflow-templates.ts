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
  skillSlug: string,
  skillName: string,
  skillCategory: string
): WorkflowStepDef {
  return {
    id: `step-${order}`,
    order,
    dependsOn: order > 1 ? [`step-${order - 1}`] : [],
    name,
    type: "skill",
    config: { skillSlug, skillName, skillCategory, parameters: {} },
  };
}

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    name: "突发新闻快速报道",
    description: "从热点发现到稿件发布的全流程自动化，适用于突发新闻的快速响应",
    category: "news",
    triggerType: "manual",
    steps: [
      step(1, "热点确认与信息采集", "trend_monitor", "趋势监控", "perception"),
      step(2, "快速选题策划", "topic_extraction", "选题提取", "analysis"),
      step(3, "稿件快速撰写", "content_generate", "内容生成", "generation"),
      step(4, "质量审核", "quality_review", "质量审核", "management"),
      step(5, "多渠道发布", "publish_strategy", "发布策略", "management"),
    ],
  },
  {
    name: "发布会追踪报道",
    description: "实时追踪发布会要点，自动生成报道并分发到各渠道",
    category: "news",
    triggerType: "manual",
    steps: [
      step(1, "发布会信息采集", "news_aggregation", "新闻聚合", "perception"),
      step(2, "要点提取与稿件生成", "content_generate", "内容生成", "generation"),
      step(3, "内容审核", "quality_review", "质量审核", "management"),
      step(4, "全渠道分发", "publish_strategy", "发布策略", "management"),
    ],
  },
  {
    name: "每日热点早报",
    description: "每天早上自动聚合热点新闻，生成摘要早报",
    category: "news",
    triggerType: "scheduled",
    triggerConfig: { cron: "0 8 * * *", timezone: "Asia/Shanghai" },
    steps: [
      step(1, "全网热点聚合", "news_aggregation", "新闻聚合", "perception"),
      step(2, "热点摘要生成", "summary_generate", "摘要生成", "generation"),
    ],
  },
  {
    name: "短视频批量生产",
    description: "从选题到脚本到剪辑方案的短视频批量生产流程",
    category: "video",
    triggerType: "manual",
    steps: [
      step(1, "选题策划", "topic_extraction", "选题提取", "analysis"),
      step(2, "脚本生成", "script_generate", "脚本生成", "generation"),
      step(3, "剪辑计划", "video_edit_plan", "视频剪辑方案", "production"),
      step(4, "质量审核", "quality_review", "质量审核", "management"),
    ],
  },
  {
    name: "竞品监测周报",
    description: "每周自动抓取竞品动态，生成对比分析报告",
    category: "analytics",
    triggerType: "scheduled",
    triggerConfig: { cron: "0 9 * * 1", timezone: "Asia/Shanghai" },
    steps: [
      step(1, "竞品信息抓取", "competitor_analysis", "竞品分析", "analysis"),
      step(2, "数据对比分析", "data_report", "数据报告", "analysis"),
    ],
  },
  {
    name: "全渠道内容分发",
    description: "内容审核通过后，自动适配各渠道并分发，回收数据",
    category: "distribution",
    triggerType: "manual",
    steps: [
      step(1, "质量审核", "quality_review", "质量审核", "management"),
      step(2, "渠道适配与发布", "publish_strategy", "发布策略", "management"),
      step(3, "数据回收分析", "data_report", "数据报告", "analysis"),
    ],
  },
  {
    name: "深度专题制作",
    description: "从调研到策划到写作到视频的完整深度专题制作流程",
    category: "news",
    triggerType: "manual",
    steps: [
      step(1, "深度调研", "web_search", "网络搜索", "perception"),
      step(2, "专题策划", "topic_extraction", "选题提取", "analysis"),
      step(3, "长文写作", "content_generate", "内容生成", "generation"),
      step(4, "视频制作方案", "video_edit_plan", "视频剪辑方案", "production"),
      step(5, "质量审核", "quality_review", "质量审核", "management"),
    ],
  },
  {
    name: "每日热点新闻推荐",
    description: "每天早晨自动聚合全网热点，评估价值后生成推荐列表并推送到编辑部",
    category: "news",
    triggerType: "scheduled",
    triggerConfig: { cron: "0 7 * * *", timezone: "Asia/Shanghai" },
    steps: [
      step(1, "全网热点聚合", "news_aggregation", "新闻聚合", "perception"),
      step(2, "热度与价值评估", "topic_extraction", "选题提取", "analysis"),
      step(3, "推荐列表生成", "content_generate", "内容生成", "generation"),
      step(4, "推送到编辑部", "publish_strategy", "发布策略", "management"),
    ],
  },
  {
    name: "金融科技监管日报",
    description: "工作日定时抓取金融监管政策，分析影响后生成日报并合规审核发布",
    category: "news",
    triggerType: "scheduled",
    triggerConfig: { cron: "0 9 * * 1-5", timezone: "Asia/Shanghai" },
    steps: [
      step(1, "监管政策抓取", "fintech_regulation_monitor", "金融监管监控", "perception"),
      step(2, "政策影响分析", "data_report", "数据报告", "analysis"),
      step(3, "日报稿件撰写", "content_generate", "内容生成", "generation"),
      step(4, "合规审核", "quality_review", "质量审核", "management"),
      step(5, "多渠道发布", "publish_strategy", "发布策略", "management"),
    ],
  },
  {
    name: "每周竞争对手情报报告",
    description: "每周一自动抓取竞品动态，对比分析差异与机会后生成情报报告推送管理层",
    category: "analytics",
    triggerType: "scheduled",
    triggerConfig: { cron: "0 10 * * 1", timezone: "Asia/Shanghai" },
    steps: [
      step(1, "竞品动态抓取", "competitor_analysis", "竞品分析", "perception"),
      step(2, "竞品内容对比", "data_report", "数据报告", "analysis"),
      step(3, "差异与机会分析", "topic_extraction", "选题提取", "analysis"),
      step(4, "情报报告生成", "content_generate", "内容生成", "generation"),
      step(5, "报告推送至管理层", "publish_strategy", "发布策略", "management"),
    ],
  },
  {
    name: "客户投诉邮件分类",
    description: "手动触发客户投诉邮件分类流程，自动识别情感与紧急度后派发到对应部门",
    category: "distribution",
    triggerType: "manual",
    steps: [
      step(1, "邮件拉取与预处理", "email_classifier", "邮件分类", "perception"),
      step(2, "情感与紧急度分析", "data_report", "数据报告", "analysis"),
      step(3, "自动分类与打标", "topic_extraction", "选题提取", "analysis"),
      step(4, "派发至对应部门", "publish_strategy", "发布策略", "management"),
    ],
  },
];
