import { cn } from "@/lib/utils";

export interface PatternItem {
  dimension: string;
  rule: string;
}

interface PatternTableProps {
  patterns: PatternItem[];
  className?: string;
}

/**
 * 共性规律表格 —— 蓝色表头 + 编号圆圈 + 维度名加粗 + 规律描述。
 * 视觉对齐 BRTV HTML 样张的 .rule-table 区块。
 */
export function PatternTable({ patterns, className }: PatternTableProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.07)] border border-gray-200/60 dark:border-gray-700/40",
        className,
      )}
    >
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="bg-[#1F3864] text-white text-[13px] font-semibold px-4 py-3 text-left w-14">
              #
            </th>
            <th className="bg-[#1F3864] text-white text-[13px] font-semibold px-4 py-3 text-left w-32">
              维度
            </th>
            <th className="bg-[#1F3864] text-white text-[13px] font-semibold px-4 py-3 text-left">
              规律
            </th>
          </tr>
        </thead>
        <tbody>
          {patterns.map((pattern, idx) => (
            <tr
              key={pattern.dimension}
              className={cn(
                idx % 2 === 0
                  ? "bg-white dark:bg-gray-900"
                  : "bg-[#F5F9FF] dark:bg-gray-800/40",
              )}
            >
              <td className="px-4 py-3 align-top border-b border-gray-100 dark:border-gray-800 last:border-b-0">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#2E75B6] text-white text-[12px] font-bold">
                  {idx + 1}
                </span>
              </td>
              <td className="px-4 py-3 align-top text-[13px] font-semibold text-[#1F3864] dark:text-blue-200 border-b border-gray-100 dark:border-gray-800 last:border-b-0">
                {pattern.dimension}
              </td>
              <td className="px-4 py-3 align-top text-[13px] text-gray-700 dark:text-gray-300 leading-[1.7] border-b border-gray-100 dark:border-gray-800 last:border-b-0">
                {pattern.rule}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
