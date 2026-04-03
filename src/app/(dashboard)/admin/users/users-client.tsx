"use client";

import { useState } from "react";
import {
  Plus,
  Pencil,
  UserX,
  Shield,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createUser,
  updateUser,
  deactivateUser,
  assignUserRole,
  removeUserRole,
} from "@/app/actions/admin";
import type { UserWithRoles } from "@/lib/dal/admin";

type Role = {
  id: string;
  name: string;
  slug: string;
  isSystem: boolean;
};

type Org = {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
};

export default function UsersClient({
  users,
  organizations,
  roles,
  isSuperAdmin,
  currentOrgId,
}: {
  users: UserWithRoles[];
  organizations: Org[];
  roles: Role[];
  isSuperAdmin: boolean;
  currentOrgId: string;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: "",
    displayName: "",
    organizationId: currentOrgId,
    roleId: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function openCreate() {
    setForm({
      email: "",
      password: "",
      displayName: "",
      organizationId: currentOrgId,
      roleId: roles.find((r) => r.slug === "editor")?.id || roles[0]?.id || "",
    });
    setError("");
    setDialogOpen(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await createUser(form);
      setDialogOpen(false);
    } catch (err: any) {
      setError(err.message || "创建失败");
    } finally {
      setLoading(false);
    }
  }

  function openRoleDialog(user: UserWithRoles) {
    setSelectedUser(user);
    setSelectedRoleId("");
    setRoleDialogOpen(true);
  }

  async function handleAssignRole(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser || !selectedRoleId) return;
    setLoading(true);
    try {
      await assignUserRole(
        selectedUser.id,
        selectedRoleId,
        selectedUser.organizationId || currentOrgId
      );
      setRoleDialogOpen(false);
    } catch (err: any) {
      alert(err.message || "分配失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveRole(userId: string, roleId: string) {
    if (!confirm("确定移除该角色吗？")) return;
    try {
      await removeUserRole(userId, roleId);
    } catch (err: any) {
      alert(err.message || "移除失败");
    }
  }

  async function handleDeactivate(user: UserWithRoles) {
    if (!confirm(`确定停用用户「${user.displayName}」吗？`)) return;
    try {
      await deactivateUser(user.id);
    } catch (err: any) {
      alert(err.message || "停用失败");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">用户管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理用户账号、分配组织和角色
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-primary text-primary-foreground hover:brightness-110"
        >
          <Plus size={16} className="mr-1.5" />
          添加用户
        </Button>
      </div>

      {/* User List */}
      <div className="space-y-3">
        {users.map((user) => (
          <div
            key={user.id}
            className="glass-secondary rounded-2xl p-4 flex items-center gap-4"
          >
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center shrink-0">
              <span className="text-sm font-semibold text-blue-400">
                {user.displayName.charAt(0)}
              </span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">
                  {user.displayName}
                </span>
                {user.isSuperAdmin && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-rose-500/10 text-rose-400">
                    <ShieldCheck size={10} className="mr-0.5" />
                    超管
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                {user.organizationName && (
                  <span>{user.organizationName}</span>
                )}
                <span>
                  加入于 {new Date(user.createdAt).toLocaleDateString("zh-CN")}
                </span>
              </div>
            </div>

            {/* Roles */}
            <div className="flex items-center gap-1.5 shrink-0">
              {user.roles.map((role) => (
                <Badge
                  key={role.id}
                  variant="outline"
                  className="text-[11px] cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 hover:border-red-300 transition-colors"
                  onClick={() => handleRemoveRole(user.id, role.id)}
                  title="点击移除角色"
                >
                  {role.name}
                </Badge>
              ))}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-blue-500"
                onClick={() => openRoleDialog(user)}
                title="分配角色"
              >
                <Shield size={14} />
              </Button>
            </div>

            {/* Actions */}
            <div className="flex gap-1 shrink-0">
              {!user.isSuperAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-red-500"
                  onClick={() => handleDeactivate(user)}
                  title="停用用户"
                >
                  <UserX size={14} />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {users.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          暂无用户
        </div>
      )}

      {/* Create User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加用户</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">姓名</label>
              <Input
                value={form.displayName}
                onChange={(e) =>
                  setForm({ ...form, displayName: e.target.value })
                }
                placeholder="用户姓名"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">邮箱</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="user@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">密码</label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="至少 6 位"
                minLength={6}
                required
              />
            </div>
            {isSuperAdmin && organizations.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">所属组织</label>
                <Select
                  value={form.organizationId}
                  onValueChange={(v) =>
                    setForm({ ...form, organizationId: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择组织" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">角色</label>
              <Select
                value={form.roleId}
                onValueChange={(v) => setForm({ ...form, roleId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择角色" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              {loading ? "创建中..." : "创建用户"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign Role Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              分配角色 - {selectedUser?.displayName}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAssignRole} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">选择角色</label>
              <Select
                value={selectedRoleId}
                onValueChange={setSelectedRoleId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择角色" />
                </SelectTrigger>
                <SelectContent>
                  {roles
                    .filter(
                      (r) =>
                        !selectedUser?.roles.some((ur) => ur.id === r.id)
                    )
                    .map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="submit"
              disabled={loading || !selectedRoleId}
              className="w-full bg-primary text-primary-foreground hover:brightness-110"
            >
              {loading ? "分配中..." : "确认分配"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
