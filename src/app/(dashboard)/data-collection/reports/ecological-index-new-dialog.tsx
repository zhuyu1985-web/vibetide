"use client";
//
// 新建指数体系报告 Dialog
// Spec: docs/superpowers/specs/2026-05-26-ecological-index-report-design.md §7.3 / §8.1
//
// 表单字段: 标题 / 年份 / 媒体名单 / 活动数据集 / 同时生成数据源 checkbox
// 实时预估: 选名单 / 切年份 → useTransition + previewScopeCoverage

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createEcologicalIndexReportAction,
  previewScopeCoverage,
} from "@/app/actions/research/ecological-index-reports";

// 跨 server/client 边界传输用的轻量类型(避免传 Date 实例引发 hydration / TS 警告)
export type ScopeOption = {
  id: string;
  name: string;
  totalUnits: number;
  centralCount: number;
  industryCount: number;
  municipalCount: number;
  districtRmtCount: number;
  districtGovCount: number;
  isDefault: boolean;
};

export type DatasetOption = {
  id: string;
  name: string;
  year: number;
  districtCount: number;
  totalActivities: number;
  activityThemes: string[];
  isDefault: boolean;
};

type ScopeCoveragePreview = {
  matchedOutletCount: number;
  itemsInScope: number;
  itemsTotal: number;
  retentionPct: number;
  byTier: {
    central: number;
    industry: number;
    municipal: number;
    district: number;
  };
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scopes: ScopeOption[];
  datasets: DatasetOption[];
  onCreated: (reportId: string) => void;
}

