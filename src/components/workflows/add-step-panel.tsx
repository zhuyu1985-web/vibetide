"use client";

import {
  FolderOpen,
  Radio,
  FileText,
  Bell,
  Telescope,
  Globe,
  Newspaper,
  Ear,
  Search,
  BarChart3,
  Users,
  Target,
  PenTool,
  Heading,
  FileStack,
  BookOpen,
  Wand2,
  Languages,
  Lightbulb,
  Film,
  Image,
  Layout,
  Mic,
  CheckSquare,
  Shield,
  ListChecks,
  Share2,
  FolderSearch,
  Library,
  Award,
  TrendingUp,
  Flame,
  type LucideIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AddStepPanelProps {
  onAddSkillStep: (skillSlug: string, skillName: string, skillCategory: string) => void;
  onAddOutputStep: (action: string, actionLabel: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OUTPUT_ACTIONS = [
  { id: "save_to_assets", label: "保存到媒资库", icon: FolderOpen },
  { id: "publish", label: "发布到渠道", icon: Radio },
  { id: "generate_report", label: "生成报告", icon: FileText },
  { id: "send_notification", label: "发送通知", icon: Bell },
] as const;

interface SkillDef {
  slug: string;
  name: string;
  icon: LucideIcon;
}

interface SkillGroup {
  category: string;
  label: string;
  skills: SkillDef[];
}

const SKILL_GROUPS: SkillGroup[] = [
  {
    category: "perception",
    label: "感知",
    skills: [
      { slug: "trend_monitor", name: "趋势监控", icon: Telescope },
      { slug: "news_aggregation", name: "新闻聚合", icon: Newspaper },
      { slug: "social_listening", name: "社交聆听", icon: Ear },
      { slug: "web_search", name: "网络搜索", icon: Globe },
    ],
  },
  {
    category: "analysis",
    label: "分析",
    skills: [
      { slug: "topic_extraction", name: "选题提取", icon: Search },
      { slug: "audience_analysis", name: "受众分析", icon: Users },
      { slug: "competitor_analysis", name: "竞品分析", icon: Target },
      { slug: "sentiment_analysis", name: "情感分析", icon: BarChart3 },
      { slug: "heat_scoring", name: "热度评分", icon: Flame },
      { slug: "data_report", name: "数据报告", icon: TrendingUp },
    ],
  },
  {
    category: "generation",
    label: "生成",
    skills: [
      { slug: "content_generate", name: "内容生成", icon: PenTool },
      { slug: "headline_generate", name: "标题生成", icon: Heading },
      { slug: "summary_generate", name: "摘要生成", icon: FileStack },
      { slug: "script_generate", name: "脚本生成", icon: BookOpen },
      { slug: "style_rewrite", name: "风格改写", icon: Wand2 },
      { slug: "translation", name: "翻译", icon: Languages },
      { slug: "angle_design", name: "角度设计", icon: Lightbulb },
    ],
  },
  {
    category: "production",
    label: "制作",
    skills: [
      { slug: "video_edit_plan", name: "视频剪辑方案", icon: Film },
      { slug: "thumbnail_generate", name: "缩略图生成", icon: Image },
      { slug: "layout_design", name: "版面设计", icon: Layout },
      { slug: "audio_plan", name: "音频方案", icon: Mic },
    ],
  },
  {
    category: "management",
    label: "管理",
    skills: [
      { slug: "quality_review", name: "质量审核", icon: CheckSquare },
      { slug: "compliance_check", name: "合规检查", icon: Shield },
      { slug: "fact_check", name: "事实核查", icon: ListChecks },
      { slug: "publish_strategy", name: "发布策略", icon: Share2 },
      { slug: "task_planning", name: "任务规划", icon: ListChecks },
    ],
  },
  {
    category: "knowledge",
    label: "知识",
    skills: [
      { slug: "knowledge_retrieval", name: "知识检索", icon: FolderSearch },
      { slug: "media_search", name: "媒资搜索", icon: Library },
      { slug: "case_reference", name: "案例参考", icon: Award },
    ],
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AddStepPanel({
  onAddSkillStep,
  onAddOutputStep,
}: AddStepPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      <h3 className="text-base font-semibold text-foreground">添加步骤</h3>

      {/* ── Skills grouped by category ── */}
      {SKILL_GROUPS.map((group) => (
        <div key={group.category}>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {group.label}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {group.skills.map((skill) => {
              const Icon = skill.icon;
              return (
                <button
                  key={skill.slug}
                  onClick={() =>
                    onAddSkillStep(skill.slug, skill.name, group.category)
                  }
                  className="flex items-center gap-2 rounded-xl px-2.5 py-2 bg-black/[0.03] dark:bg-white/[0.04] border-0 text-sm text-foreground hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                >
                  <span className="flex items-center justify-center w-6 h-6 rounded-lg shrink-0 bg-black/[0.05] dark:bg-white/[0.08]">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  </span>
                  <span className="truncate text-xs">{skill.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* ── Output Actions ── */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">
          输出动作
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {OUTPUT_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => onAddOutputStep(action.id, action.label)}
                className="flex items-center gap-2 rounded-xl px-2.5 py-2 bg-black/[0.03] dark:bg-white/[0.04] border-0 text-sm text-foreground hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <span className="flex items-center justify-center w-6 h-6 rounded-lg shrink-0 bg-black/[0.05] dark:bg-white/[0.08]">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                </span>
                <span className="truncate text-xs">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
