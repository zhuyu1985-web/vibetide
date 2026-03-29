"use client";

import { X, Trash2, Share2, FolderInput, Wand2, ArrowRightLeft, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaLibraryType } from "@/lib/types";

interface Props {
  library: MediaLibraryType;
  selectedCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDelete: () => void;
  onShare: () => void;
  onMoveToProduct?: () => void;
  onMove?: () => void;
  onSubmitReview?: () => void;
  onSmartProcess: () => void;
}

export function BatchActionBar({
  library, selectedCount, onSelectAll, onClearSelection,
  onDelete, onShare, onMoveToProduct, onMove, onSubmitReview, onSmartProcess,
}: Props) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 mb-3 animate-in slide-in-from-top-2 duration-200">
      <span className="text-[13px] text-blue-700 dark:text-blue-300 font-medium">
        已选择 {selectedCount} 项
      </span>

      <button onClick={onSelectAll} className="text-[12px] text-blue-600 dark:text-blue-400 hover:underline">
        全选当前页
      </button>
      <button onClick={onClearSelection} className="text-[12px] text-gray-500 dark:text-gray-400 hover:underline">
        取消全选
      </button>

      <div className="ml-auto flex items-center gap-1">
        {library === "personal" && onMoveToProduct && (
          <ActionBtn icon={FolderInput} label="入成品库" onClick={onMoveToProduct} />
        )}
        {library === "product" && onMove && (
          <ActionBtn icon={ArrowRightLeft} label="移动" onClick={onMove} />
        )}
        {library === "product" && onSubmitReview && (
          <ActionBtn icon={ClipboardCheck} label="提交审核" onClick={onSubmitReview} />
        )}
        <ActionBtn icon={Wand2} label="智能处理" onClick={onSmartProcess} />
        <ActionBtn icon={Share2} label="分享" onClick={onShare} />
        <ActionBtn icon={Trash2} label="删除" onClick={onDelete} danger />
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, onClick, danger }: {
  icon: typeof Trash2; label: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-7 flex items-center gap-1.5 px-2.5 rounded-md text-[12px] transition-colors",
        danger
          ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20"
          : "text-gray-600 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-white/5"
      )}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}
