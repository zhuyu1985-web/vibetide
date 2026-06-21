"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GlassCard } from "@/components/shared/glass-card";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import type { DomainRecord } from "@/lib/types";
import {
  createDomainAction,
  updateDomainAction,
  deleteDomainAction,
  seedDefaultDomainsAction,
} from "@/app/actions/domains";

/** 把用户输入归一化为裸域名（去协议 / 路径 / www. 前缀）。 */
function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./i, "")
    .toLowerCase();
}

interface FormState {
  name: string;
  slug: string;
  description: string;
  promptGuidance: string;
  authoritySources: string[];
  sortOrder: number;
}

const EMPTY_FORM: FormState = {
  name: "",
  slug: "",
  description: "",
  promptGuidance: "",
  authoritySources: [],
  sortOrder: 0,
};

export function DomainsClient({ domains }: { domains: DomainRecord[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // null = 新建
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [newSource, setNewSource] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setNewSource("");
    setDialogOpen(true);
  };

  const openEdit = (d: DomainRecord) => {
    setEditingId(d.id);
    setForm({
      name: d.name,
      slug: d.slug,
      description: d.description ?? "",
      promptGuidance: d.promptGuidance ?? "",
      authoritySources: d.authoritySources ?? [],
      sortOrder: d.sortOrder ?? 0,
    });
    setNewSource("");
    setDialogOpen(true);
  };

  const addSource = () => {
    const v = normalizeDomain(newSource);
    if (v && !form.authoritySources.includes(v)) {
      setForm((f) => ({ ...f, authoritySources: [...f.authoritySources, v] }));
    }
    setNewSource("");
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error("请填写领域名称");
      return;
    }
    startTransition(async () => {
      try {
        if (editingId) {
          await updateDomainAction(editingId, {
            name: form.name,
            description: form.description,
            promptGuidance: form.promptGuidance,
            authoritySources: form.authoritySources,
            sortOrder: form.sortOrder,
          });
          toast.success("已保存");
        } else {
          await createDomainAction({
            name: form.name,
            slug: form.slug || undefined,
            description: form.description,
            promptGuidance: form.promptGuidance,
            authoritySources: form.authoritySources,
            sortOrder: form.sortOrder,
          });
          toast.success("已创建");
        }
        setDialogOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "保存失败");
      }
    });
  };

  const handleDelete = (d: DomainRecord) => {
    setDeletingId(d.id);
    startTransition(async () => {
      try {
        await deleteDomainAction(d.id);
        toast.success("已删除");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "删除失败");
      } finally {
        setDeletingId(null);
      }
    });
  };

  const handleSeed = () => {
    startTransition(async () => {
      try {
        const { inserted } = await seedDefaultDomainsAction();
        toast.success(inserted > 0 ? `已导入 ${inserted} 个默认领域` : "默认领域已存在");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "导入失败");
      }
    });
  };

  return (
    <div className="px-4 py-6">
      <PageHeader
        title="领域字典"
        description="维护领域 + 口径包（提示词口径 / 权威源）。改口径包即时影响该领域所有员工实例的产出与检索倾向。"
        actions={
          <Button onClick={openCreate} className="gap-1.5">
            <Plus size={16} />
            新建领域
          </Button>
        }
      />

      <GlassCard>
        <DataTable
          rows={domains}
          rowKey={(d) => d.id}
          columns={[
            { key: "name", header: "名称", render: (d) => <span className="font-medium">{d.name}</span> },
            {
              key: "slug",
              header: "slug",
              width: "w-32",
              render: (d) => <span className="text-xs text-gray-400">{d.slug}</span>,
            },
            {
              key: "guidance",
              header: "口径包",
              width: "w-24",
              render: (d) =>
                d.promptGuidance ? (
                  <Badge variant="secondary" className="text-[11px]">已配置</Badge>
                ) : (
                  <span className="text-xs text-gray-400">—</span>
                ),
            },
            {
              key: "sources",
              header: "权威源",
              width: "w-20",
              align: "right",
              render: (d) => (
                <span className="text-xs text-gray-500">{d.authoritySources.length}</span>
              ),
            },
            {
              key: "sort",
              header: "排序",
              width: "w-16",
              align: "right",
              render: (d) => <span className="text-xs text-gray-500">{d.sortOrder}</span>,
            },
            {
              key: "actions",
              header: "",
              width: "w-24",
              align: "right",
              render: (d) => (
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)}>
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-600"
                    disabled={pending && deletingId === d.id}
                    onClick={() => handleDelete(d)}
                  >
                    {pending && deletingId === d.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </Button>
                </div>
              ),
            },
          ]}
          emptyMessage={
            <div className="flex h-[200px] flex-col items-center justify-center gap-3">
              <p className="text-sm text-gray-400">尚无领域字典</p>
              <Button onClick={handleSeed} disabled={pending} className="gap-1.5">
                {pending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                导入默认领域
              </Button>
            </div>
          }
        />
      </GlassCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "编辑领域" : "新建领域"}</DialogTitle>
            <DialogDescription>
              口径包注入该领域所有实例的 prompt（Layer 4.5）与 web_search 检索源。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">名称</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="如 财经"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">slug（留空自动生成）</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="finance"
                  disabled={!!editingId}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">描述</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="财经/金融/产业经济报道"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">口径（promptGuidance）</Label>
              <Textarea
                value={form.promptGuidance}
                onChange={(e) => setForm((f) => ({ ...f, promptGuidance: e.target.value }))}
                placeholder="该领域的口径 / 术语 / 报道禁忌。如：不作投资建议；数据以官方披露为准…"
                rows={4}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">权威源域名（喂 web_search includeDomains）</Label>
              <div className="flex flex-wrap gap-2">
                {form.authoritySources.map((s) => (
                  <Badge key={s} variant="secondary" className="gap-1 text-xs pr-1">
                    {s}
                    <button
                      className="ml-0.5 hover:text-red-500"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          authoritySources: f.authoritySources.filter((x) => x !== s),
                        }))
                      }
                    >
                      <X size={10} />
                    </button>
                  </Badge>
                ))}
                {form.authoritySources.length === 0 && (
                  <span className="text-xs text-gray-400">未设置</span>
                )}
              </div>
              <Input
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                placeholder="如 csrc.gov.cn，回车添加"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSource();
                  }
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">排序</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))
                }
                className="w-24"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={pending} className="gap-1.5">
              {pending && <Loader2 size={14} className="animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
