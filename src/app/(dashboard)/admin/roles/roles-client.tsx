"use client";

import { useState } from "react";
import {
  Plus,
  Shield,
  ShieldCheck,
  Check,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createRole, updateRole, deleteRole } from "@/app/actions/admin";
import { PERMISSION_GROUPS } from "@/lib/rbac-constants";

type Role = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  permissions: unknown;
  organizationId: string | null;
};

export default function RolesClient({
  roles,
  organizationId,
}: {
  roles: Role[];
  organizationId: string;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function getPerms(role: Role): string[] {
    return (role.permissions as string[]) || [];
  }

  function openCreate() {
    setEditRole(null);
    setName("");
    setSlug("");
    setDescription("");
    setSelectedPerms([]);
    setError("");
    setDialogOpen(true);
  }

  function openEdit(role: Role) {
    setEditRole(role);
    setName(role.name);
    setSlug(role.slug);
    setDescription(role.description || "");
    setSelectedPerms(getPerms(role));
    setError("");
    setDialogOpen(true);
  }

  function togglePerm(perm: string) {
    setSelectedPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (editRole) {
        await updateRole(editRole.id, {
          name: editRole.isSystem ? undefined : name,
          description: editRole.isSystem ? undefined : description,
          permissions: selectedPerms,
        });
      } else {
        await createRole({
          name,
          slug,
          description,
          permissions: selectedPerms,
          organizationId,
        });
      }
      setDialogOpen(false);
    } catch (err: any) {
      setError(err.message || "操作失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(role: Role) {
    if (!confirm(`确定删除角色「${role.name}」吗？`)) return;
    try {
      await deleteRole(role.id);
    } catch (err: any) {
      alert(err.message || "删除失败");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">角色权限</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理系统角色和权限配置
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-primary text-primary-foreground hover:brightness-110"
        >
          <Plus size={16} className="mr-1.5" />
          新建角色
        </Button>
      </div>

      {/* Role Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {roles.map((role) => {
          const perms = getPerms(role);
          return (
            <div
              key={role.id}
              className="glass-secondary rounded-2xl p-5 space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                    {role.isSystem ? (
                      <ShieldCheck size={20} className="text-indigo-400" />
                    ) : (
                      <Shield size={20} className="text-purple-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{role.name}</h3>
                      {role.isSystem && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0"
                        >
                          系统角色
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {role.description || role.slug}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => openEdit(role)}
                  >
                    <Pencil size={14} />
                  </Button>
                  {!role.isSystem && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-500"
                      onClick={() => handleDelete(role)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              </div>

              {/* Permission summary */}
              <div className="flex flex-wrap gap-1.5">
                {PERMISSION_GROUPS.map((group) => {
                  const activeCount = group.permissions.filter((p) =>
                    perms.includes(p.key)
                  ).length;
                  if (activeCount === 0) return null;
                  return (
                    <Badge
                      key={group.label}
                      variant="outline"
                      className="text-[10px]"
                    >
                      {group.label} ({activeCount}/{group.permissions.length})
                    </Badge>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editRole
                ? editRole.isSystem
                  ? `编辑权限 — ${editRole.name}`
                  : "编辑角色"
                : "新建角色"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Only show name/slug for non-system roles */}
            {(!editRole || !editRole.isSystem) && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">角色名称</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例：内容审核员"
                    required={!editRole}
                  />
                </div>
                {!editRole && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">角色标识</label>
                    <Input
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="例：content-reviewer"
                      required
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium">描述</label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="角色描述"
                  />
                </div>
              </>
            )}

            {/* Permission checklist */}
            <div className="space-y-4">
              <label className="text-sm font-medium">权限配置</label>
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.label} className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {group.label}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {group.permissions.map((perm) => (
                      <label
                        key={perm.key}
                        className="flex items-center gap-2 text-sm cursor-pointer hover:text-foreground transition-colors"
                      >
                        <Checkbox
                          checked={selectedPerms.includes(perm.key)}
                          onCheckedChange={() => togglePerm(perm.key)}
                        />
                        {perm.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
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
              {loading ? "保存中..." : "保存"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
