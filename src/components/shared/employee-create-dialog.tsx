"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createEmployee } from "@/app/actions/employees";
import { Loader2 } from "lucide-react";

interface EmployeeCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onSuccess?: () => void;
}

export function EmployeeCreateDialog({
  open,
  onOpenChange,
  organizationId,
  onSuccess,
}: EmployeeCreateDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    slug: "",
    name: "",
    nickname: "",
    title: "",
    motto: "",
    roleType: "custom",
    authorityLevel: "advisor" as "observer" | "advisor" | "executor" | "coordinator",
  });

  const handleSubmit = async () => {
    if (!form.slug || !form.name || !form.nickname || !form.title) return;
    setError(null);
    setLoading(true);
    try {
      await createEmployee({
        organizationId: organizationId || undefined,
        slug: form.slug,
        name: form.name,
        nickname: form.nickname,
        title: form.title,
        motto: form.motto || undefined,
        roleType: form.roleType,
        authorityLevel: form.authorityLevel,
      });
      onOpenChange(false);
      setForm({
        slug: "",
        name: "",
        nickname: "",
        title: "",
        motto: "",
        roleType: "custom",
        authorityLevel: "advisor",
      });
      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "创建失败，请稍后重试";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>创建自定义AI员工</DialogTitle>
          <DialogDescription>
            定义你的专属AI员工，设置角色和权限
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="slug" className="text-xs">
                员工ID (英文) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="slug"
                placeholder="如: xiaoming"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                className="glass-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nickname" className="text-xs">
                昵称 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nickname"
                placeholder="如: 小明"
                value={form.nickname}
                onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                className="glass-input"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs">
              角色名称 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              placeholder="如: 热点猎手、内容创作师"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="glass-input"
            />
            <p className="text-[10px] text-muted-foreground">描述该员工的核心职能</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="title" className="text-xs">
              职位介绍 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              placeholder="如: 负责全网热点监控与趋势预判"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="glass-input"
            />
            <p className="text-[10px] text-muted-foreground">简要描述该员工的职责与定位</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="motto" className="text-xs">
              座右铭
            </Label>
            <Input
              id="motto"
              placeholder="如: 数据之中自有乾坤"
              value={form.motto}
              onChange={(e) => setForm({ ...form, motto: e.target.value })}
              className="glass-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">角色类型</Label>
              <Input
                placeholder="如: data_miner"
                value={form.roleType}
                onChange={(e) => setForm({ ...form, roleType: e.target.value })}
                className="glass-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">权限等级</Label>
              <Select
                value={form.authorityLevel}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    authorityLevel: v as typeof form.authorityLevel,
                  })
                }
              >
                <SelectTrigger className="glass-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="observer">观察者</SelectItem>
                  <SelectItem value="advisor">顾问</SelectItem>
                  <SelectItem value="executor">执行者</SelectItem>
                  <SelectItem value="coordinator">协调者</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        {error && (
          <p className="text-sm text-red-500 px-1">{error}</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !form.slug || !form.name || !form.nickname || !form.title}
          >
            {loading && <Loader2 size={14} className="mr-1 animate-spin" />}
            创建员工
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
