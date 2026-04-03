"use client";

import { useState, useEffect, useTransition } from "react";
import { Shield, UserRound, Users, Plus, Trash2, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { setCategoryPermission, removeCategoryPermission } from "@/app/actions/categories";
import type {
  CategoryPermissionItem, CategoryPermissionType, PermissionGranteeType,
} from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  categoryName: string;
  permissions: CategoryPermissionItem[];
  orgUsers: { id: string; displayName: string; role: string }[];
  onRefresh: () => void;
}

const PERMISSION_LABELS: Record<CategoryPermissionType, string> = {
  read: "查看",
  write: "编辑",
  manage: "管理",
};

const PERMISSION_COLORS: Record<CategoryPermissionType, string> = {
  read: "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400",
  write: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400",
  manage: "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400",
};

const ROLE_OPTIONS = [
  { value: "admin", label: "管理员" },
  { value: "editor", label: "编辑" },
  { value: "viewer", label: "查看者" },
];

export function CategoryPermissionDialog({
  open, onOpenChange, categoryId, categoryName,
  permissions, orgUsers, onRefresh,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [addMode, setAddMode] = useState(false);

  // Form state for adding permission
  const [granteeType, setGranteeType] = useState<PermissionGranteeType>("role");
  const [granteeId, setGranteeId] = useState("");
  const [permType, setPermType] = useState<CategoryPermissionType>("read");

  useEffect(() => {
    if (!open) {
      setAddMode(false);
      setGranteeId("");
      setPermType("read");
    }
  }, [open]);

  const handleAdd = () => {
    if (!granteeId) return;
    startTransition(async () => {
      await setCategoryPermission({
        categoryId,
        granteeType,
        granteeId,
        permissionType: permType,
      });
      setAddMode(false);
      setGranteeId("");
      setPermType("read");
      onRefresh();
    });
  };

  const handleRemove = (permId: string) => {
    startTransition(async () => {
      await removeCategoryPermission(permId);
      onRefresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <Shield size={16} className="text-purple-500" />
            栏目权限 — {categoryName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current permissions */}
          <div className="space-y-1.5">
            <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
              当前权限
            </p>
            {permissions.length === 0 ? (
              <p className="text-[12px] text-gray-400 dark:text-gray-500 py-3 text-center">
                暂无权限设置，所有用户均可访问
              </p>
            ) : (
              <div className="space-y-1">
                {permissions.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/[0.03] text-[13px]"
                  >
                    {p.granteeType === "role" ? (
                      <Users size={14} className="text-gray-400 shrink-0" />
                    ) : (
                      <UserRound size={14} className="text-gray-400 shrink-0" />
                    )}
                    <span className="flex-1 truncate">{p.granteeLabel}</span>
                    <Badge
                      variant="secondary"
                      className={cn("text-[10px] px-1.5 py-0", PERMISSION_COLORS[p.permissionType])}
                    >
                      {PERMISSION_LABELS[p.permissionType]}
                    </Badge>
                    <button
                      onClick={() => handleRemove(p.id)}
                      disabled={isPending}
                      className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add permission */}
          {!addMode ? (
            <button
              onClick={() => setAddMode(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
            >
              <Plus size={14} />
              添加权限
            </button>
          ) : (
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-white/[0.03] space-y-3">
              <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                添加新权限
              </p>

              {/* Grantee type */}
              <div className="flex gap-2">
                <button
                  onClick={() => { setGranteeType("role"); setGranteeId(""); }}
                  className={cn(
                    "flex-1 py-1.5 rounded-md text-[12px] transition-colors",
                    granteeType === "role"
                      ? "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                  )}
                >
                  按角色
                </button>
                <button
                  onClick={() => { setGranteeType("user"); setGranteeId(""); }}
                  className={cn(
                    "flex-1 py-1.5 rounded-md text-[12px] transition-colors",
                    granteeType === "user"
                      ? "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                  )}
                >
                  按用户
                </button>
              </div>

              {/* Grantee selection */}
              <Select value={granteeId} onValueChange={setGranteeId}>
                <SelectTrigger className="h-8 text-[12px]">
                  <SelectValue placeholder={granteeType === "role" ? "选择角色" : "选择用户"} />
                </SelectTrigger>
                <SelectContent>
                  {granteeType === "role"
                    ? ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value} className="text-[12px]">
                          {r.label}
                        </SelectItem>
                      ))
                    : orgUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id} className="text-[12px]">
                          {u.displayName}
                          <span className="ml-1 text-gray-400">({u.role})</span>
                        </SelectItem>
                      ))
                  }
                </SelectContent>
              </Select>

              {/* Permission type */}
              <Select value={permType} onValueChange={(v) => setPermType(v as CategoryPermissionType)}>
                <SelectTrigger className="h-8 text-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read" className="text-[12px]">查看 — 浏览栏目和资源</SelectItem>
                  <SelectItem value="write" className="text-[12px]">编辑 — 上传、编辑、删除资源</SelectItem>
                  <SelectItem value="manage" className="text-[12px]">管理 — 管理栏目设置和权限</SelectItem>
                </SelectContent>
              </Select>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={!granteeId || isPending}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md bg-blue-600 text-white text-[12px] hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isPending && <Loader2 size={12} className="animate-spin" />}
                  确认添加
                </button>
                <button
                  onClick={() => setAddMode(false)}
                  className="px-3 py-1.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[12px] hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
