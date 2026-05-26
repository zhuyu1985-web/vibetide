"use client";
//
// 上传媒体名单 xlsx → 调 uploadMediaScopeXlsx server action
// Spec: docs/superpowers/specs/2026-05-26-ecological-index-report-design.md §7.2

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { uploadMediaScopeXlsx } from "@/app/actions/research/media-scopes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function UploadScopeDialog({ open, onOpenChange, onSuccess }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName("");
    setDescription("");
    setFile(null);
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("请输入名单名称");
      return;
    }
    if (!file) {
      toast.error("请选择 xlsx 文件");
      return;
    }
    setSubmitting(true);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      const result = await uploadMediaScopeXlsx({
        name: name.trim(),
        description: description.trim() || undefined,
        fileBase64: base64,
        fileName: file.name,
      });
      toast.success(`已创建名单(${result.stats.totalUnits} 单位)`);
      if (result.warnings.length > 0) {
        result.warnings.slice(0, 5).forEach((w) => toast.warning(w));
      }
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(`上传失败:${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !submitting) reset();
        if (!submitting) onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>上传媒体名单</DialogTitle>
          <DialogDescription>
            上传 xlsx 文件,自动解析央/业/市/融/政五级分级与区县映射。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="scope-name">名单名称 *</Label>
            <Input
              id="scope-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例:2025 年度生态文明传播媒体名单"
              maxLength={100}
              disabled={submitting}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="scope-desc">描述</Label>
            <Textarea
              id="scope-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="可选"
              rows={2}
              maxLength={300}
              disabled={submitting}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="scope-file">xlsx 文件 *</Label>
            <Input
              id="scope-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground">
              限 5MB,需含分级 / 媒体名 / 区县 / 网站 / 公众号名 / 微博 URL 等列
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            disabled={submitting}
          >
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="size-4 mr-1.5 animate-spin" />}
            {submitting ? "上传中..." : "上传并解析"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
