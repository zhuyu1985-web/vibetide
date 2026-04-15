"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Settings } from "lucide-react";
import type { ResearchTaskSummary } from "@/lib/dal/research/research-tasks";

const STATUS_LABELS: Record<string, string> = {
  pending: "排队中",
  crawling: "采集中",
  analyzing: "分析中",
  done: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700 hover:bg-gray-100",
  crawling: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  analyzing: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  done: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  failed: "bg-red-100 text-red-700 hover:bg-red-100",
  cancelled: "bg-gray-100 text-gray-500 hover:bg-gray-100",
};

export function ResearchHomeClient({ tasks }: { tasks: ResearchTaskSummary[] }) {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">新闻研究</h1>
          <p className="text-sm text-muted-foreground mt-1">
            面向新闻传播学研究的检索、命中统计与报告生成工作台。
          </p>
        </div>
        <Button variant="ghost" asChild>
          <Link href="/research/new"><Plus className="mr-1 h-4 w-4" />新建研究任务</Link>
        </Button>
      </div>

      {/* Quick admin links */}
      <div className="flex gap-2 text-sm text-muted-foreground">
        <Link href="/research/admin/media-outlets" className="inline-flex items-center gap-1 hover:text-foreground transition">
          <Settings className="h-3.5 w-3.5" />媒体源管理
        </Link>
        <span>·</span>
        <Link href="/research/admin/topics" className="inline-flex items-center gap-1 hover:text-foreground transition">
          <FileText className="h-3.5 w-3.5" />主题词库管理
        </Link>
      </div>

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">我的研究任务</h2>
        {tasks.length === 0 ? (
          <div className="rounded-xl bg-card p-12 text-center space-y-4">
            <p className="text-muted-foreground">还没有研究任务</p>
            <Button variant="ghost" asChild>
              <Link href="/research/new"><Plus className="mr-1 h-4 w-4" />创建第一个任务</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((t) => (
              <Link
                key={t.id}
                href={`/research/tasks/${t.id}`}
                className="block rounded-xl bg-card p-5 hover:bg-accent transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium truncate">{t.name}</h3>
                      <Badge className={STATUS_CLASS[t.status] ?? "bg-gray-100 text-gray-700"}>
                        {STATUS_LABELS[t.status] ?? t.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t.timeRangeStart.toLocaleDateString("zh-CN")} ~{" "}
                      {t.timeRangeEnd.toLocaleDateString("zh-CN")} · {t.topicCount} 主题 · {t.districtCount} 区县 · {t.tierCount} 级媒体
                    </p>
                  </div>
                  <div className="text-right text-sm shrink-0">
                    <div className="font-medium text-lg">{t.crawledCount}</div>
                    <div className="text-xs text-muted-foreground">已采集</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
