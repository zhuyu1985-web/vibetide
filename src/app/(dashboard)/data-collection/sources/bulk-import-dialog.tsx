"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/shared/data-table";
import { parseExcelFile, type ParsedExcel } from "@/lib/collection/bulk-import/parse";
import { matchColumns } from "@/lib/collection/bulk-import/field-mapper";
import {
  CONTENT_TYPE_VALUES,
  CONTENT_TYPE_LABELS,
  OUTLET_TIER_VALUES,
  OUTLET_TIER_LABELS,
} from "@/lib/collection/constants";
import {
  previewBulkImport,
  executeBulkImport,
  type PreviewResult,
} from "@/app/actions/bulk-import";
import type { ImportMapping, ImportDefaults } from "@/lib/collection/bulk-import/transform";
import { downloadErrorCsv, type ErrorRow } from "./bulk-import-error-csv";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Step = "upload" | "mapping" | "preview" | "execute";

interface BulkImportDefaults {
  contentType: string;
  outletTier: string | null;
  outletRegion: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Root Dialog
// ─────────────────────────────────────────────────────────────────────────────

export function BulkImportDialog({ open, onClose, onComplete }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [parsed, setParsed] = useState<ParsedExcel | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [defaults, setDefaults] = useState<BulkImportDefaults>({
    contentType: "image_text",
    outletTier: null,
    outletRegion: "",
  });
  const [parsing, setParsing] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    try {
      const result = await parseExcelFile(file);
      setParsed(result);
      setMapping(matchColumns(result.columns));
    } catch (err) {
      toast.error(`解析失败：${(err as Error).message}`);
    } finally {
      setParsing(false);
    }
  }

  function reset() {
    setStep("upload");
    setParsed(null);
    setMapping({});
    setDefaults({ contentType: "image_text", outletTier: null, outletRegion: "" });
  }

  const stepNumber: Record<Step, number> = {
    upload: 1,
    mapping: 2,
    preview: 3,
    execute: 4,
  };

