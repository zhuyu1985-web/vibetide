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
  Sparkles,
  Database,
  Package,
  type LucideIcon,
} from "lucide-react";
import type { WorkflowPickerSkill } from "@/lib/dal/skills";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AddStepPanelProps {
  /** Live skills list, loaded server-side from the skills table. */
  skills: WorkflowPickerSkill[];
  onAddSkillStep: (
    skillSlug: string,
    skillName: string,
    skillCategory: string,
  ) => void;
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

/**
 * Per-slug icon for known builtins. Unknown slugs (custom / plugin skills)
 * fall back to the category icon.
 */
const SKILL_ICONS: Record<string, LucideIcon> = {
  web_search: Globe,
  web_deep_read: Search,
  trend_monitor: Telescope,
  news_aggregation: Newspaper,
  social_listening: Ear,
  trending_topics: Flame,
  media_search: Library,
  angle_design: Lightbulb,
  content_generate: PenTool,
  headline_generate: Heading,
  summary_generate: FileStack,
  style_rewrite: Wand2,
  translation: Languages,
  layout_design: Layout,
  thumbnail_generate: Image,
  zongyi_highlight: Sparkles,
  script_generate: BookOpen,
  duanju_script: Film,
  podcast_script: Mic,
  tandian_script: Film,
  zhongcao_script: Film,
  video_edit_plan: Film,
  audio_plan: Mic,
  quality_review: CheckSquare,
  compliance_check: Shield,
  fact_check: ListChecks,
  topic_extraction: Search,
  sentiment_analysis: BarChart3,
  audience_analysis: Users,
  competitor_analysis: Target,
  heat_scoring: Flame,
  data_report: TrendingUp,
  cms_publish: Share2,
  cms_catalog_sync: Database,
  aigc_script_push: Share2,
  publish_strategy: Share2,
  task_planning: ListChecks,
  knowledge_retrieval: FolderSearch,
  case_reference: Award,
};

/** Ordering + labels for the 10-bucket skill taxonomy (matches DB enum). */
const CATEGORY_ORDER: Array<{
  category: string;
  label: string;
  icon: LucideIcon;
}> = [
  { category: "web_search", label: "全网检索", icon: Globe },
  { category: "data_collection", label: "数据采集", icon: Database },
  { category: "topic_planning", label: "选题策划", icon: Lightbulb },
  { category: "content_gen", label: "内容生成", icon: PenTool },
  { category: "av_script", label: "视音频脚本", icon: Film },
  { category: "quality_review", label: "质量审核", icon: Shield },
  { category: "content_analysis", label: "内容分析", icon: BarChart3 },
  { category: "data_analysis", label: "数据分析", icon: TrendingUp },
  { category: "distribution", label: "渠道分发", icon: Share2 },
  { category: "other", label: "其他", icon: Package },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupSkills(skills: WorkflowPickerSkill[]) {
  const byCategory = new Map<string, WorkflowPickerSkill[]>();
  for (const s of skills) {
    const key = s.category;
    const bucket = byCategory.get(key) ?? [];
    bucket.push(s);
    byCategory.set(key, bucket);
  }

  // Stable order: canonical first, then any unexpected categories at the end.
  const groups: Array<{
    category: string;
    label: string;
    icon: LucideIcon;
    skills: WorkflowPickerSkill[];
  }> = [];
  const known = new Set(CATEGORY_ORDER.map((c) => c.category));
  for (const meta of CATEGORY_ORDER) {
    const list = byCategory.get(meta.category);
    if (!list?.length) continue;
    groups.push({ ...meta, skills: list });
  }
  for (const [cat, list] of byCategory) {
    if (known.has(cat) || list.length === 0) continue;
    groups.push({ category: cat, label: cat, icon: Package, skills: list });
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AddStepPanel({
  skills,
  onAddSkillStep,
  onAddOutputStep,
}: AddStepPanelProps) {
  const groups = groupSkills(skills);

  return (
    <div className="flex flex-col gap-6">
      {groups.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          当前组织暂无可用技能，请先在「技能库」中同步或创建。
        </p>
      ) : (
        groups.map((group) => {
          const GroupIcon = group.icon;
          return (
            <div key={group.category}>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <GroupIcon className="w-3 h-3" />
                {group.label}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {group.skills.map((skill) => {
                  const Icon = SKILL_ICONS[skill.slug] ?? group.icon;
                  return (
                    <button
                      key={skill.slug}
                      onClick={() =>
                        onAddSkillStep(skill.slug, skill.name, skill.category)
                      }
                      title={skill.name}
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
          );
        })
      )}

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
