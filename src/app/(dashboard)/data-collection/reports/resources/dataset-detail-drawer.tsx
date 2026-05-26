"use client";
//
// 活动数据集详情 Drawer - 39 区县 × 5 主题统计表
// Spec: docs/superpowers/specs/2026-05-26-ecological-index-report-design.md §7.2

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { getActivityDatasetDetail } from "@/app/actions/research/activity-datasets";
import type { ActivityDatasetDetail } from "@/lib/dal/research/activity-datasets";

interface Props {
  datasetId: string;
  onClose: () => void;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  // 既支持 YYYY-MM-DD 也兼容完整 ISO
  return iso.slice(0, 10);
}

export function DatasetDetailDrawer({ datasetId, onClose }: Props) {
  const [detail, setDetail] = useState<ActivityDatasetDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDetail(null);
    getActivityDatasetDetail(datasetId)
      .then((d) => {
        if (!cancelled) {
          setDetail(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [datasetId]);

  const themes = detail?.activityThemes ?? [];

  return (
    <Sheet
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent className="w-full sm:max-w-4xl">
        <SheetHeader>
          <SheetTitle>{detail?.name ?? (loading ? "加载中..." : "未找到")}</SheetTitle>
        </SheetHeader>
        {loading && (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin mr-2" />
            加载中...
          </div>
        )}
        {!loading && !detail && (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            数据集不存在或已删除
          </div>
        )}
        {detail && (
          <div className="mt-2 space-y-4 overflow-y-auto h-[calc(100vh-120px)]">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/30">
                  {detail.year} 年
                </Badge>
                <span className="text-muted-foreground">
                  共 <span className="font-medium text-foreground tabular-nums">
                    {detail.districtCount}
                  </span> 区县 ·{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {detail.totalActivities}
                  </span> 场
                </span>
              </div>
              {detail.sourceFileName && (
                <div className="text-xs text-muted-foreground">
                  源文件:{detail.sourceFileName}
                </div>
              )}
            </div>

            <div className="border border-gray-200/60 dark:border-gray-700/40 rounded-lg overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead className="bg-gray-50/60 dark:bg-gray-800/40 text-xs">
                  <tr>
                    <th className="text-left p-2 font-semibold text-gray-600 dark:text-gray-400 sticky left-0 bg-gray-50/60 dark:bg-gray-800/40 z-10 w-28">
                      区县
                    </th>
                    {themes.map((t) => (
                      <th
                        key={t}
                        className="text-right p-2 font-semibold text-gray-600 dark:text-gray-400 w-20"
                        title={t}
                      >
                        {t}
                      </th>
                    ))}
                    <th className="text-right p-2 font-semibold text-gray-700 dark:text-gray-300 w-16">
                      总数
                    </th>
                    <th className="text-left p-2 font-semibold text-gray-600 dark:text-gray-400 w-24">
                      首发
                    </th>
                    <th className="text-left p-2 font-semibold text-gray-600 dark:text-gray-400 w-24">
                      末发
                    </th>
                    <th className="text-right p-2 font-semibold text-gray-600 dark:text-gray-400 w-16">
                      跨度
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detail.data.map((row) => (
                    <tr
                      key={row.district}
                      className="border-t border-gray-100/60 dark:border-gray-800/40 hover:bg-gray-50/30 dark:hover:bg-gray-800/20"
                    >
                      <td className="p-2 sticky left-0 bg-white dark:bg-gray-950 z-10 text-gray-800 dark:text-gray-200 font-medium">
                        {row.district}
                      </td>
                      {themes.map((t) => (
                        <td
                          key={t}
                          className="p-2 text-right tabular-nums text-xs text-muted-foreground"
                        >
                          {row.themes[t] ?? 0}
                        </td>
                      ))}
                      <td className="p-2 text-right tabular-nums text-sm font-medium text-gray-800 dark:text-gray-200">
                        {row.total}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground tabular-nums">
                        {formatDate(row.firstDate)}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground tabular-nums">
                        {formatDate(row.lastDate)}
                      </td>
                      <td className="p-2 text-right text-xs text-muted-foreground tabular-nums">
                        {row.spanDays}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
