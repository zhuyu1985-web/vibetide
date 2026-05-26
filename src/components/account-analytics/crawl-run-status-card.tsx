"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock4,
  Loader2,
  XCircle,
} from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { getAccountCrawlStatus } from "@/app/actions/account-analytics";
import { cn } from "@/lib/utils";

type RunStatus = "running" | "success" | "partial" | "failed";

interface LatestRun {
  runId: string;
  status: RunStatus;
  startedAt: string;
  finishedAt: string | null;
  itemsInserted: number;
  itemsMerged: number;
  itemsFailed: number;
  errorSummary: string | null;
  trigger: string;
}

interface Props {
  accountId: string;
  accountSource: "my" | "benchmark";
  /** 父组件可触发立即刷新（如刚点了"立即抓取"按钮）*/
  refreshToken?: number;
}

const STATUS_META: Record<
  RunStatus,
  { label: string; icon: typeof CheckCircle2; tone: string; bg: string }
> = {
  running: {
    label: "抓取中",
    icon: Loader2,
    tone: "text-[#2E75B6]",
    bg: "bg-[#EEF4FB] dark:bg-blue-950/30",
  },
  success: {
    label: "已完成",
    icon: CheckCircle2,
    tone: "text-[#2A9D8F]",
    bg: "bg-[#E8F5F3] dark:bg-teal-950/30",
  },
  partial: {
    label: "部分成功",
    icon: AlertCircle,
    tone: "text-[#2E75B6]",
    bg: "bg-[#EEF4FB] dark:bg-blue-950/30",
  },
  failed: {
    label: "失败",
    icon: XCircle,
    tone: "text-[#E84057]",
    bg: "bg-[#FCE9EC] dark:bg-red-950/30",
  },
};

const POLL_INTERVAL_MS = 5000;

export function CrawlRunStatusCard({
  accountId,
  accountSource,
  refreshToken,
}: Props) {
  const [latestRun, setLatestRun] = useState<LatestRun | null>(null);
  const [hasSource, setHasSource] = useState(true);
  const [loading, setLoading] = useState(true);
  const reqIdRef = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqIdRef.current;
    const res = await getAccountCrawlStatus({ accountId, accountSource });
    if (id !== reqIdRef.current) return;
    if (!res.success) {
      setLoading(false);
      return;
    }
    setLatestRun(res.latestRun);
    setHasSource(res.hasSource);
    setLoading(false);
  }, [accountId, accountSource]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  // running 时高频轮询，其他状态低频确认是否有新 run
  useEffect(() => {
    const status = latestRun?.status;
    const isRunning = status === "running";
    const interval = isRunning ? POLL_INTERVAL_MS : POLL_INTERVAL_MS * 4;
    const timer = setInterval(() => {
      void load();
    }, interval);
    return () => clearInterval(timer);
  }, [latestRun?.status, load]);

  if (loading) {
    return null;
  }

  if (!hasSource && !latestRun) {
    return (
      <GlassCard padding="md">
        <div className="flex items-center gap-2 text-[13px] text-gray-500">
          <Clock4 size={14} className="shrink-0" />
          <span>
            尚未派发过抓取任务 —— 点击右上角「立即抓取」开始首次抓取
          </span>
        </div>
      </GlassCard>
    );
  }

  if (!latestRun) {
    return (
      <GlassCard padding="md">
        <div className="flex items-center gap-2 text-[13px] text-gray-500">
          <Loader2 size={14} className="shrink-0 animate-spin" />
          <span>采集任务已就绪，等待首次执行...</span>
        </div>
      </GlassCard>
    );
  }

  const meta = STATUS_META[latestRun.status];
  const Icon = meta.icon;
  const durationSec = latestRun.finishedAt
    ? Math.max(
        0,
        Math.round(
          (new Date(latestRun.finishedAt).getTime() -
            new Date(latestRun.startedAt).getTime()) /
            1000,
        ),
      )
    : Math.max(
        0,
        Math.round(
          (Date.now() - new Date(latestRun.startedAt).getTime()) / 1000,
        ),
      );

  const startedLabel = latestRun.startedAt
    .slice(5, 16)
    .replace("T", " ");

  return (
    <GlassCard padding="md">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium",
            meta.bg,
            meta.tone,
          )}
        >
          <Icon
            size={13}
            className={cn(
              "shrink-0",
              latestRun.status === "running" && "animate-spin",
            )}
          />
          {meta.label}
        </span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-gray-600 dark:text-gray-300">
          <span>
            <span className="text-gray-400">开始 · </span>
            {startedLabel}
          </span>
          <span>
            <span className="text-gray-400">耗时 · </span>
            {durationSec < 60
              ? `${durationSec}s`
              : `${Math.floor(durationSec / 60)}m${durationSec % 60}s`}
          </span>
          <span>
            <span className="text-gray-400">新入库 · </span>
            <span className="font-semibold text-[#1F3864] dark:text-blue-200">
              {latestRun.itemsInserted}
            </span>
          </span>
          {latestRun.itemsMerged > 0 && (
            <span>
              <span className="text-gray-400">合并 · </span>
              {latestRun.itemsMerged}
            </span>
          )}
          {latestRun.itemsFailed > 0 && (
            <span className="text-[#E84057]">
              <span className="text-gray-400">失败 · </span>
              {latestRun.itemsFailed}
            </span>
          )}
        </div>
      </div>
      {latestRun.errorSummary && (
        <p className="mt-2 rounded-md bg-[#FCE9EC] dark:bg-red-950/30 px-3 py-2 text-[12px] leading-relaxed text-[#E84057]">
          {latestRun.errorSummary}
        </p>
      )}
      {latestRun.status === "success" && latestRun.itemsInserted === 0 && (
        <p className="mt-2 text-[12px] text-gray-500">
          抓取成功但 0 条入库 —— 可能账号近期没发新内容，或识别符配置不匹配该账号
        </p>
      )}
    </GlassCard>
  );
}
