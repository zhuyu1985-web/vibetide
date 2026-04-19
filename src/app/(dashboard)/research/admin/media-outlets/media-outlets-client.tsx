"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import type {
  MediaOutletSummary,
  MediaTier,
} from "@/lib/dal/research/media-outlets";
import type { CqDistrict } from "@/lib/dal/research/cq-districts";
import {
  createMediaOutlet,
  updateMediaOutlet,
  archiveMediaOutlet,
  unarchiveMediaOutlet,
} from "@/app/actions/research/media-outlets";

const TIER_LABELS: Record<MediaTier, string> = {
  central: "中央级",
  provincial_municipal: "省/市级",
  industry: "行业级",
  district_media: "区县融媒体",
};

const TIER_BADGE_CLASS: Record<MediaTier, string> = {
  central: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30",
  provincial_municipal: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30",
  industry: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30",
  district_media: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/30",
};

type DialogMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; outlet: MediaOutletSummary };

type FormState = {
  id?: string;
  name: string;
  tier: MediaTier;
  province: string;
  districtId: string;
  industryTag: string;
  officialUrl: string;
  aliases: { alias: string; matchPattern: string }[];
};

function emptyForm(): FormState {
  return {
    name: "",
    tier: "central",
    province: "",
    districtId: "",
    industryTag: "",
    officialUrl: "",
    aliases: [],
  };
}

