"use client";

import Link from "next/link";
import { Video, Image as ImageIcon, Headphones, FileText, FileEdit, MoreHorizontal, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/shared/glass-card";
import type { MediaAssetFull } from "@/lib/types";

const typeConfig: Record<string, { label: string; color: string; bgColor: string; icon: typeof Video }> = {
  video: { label: "视频", color: "text-blue-500", bgColor: "bg-blue-100 dark:bg-blue-900/30", icon: Video },
  image: { label: "图片", color: "text-green-500", bgColor: "bg-green-100 dark:bg-green-900/30", icon: ImageIcon },
  audio: { label: "音频", color: "text-purple-500", bgColor: "bg-purple-100 dark:bg-purple-900/30", icon: Headphones },
  document: { label: "文档", color: "text-amber-500", bgColor: "bg-amber-100 dark:bg-amber-900/30", icon: FileText },
  manuscript: { label: "文稿", color: "text-pink-500", bgColor: "bg-pink-100 dark:bg-pink-900/30", icon: FileEdit },
};

const reviewStatusColor: Record<string, string> = {
  approved: "bg-green-500",
  reviewing: "bg-blue-500",
  pending: "bg-amber-400",
  rejected: "bg-red-500",
  not_submitted: "bg-gray-400",
};

interface Props {
  asset: MediaAssetFull;
  selected?: boolean;
  selectable?: boolean;
  onSelect?: (id: string) => void;
}

export function ResourceCard({ asset, selected, selectable, onSelect }: Props) {
  const tc = typeConfig[asset.type] || typeConfig.document;
  const Icon = tc.icon;

  return (
    <GlassCard variant="interactive" padding="none" className="overflow-hidden group relative">
      {/* Checkbox overlay */}
      {selectable && (
        <div
          className={cn(
            "absolute top-2 left-2 z-10 w-5 h-5 rounded flex items-center justify-center cursor-pointer transition-all",
            selected
              ? "bg-blue-600 text-white"
              : "bg-white/80 dark:bg-gray-800/80 opacity-0 group-hover:opacity-100"
          )}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSelect?.(asset.id); }}
        >
          {selected && <Check size={12} />}
        </div>
      )}

      <Link href={`/media-assets/${asset.id}`}>
        {/* Thumbnail */}
        <div className={cn("h-[120px] flex items-center justify-center relative", tc.bgColor)}>
          {asset.thumbnailUrl ? (
            <img src={asset.thumbnailUrl} alt={asset.title} className="w-full h-full object-cover" />
          ) : (
            <Icon size={28} className={tc.color} />
          )}
          {/* Type badge */}
          <span className={cn("absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/50 text-white")}>
            {tc.label}
          </span>
          {/* Duration badge */}
          {asset.duration && (
            <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[10px] bg-black/60 text-white">
              {asset.duration}
            </span>
          )}
          {/* Version badge */}
          {asset.versionNumber > 1 && (
            <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded text-[10px] bg-blue-600 text-white">
              V{asset.versionNumber}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="p-3">
          <h3 className="text-[13px] font-medium text-gray-800 dark:text-gray-100 truncate mb-1.5">
            {asset.title}
          </h3>

          {/* Status indicators */}
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            {asset.understandingStatus !== "queued" && (
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[10px]",
                asset.understandingStatus === "completed" ? "bg-green-100 dark:bg-green-900/30 text-green-600" :
                asset.understandingStatus === "processing" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600" :
                "bg-red-100 dark:bg-red-900/30 text-red-600"
              )}>
                AI {asset.understandingStatus === "completed" ? "已分析" : asset.understandingStatus === "processing" ? "分析中" : "失败"}
              </span>
            )}
            {asset.reviewStatus !== "not_submitted" && (
              <span className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
                <span className={cn("w-1.5 h-1.5 rounded-full", reviewStatusColor[asset.reviewStatus])} />
                {asset.reviewStatus === "approved" ? "已审核" : asset.reviewStatus === "reviewing" ? "审核中" : asset.reviewStatus === "pending" ? "待审核" : "已打回"}
              </span>
            )}
          </div>

          {/* Meta */}
          <div className="flex items-center justify-between text-[11px] text-gray-400 dark:text-gray-500">
            <span>{asset.uploaderName || "—"}</span>
            <span>{new Date(asset.createdAt).toLocaleDateString("zh-CN")}</span>
          </div>
        </div>
      </Link>
    </GlassCard>
  );
}
