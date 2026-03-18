"use client";

import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  MessageCircle,
  Newspaper,
  Music,
  Flame,
  Globe,
  Tv,
  BookOpen,
  Video,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  type LucideIcon,
} from "lucide-react";

interface ChannelPreviewPlan {
  id: string;
  channel: string;
  platform: string;
  title: string;
  adaptedContent?: {
    headline?: string;
    body?: string;
    coverImage?: string;
    tags?: string[];
    format?: string;
  };
  status: string;
  scheduledAt: string;
}

interface ChannelPreviewProps {
  publishPlans: ChannelPreviewPlan[];
}

const channelConfig: Record<
  string,
  { label: string; icon: LucideIcon; color: string; bgColor: string; charLimit: number; note: string }
> = {
  wechat: {
    label: "微信公众号",
    icon: MessageCircle,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950/50",
    charLimit: 20000,
    note: "支持图文混排，标题64字以内",
  },
  weibo: {
    label: "微博",
    icon: Flame,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-950/50",
    charLimit: 2000,
    note: "140字精华，#话题标签#",
  },
  douyin: {
    label: "抖音",
    icon: Music,
    color: "text-pink-600 dark:text-pink-400",
    bgColor: "bg-pink-50 dark:bg-pink-950/50",
    charLimit: 500,
    note: "竖屏短视频，标题55字以内",
  },
  kuaishou: {
    label: "快手",
    icon: Video,
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-50 dark:bg-yellow-950/50",
    charLimit: 500,
    note: "短视频，接地气风格",
  },
  bilibili: {
    label: "B站",
    icon: Tv,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/50",
    charLimit: 2000,
    note: "中长视频，支持专栏文章",
  },
  xiaohongshu: {
    label: "小红书",
    icon: BookOpen,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/50",
    charLimit: 1000,
    note: "图文笔记，标题20字以内",
  },
  shipinhao: {
    label: "视频号",
    icon: Video,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/50",
    charLimit: 1000,
    note: "微信生态短视频",
  },
  toutiao: {
    label: "今日头条",
    icon: Newspaper,
    color: "text-red-700 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/50",
    charLimit: 30000,
    note: "图文/微头条，推荐算法分发",
  },
};

const statusConfig: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  scheduled: { label: "已排期", icon: Clock, color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-700/50" },
  publishing: { label: "发布中", icon: Loader2, color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-700/50" },
  published: { label: "已发布", icon: CheckCircle, color: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-700/50" },
  failed: { label: "失败", icon: AlertCircle, color: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-700/50" },
};

export function ChannelPreview({ publishPlans }: ChannelPreviewProps) {
  // Group plans by platform
  const byPlatform = publishPlans.reduce<Record<string, ChannelPreviewPlan[]>>((acc, plan) => {
    const key = plan.platform || "unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(plan);
    return acc;
  }, {});

  // Determine which platforms to show (all configured + any extras from data)
  const allPlatforms = Object.keys(channelConfig);
  const platformsWithData = new Set(Object.keys(byPlatform));

  if (publishPlans.length === 0) {
    return (
      <GlassCard className="text-center py-12">
        <FileText size={40} className="mx-auto text-gray-300 mb-3" />
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
          暂无适配版本
        </h3>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          内容发布后将在此展示各渠道适配版本
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {allPlatforms.map((platform) => {
        const config = channelConfig[platform];
        const plans = byPlatform[platform] || [];
        const Icon = config.icon;

        return (
          <GlassCard
            key={platform}
            variant="interactive"
            padding="md"
            className={cn(
              "transition-all duration-200",
              plans.length === 0 && "opacity-50"
            )}
          >
            {/* Channel Header */}
            <div className="flex items-center gap-3 mb-3">
              <div
                className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center",
                  config.bgColor
                )}
              >
                <Icon size={18} className={config.color} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {config.label}
                </h4>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">{config.note}</p>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                {plans.length} 个版本
              </Badge>
            </div>

            {/* Content Previews */}
            {plans.length > 0 ? (
              <div className="space-y-2">
                {plans.map((plan) => {
                  const st = statusConfig[plan.status] || statusConfig.scheduled;
                  const StIcon = st.icon;
                  const content = plan.adaptedContent;
                  const bodyText = content?.body || "";
                  const charCount = bodyText.length;

                  return (
                    <div
                      key={plan.id}
                      className="p-2.5 rounded-lg bg-white/60 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-700/50 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate flex-1">
                          {content?.headline || plan.title}
                        </p>
                        <Badge
                          variant="outline"
                          className={cn("text-[9px] shrink-0", st.color)}
                        >
                          <StIcon size={9} className="mr-0.5" />
                          {st.label}
                        </Badge>
                      </div>

                      {bodyText && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                          {bodyText}
                        </p>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {content?.tags?.slice(0, 3).map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="text-[9px] h-4 px-1"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500">
                          {content?.format && (
                            <span className="bg-gray-50 dark:bg-gray-800/50 px-1.5 py-0.5 rounded">
                              {content.format}
                            </span>
                          )}
                          <span
                            className={cn(
                              charCount > config.charLimit
                                ? "text-red-500"
                                : "text-gray-400 dark:text-gray-500"
                            )}
                          >
                            {charCount}/{config.charLimit}字
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-xs text-gray-400 dark:text-gray-500">暂无该渠道适配内容</p>
              </div>
            )}
          </GlassCard>
        );
      })}
    </div>
  );
}
