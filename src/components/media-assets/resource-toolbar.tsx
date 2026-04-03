"use client";

import { useState } from "react";
import {
  Search, Filter, LayoutGrid, List, Upload, PanelRight,
  ChevronDown, ArrowUp, ArrowDown, Camera,
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
  const [typeOpen, setTypeOpen] = useState(false);
  const showUpload = library === "personal" || library === "product";

  const currentTypeLabel = typeFilters.find((t) => t.key === typeFilter)?.label || "全部";
  const currentSortLabel = sortOptions.find((s) => s.key === sortField)?.label || "创建时间";

  return (
    <div className="space-y-3 pb-3">
      {/* Row 1: Search bar */}
      <div className="flex items-center gap-2">
        {/* Type dropdown */}
        <div className="relative">
          <button
            onClick={() => setTypeOpen(!typeOpen)}
            className="h-9 flex items-center gap-1 px-3 rounded-lg bg-gray-100/60 dark:bg-white/5 text-[13px] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors"
          >
            {currentTypeLabel}
            <ChevronDown size={14} />
          </button>
          {typeOpen && (
            <>
              <div className="fixed inset-0 z-[999]" onClick={() => setTypeOpen(false)} />
              <div className="absolute left-0 top-full mt-1 z-[1000] w-28 py-1.5 rounded-xl bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black/5">
                {typeFilters.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => { onTypeFilterChange(t.key); setTypeOpen(false); }}
                    className={cn(
                      "w-full text-left px-3.5 py-2 text-[12px]",
                      typeFilter === t.key
                        ? "text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-950/30"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Search input */}
        <div className="flex-1 flex items-center gap-0 min-w-[200px]">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="请输入关键词"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full h-9 pl-3 pr-10 rounded-l-lg bg-gray-100/60 dark:bg-white/5 text-[13px] outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-gray-400"
            />
            <Camera size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer hover:text-blue-500 transition-colors" />
          </div>
          <button className="h-9 px-4 rounded-r-lg bg-blue-600 text-white text-[13px] font-medium hover:bg-blue-700 transition-colors shrink-0">
            检索
          </button>
        </div>

        {/* Advanced search icon */}
        <button
          className="h-9 w-9 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100/60 dark:hover:bg-white/5 transition-colors"
          title="高级检索"
        >
          <Filter size={16} />
        </button>
      </div>

      {/* Row 2: Sort + View controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Upload button */}
          {showUpload && (
            <button
              onClick={onUploadClick}
              className="h-8 flex items-center gap-1.5 px-3.5 rounded-lg bg-blue-600 text-white text-[13px] font-medium hover:bg-blue-700 transition-colors"
            >
              <Upload size={14} />
              上传
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Sort */}
          <div className="relative">
            <button
              onClick={() => setSortOpen(!sortOpen)}
              className="h-8 flex items-center gap-1.5 px-3 rounded-lg bg-gray-100/60 dark:bg-white/5 text-[12px] text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors"
            >
              {currentSortLabel}
              {sortDirection === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
              <ChevronDown size={12} />
            </button>
            {sortOpen && (
              <>
                <div className="fixed inset-0 z-[999]" onClick={() => setSortOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-[1000] w-32 py-1.5 rounded-xl bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black/5">
                  {sortOptions.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => {
                        const newDir = sortField === s.key ? (sortDirection === "asc" ? "desc" : "asc") : "desc";
                        onSortChange(s.key, newDir);
                        setSortOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-3.5 py-2 text-[12px]",
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

          {/* Filter icon */}
          <button
            onClick={onInfoPanelToggle}
            className={cn(
              "h-8 w-8 flex items-center justify-center rounded-lg transition-colors",
              infoPanelOpen
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                : "text-gray-400 hover:bg-gray-100/60 dark:hover:bg-white/5"
            )}
          >
            <PanelRight size={15} />
          </button>

          {/* View toggle */}
          <div className="flex items-center gap-0.5 bg-gray-100/60 dark:bg-white/5 rounded-lg p-0.5">
            <button
              onClick={() => onViewModeChange("grid")}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                viewMode === "grid"
                  ? "bg-white dark:bg-gray-700 text-blue-600 shadow-sm"
                  : "text-gray-400"
              )}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => onViewModeChange("list")}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                viewMode === "list"
                  ? "bg-white dark:bg-gray-700 text-blue-600 shadow-sm"
                  : "text-gray-400"
              )}
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
