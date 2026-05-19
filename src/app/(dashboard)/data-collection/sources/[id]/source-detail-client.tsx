"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Play, Pause, RefreshCw, Trash2, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  triggerCollectionSource,
  toggleCollectionSourceEnabled,
  deleteCollectionSource,
  getLatestRunForSource,
  updateCollectionSource,
  type LatestRunStatus,
} from "@/app/actions/collection";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OUTLET_TIER_VALUES, OUTLET_TIER_LABELS, type OutletTier } from "@/lib/collection/constants";
import type { ConfigField } from "@/lib/collection/types";

const CRON_PRESETS = [
  { value: "__manual__", label: "手工触发" },
  { value: "*/15 * * * *", label: "每 15 分钟" },
  { value: "0 * * * *", label: "每小时" },
  { value: "0 */6 * * *", label: "每 6 小时" },
  { value: "0 8 * * *", label: "每日 8:00" },
  { value: "0 0 * * 0", label: "每周日 0:00" },
];

const TARGET_MODULES = [
  { value: "hot_topics", label: "热点 (hot_topics)" },
  { value: "news", label: "研究 (news)" },
  { value: "benchmarking", label: "对标 (benchmarking)" },
  { value: "knowledge", label: "知识库 (knowledge)" },
];

// Polling 2s × 150 = 5 分钟。整站采集等长任务实测 3-6 分钟,90s 太短会误报"超时"。
const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 150;

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
  // Outlet fields (Task 5.3)
  outletId: string | null;
  defaultOutletTier: string | null;
  defaultOutletRegion: string | null;
}

export interface OutletOption {
  id: string;
  outletName: string;
  outletTier: string;
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
  category: string[];
  tags: string[] | null;
}

interface SourceDetailClientProps {
  source: SourceDetail;
  runs: RunSummary[];
  items: ItemSummary[];
  outlets: OutletOption[];
  configFields: ConfigField[];
}

