"use client";
//
// 上传活动数据集 xlsx → 调 uploadActivityDatasetXlsx server action
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
import { Label } from "@/components/ui/label";
import { uploadActivityDatasetXlsx } from "@/app/actions/research/activity-datasets";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const CURRENT_YEAR = new Date().getFullYear();

export function UploadDatasetDialog({ open, onOpenChange, onSuccess }: Props) {
  const [name, setName] = useState("");
  const [year, setYear] = useState<string>(String(CURRENT_YEAR));
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName("");
    setYear(String(CURRENT_YEAR));
    setFile(null);
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("请输入数据集名称");
      return;
    }
    const yearNum = Number.parseInt(year, 10);
    if (!Number.isInteger(yearNum) || yearNum < 2000 || yearNum > 2100) {
      toast.error("年份必须是 2000-2100 之间的整数");
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
      const result = await uploadActivityDatasetXlsx({
        name: name.trim(),
        year: yearNum,
        fileBase64: base64,
        fileName: file.name,
      });
      toast.success(
        `已创建数据集(${result.districtCount} 区县 / ${result.totalActivities} 场)`,
      );
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
          <DialogTitle>上传活动数据集</DialogTitle>
          <DialogDescription>
            上传 xlsx 文件,自动解析 39 区县 × 5 主题(六五环境日 / 815 全国生态日 / 志愿服务 / 设施开放 / 六进活动)。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="dataset-name">数据集名称 *</Label>
            <Input
              id="dataset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`例:${CURRENT_YEAR} 年度线下宣传活动数据`}
              maxLength={100}
              disabled={submitting}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dataset-year">年份 *</Label>
            <Input
              id="dataset-year"
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dataset-file">xlsx 文件 *</Label>
            <Input
              id="dataset-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground">
              限 5MB,需含 区县 + D-H 5 列主题场数 + 时间跨度等
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