export function MediaOutletsClient({
  outlets,
  districts,
}: {
  outlets: MediaOutletSummary[];
  districts: CqDistrict[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | MediaTier>("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "archived"
  >("active");
  const [dialog, setDialog] = useState<DialogMode>({ kind: "closed" });
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);

  const filtered = outlets.filter((o) => {
    if (tierFilter !== "all" && o.tier !== tierFilter) return false;
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (search && !o.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  function openCreate() {
    setForm(emptyForm());
    setFormError(null);
    setDialog({ kind: "create" });
  }

  function openEdit(o: MediaOutletSummary) {
    setForm({
      id: o.id,
      name: o.name,
      tier: o.tier,
      province: o.province ?? "",
      districtId:
        districts.find((d) => d.name === o.districtName)?.id ?? "",
      industryTag: o.industryTag ?? "",
      officialUrl: o.officialUrl ?? "",
      aliases: [],
    });
    setFormError(null);
    setDialog({ kind: "edit", outlet: o });
  }

  function closeDialog() {
    setDialog({ kind: "closed" });
    setForm(emptyForm());
    setFormError(null);
  }

  function addAliasRow() {
    setForm((f) => ({
      ...f,
      aliases: [...f.aliases, { alias: "", matchPattern: "" }],
    }));
  }
  function removeAliasRow(idx: number) {
    setForm((f) => ({
      ...f,
      aliases: f.aliases.filter((_, i) => i !== idx),
    }));
  }
  function updateAliasRow(
    idx: number,
    key: "alias" | "matchPattern",
    val: string,
  ) {
    setForm((f) => ({
      ...f,
      aliases: f.aliases.map((a, i) =>
        i === idx ? { ...a, [key]: val } : a,
      ),
    }));
  }

  function submit() {
    setFormError(null);
    if (!form.name.trim()) {
      setFormError("请输入媒体名称");
      return;
    }
    if (form.tier === "district_media" && !form.districtId) {
      setFormError("区县融媒体必须选择所属区县");
      return;
    }

    const aliases = form.aliases.filter(
      (a) => a.alias.trim() && a.matchPattern.trim(),
    );
    const payload = {
      name: form.name.trim(),
      tier: form.tier,
      province: form.province.trim() || undefined,
      districtId: form.districtId || undefined,
      industryTag: form.industryTag.trim() || undefined,
      officialUrl: form.officialUrl.trim() || undefined,
      aliases: aliases.length > 0 ? aliases : undefined,
    };

    startTransition(async () => {
      const res =
        dialog.kind === "edit"
          ? await updateMediaOutlet({ id: form.id!, ...payload })
          : await createMediaOutlet(payload);

      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      closeDialog();
      router.refresh();
    });
  }

  function toggleArchive(o: MediaOutletSummary) {
    startTransition(async () => {
      const res =
        o.status === "archived"
          ? await unarchiveMediaOutlet(o.id)
          : await archiveMediaOutlet(o.id);
      if (!res.ok) {
        alert(res.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="max-w-[1400px] mx-auto w-full space-y-6">
      <PageHeader
        title="媒体源管理"
        description="管理央、市、行业、区县四级媒体登记"
      />

      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="按名称搜索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={tierFilter}
          onValueChange={(v) => setTierFilter(v as "all" | MediaTier)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="层级" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部层级</SelectItem>
            <SelectItem value="central">中央级</SelectItem>
            <SelectItem value="provincial_municipal">省/市级</SelectItem>
            <SelectItem value="industry">行业级</SelectItem>
            <SelectItem value="district_media">区县融媒体</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) =>
            setStatusFilter(v as "all" | "active" | "archived")
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="active">有效</SelectItem>
            <SelectItem value="archived">已归档</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          新增媒体
        </Button>
      </div>

      <DataTable
        rows={filtered}
        rowKey={(o) => o.id}
        emptyMessage="未找到匹配的媒体源"
        columns={[
          {
            key: "name",
            header: "名称",
            render: (o) =>
              o.officialUrl ? (
                <a
                  href={o.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline truncate block"
                >
                  {o.name}
                </a>
              ) : (
                <span className="truncate block">{o.name}</span>
              ),
          },
          {
            key: "tier",
            header: "层级",
            width: "w-24",
            render: (o) => (
              <Badge className={TIER_BADGE_CLASS[o.tier]}>{TIER_LABELS[o.tier]}</Badge>
            ),
          },
          {
            key: "province",
            header: "省市",
            width: "w-24",
            render: (o) => <span className="truncate block">{o.province ?? "-"}</span>,
          },
          {
            key: "district",
            header: "区县",
            width: "w-24",
            render: (o) => <span className="truncate block">{o.districtName ?? "-"}</span>,
          },
          {
            key: "industry",
            header: "行业标签",
            width: "w-28",
            render: (o) => <span className="truncate block">{o.industryTag ?? "-"}</span>,
          },
          {
            key: "status",
            header: "状态",
            width: "w-20",
            render: (o) =>
              o.status === "active" ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  有效
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  已归档
                </span>
              ),
          },
          {
            key: "aliasCount",
            header: "别名数",
            width: "w-16",
            render: (o) => o.aliasCount,
          },
          {
            key: "actions",
            header: "操作",
            width: "w-32",
            align: "right",
            render: (o) => (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(o)}>
                  编辑
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleArchive(o)}
                  disabled={pending}
                >
                  {o.status === "archived" ? "恢复" : "归档"}
                </Button>
              </div>
            ),
          },
        ] satisfies DataTableColumn<MediaOutletSummary>[]}
      />

      <Dialog
        open={dialog.kind !== "closed"}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialog.kind === "edit" ? "编辑媒体源" : "新增媒体源"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {formError && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {formError}
              </div>
            )}
            <div className="space-y-1">
              <Label>名称</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>层级</Label>
              <Select
                value={form.tier}
                onValueChange={(v) =>
                  setForm({ ...form, tier: v as MediaTier })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="central">中央级</SelectItem>
                  <SelectItem value="provincial_municipal">省/市级</SelectItem>
                  <SelectItem value="industry">行业级</SelectItem>
                  <SelectItem value="district_media">区县融媒体</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.tier === "district_media" && (
              <div className="space-y-1">
                <Label>所属区县</Label>
                <Select
                  value={form.districtId}
                  onValueChange={(v) => setForm({ ...form, districtId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择区县" />
                  </SelectTrigger>
                  <SelectContent>
                    {districts.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.tier !== "district_media" && (
              <div className="space-y-1">
                <Label>省/市</Label>
                <Input
                  value={form.province}
                  onChange={(e) =>
                    setForm({ ...form, province: e.target.value })
                  }
                  placeholder="如：重庆市"
                />
              </div>
            )}
            {form.tier === "industry" && (
              <div className="space-y-1">
                <Label>行业标签</Label>
                <Input
                  value={form.industryTag}
                  onChange={(e) =>
                    setForm({ ...form, industryTag: e.target.value })
                  }
                  placeholder="如：环境 / 健康 / 能源"
                />
              </div>
            )}
            <div className="space-y-1">
              <Label>官网 URL</Label>
              <Input
                type="url"
                value={form.officialUrl}
                onChange={(e) =>
                  setForm({ ...form, officialUrl: e.target.value })
                }
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>别名（用于匹配抓取结果）</Label>
                <Button variant="ghost" size="sm" onClick={addAliasRow}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  添加别名
                </Button>
              </div>
              {dialog.kind === "edit" && form.aliases.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  注：保存时将替换现有别名。如需保留原别名请先添加。
                </p>
              )}
              {form.aliases.map((a, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={a.alias}
                    onChange={(e) =>
                      updateAliasRow(i, "alias", e.target.value)
                    }
                    placeholder="别名"
                  />
                  <Input
                    value={a.matchPattern}
                    onChange={(e) =>
                      updateAliasRow(i, "matchPattern", e.target.value)
                    }
                    placeholder="匹配模式（域名或正则）"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAliasRow(i)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>
              取消
            </Button>
            <Button variant="ghost" onClick={submit} disabled={pending}>
              {pending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