export function SourceDetailClient({ source, runs, items, outlets, configFields }: SourceDetailClientProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const baselineRunId = useRef<string | null>(null);

  // 编辑配置 dialog state
  const [editOpen, setEditOpen] = useState(false);

  // Outlet edit state
  const [outletId, setOutletId] = useState<string>(source.outletId ?? "__none__");
  const [defaultOutletTier, setDefaultOutletTier] = useState<string>(source.defaultOutletTier ?? "__none__");
  const [defaultOutletRegion, setDefaultOutletRegion] = useState<string>(source.defaultOutletRegion ?? "");

  const handleSaveOutlet = async () => {
    setBusy(true);
    try {
      await updateCollectionSource({
        sourceId: source.id,
        outletId: outletId === "__none__" ? null : outletId,
        defaultOutletTier: defaultOutletTier === "__none__" ? null : defaultOutletTier,
        defaultOutletRegion: defaultOutletRegion.trim() || null,
      });
      toast.success("媒体信息已保存");
      router.refresh();
    } catch (err) {
      toast.error(`保存失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

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
      // 不是失败 — 仅仅是前端 polling 90s 等不到完成(整站采集等长任务会跑几分钟)。
      // run 在后台继续,稍后刷新「最近运行」tab 即可看结果。
      toast.info("任务仍在后台运行,几分钟后刷新「最近运行」可查看结果");
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

  const handleDelete = () => {
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    setDeleteOpen(false);
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
          <Button variant="outline" onClick={() => setEditOpen(true)} disabled={busy}>
            <Pencil className="mr-2 h-4 w-4" />编辑配置
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
            <div className="md:col-span-2 rounded-lg border bg-card p-5 space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">媒体归属</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">绑定媒体（可选）</span>
                  <Select value={outletId} onValueChange={setOutletId}>
                    <SelectTrigger>
                      <SelectValue placeholder="未绑定" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">未绑定</SelectItem>
                      {outlets.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.outletName}（{OUTLET_TIER_LABELS[o.outletTier as OutletTier] ?? o.outletTier}）
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">默认分级（兜底）</span>
                  <Select value={defaultOutletTier} onValueChange={setDefaultOutletTier}>
                    <SelectTrigger>
                      <SelectValue placeholder="无" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">无</SelectItem>
                      {OUTLET_TIER_VALUES.map((t) => (
                        <SelectItem key={t} value={t}>{OUTLET_TIER_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">默认区域</span>
                  <Input
                    value={defaultOutletRegion}
                    onChange={(e) => setDefaultOutletRegion(e.target.value)}
                    placeholder="如: 重庆 / 全国"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveOutlet} disabled={busy}>
                  保存媒体信息
                </Button>
              </div>
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
          <DataTable
            rows={runs}
            rowKey={(r) => String(r.id)}
            emptyMessage="暂无运行记录"
            columns={[
              {
                key: "startedAt",
                header: "开始",
                width: "w-40",
                render: (r) => new Date(r.startedAt).toLocaleString("zh-CN"),
              },
              {
                key: "trigger",
                header: "触发",
                width: "w-20",
                render: (r) => <span className="text-gray-600 dark:text-gray-300">{r.trigger}</span>,
              },
              {
                key: "status",
                header: "状态",
                width: "w-20",
                render: (r) => (
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
                ),
              },
              {
                key: "inserted",
                header: "新增",
                width: "w-16",
                align: "right",
                render: (r) => r.itemsInserted,
              },
              {
                key: "merged",
                header: "合并",
                width: "w-16",
                align: "right",
                render: (r) => r.itemsMerged,
              },
              {
                key: "failed",
                header: "失败",
                width: "w-16",
                align: "right",
                render: (r) => r.itemsFailed,
              },
              {
                key: "error",
                header: "错误",
                render: (r) => (
                  <span className="text-xs text-muted-foreground truncate block">
                    {r.errorSummary ?? "—"}
                  </span>
                ),
              },
            ] satisfies DataTableColumn<RunSummary>[]}
          />
        </TabsContent>

        <TabsContent value="items" className="mt-4 flex flex-col gap-3">
          {/* A1 (2026-05-14): 提示 detail tab 只显示前 50 条,完整列表在内容池 */}
          {items.length >= 50 && (
            <p className="text-xs text-muted-foreground">
              本 tab 仅显示最近 50 条(累计已采集 {source.totalItemsCollected} 条)。
              <Link
                href={`/data-collection/content?sourceType=${source.sourceType}`}
                className="text-sky-600 hover:underline ml-1"
              >
                到内容池查看完整列表 →
              </Link>
            </p>
          )}
          <DataTable
            rows={items}
            rowKey={(i) => i.id}
            emptyMessage="暂无内容"
            columns={[
              {
                key: "title",
                header: "标题",
                render: (i) => (
                  <span className="truncate block">
                    {i.canonicalUrl ? (
                      <a
                        href={i.canonicalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-600 hover:underline"
                      >
                        {i.title}
                      </a>
                    ) : (
                      i.title
                    )}
                  </span>
                ),
              },
              {
                key: "channel",
                header: "渠道",
                width: "w-32",
                render: (i) => <span className="text-gray-600 dark:text-gray-300 truncate block">{i.firstSeenChannel}</span>,
              },
              {
                key: "category",
                header: "分类",
                width: "w-32",
                render: (i) => (
                  <span
                    className="text-gray-600 dark:text-gray-300 truncate block"
                    title={i.category.join("、")}
                  >
                    {i.category.length === 0 ? "—" : i.category.join("、")}
                  </span>
                ),
              },
              {
                key: "firstSeenAt",
                header: "采集时间",
                width: "w-44",
                render: (i) => (
                  <span className="text-gray-600 dark:text-gray-300">
                    {new Date(i.firstSeenAt).toLocaleString("zh-CN")}
                  </span>
                ),
              },
            ] satisfies DataTableColumn<ItemSummary>[]}
          />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="删除采集源"
        description={`确认删除源「${source.name}」？`}
        confirmText="删除"
        variant="danger"
        loading={busy}
        onConfirm={confirmDelete}
      />

      <EditSourceDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        source={source}
        configFields={configFields}
        onSaved={() => router.refresh()}
      />
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

// ───────────────────────────────────────────────────────────────────────────
// 编辑配置 Dialog
//
// 后端 updateCollectionSource action 支持改 name / scheduleCron / targetModules /
// defaultCategory / defaultTags / config / outlet 字段。本 dialog 暴露:
//   - 基本:名称 / 调度频率 / 归属模块 / 默认分类 / 默认标签
//   - 参数:渲染当前 sourceType 的 configFields (跟 wizard 第 2 步一致)
// sourceType 只读显示(技术上不能跨 adapter 切 config schema)。
// ───────────────────────────────────────────────────────────────────────────

interface EditSourceDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  source: SourceDetail;
  configFields: ConfigField[];
  onSaved: () => void;
}

function EditSourceDialog({ open, onOpenChange, source, configFields, onSaved }: EditSourceDialogProps) {
  const [name, setName] = useState(source.name);
  const [scheduleCron, setScheduleCron] = useState<string>(source.scheduleCron ?? "__manual__");
  const [targetModules, setTargetModules] = useState<string[]>(source.targetModules);
  const [defaultCategory, setDefaultCategory] = useState<string>(source.defaultCategory ?? "");
  const [defaultTagsRaw, setDefaultTagsRaw] = useState<string>(
    (source.defaultTags ?? []).join(", "),
  );
  const [config, setConfig] = useState<Record<string, unknown>>(
    (source.config as Record<string, unknown> | null) ?? {},
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const tags = defaultTagsRaw.split(",").map((t) => t.trim()).filter(Boolean);
      await updateCollectionSource({
        sourceId: source.id,
        name: name.trim(),
        scheduleCron: scheduleCron === "__manual__" ? null : scheduleCron,
        targetModules,
        defaultCategory: defaultCategory.trim() || null,
        defaultTags: tags.length > 0 ? tags : null,
        config,
      });
      toast.success("配置已保存");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(`保存失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>编辑采集源</DialogTitle>
          <DialogDescription>
            源类型 <span className="font-medium text-foreground">{source.sourceTypeLabel}</span> 不可变更(历史运行记录与该类型绑定)。如需换类型,请删除当前源后新建。
          </DialogDescription>
        </DialogHeader>

        <div className="h-[500px] overflow-y-auto pr-1">
          <div className="flex flex-col gap-5">
            {/* 名称 */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-name">名称</Label>
              <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            {/* 配置参数(当前 sourceType 的 fields) */}
            {configFields.length > 0 && (
              <div className="rounded-md border border-border bg-muted/30 p-4 flex flex-col gap-5">
                <div className="text-xs font-medium text-muted-foreground">配置参数</div>
                {configFields.map((f) => (
                  <ConfigFieldRow
                    key={f.key}
                    field={f}
                    value={config[f.key]}
                    onChange={(v) => setConfig({ ...config, [f.key]: v })}
                  />
                ))}
              </div>
            )}

            {/* 调度频率 */}
            <div className="flex flex-col gap-2">
              <Label>调度频率</Label>
              <Select value={scheduleCron} onValueChange={setScheduleCron}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CRON_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 归属模块 */}
            <div className="flex flex-col gap-2">
              <Label>归属模块</Label>
              <div className="grid grid-cols-2 gap-2">
                {TARGET_MODULES.map((m) => {
                  const checked = targetModules.includes(m.value);
                  return (
                    <label key={m.value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c) => {
                          if (c) setTargetModules([...targetModules, m.value]);
                          else setTargetModules(targetModules.filter((x) => x !== m.value));
                        }}
                      />
                      <span>{m.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 默认分类 / 标签 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-cat">默认分类</Label>
                <Input
                  id="edit-cat"
                  value={defaultCategory}
                  onChange={(e) => setDefaultCategory(e.target.value)}
                  placeholder="如: 时政"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-tags">默认标签(逗号分隔)</Label>
                <Input
                  id="edit-tags"
                  value={defaultTagsRaw}
                  onChange={(e) => setDefaultTagsRaw(e.target.value)}
                  placeholder="如: 热榜, 每日"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ConfigFieldRowProps {
  field: ConfigField;
  value: unknown;
  onChange: (v: unknown) => void;
}

function ConfigFieldRow({ field, value, onChange }: ConfigFieldRowProps) {
  if (field.type === "boolean") {
    return (
      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <Checkbox
          checked={Boolean(value)}
          onCheckedChange={(c) => onChange(Boolean(c))}
        />
        <div className="flex flex-col gap-0.5">
          <span>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </span>
          {field.help && <span className="text-xs text-muted-foreground">{field.help}</span>}
        </div>
      </label>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`edit-${field.key}`}>
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {renderConfigInput(field, value, onChange)}
      {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
    </div>
  );
}

function renderConfigInput(field: ConfigField, value: unknown, onChange: (v: unknown) => void) {
  switch (field.type) {
    case "text":
    case "url":
      return (
        <Input
          id={`edit-${field.key}`}
          type={field.type}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "textarea":
      return (
        <Textarea
          id={`edit-${field.key}`}
          value={
            Array.isArray(value)
              ? (value as string[]).join("\n")
              : ((value as string) ?? "")
          }
          rows={4}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "number":
      return (
        <Input
          id={`edit-${field.key}`}
          type="number"
          value={(value as number | undefined) ?? ""}
          min={field.validation?.min}
          max={field.validation?.max}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        />
      );
    case "select":
      return (
        <Select value={(value as string) ?? ""} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder={field.help ?? "请选择"} /></SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    default:
      // multiselect / kv / boolean 不在编辑 dialog 支持范围内 — 给个占位说明
      return (
        <div className="text-xs text-muted-foreground italic px-2 py-1.5 border rounded-md bg-muted/30">
          {field.type} 类型字段暂不支持在线编辑(请删除源后重建)
        </div>
      );
  }
}
