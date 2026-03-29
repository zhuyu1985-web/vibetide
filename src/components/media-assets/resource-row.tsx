"use client";

import Link from "next/link";
import { Video, Image as ImageIcon, Headphones, FileText, FileEdit, Check, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaAssetFull } from "@/lib/types";

const typeIcons: Record<string, { icon: typeof Video; color: string; bg: string }> = {
  video: { icon: Video, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20" },
  image: { icon: ImageIcon, color: "text-green-500", bg: "bg-green-50 dark:bg-green-900/20" },
  audio: { icon: Headphones, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/20" },
  document: { icon: FileText, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20" },
  manuscript: { icon: FileEdit, color: "text-pink-500", bg: "bg-pink-50 dark:bg-pink-900/20" },
};

const typeLabels: Record<string, string> = {
  video: "视频", image: "图片", audio: "音频", document: "文档", manuscript: "文稿",
};

interface Props {
  asset: MediaAssetFull;
  selected?: boolean;
  selectable?: boolean;
  onSelect?: (id: string) => void;
}

export function ResourceRow({ asset, selected, selectable, onSelect }: Props) {
  const tc = typeIcons[asset.type] || typeIcons.document;
  const Icon = tc.icon;

  return (
    <div className={cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]",
      selected && "bg-blue-50/50 dark:bg-blue-950/20"
    )}>
      {/* Checkbox */}
      {selectable && (
        <div
          className={cn(
            "w-5 h-5 rounded flex items-center justify-center cursor-pointer shrink-0 transition-colors",
            selected ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-gray-700"
          )}
          onClick={() => onSelect?.(asset.id)}
        >
          {selected && <Check size={12} />}
        </div>
      )}

      {/* Thumbnail */}
      <Link href={`/media-assets/${asset.id}`} className="flex items-center gap-3 flex-1 min-w-0">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", tc.bg)}>
          <Icon size={18} className={tc.color} />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-[13px] font-medium text-gray-800 dark:text-gray-100 truncate">
            {asset.title}
          </h3>
        </div>

        <span className="text-[12px] text-gray-400 dark:text-gray-500 shrink-0 w-12">
          {typeLabels[asset.type]}
        </span>

        <span className="text-[12px] text-gray-400 dark:text-gray-500 shrink-0 w-20 truncate">
          {asset.uploaderName || "—"}
        </span>

        <span className="text-[12px] text-gray-400 dark:text-gray-500 shrink-0 w-24">
          {new Date(asset.createdAt).toLocaleDateString("zh-CN")}
        </span>

        <span className="text-[12px] text-gray-400 dark:text-gray-500 shrink-0 w-16 text-right">
          {asset.fileSizeDisplay || "—"}
        </span>
      </Link>
    </div>
  );
}
