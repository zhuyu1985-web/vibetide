"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Play, Pause, Trash2, RefreshCw } from "lucide-react";
import type { AdapterMeta } from "@/lib/collection/adapter-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  toggleCollectionSourceEnabled,
  deleteCollectionSource,
  triggerCollectionSource,
} from "@/app/actions/collection";

export interface SourceListItem {
  id: string;
  name: string;
  sourceType: string;
  enabled: boolean;
  scheduleCron: string | null;
  targetModules: string[];
  lastRunAt: string | null;
  lastRunStatus: string | null;
  totalItemsCollected: number;
}

interface SourcesClientProps {
  initialSources: SourceListItem[];
  adapterMetas: AdapterMeta[];
}

export function SourcesClient({ initialSources, adapterMetas }: SourcesClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("__all__");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = initialSources.filter((s) => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== "__all__" && s.sourceType !== typeFilter) return false;
    if (statusFilter === "enabled" && !s.enabled) return false;
    if (statusFilter === "disabled" && s.enabled) return false;
    return true;
  });

  const handleToggle = async (id: string, enabled: boolean) => {
    setBusyId(id);
    try {
      await toggleCollectionSourceEnabled(id, !enabled);
      toast.success(!enabled ? "已启用" : "已暂停");
      router.refresh();
    } catch (err) {
      toast.error(`操作失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleTrigger = async (id: string) => {
    setBusyId(id);
    try {
      await triggerCollectionSource(id);
      toast.success("已触发一次采集,请稍后刷新查看结果");
    } catch (err) {
      toast.error(`触发失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确认删除源「${name}」?此操作不可撤销(已采集的数据保留)。`)) return;
    setBusyId(id);
    try {
      await deleteCollectionSource(id);
      toast.success("已删除");
      router.refresh();
    } catch (err) {
      toast.error(`删除失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusyId(null);
    }
  };

  const typeLabel = (type: string) =>
    adapterMetas.find((m) => m.type === type)?.displayName ?? type;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Input
            className="w-64"
            placeholder="按名称搜索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="源类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部类型</SelectItem>
              {adapterMetas.map((m) => (
                <SelectItem key={m.type} value={m.type}>
                  {m.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部</SelectItem>
              <SelectItem value="enabled">启用</SelectItem>
              <SelectItem value="disabled">暂停</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button asChild>
          <Link href="/data-collection/sources/new">
            <Plus className="mr-2 h-4 w-4" />
            新建源
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>调度</TableHead>
              <TableHead>归属模块</TableHead>
              <TableHead>最近运行</TableHead>
              <TableHead className="text-right">已采集</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  {initialSources.length === 0
                    ? "还没有采集源。点击右上角「新建源」开始。"
                    : "没有匹配的记录"}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <Link
                    href={`/data-collection/sources/${s.id}`}
                    className="text-primary hover:underline"
                  >
                    {s.name}
                  </Link>
                </TableCell>
                <TableCell>{typeLabel(s.sourceType)}</TableCell>
                <TableCell className="font-mono text-xs">{s.scheduleCron ?? "手工"}</TableCell>
                <TableCell>{s.targetModules.join(", ") || "—"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {s.lastRunAt ? new Date(s.lastRunAt).toLocaleString("zh-CN") : "未运行"}
                </TableCell>
                <TableCell className="text-right">{s.totalItemsCollected}</TableCell>
                <TableCell>
                  {s.enabled ? (
                    s.lastRunStatus === "failed" ? (
                      <Badge variant="destructive">失败</Badge>
                    ) : s.lastRunStatus === "partial" ? (
                      <Badge variant="secondary">部分失败</Badge>
                    ) : (
                      <Badge variant="default">启用</Badge>
                    )
                  ) : (
                    <Badge variant="outline">暂停</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={busyId === s.id || !s.enabled}
                      onClick={() => handleTrigger(s.id)}
                      title="立即触发"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={busyId === s.id}
                      onClick={() => handleToggle(s.id, s.enabled)}
                      title={s.enabled ? "暂停" : "启用"}
                    >
                      {s.enabled ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={busyId === s.id}
                      onClick={() => handleDelete(s.id, s.name)}
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