  // Coerce to ImportDefaults for server action
  function asImportDefaults(): ImportDefaults {
    return {
      contentType: (defaults.contentType as ImportDefaults["contentType"]) ?? "image_text",
      outletTier: defaults.outletTier,
      outletRegion: defaults.outletRegion || null,
    };
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && (reset(), onClose())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>批量导入 Excel/CSV</DialogTitle>
          <p className="text-sm text-muted-foreground">步骤 {stepNumber[step]} / 4</p>
        </DialogHeader>

        {/* ── Step 1: 上传 ── */}
        {step === "upload" && (
          <div className="space-y-4">
            <Input
              type="file"
              accept=".xlsx,.xls,.csv,.ods,.tsv"
              onChange={handleFileChange}
              disabled={parsing}
            />
            {parsing && <p className="text-sm text-muted-foreground">解析中...</p>}
            {parsed && (
              <div className="rounded border p-3 text-sm space-y-1">
                <div>文件名：{parsed.fileName}</div>
                <div>工作表：{parsed.sheetName}</div>
                <div>列数：{parsed.columns.length}</div>
                <div>行数：{parsed.totalRows}</div>
                {parsed.totalRows > 50000 && (
                  <div className="text-amber-600">超过 50000 行建议拆分文件</div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>
                取消
              </Button>
              <Button onClick={() => setStep("mapping")} disabled={!parsed}>
                下一步
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── Step 2: 字段映射 ── */}
        {step === "mapping" && parsed && (
          <MappingStep
            parsed={parsed}
            mapping={mapping}
            setMapping={setMapping}
            defaults={defaults}
            setDefaults={setDefaults}
            onBack={() => setStep("upload")}
            onNext={() => setStep("preview")}
          />
        )}

        {/* ── Step 3: 试运行 ── */}
        {step === "preview" && parsed && (
          <PreviewStep
            parsed={parsed}
            mapping={mapping as ImportMapping}
            defaults={asImportDefaults()}
            onBack={() => setStep("mapping")}
            onExecute={() => setStep("execute")}
          />
        )}

        {/* ── Step 4: 全量执行 ── */}
        {step === "execute" && parsed && (
          <ExecuteStep
            parsed={parsed}
            mapping={mapping as ImportMapping}
            defaults={asImportDefaults()}
            onComplete={() => {
              reset();
              onComplete();
              toast.success("导入完成");
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: 字段映射
// ─────────────────────────────────────────────────────────────────────────────

const FIELD_DEFS: Array<{ key: string; label: string; required?: boolean }> = [
  { key: "title", label: "标题 *", required: true },
  { key: "content", label: "正文" },
  { key: "summary", label: "摘要" },
  { key: "canonicalUrl", label: "原文链接" },
  { key: "publishedAt", label: "发布时间" },
  { key: "outletName", label: "媒体名（用于自动识别）" },
  { key: "outletTier", label: "媒体分级（可填可默认）" },
  { key: "outletRegion", label: "区域" },
  { key: "contentType", label: "内容类型" },
];

function MappingStep({
  parsed,
  mapping,
  setMapping,
  defaults,
  setDefaults,
  onBack,
  onNext,
}: {
  parsed: ParsedExcel;
  mapping: Record<string, string | null>;
  setMapping: (m: Record<string, string | null>) => void;
  defaults: BulkImportDefaults;
  setDefaults: (d: BulkImportDefaults) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const titleMissing = !mapping.title;

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
      <div className="rounded border p-3 text-sm">
        <div className="font-medium mb-2">前 5 行预览</div>
        <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all">
          {JSON.stringify(parsed.rows.slice(0, 5), null, 2)}
        </pre>
      </div>

      <div className="space-y-2">
        <div className="font-medium text-sm">字段映射（系统已自动猜测，可手动修改）</div>
        {FIELD_DEFS.map((f) => (
          <div key={f.key} className="flex items-center gap-2">
            <label className="text-sm w-40 shrink-0">{f.label}</label>
            <Select
              value={mapping[f.key] ?? "__none__"}
              onValueChange={(v) =>
                setMapping({ ...mapping, [f.key]: v === "__none__" ? null : v })
              }
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">未映射</SelectItem>
                {parsed.columns.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t pt-3">
        <div className="font-medium text-sm">默认值（未映射字段使用）</div>

        <div className="flex items-center gap-2">
          <label className="text-sm w-40 shrink-0">默认 contentType</label>
          <Select
            value={defaults.contentType}
            onValueChange={(v) => setDefaults({ ...defaults, contentType: v })}
          >
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTENT_TYPE_VALUES.map((t) => (
                <SelectItem key={t} value={t}>
                  {CONTENT_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm w-40 shrink-0">默认 outletTier</label>
          <Select
            value={defaults.outletTier ?? "__none__"}
            onValueChange={(v) =>
              setDefaults({ ...defaults, outletTier: v === "__none__" ? null : v })
            }
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="无" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">无</SelectItem>
              {OUTLET_TIER_VALUES.map((t) => (
                <SelectItem key={t} value={t}>
                  {OUTLET_TIER_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm w-40 shrink-0">默认 outletRegion</label>
          <Input
            value={defaults.outletRegion}
            onChange={(e) => setDefaults({ ...defaults, outletRegion: e.target.value })}
            placeholder="重庆 / 全国 ..."
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onBack}>
          上一步
        </Button>
        <Button onClick={onNext} disabled={titleMissing}>
          下一步
        </Button>
      </DialogFooter>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3: 试运行（Task 2.3）
// ─────────────────────────────────────────────────────────────────────────────

function PreviewStep({
  parsed,
  mapping,
  defaults,
  onBack,
  onExecute,
}: {
  parsed: ParsedExcel;
  mapping: ImportMapping;
  defaults: ImportDefaults;
  onBack: () => void;
  onExecute: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<PreviewResult | null>(null);

  useEffect(() => {
    setLoading(true);
    previewBulkImport({
      sampleRows: parsed.rows.slice(0, 100),
      mapping,
      defaults,
    })
      .then((r) => {
        setResult(r);
        setLoading(false);
      })
      .catch((err) => {
        toast.error(`试运行失败：${(err as Error).message}`);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground">试运行扫描中...</div>;
  }
  if (!result) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded border p-3">
          <div className="text-2xl font-medium text-emerald-600">{result.hitDictCount}</div>
          <div className="text-xs text-muted-foreground">命中字典 outlet</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-2xl font-medium text-amber-600">{result.skippedDuplicateCount}</div>
          <div className="text-xs text-muted-foreground">已存在跳过</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-2xl font-medium text-red-600">{result.errorRows.length}</div>
          <div className="text-xs text-muted-foreground">错误行（前 100）</div>
        </div>
      </div>

      {result.errorRows.length > 0 && (
        <div>
          <div className="text-sm font-medium mb-2">错误样本</div>
          <DataTable
            rows={result.errorRows}
            rowKey={(r) => `${r.rowIndex}`}
            columns={[
              {
                key: "rowIndex",
                header: "行号",
                width: "w-16",
                render: (r) => `#${r.rowIndex + 1}`,
              },
              {
                key: "reason",
                header: "错误原因",
                render: (r) => <span className="text-red-600 text-xs">{r.reason}</span>,
              },
              {
                key: "row",
                header: "Excel 数据",
                render: (r) => (
                  <pre className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {JSON.stringify(r.row).slice(0, 80)}…
                  </pre>
                ),
              },
            ]}
          />
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        扫描了前 {result.totalScanned} 行。全量执行将跳过错误行继续写入。
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onBack}>
          上一步
        </Button>
        <Button onClick={onExecute}>
          跳过错误行，执行全量（{parsed.totalRows} 行）
        </Button>
      </DialogFooter>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4: 全量执行（Task 2.4）
// ─────────────────────────────────────────────────────────────────────────────

const BATCH_SIZE = 500;

function ExecuteStep({
  parsed,
  mapping,
  defaults,
  onComplete,
}: {
  parsed: ParsedExcel;
  mapping: ImportMapping;
  defaults: ImportDefaults;
  onComplete: () => void;
}) {
  const totalBatches = Math.max(1, Math.ceil(parsed.totalRows / BATCH_SIZE));

  const [progress, setProgress] = useState(0); // 已完成批次数
  const [stats, setStats] = useState({ inserted: 0, skipped: 0, failed: 0 });
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let currentRunId: string | undefined;
    const allErrors: ErrorRow[] = [];

    async function runBatches() {
      for (let i = 0; i < totalBatches; i++) {
        if (cancelled) break;
        const batchRows = parsed.rows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        try {
          const result = await executeBulkImport({
            rows: batchRows,
            mapping,
            defaults,
            batchIndex: i,
            totalBatches,
            runId: currentRunId,
          });
          if (!currentRunId) currentRunId = result.runId;
          setStats((s) => ({
            inserted: s.inserted + result.batchInserted,
            skipped: s.skipped + result.batchSkipped,
            failed: s.failed + result.batchFailed,
          }));
          allErrors.push(...result.errorRows);
          setErrors([...allErrors]);
          setProgress(i + 1);
        } catch (err) {
          toast.error(`批次 ${i + 1} 失败：${(err as Error).message}`);
          // 不中断，继续下一批
          setProgress(i + 1);
        }
      }
      if (!cancelled) setDone(true);
    }

    runBatches();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const processedRows = Math.min(progress * BATCH_SIZE, parsed.totalRows);
  const percent = totalBatches > 0 ? Math.round((progress / totalBatches) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-sm mb-1 text-muted-foreground">
          <span>
            {processedRows} / {parsed.totalRows} 行（{percent}%）
          </span>
          <span>
            {progress} / {totalBatches} 批次
          </span>
        </div>
        <div className="h-2 rounded bg-muted overflow-hidden">
          <div
            className="h-full rounded bg-primary transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* 实时计数卡片 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded border p-3">
          <div className="text-xl font-medium text-emerald-600">{stats.inserted}</div>
          <div className="text-xs text-muted-foreground">已入库</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xl font-medium text-amber-600">{stats.skipped}</div>
          <div className="text-xs text-muted-foreground">跳过重复</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xl font-medium text-red-600">{stats.failed}</div>
          <div className="text-xs text-muted-foreground">失败</div>
        </div>
      </div>

      {/* 完成横幅 */}
      {done && (
        <div className="rounded border-2 border-emerald-500/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 text-center space-y-2">
          <div className="font-medium text-emerald-700 dark:text-emerald-400">导入完成！</div>
          <div className="text-sm text-muted-foreground">
            共 {parsed.totalRows} 行 / 入库 {stats.inserted} / 跳过重复 {stats.skipped} / 失败{" "}
            {stats.failed}
          </div>
          {errors.length > 0 && (
            <Button
              variant="ghost"
              onClick={() => downloadErrorCsv(errors)}
            >
              下载错误清单 CSV（{errors.length} 行）
            </Button>
          )}
        </div>
      )}

      <DialogFooter>
        <Button onClick={onComplete} disabled={!done}>
          关闭
        </Button>
      </DialogFooter>
    </div>
  );
}
