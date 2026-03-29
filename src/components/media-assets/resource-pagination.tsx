"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const PAGE_SIZES = [10, 20, 50, 100];

export function ResourcePagination({ total, page, pageSize, totalPages, onPageChange, onPageSizeChange }: Props) {
  if (total === 0) return null;

  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between py-3 px-1 text-[13px] text-gray-500 dark:text-gray-400">
      <span>共 {total} 项</span>

      <div className="flex items-center gap-2">
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="h-7 px-2 rounded-md bg-gray-100/60 dark:bg-white/5 text-[12px] outline-none"
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>{s} 条/页</option>
          ))}
        </select>

        <div className="flex items-center gap-0.5">
          <button
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-30"
          >
            <ChevronLeft size={14} />
          </button>

          {pages.map((p, i) =>
            p === "..." ? (
              <span key={`dot-${i}`} className="w-7 h-7 flex items-center justify-center">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p as number)}
                className={cn(
                  "w-7 h-7 flex items-center justify-center rounded-md text-[12px]",
                  p === page
                    ? "bg-blue-600 text-white"
                    : "hover:bg-gray-100 dark:hover:bg-white/5"
                )}
              >
                {p}
              </button>
            )
          )}

          <button
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-30"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
