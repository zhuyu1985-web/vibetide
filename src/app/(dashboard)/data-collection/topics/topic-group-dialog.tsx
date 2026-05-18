"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TopicGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (groupName: string) => Promise<void>;
}

export function TopicGroupDialog({
  open,
  onOpenChange,
  onCreate,
}: TopicGroupDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setName("");
      setError(null);
    }
  }, [open]);

  function handleSubmit() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("请输入分组名称");
      return;
    }
    if (trimmed.length > 50) {
      setError("分组名称最多 50 个字符");
      return;
    }
    startTransition(async () => {
      try {
        await onCreate(trimmed);
        onOpenChange(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "创建失败");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>新建分组</DialogTitle>
          <DialogDescription>
            分组用于侧栏组织方案。分组只在有方案归属时显示。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <Label>分组名称</Label>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如:民生热点 / 区县动态"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !pending) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            取消
          </Button>
          <Button variant="ghost" onClick={handleSubmit} disabled={pending}>
            {pending ? "创建中…" : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
