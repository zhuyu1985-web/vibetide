"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createBenchmarkAccount,
  updateBenchmarkAccount,
  deleteBenchmarkAccount,
} from "@/app/actions/topic-compare-accounts";
import type { BenchmarkAccountRow } from "@/lib/dal/benchmark-accounts";

const PLATFORM_OPTIONS = [
  { value: "douyin", label: "抖音" },
  { value: "wechat", label: "微信公众号" },
  { value: "weibo", label: "微博" },
  { value: "website", label: "网站/报纸" },
  { value: "kuaishou", label: "快手" },
  { value: "bilibili", label: "B 站" },
  { value: "xiaohongshu", label: "小红书" },
  { value: "other", label: "其他" },
] as const;

const LEVEL_OPTIONS = [
  { value: "central", label: "央级", color: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
  { value: "provincial", label: "省级", color: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" },
  { value: "city", label: "地市级", color: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300" },
  { value: "industry", label: "行业", color: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300" },
  { value: "self_media", label: "自媒体", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
] as const;

function platformLabel(p: string): string {
  return PLATFORM_OPTIONS.find((o) => o.value === p)?.label ?? p;
}

function levelConfig(l: string) {
  return LEVEL_OPTIONS.find((o) => o.value === l) ?? { label: l, color: "bg-gray-100" };
}

type FormState = {
  id?: string;
  platform: (typeof PLATFORM_OPTIONS)[number]["value"];
  level: (typeof LEVEL_OPTIONS)[number]["value"];
  handle: string;
  name: string;
  accountUrl: string;
  description: string;
  region: string;
  isPresetReadonly?: boolean;
};

const emptyForm: FormState = {
  platform: "douyin",
  level: "central",
  handle: "",
  name: "",
  accountUrl: "",
  description: "",
  region: "",
};

interface Props {
  rows: BenchmarkAccountRow[];
}

export function BenchmarkAccountsClient({ rows }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [deleteTarget, setDeleteTarget] = useState<BenchmarkAccountRow | null>(null);

  function openCreate() {
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(row: BenchmarkAccountRow) {
    setForm({
      id: row.id,
      platform: row.platform as FormState["platform"],
      level: row.level as FormState["level"],
      handle: row.handle,
      name: row.name,
      accountUrl: row.accountUrl ?? "",
      description: row.description ?? "",
      region: row.region ?? "",
      isPresetReadonly: row.isPreset,
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    startTransition(async () => {
      const res = form.id
        ? await updateBenchmarkAccount({
            id: form.id,
            name: form.name,
            accountUrl: form.accountUrl,
            description: form.description,
            region: form.region,
          })
        : await createBenchmarkAccount({
            platform: form.platform,
            level: form.level,
            handle: form.handle,
            name: form.name,
            accountUrl: form.accountUrl,
            description: form.description,
            region: form.region,
          });
      if (res.success) {
        toast.success(form.id ? "已更新" : "已创建");
        setDialogOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || "保存失败");
      }
    });
  }

  function handleDelete(row: BenchmarkAccountRow) {
    if (row.isPreset) {
      toast.error("预置账号不可删除，请在编辑中停用");
      return;
    }
    setDeleteTarget(row);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    startTransition(async () => {
      const res = await deleteBenchmarkAccount(target.id);
      if (res.success) {
        toast.success("已删除");
        router.refresh();
      } else {
        toast.error(res.error || "删除失败");
      }
      setDeleteTarget(null);
    });
  }

  function handleToggleEnabled(row: BenchmarkAccountRow) {
    startTransition(async () => {
      const res = await updateBenchmarkAccount({
        id: row.id,
        isEnabled: !row.isEnabled,
      });
      if (res.success) {
        toast.success(row.isEnabled ? "已停用" : "已启用");
        router.refresh();
      } else {
        toast.error(res.error || "操作失败");
      }
    });
  }

  const filtered = useMemo(() => {
    if (platformFilter === "all") return rows;
    return rows.filter((r) => r.platform === platformFilter);
  }, [rows, platformFilter]);

  // 按 level 分组
  const grouped = useMemo(() => {
    const g: Record<string, BenchmarkAccountRow[]> = {};
    for (const row of filtered) {
      if (!g[row.level]) g[row.level] = [];
      g[row.level].push(row);
    }
    return g;
  }, [filtered]);

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        title="对标账号库"
        description="央级、省级、地市、行业、自媒体的账号池，用于同题对比时对照报道维度"
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1.5" />
            新增账号
          </Button>
        }
      />

      <div className="mb-4">
        <Tabs value={platformFilter} onValueChange={setPlatformFilter}>
          <TabsList variant="line">
            <TabsTrigger value="all">全部</TabsTrigger>
            {PLATFORM_OPTIONS.map((p) => (
              <TabsTrigger key={p.value} value={p.value}>
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="space-y-6">
        {LEVEL_OPTIONS.map((levelOpt) => {
          const accs = grouped[levelOpt.value] ?? [];
          if (accs.length === 0) return null;
          return (
            <GlassCard padding="md" key={levelOpt.value}>
              <div className="flex items-center gap-2 mb-4">
                <span
                  className={`text-xs px-2 py-0.5 rounded ${levelOpt.color}`}
                >
                  {levelOpt.label}
                </span>
                <span className="text-xs text-gray-500">{accs.length} 个账号</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {accs.map((acc) => (
                  <div
                    key={acc.id}
                    className="flex items-start gap-2 p-3 rounded-lg bg-white/60 dark:bg-gray-800/60"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {acc.name}
                        </div>
                        {acc.isPreset && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">
                            预置
                          </span>
                        )}
                        {!acc.isEnabled && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                            已停用
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 truncate">
                        {platformLabel(acc.platform)} · @{acc.handle}
                        {acc.region && <span className="ml-1">· {acc.region}</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
                        <span>{acc.postCount} 条</span>
                        {acc.accountUrl && (
                          <a
                            href={acc.accountUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-700"
                          >
                            <ExternalLink className="w-3 h-3" />
                            主页
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(acc)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleEnabled(acc)}
                      >
                        <span className="text-xs">
                          {acc.isEnabled ? "停" : "启"}
                        </span>
                      </Button>
                      {!acc.isPreset && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(acc)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {form.id
                ? form.isPresetReadonly
                  ? "查看账号（预置，只读）"
                  : "编辑账号"
                : "新增账号"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">平台</label>
                <Select
                  value={form.platform}
                  onValueChange={(v) => setForm({ ...form, platform: v as FormState["platform"] })}
                  disabled={!!form.id}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORM_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">级别</label>
                <Select
                  value={form.level}
                  onValueChange={(v) => setForm({ ...form, level: v as FormState["level"] })}
                  disabled={!!form.id || form.isPresetReadonly}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVEL_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">handle</label>
                <Input
                  value={form.handle}
                  onChange={(e) => setForm({ ...form, handle: e.target.value })}
                  disabled={!!form.id}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">地区（选填）</label>
                <Input
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  placeholder="北京"
                  disabled={form.isPresetReadonly}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">显示名称</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                disabled={form.isPresetReadonly}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">主页 URL</label>
              <Input
                value={form.accountUrl}
                onChange={(e) => setForm({ ...form, accountUrl: e.target.value })}
                disabled={form.isPresetReadonly}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">简介（选填）</label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                disabled={form.isPresetReadonly}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              {form.isPresetReadonly ? "关闭" : "取消"}
            </Button>
            {!form.isPresetReadonly && (
              <Button onClick={handleSubmit} disabled={pending}>
                {form.id ? "保存" : "创建"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="删除对标账号"
        description={`确认删除 ${deleteTarget?.name ?? ""}？`}
        confirmText="删除"
        variant="danger"
        loading={pending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
