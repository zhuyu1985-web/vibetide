"use client";
//
// 媒体名单详情 Drawer
// 显示单位明细 (按 xlsx 行号排序),用于人工核对解析结果
// Spec: docs/superpowers/specs/2026-05-26-ecological-index-report-design.md §7.2

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { getMediaScopeDetail } from "@/app/actions/research/media-scopes";
import type { MediaScopeDetail } from "@/lib/dal/research/media-scopes";

const TIER_LABEL: Record<string, string> = {
  central: "中央",
  industry: "行业",
  municipal: "市级",
  district_rmt: "区县融媒",
  district_gov: "区县政务",
};

const TIER_BADGE_CLASS: Record<string, string> = {
  central:
    "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/30",
  industry:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30",
  municipal:
    "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/30",
  district_rmt:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30",
  district_gov:
    "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/30",
};

interface Props {
  scopeId: string;
  onClose: () => void;
}

export function ScopeDetailDrawer({ scopeId, onClose }: Props) {
  const [detail, setDetail] = useState<MediaScopeDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDetail(null);
    getMediaScopeDetail(scopeId)
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
  }, [scopeId]);

  return (
    <Sheet
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent className="w-full sm:max-w-3xl">
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
            名单不存在或已删除
          </div>
        )}
        {detail && (
          <div className="mt-2 space-y-4 overflow-y-auto h-[calc(100vh-120px)]">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">总数:</span>
                <span className="font-medium tabular-nums">{detail.totalUnits}</span>
                <span className="text-muted-foreground">单位</span>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                <Badge className={TIER_BADGE_CLASS.central}>
                  央 {detail.centralCount}
                </Badge>
                <Badge className={TIER_BADGE_CLASS.industry}>
                  业 {detail.industryCount}
                </Badge>
                <Badge className={TIER_BADGE_CLASS.municipal}>
                  市 {detail.municipalCount}
                </Badge>
                <Badge className={TIER_BADGE_CLASS.district_rmt}>
                  融 {detail.districtRmtCount}
                </Badge>
                <Badge className={TIER_BADGE_CLASS.district_gov}>
                  政 {detail.districtGovCount}
                </Badge>
              </div>
              {detail.description && (
                <div className="text-muted-foreground text-xs leading-relaxed">
                  {detail.description}
                </div>
              )}
              {detail.sourceFileName && (
                <div className="text-xs text-muted-foreground">
                  源文件:{detail.sourceFileName}
                </div>
              )}
            </div>

            <div className="border border-gray-200/60 dark:border-gray-700/40 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/60 dark:bg-gray-800/40 text-xs">
                  <tr>
                    <th className="text-left p-2 font-semibold text-gray-600 dark:text-gray-400 w-12">
                      行
                    </th>
                    <th className="text-left p-2 font-semibold text-gray-600 dark:text-gray-400">
                      媒体名
                    </th>
                    <th className="text-left p-2 font-semibold text-gray-600 dark:text-gray-400 w-20">
                      分级
                    </th>
                    <th className="text-left p-2 font-semibold text-gray-600 dark:text-gray-400 w-28">
                      区县
                    </th>
                    <th className="text-left p-2 font-semibold text-gray-600 dark:text-gray-400">
                      公众号
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detail.units.map((u) => (
                    <tr
                      key={u.id}
                      className="border-t border-gray-100/60 dark:border-gray-800/40 hover:bg-gray-50/30 dark:hover:bg-gray-800/20"
                    >
                      <td className="p-2 text-xs text-muted-foreground tabular-nums">
                        L{u.xlsxRow}
                      </td>
                      <td className="p-2 text-gray-800 dark:text-gray-200">{u.name}</td>
                      <td className="p-2">
                        <Badge
                          className={`${TIER_BADGE_CLASS[u.tier]} text-[10px] px-1.5 py-0`}
                        >
                          {TIER_LABEL[u.tier] ?? u.tier}
                        </Badge>
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {u.districtNormalized ?? u.districtOrig ?? "—"}
                      </td>
                      <td className="p-2 text-xs text-gray-700 dark:text-gray-300">
                        {u.wechatNames.length > 0
                          ? u.wechatNames.slice(0, 2).join("、") +
                            (u.wechatNames.length > 2 ? " ..." : "")
                          : "—"}
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
