"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { RefreshCcw, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  runMissedTopicDetection,
  confirmMissedTopic,
  excludeMissedTopic,
  markMissedTopicPushed,
} from "@/app/actions/missing-topics";
import type { MissingTopicRow } from "@/lib/dal/missing-topics";

const LEVEL_LABEL: Record<string, string> = {
  central: "央级",
  provincial: "省级",
  city: "地市",
  industry: "行业",
  self_media: "自媒体",
};

const STATUS_CONFIG: Record<
  MissingTopicRow["uiStatus"],
  { label: string; color: string }
> = {
  covered: { label: "已覆盖", color: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300" },
  suspected: { label: "疑似漏题", color: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300" },
  confirmed: { label: "已确认", color: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
  excluded: { label: "已排除", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  pushed: { label: "已推送", color: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300" },
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

interface Props {
  items: MissingTopicRow[];
  kpis: {
    totalClues: number;
    suspectedMissed: number;
    confirmedMissed: number;
    covered: number;
    excluded: number;
    pushed: number;
    coverageRate: number;
  };
}

export function MissingTopicsClient({ items, kpis }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  function handleDetect() {
    startTransition(async () => {
      const res = await runMissedTopicDetection();
      if (res.success) {
        toast.success(
          `扫描 ${res.scanned} 条对标报道：新增 ${res.created}，已覆盖 ${res.covered}`
        );
        router.refresh();
      } else {
        toast.error(res.error || "识别失败");
      }
    });
  }

  function handleConfirm(id: string) {
    startTransition(async () => {
      const res = await confirmMissedTopic(id);
      if (res.success) {
        toast.success("已确认为漏题");
        router.refresh();
      } else toast.error(res.error || "失败");
    });
  }

  function handleExclude(id: string) {
    const reason = prompt("排除原因（选填）") ?? "";
    startTransition(async () => {
      const res = await excludeMissedTopic({
        topicId: id,
        reasonCode: "manual_excluded",
        reasonText: reason || undefined,
      });
      if (res.success) {
        toast.success("已排除");
        router.refresh();
      } else toast.error(res.error || "失败");
    });
  }

  function handlePush(id: string) {
    startTransition(async () => {
      const res = await markMissedTopicPushed(id);
      if (res.success) {
        toast.success("已推送");
        router.refresh();
      } else toast.error(res.error || "推送失败");
    });
  }

  const filtered = useMemo(() => {
    if (statusFilter === "all") return items;
    return items.filter((i) => i.uiStatus === statusFilter);
  }, [items, statusFilter]);

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        title="漏题筛查"
        description="对标账号发了、我方账号未覆盖的话题线索"
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDetect}
            disabled={pending}
          >
            <RefreshCcw className={`w-4 h-4 mr-1.5 ${pending ? "animate-spin" : ""}`} />
            {pending ? "扫描中..." : "从对标报道刷新"}
          </Button>
        }
      />

      {/* KPI */}
      <div className="grid grid-cols-6 gap-3 mb-4">
        <GlassCard padding="sm">
          <div className="text-xs text-gray-500">总线索</div>
          <div className="text-2xl font-bold mt-1">{kpis.totalClues}</div>
        </GlassCard>
        <div className="rounded-xl bg-orange-50 dark:bg-orange-950/30 p-4">
          <div className="text-xs text-orange-600">疑似漏题</div>
          <div className="text-2xl font-bold mt-1 text-orange-600">{kpis.suspectedMissed}</div>
        </div>
        <div className="rounded-xl bg-red-50 dark:bg-red-950/30 p-4">
          <div className="text-xs text-red-600">已确认</div>
          <div className="text-2xl font-bold mt-1 text-red-600">{kpis.confirmedMissed}</div>
        </div>
        <div className="rounded-xl bg-green-50 dark:bg-green-950/30 p-4">
          <div className="text-xs text-green-600">已覆盖</div>
          <div className="text-2xl font-bold mt-1 text-green-600">{kpis.covered}</div>
        </div>
        <div className="rounded-xl bg-sky-50 dark:bg-sky-950/30 p-4">
          <div className="text-xs text-sky-600">已推送</div>
          <div className="text-2xl font-bold mt-1 text-sky-600">{kpis.pushed}</div>
        </div>
        <GlassCard padding="sm">
          <div className="text-xs text-gray-500">覆盖率</div>
          <div className="text-2xl font-bold mt-1">{kpis.coverageRate}%</div>
        </GlassCard>
      </div>

      <div className="mb-3">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList variant="line">
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="suspected">疑似漏题</TabsTrigger>
            <TabsTrigger value="confirmed">已确认</TabsTrigger>
            <TabsTrigger value="covered">已覆盖</TabsTrigger>
            <TabsTrigger value="pushed">已推送</TabsTrigger>
            <TabsTrigger value="excluded">已排除</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {filtered.length === 0 ? (
        <GlassCard padding="lg">
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="text-sm">{items.length === 0 ? "暂无漏题线索" : "当前筛选无数据"}</p>
            <p className="text-xs mt-2">点击右上角「从对标报道刷新」生成线索</p>
          </div>
        </GlassCard>
      ) : (
        <DataTable
            rows={filtered}
            rowKey={(r) => r.id}
            columns={[
              {
                key: "title",
                header: "线索标题",
                render: (r) => (
                  <div className="min-w-0">
                    <Link
                      href={`/missing-topics/${r.id}`}
                      className="text-sm text-gray-900 dark:text-gray-100 hover:text-sky-600 dark:hover:text-sky-400 truncate block"
                    >
                      {r.title}
                    </Link>
                    {r.topic && (
                      <div className="text-xs text-gray-500 mt-0.5 truncate">
                        {r.topic}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: "source",
                header: "主要来源",
                width: "200px",
                render: (r) => (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-700">{r.primarySourceName}</span>
                    {r.primarySourceLevel && (
                      <span className="text-[10px] text-gray-500">
                        {LEVEL_LABEL[r.primarySourceLevel] ?? r.primarySourceLevel}
                      </span>
                    )}
                    {r.primarySourceUrl && (
                      <a
                        href={r.primarySourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-600 hover:text-sky-700"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ),
              },
              {
                key: "relatedCount",
                header: "多源",
                width: "60px",
                align: "center",
                render: (r) =>
                  r.relatedCount > 0 ? (
                    <span className="text-xs text-gray-600">+{r.relatedCount}</span>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  ),
              },
              {
                key: "discoveredAt",
                header: "发现时间",
                width: "110px",
                render: (r) => <span className="text-xs text-gray-500">{fmtDate(r.discoveredAt)}</span>,
              },
              {
                key: "heatScore",
                header: "热度",
                width: "60px",
                align: "right",
                render: (r) => <span className="text-xs">{r.heatScore}</span>,
              },
              {
                key: "status",
                header: "状态",
                width: "90px",
                render: (r) => {
                  const s = STATUS_CONFIG[r.uiStatus];
                  return (
                    <span className={`text-[11px] px-2 py-0.5 rounded ${s.color}`}>
                      {s.label}
                    </span>
                  );
                },
              },
              {
                key: "actions",
                header: "操作",
                width: "220px",
                render: (r) => {
                  if (r.uiStatus === "excluded" || r.uiStatus === "covered") {
                    return <span className="text-xs text-gray-400">-</span>;
                  }
                  return (
                    <div className="flex gap-1">
                      {r.uiStatus !== "confirmed" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() => handleConfirm(r.id)}
                        >
                          确认
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => handleExclude(r.id)}
                      >
                        排除
                      </Button>
                      {r.uiStatus !== "pushed" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() => handlePush(r.id)}
                        >
                          推送
                        </Button>
                      )}
                    </div>
                  );
                },
              },
          ]}
        />
      )}
    </div>
  );
}
