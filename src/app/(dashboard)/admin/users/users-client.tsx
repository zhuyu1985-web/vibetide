"use client";

import { useState } from "react";
import {
  Plus,
  Pencil,
  UserX,
  Shield,
  ShieldCheck,
  X,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: "",
    password: "",
    displayName: "",
    organizationId: currentOrgId,
    roleId: "",
  });

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserWithRoles | null>(null);
  const [editForm, setEditForm] = useState({ displayName: "", organizationId: "" });

  // Assign role dialog
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleUser, setRoleUser] = useState<UserWithRoles | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState("");

  // Confirm dialogs
  const [confirmAction, setConfirmAction] = useState<{
    type: "deactivate" | "removeRole";
    title: string;
    description: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  // ── Create ──
  function openCreate() {
    setCreateForm({
      email: "",
      password: "",
      displayName: "",
      organizationId: currentOrgId,
      roleId: roles.find((r) => r.slug === "editor")?.id || roles[0]?.id || "",
    });
    setError("");
    setCreateOpen(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await createUser(createForm);
      setCreateOpen(false);
    } catch (err: any) {
      setError(err.message || "创建失败");
    } finally {
      setLoading(false);
    }
  }

  // ── Edit ──
  function openEdit(user: UserWithRoles) {
    setEditUser(user);
    setEditForm({
      displayName: user.displayName,
      organizationId: user.organizationId || currentOrgId,
    });
    setError("");
    setEditOpen(true);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setLoading(true);
    setError("");
    try {
      await updateUser(editUser.id, editForm);
      setEditOpen(false);
    } catch (err: any) {
      setError(err.message || "更新失败");
    } finally {
      setLoading(false);
    }
  }

  // ── Assign role ──
  function openRoleDialog(user: UserWithRoles) {
    setRoleUser(user);
    setSelectedRoleId("");
    setActionError("");
    setRoleDialogOpen(true);
  }

  async function handleAssignRole(e: React.FormEvent) {
    e.preventDefault();
    if (!roleUser || !selectedRoleId) return;
    setLoading(true);
    setActionError("");
    try {
      await assignUserRole(
        roleUser.id,
        selectedRoleId,
        roleUser.organizationId || currentOrgId
      );
      setRoleDialogOpen(false);
    } catch (err: any) {
      setActionError(err.message || "分配失败");
    } finally {
      setLoading(false);
    }
  }

  // ── Remove role (with confirmation) ──
  function confirmRemoveRole(user: UserWithRoles, role: { id: string; name: string }) {
    setConfirmAction({
      type: "removeRole",
      title: "移除角色",
      description: `确定移除「${user.displayName}」的「${role.name}」角色吗？`,
      onConfirm: async () => {
        await removeUserRole(user.id, role.id);
      },
    });
  }

  // ── Deactivate (with confirmation) ──
  function confirmDeactivate(user: UserWithRoles) {
    setConfirmAction({
      type: "deactivate",
      title: "停用用户",
      description: `确定停用用户「${user.displayName}」吗？停用后该用户将无法登录系统。`,
      onConfirm: async () => {
        await deactivateUser(user.id);
      },
    });
  }

  async function handleConfirmAction() {
    if (!confirmAction) return;
    setLoading(true);
    try {
      await confirmAction.onConfirm();
      setConfirmAction(null);
    } catch (err: any) {
      setActionError(err.message || "操作失败");
      setConfirmAction(null);
    } finally {
      setLoading(false);
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
        <Button onClick={openCreate}>
          <Plus size={16} className="mr-1.5" />
          添加用户
        </Button>
      </div>

      {/* Action error toast */}
      {actionError && (
        <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 dark:bg-red-950/50 rounded-lg px-4 py-3">
          <span className="flex-1">{actionError}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-red-400 hover:text-red-600"
            onClick={() => setActionError("")}
          >
            <X size={14} />
          </Button>
        </div>
      )}

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
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 bg-rose-500/10 text-rose-400"
                  >
                    <ShieldCheck size={10} className="mr-0.5" />
                    超管
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                {user.organizationName && <span>{user.organizationName}</span>}
                <span>
                  加入于{" "}
                  {new Date(user.createdAt).toLocaleDateString("zh-CN")}
                </span>
              </div>
            </div>

            {/* Roles */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] text-indigo-400/80 font-medium mr-0.5">角色</span>
              {user.roles.map((role) => (
                <Badge
                  key={role.id}
                  variant="outline"
                  className="text-[11px] gap-1 pr-1"
                >
                  {role.name}
                  <button
                    className="ml-0.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 p-0.5 transition-colors"
                    onClick={() => confirmRemoveRole(user, role)}
                    title="移除角色"
                  >
                    <X size={10} />
                  </button>
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
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => openEdit(user)}
                title="编辑用户"
              >
                <Pencil size={14} />
              </Button>
              {!user.isSuperAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-red-500"
                  onClick={() => confirmDeactivate(user)}
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

      {/* ── Create User Dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加用户</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">姓名</label>
              <Input
                value={createForm.displayName}
                onChange={(e) =>
                  setCreateForm({ ...createForm, displayName: e.target.value })
                }
                placeholder="用户姓名"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">邮箱</label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm({ ...createForm, email: e.target.value })
                }
                placeholder="user@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">密码</label>
              <Input
                type="password"
                value={createForm.password}
                onChange={(e) =>
                  setCreateForm({ ...createForm, password: e.target.value })
                }
                placeholder="至少 6 位"
                minLength={6}
                required
              />
            </div>
            {isSuperAdmin && organizations.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">所属组织</label>
                <Select
                  value={createForm.organizationId}
                  onValueChange={(v) =>
                    setCreateForm({ ...createForm, organizationId: v })
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
                value={createForm.roleId}
                onValueChange={(v) =>
                  setCreateForm({ ...createForm, roleId: v })
                }
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
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "创建中..." : "创建用户"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit User Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑用户 — {editUser?.displayName}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">姓名</label>
              <Input
                value={editForm.displayName}
                onChange={(e) =>
                  setEditForm({ ...editForm, displayName: e.target.value })
                }
                placeholder="用户姓名"
                required
              />
            </div>
            {isSuperAdmin && organizations.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">所属组织</label>
                <Select
                  value={editForm.organizationId}
                  onValueChange={(v) =>
                    setEditForm({ ...editForm, organizationId: v })
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
            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "保存中..." : "保存修改"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Assign Role Dialog ── */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              分配角色 — {roleUser?.displayName}
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
                      (r) => !roleUser?.roles.some((ur) => ur.id === r.id)
                    )
                    .map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {actionError && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/50 rounded-lg px-3 py-2">
                {actionError}
              </p>
            )}
            <Button
              type="submit"
              disabled={loading || !selectedRoleId}
              className="w-full"
            >
              {loading ? "分配中..." : "确认分配"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Confirm AlertDialog ── */}
      <AlertDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              disabled={loading}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              {loading ? "处理中..." : "确认"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
