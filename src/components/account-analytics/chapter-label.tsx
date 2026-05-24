import { cn } from "@/lib/utils";

interface ChapterLabelProps {
  index: number;
  title: string;
  className?: string;
}

/**
 * 章节标签 —— "Chapter 01 · 昨日数据总览" 风格的小号蓝色全大写标签。
 * 对齐 BRTV HTML 样张的 .chapter 样式。
 */
export function ChapterLabel({ index, title, className }: ChapterLabelProps) {
  const paddedIndex = String(index).padStart(2, "0");
  return (
    <div
      className={cn(
        "text-[11px] font-bold uppercase tracking-[0.25em] text-[#2E75B6] dark:text-blue-400 mb-2 mt-8 first:mt-0",
        className,
      )}
    >
      Chapter {paddedIndex} · {title}
    </div>
  );
}
