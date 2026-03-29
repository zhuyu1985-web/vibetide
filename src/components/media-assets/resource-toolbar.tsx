"use client";

import { useState } from "react";
import {
  Search, Filter, LayoutGrid, List, ArrowUpDown, Upload, PanelRight,
  ChevronDown, ArrowUp, ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaLibraryType } from "@/lib/types";

const typeFilters = [
  { key: "all", label: "全部" },
  { key: "video", label: "视频" },
  { key: "audio", label: "音频" },
  { key: "image", label: "图片" },
  { key: "document", label: "文档" },
  { key: "manuscript", label: "文稿" },
];

const sortOptions = [
  { key: "createdAt", label: "创建时间" },
  { key: "title", label: "文件名称" },
  { key: "fileSize", label: "文件大小" },
];

interface Props {
  library: MediaLibraryType;
  search: string;
  onSearchChange: (v: string) => void;
  typeFilter: string;
  onTypeFilterChange: (v: string) => void;
  sortField: string;
  sortDirection: "asc" | "desc";
  onSortChange: (field: string, dir: "asc" | "desc") => void;
  viewMode: "grid" | "list";
  onViewModeChange: (v: "grid" | "list") => void;
  onUploadClick: () => void;
  infoPanelOpen: boolean;
  onInfoPanelToggle: () => void;
}

export function ResourceToolbar({
  library, search, onSearchChange, typeFilter, onTypeFilterChange,
  sortField, sortDirection, onSortChange, viewMode, onViewModeChange,
  onUploadClick, infoPanelOpen, onInfoPanelToggle,
}: Props) {
  const [sortOpen, setSortOpen] = useState(false);
  const showUpload = library === "personal" || library === "product";

  return (
    <div className="flex items-center gap-2 py-2 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="搜索资源..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-8 pl-9 pr-3 rounded-lg bg-gray-100/60 dark:bg-white/5 text-[13px] outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {/* Type filter tabs */}
      <div className="flex items-center gap-0.5 bg-gray-100/60 dark:bg-white/5 rounded-lg p-0.5">
        {typeFilters.map((t) => (
          <button
            key={t.key}
            onClick={() => onTypeFilterChange(t.key)}
            className={cn(
              "px-2.5 py-1 rounded-md text-[12px] transition-colors",
              typeFilter === t.key
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="relative">
        <button
          onClick={() => setSortOpen(!sortOpen)}
          className="h-8 flex items-center gap-1.5 px-2.5 rounded-lg text-[12px] text-gray-500 dark:text-gray-400 hover:bg-gray-100/60 dark:hover:bg-white/5"
        >
          <ArrowUpDown size={14} />
          <span>{sortOptions.find((s) => s.key === sortField)?.label}</span>
          {sortDirection === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
        </button>
        {sortOpen && (
          <>
            <div className="fixed inset-0 z-[999]" onClick={() => setSortOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-[1000] w-36 py-1.5 rounded-xl bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black/5">
              {sortOptions.map((s) => (
                <button
                  key={s.key}
                  onClick={() => {
                    const newDir = sortField === s.key ? (sortDirection === "asc" ? "desc" : "asc") : "desc";
                    onSortChange(s.key, newDir);
                    setSortOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3.5 py-2 text-[12px]",
                    sortField === s.key
                      ? "text-blue-600 dark:text-blue-400 font-medium"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1">
        {/* View toggle */}
        <div className="flex items-center gap-0.5 bg-gray-100/60 dark:bg-white/5 rounded-lg p-0.5">
          <button
            onClick={() => onViewModeChange("grid")}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              viewMode === "grid"
                ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-400 dark:text-gray-500"
            )}
          >
            <LayoutGrid size={14} />
          </button>
          <button
            onClick={() => onViewModeChange("list")}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              viewMode === "list"
                ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-400 dark:text-gray-500"
            )}
          >
            <List size={14} />
          </button>
        </div>

        {/* Info panel toggle */}
        <button
          onClick={onInfoPanelToggle}
          className={cn(
            "p-1.5 rounded-lg transition-colors",
            infoPanelOpen
              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
              : "text-gray-400 hover:bg-gray-100/60 dark:hover:bg-white/5"
          )}
        >
          <PanelRight size={16} />
        </button>

        {/* Upload button */}
        {showUpload && (
          <button
            onClick={onUploadClick}
            className="h-8 flex items-center gap-1.5 px-3 rounded-lg bg-blue-600 text-white text-[13px] font-medium hover:bg-blue-700 transition-colors"
          >
            <Upload size={14} />
            上传
          </button>
        )}
      </div>
    </div>
  );
}
