"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Play, Pause, RefreshCw, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  triggerCollectionSource,
  toggleCollectionSourceEnabled,
  deleteCollectionSource,
  getLatestRunForSource,
  type LatestRunStatus,
} from "@/app/actions/collection";

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 45;

export interface SourceDetail {
  id: string;
  name: string;
  sourceType: string;
  sourceTypeLabel: string;
  config: unknown;
  scheduleCron: string | null;
  targetModules: string[];
  defaultCategory: string | null;
  defaultTags: string[] | null;
  enabled: boolean;
  createdAt: string;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  totalItemsCollected: number;
  totalRuns: number;
}

export interface RunSummary {
  id: string;
  trigger: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  itemsAttempted: number;
  itemsInserted: number;
  itemsMerged: number;
  itemsFailed: number;
  errorSummary: string | null;
}

export interface ItemSummary {
  id: string;
  title: string;
  canonicalUrl: string | null;
  firstSeenChannel: string;
  firstSeenAt: string;
  category: string | null;
  tags: string[] | null;
}

interface SourceDetailClientProps {
  source: SourceDetail;
  runs: RunSummary[];
  items: ItemSummary[];
}

export function SourceDetailClient({ source, runs, items }: SourceDetailClientProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const baselineRunId = useRef<string | null>(null);

  const pollUntilDone = async () => {
    let attempts = 0;
    const tick = async () => {
      attempts++;
      let latest: LatestRunStatus;
      try {
        latest = await getLatestRunForSource(source.id);
      } catch {
        if (attempts < POLL_MAX_ATTEMPTS) setTimeout(tick, POLL_INTERVAL_MS);
        else finalize(null);
        return;
      }
      if (
        latest.runId &&
        latest.runId !== baselineRunId.current &&
        (latest.status === "success" ||
          latest.status === "partial" ||
          latest.status === "failed")
      ) {
        finalize(latest);
        return;
      }
      if (attempts >= POLL_MAX_ATTEMPTS) {
        finalize(null);
        return;
      }
      setTimeout(tick, POLL_INTERVAL_MS);
    };
    tick();
  };

  const finalize = (finalRun: LatestRunStatus | null) => {
    setRunning(false);
    baselineRunId.current = null;
    if (!finalRun) {
      toast.warning("采集超时,请稍后手动刷新查看结果");
      router.refresh();
      return;
    }
    if (finalRun.status === "success") {
      toast.success(
        `采集完成:新增 ${finalRun.itemsInserted} · 合并 ${finalRun.itemsMerged}`,
      );
    } else if (finalRun.status === "partial") {
      toast.warning(
        `部分失败:新增 ${finalRun.itemsInserted} · 合并 ${finalRun.itemsMerged} · 失败 ${finalRun.itemsFailed}`,
      );
    } else if (finalRun.status === "failed") {
      toast.error(`采集失败: ${finalRun.errorSummary ?? "未知错误"}`);
    }
    router.refresh();
  };

  const handleTrigger = async () => {
    if (running) return;
    setBusy(true);
    try {
      const before = await getLatestRunForSource(source.id);
      baselineRunId.current = before.runId;
      await triggerCollectionSource(source.id);
      setRunning(true);
      pollUntilDone();
      toast("已触发采集,等待完成...", { duration: 3000 });
    } catch (err) {
      toast.error(`触发失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async () => {
    setBusy(true);
    try {
      await toggleCollectionSourceEnabled(source.id, !source.enabled);
      toast.success(!source.enabled ? "已启用" : "已暂停");
      router.refresh();
    } catch (err) {
      toast.error(`操作失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`确认删除源「${source.name}」?`)) return;
    setBusy(true);
    try {
      await deleteCollectionSource(source.id);
      toast.success("已删除");
      router.push("/data-collection/sources");
    } catch (err) {
      toast.error(`删除失败: ${err instanceof Error ? err.message : String(err)}`);
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/data-collection/sources"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="inline h-4 w-4" />返回列表
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <h2 className="text-2xl font-semibold">{source.name}</h2>
            <Badge variant={source.enabled ? "default" : "outline"}>
              {source.enabled ? "启用" : "暂停"}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleTrigger} disabled={busy || running || !source.enabled}>
            {running ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />采集中...</>
            ) : (
              <><RefreshCw className="mr-2 h-4 w-4" />立即触发</>
            )}
          </Button>
          <Button variant="outline" onClick={handleToggle} disabled={busy}>
            {source.enabled ? (
              <Pause className="mr-2 h-4 w-4" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            {source.enabled ? "暂停" : "启用"}
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={busy}>
            <Trash2 className="mr-2 h-4 w-4" />删除
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="runs">最近运行 ({runs.length})</TabsTrigger>
          <TabsTrigger value="items">最近内容 ({items.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3 rounded-lg border bg-card p-5">
              <h3 className="text-sm font-medium text-muted-foreground">基础信息</h3>
              <KV label="类型" value={source.sourceTypeLabel} />
              <KV label="调度" value={source.scheduleCron ?? "手工触发"} />
              <KV label="归属模块" value={source.targetModules.join(", ") || "—"} />
              <KV label="默认分类" value={source.defaultCategory ?? "—"} />
              <KV label="默认标签" value={source.defaultTags?.join(", ") ?? "—"} />
              <KV label="创建于" value={new Date(source.createdAt).toLocaleString("zh-CN")} />
            </div>
            <div className="space-y-3 rounded-lg border bg-card p-5">
              <h3 className="text-sm font-medium text-muted-foreground">统计</h3>
              <KV label="累计采集" value={String(source.totalItemsCollected)} />
              <KV label="累计运行" value={String(source.totalRuns)} />
              <KV
                label="最近运行"
                value={
                  source.lastRunAt
                    ? new Date(source.lastRunAt).toLocaleString("zh-CN")
                    : "未运行"
                }
              />
              <KV label="最近状态" value={source.lastRunStatus ?? "—"} />
            </div>
            <div className="md:col-span-2 rounded-lg border bg-muted/20 p-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">配置</h3>
              <pre className="text-xs overflow-x-auto">
                {JSON.stringify(source.config, null, 2)}
              </pre>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="runs" className="mt-4">
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>开始</TableHead>
                  <TableHead>触发</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">新增</TableHead>
                  <TableHead className="text-right">合并</TableHead>
                  <TableHead className="text-right">失败</TableHead>
                  <TableHead>错误</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      暂无运行记录
                    </TableCell>
                  </TableRow>
                )}
                {runs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">
                      {new Date(r.startedAt).toLocaleString("zh-CN")}
                    </TableCell>
                    <TableCell>{r.trigger}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.status === "success"
                            ? "default"
                            : r.status === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{r.itemsInserted}</TableCell>
                    <TableCell className="text-right">{r.itemsMerged}</TableCell>
                    <TableCell className="text-right">{r.itemsFailed}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {r.errorSummary ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="items" className="mt-4">
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>标题</TableHead>
                  <TableHead>渠道</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>采集时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center py-8 text-muted-foreground"
                    >
                      暂无内容
                    </TableCell>
                  </TableRow>
                )}
                {items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>
                      {i.canonicalUrl ? (
                        <a
                          href={i.canonicalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          {i.title}
                        </a>
                      ) : (
                        i.title
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{i.firstSeenChannel}</TableCell>
                    <TableCell>{i.category ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {new Date(i.firstSeenAt).toLocaleString("zh-CN")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-xs text-muted-foreground min-w-[80px]">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}
