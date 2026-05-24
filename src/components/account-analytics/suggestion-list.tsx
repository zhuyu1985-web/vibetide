import { cn } from "@/lib/utils";

export interface SuggestionItem {
  title: string;
  body: string;
}

interface SuggestionListProps {
  items: SuggestionItem[];
  className?: string;
}

/**
 * 运营建议列表 —— 编号圆圈 + 标题 + 正文，每条独立卡片化。
 * 视觉对齐 BRTV HTML 样张的 .tips ol 区块。
 */
export function SuggestionList({ items, className }: SuggestionListProps) {
  return (
    <ol className={cn("space-y-4", className)}>
      {items.map((item, idx) => (
        <li
          key={idx}
          className="flex items-start gap-4 rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-white dark:bg-gray-900 p-4 sm:p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
        >
          <span className="shrink-0 inline-flex items-center justify-center w-8 h-8 mt-0.5 rounded-full bg-[#2E75B6] text-white text-[15px] font-bold">
            {idx + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-bold text-[#1F3864] dark:text-blue-200 mb-1.5">
              {item.title}
            </div>
            <div className="text-[13px] text-gray-600 dark:text-gray-400 leading-[1.75]">
              {item.body}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
