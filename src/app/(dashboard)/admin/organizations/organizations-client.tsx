"use client";

import { useState } from "react";
import { Building2, Plus, Pencil, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createOrganization,
  updateOrganization,
  deleteOrganization,
} from "@/app/actions/admin";

type Org = {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  createdAt: Date;
};

export default function OrganizationsClient({
  organizations,
}: {
  organizations: Org[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editOrg, setEditOrg] = useState<Org | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function openCreate() {
    setEditOrg(null);
    setName("");
    setSlug("");
    setError("");
    setDialogOpen(true);
  }

  function openEdit(org: Org) {
    setEditOrg(org);
    setName(org.name);
    setSlug(org.slug);
    setError("");
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (editOrg) {
        await updateOrganization(editOrg.id, { name, slug });
      } else {
        await createOrganization({ name, slug });
      }
      setDialogOpen(false);
    } catch (err: any) {
      setError(err.message || "操作失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(org: Org) {
    if (!confirm(`确定删除组织「${org.name}」吗？`)) return;
    try {
      await deleteOrganization(org.id);
    } catch (err: any) {
      alert(err.message || "删除失败");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">组织管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理平台中的所有组织，每个组织的数据相互隔离
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-primary text-primary-foreground hover:brightness-110"
        >
          <Plus size={16} className="mr-1.5" />
          新建组织
        </Button>
      </div>

      {/* Organization Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {organizations.map((org) => (
          <div
            key={org.id}
            className="glass-secondary rounded-2xl p-5 space-y-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 flex items-center justify-center">
                  <Building2 size={20} className="text-rose-400" />
                </div>
                <div>
                  <h3 className="font-semibold">{org.name}</h3>
                  <p className="text-xs text-muted-foreground">{org.slug}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => openEdit(org)}
                >
                  <Pencil size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-red-500"
                  onClick={() => handleDelete(org)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Users size={14} />
                <span>{org.memberCount} 成员</span>
              </div>
              <span>
                创建于{" "}
                {new Date(org.createdAt).toLocaleDateString("zh-CN")}
              </span>
            </div>
          </div>
        ))}
      </div>

      {organizations.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          暂无组织，点击上方按钮创建
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editOrg ? "编辑组织" : "新建组织"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">组织名称</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例：华栖云传媒集团"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">组织标识 (slug)</label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="例：huaqiyun-media"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground hover:brightness-110"
            >
              {loading ? "保存中..." : editOrg ? "保存修改" : "创建组织"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