export function EcologicalIndexNewDialog({
  open,
  onOpenChange,
  scopes,
  datasets,
  onCreated,
}: Props) {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const defaultScope = useMemo(
    () => scopes.find((s) => s.isDefault) ?? scopes[0] ?? null,
    [scopes],
  );
  const defaultDataset = useMemo(
    () => datasets.find((d) => d.isDefault) ?? datasets[0] ?? null,
    [datasets],
  );

  const [title, setTitle] = useState("");
  const [year, setYear] = useState<number>(currentYear);
  const [scopeId, setScopeId] = useState<string>(defaultScope?.id ?? "");
  const [datasetId, setDatasetId] = useState<string>(defaultDataset?.id ?? "");
  const [includeContentSource, setIncludeContentSource] = useState(true);
  const [preview, setPreview] = useState<ScopeCoveragePreview | null>(null);
  const [previewPending, startPreview] = useTransition();
  const [submitting, setSubmitting] = useState(false);

  // 打开时(且未填过)初始化标题; 切年份时若标题仍是上一年模板,也跟着同步
  useEffect(() => {
    if (open) {
      setTitle((prev) => {
        const template = (y: number) => `${y} 年度重庆市生态文明传播指数排行榜及解读`;
        if (!prev.trim()) return template(year);
        // 切年份: 旧标题若是其它年份的同款模板, 就更新年份段
        const m = prev.match(/^(\d{4})\s+年度重庆市生态文明传播指数排行榜及解读$/);
        if (m && Number(m[1]) !== year) return template(year);
        return prev;
      });
    }
  }, [open, year]);

  // 选名单 / 切年份 → 实时调 previewScopeCoverage
  useEffect(() => {
    if (!open || !scopeId) {
      setPreview(null);
      return;
    }
    startPreview(async () => {
      try {
        const result = await previewScopeCoverage(scopeId, year);
        setPreview(result);
      } catch {
        setPreview(null);
      }
    });
  }, [open, scopeId, year]);

  const selectedScope = useMemo(
    () => scopes.find((s) => s.id === scopeId) ?? null,
    [scopes, scopeId],
  );
  const selectedDataset = useMemo(
    () => datasets.find((d) => d.id === datasetId) ?? null,
    [datasets, datasetId],
  );

  function reset() {
    setTitle("");
    setYear(currentYear);
    setScopeId(defaultScope?.id ?? "");
    setDatasetId(defaultDataset?.id ?? "");
    setIncludeContentSource(true);
    setPreview(null);
  }

  async function handleSubmit() {
    if (!title.trim()) {
      toast.error("请输入报告标题");
      return;
    }
    if (!scopeId) {
      toast.error("请选择媒体名单");
      return;
    }
    if (!datasetId) {
      toast.error("请选择活动数据集");
      return;
    }
    setSubmitting(true);
    try {
      const result = await createEcologicalIndexReportAction({
        title: title.trim(),
        year,
        scopeId,
        activityDatasetId: datasetId,
        includeContentSource,
      });
      toast.success("已提交生成请求,流水线异步执行中");
      reset();
      onOpenChange(false);
      onCreated(result.reportId);
      router.refresh();
    } catch (err) {
      toast.error(`提交失败:${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  const hasScope = scopes.length > 0;
  const hasDataset = datasets.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !submitting) reset();
        if (!submitting) onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>新建指数体系报告</DialogTitle>
          <DialogDescription>
            选定媒体名单与年度活动数据集后,系统将异步生成排行榜 docx、可验证 xlsx 与内容池数据源。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 标题 */}
          <div className="space-y-1.5">
            <Label htmlFor="eco-title">报告标题 *</Label>
            <Input
              id="eco-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例:2025 年度重庆市生态文明传播指数排行榜及解读"
              maxLength={120}
              disabled={submitting}
            />
          </div>

          {/* 年份 */}
          <div className="space-y-1.5">
            <Label htmlFor="eco-year">统计年份 *</Label>
            <Select
              value={String(year)}
              onValueChange={(v) => setYear(Number(v))}
              disabled={submitting}
            >
              <SelectTrigger id="eco-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              时间窗口:{year}-01-01 ~ {year + 1}-01-01
            </p>
          </div>

          {/* 媒体名单 */}
          <div className="space-y-1.5">
            <Label htmlFor="eco-scope">媒体名单 *</Label>
            {!hasScope ? (
              <p className="text-sm text-rose-600 dark:text-rose-400">
                暂无媒体名单,请先到{" "}
                <a
                  href="/data-collection/reports/resources"
                  className="underline"
                >
                  资源管理
                </a>{" "}
                上传 xlsx
              </p>
            ) : (
              <Select
                value={scopeId}
                onValueChange={setScopeId}
                disabled={submitting}
              >
                <SelectTrigger id="eco-scope">
                  <SelectValue placeholder="选择媒体名单" />
                </SelectTrigger>
                <SelectContent>
                  {scopes.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}({s.totalUnits} 单位)
                      {s.isDefault ? " · 默认" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedScope && (
              <p className="text-xs text-muted-foreground">
                央 {selectedScope.centralCount} · 业 {selectedScope.industryCount}{" "}
                · 市 {selectedScope.municipalCount} · 融{" "}
                {selectedScope.districtRmtCount} · 政{" "}
                {selectedScope.districtGovCount}
              </p>
            )}
            {previewPending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                预估覆盖率中...
              </div>
            )}
            {!previewPending && preview && (
              <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
                <div>
                  预计匹配 outlet:{" "}
                  <strong className="text-foreground">
                    {preview.matchedOutletCount}
                  </strong>{" "}
                  个
                </div>
                <div>
                  预计覆盖 items:{" "}
                  <strong className="text-foreground">
                    {preview.itemsInScope.toLocaleString()}
                  </strong>{" "}
                  条{" "}
                  {preview.itemsTotal > 0
                    ? `(保留率 ${preview.retentionPct.toFixed(1)}%)`
                    : "(暂无数据)"}
                </div>
                <div className="text-[10px]">
                  央 {preview.byTier.central.toLocaleString()} · 业{" "}
                  {preview.byTier.industry.toLocaleString()} · 市{" "}
                  {preview.byTier.municipal.toLocaleString()} · 区{" "}
                  {preview.byTier.district.toLocaleString()}
                </div>
                {preview.matchedOutletCount === 0 && (
                  <div className="text-rose-600 dark:text-rose-400">
                    名单尚未解析至 outlet,请先在资源管理页对该名单做匹配
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 活动数据集 */}
          <div className="space-y-1.5">
            <Label htmlFor="eco-dataset">活动数据集 *</Label>
            {!hasDataset ? (
              <p className="text-sm text-rose-600 dark:text-rose-400">
                暂无活动数据集,请先到{" "}
                <a
                  href="/data-collection/reports/resources?tab=datasets"
                  className="underline"
                >
                  资源管理
                </a>{" "}
                上传 xlsx
              </p>
            ) : (
              <Select
                value={datasetId}
                onValueChange={setDatasetId}
                disabled={submitting}
              >
                <SelectTrigger id="eco-dataset">
                  <SelectValue placeholder="选择活动数据集" />
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}({d.year} · {d.districtCount} 区县 ·{" "}
                      {d.totalActivities} 场){d.isDefault ? " · 默认" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedDataset && (
              <p className="text-xs text-muted-foreground">
                {selectedDataset.totalActivities} 场活动 ·{" "}
                {selectedDataset.activityThemes.length} 主题
              </p>
            )}
          </div>

          {/* 同时生成数据源 */}
          <div className="flex items-start gap-2">
            <Checkbox
              id="eco-include-content"
              checked={includeContentSource}
              onCheckedChange={(v) => setIncludeContentSource(v === true)}
              disabled={submitting}
            />
            <div className="space-y-0.5">
              <Label
                htmlFor="eco-include-content"
                className="text-sm font-normal cursor-pointer"
              >
                同时生成内容池数据源 xlsx
              </Label>
              <p className="text-xs text-muted-foreground">
                按 4 个 tier 拆 4 个独立 xlsx(中央/行业/市级/区县),含正文/OCR/ASR 等 32 列。
                可在详情页单独下载。生成耗时增加约 30-60 秒。
              </p>
            </div>
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
          <Button
            onClick={handleSubmit}
            disabled={
              submitting || !scopeId || !datasetId || !hasScope || !hasDataset
            }
          >
            {submitting && <Loader2 className="size-4 mr-1.5 animate-spin" />}
            {submitting ? "提交中..." : "生成报告"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
