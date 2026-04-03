"use client";

import Link from "next/link";
import {
  Video, Image as ImageIcon, Headphones, FileText, FileEdit,
  Check, FileCheck, Brain, ListChecks, Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaAssetFull } from "@/lib/types";

const typeConfig: Record<string, { label: string; color: string; bgColor: string; icon: typeof Video }> = {
  video: { label: "视频", color: "text-blue-500", bgColor: "bg-blue-100 dark:bg-blue-900/30", icon: Video },
  image: { label: "图片", color: "text-green-500", bgColor: "bg-green-100 dark:bg-green-900/30", icon: ImageIcon },
  audio: { label: "音频", color: "text-purple-500", bgColor: "bg-purple-100 dark:bg-purple-900/30", icon: Headphones },
  document: { label: "文档", color: "text-amber-500", bgColor: "bg-amber-100 dark:bg-amber-900/30", icon: FileText },
  manuscript: { label: "文稿", color: "text-pink-500", bgColor: "bg-pink-100 dark:bg-pink-900/30", icon: FileEdit },
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
    <div className="group relative rounded-xl overflow-hidden bg-white dark:bg-gray-900/50 ring-1 ring-gray-200/60 dark:ring-white/[0.06] hover:ring-blue-300 dark:hover:ring-blue-800 hover:shadow-md transition-all">
      {/* Checkbox overlay */}
      {selectable && (
        <div
          className={cn(
            "absolute top-2.5 left-2.5 z-10 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition-all ring-1",
            selected
              ? "bg-blue-600 text-white ring-blue-600"
              : "bg-white/90 dark:bg-gray-800/90 ring-gray-300 dark:ring-gray-600 opacity-0 group-hover:opacity-100"
          )}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSelect?.(asset.id); }}
        >
          {selected && <Check size={11} strokeWidth={3} />}
        </div>
      )}

      <Link href={`/media-assets/${asset.id}`}>
        {/* Thumbnail area */}
        <div className={cn("aspect-[16/10] flex items-center justify-center relative overflow-hidden", tc.bgColor)}>
          {asset.thumbnailUrl ? (
            <img src={asset.thumbnailUrl} alt={asset.title} className="w-full h-full object-cover" />
          ) : (
            <Icon size={32} className={cn(tc.color, "opacity-60")} />
          )}

          {/* Duration badge */}
          {asset.duration && (
            <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/70 text-white backdrop-blur-sm">
              {asset.duration}
            </span>
          )}

          {/* Version badge */}
          {asset.versionNumber > 1 && (
            <span className="absolute top-2.5 right-2.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-600 text-white">
              V{asset.versionNumber}
            </span>
          )}

          {/* Bottom status icons — overlaid on thumbnail */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1">
            {/* Catalog status */}
            <StatusIcon
              active={asset.catalogStatus === "cataloged"}
              icon={Pencil}
              title={asset.catalogStatus === "cataloged" ? "已编目" : "未编目"}
              activeColor="text-emerald-400"
            />
            {/* AI status */}
            <StatusIcon
              active={asset.understandingStatus === "completed"}
              icon={Brain}
              title={asset.understandingStatus === "completed" ? "AI已分析" : "AI未分析"}
              activeColor="text-blue-400"
              processing={asset.understandingStatus === "processing"}
            />
            {/* Review status */}
            {asset.reviewStatus !== "not_submitted" && (
              <StatusIcon
                active={asset.reviewStatus === "approved"}
                icon={ListChecks}
                title={
                  asset.reviewStatus === "approved" ? "审核通过" :
                  asset.reviewStatus === "reviewing" ? "审核中" :
                  asset.reviewStatus === "pending" ? "待审核" : "已打回"
                }
                activeColor="text-green-400"
                processing={asset.reviewStatus === "reviewing" || asset.reviewStatus === "pending"}
              />
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="px-3 py-2.5">
          <h3 className="text-[13px] font-medium text-gray-800 dark:text-gray-100 truncate leading-snug">
            {asset.title}
          </h3>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 truncate">
            {asset.uploaderName || "—"} · {new Date(asset.createdAt).toLocaleString("zh-CN", {
              year: "numeric", month: "2-digit", day: "2-digit",
              hour: "2-digit", minute: "2-digit", second: "2-digit",
            })}
          </p>
        </div>
      </Link>
    </div>
  );
}

function StatusIcon({
  active, icon: Icon, title, activeColor, processing,
}: {
  active: boolean;
  icon: typeof FileCheck;
  title: string;
  activeColor: string;
  processing?: boolean;
}) {
  return (
    <span
      className={cn(
        "w-6 h-6 rounded-md flex items-center justify-center backdrop-blur-sm transition-colors",
        active ? cn("bg-black/50", activeColor) :
        processing ? "bg-black/50 text-amber-400" :
        "bg-black/40 text-white/50"
      )}
      title={title}
    >
      <Icon size={13} />
    </span>
  );
}
