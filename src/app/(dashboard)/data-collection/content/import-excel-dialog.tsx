"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Upload, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  detectOpinionFormat,
  importOpinionBatch,
} from "@/app/actions/bulk-import";

const BATCH_SIZE = 500;

type Phase = "idle" | "parsing" | "importing" | "done" | "error";

interface ImportStats {
  inserted: number;
  merged: number;
  failed: number;
  skipped: number;
  errors: Array<{ rowIndex: number; reason: string }>;
}

interface ImportExcelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportExcelDialog({ open, onOpenChange }: ImportExcelDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0); // 0..100
  const [totalRows, setTotalRows] = useState(0);
  const [processedRows, setProcessedRows] = useState(0);
  const [stats, setStats] = useState<ImportStats>({
    inserted: 0,
    merged: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  });
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const reset = useCallback(() => {
    setFile(null);
    setPhase("idle");
    setProgress(0);
    setTotalRows(0);
    setProcessedRows(0);
    setStats({ inserted: 0, merged: 0, failed: 0, skipped: 0, errors: [] });
    setErrMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleClose = useCallback(
    (next: boolean) => {
      // 导入中不允许关闭
      if (phase === "parsing" || phase === "importing") return;
      onOpenChange(next);
      if (!next) {
        // 关闭后刷新页面数据
        if (phase === "done") router.refresh();
        // 延迟 reset 等动画
        setTimeout(reset, 300);
      }
    },
    [phase, onOpenChange, router, reset],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setErrMsg(null);
  };

  const handleImport = useCallback(async () => {
    if (!file) return;
    setErrMsg(null);
    setPhase("parsing");

    try {
      // 客户端解析 Excel(避免大文件经 form-data 上传)
      const XLSX = await import("@e965/xlsx");
      const buffer = await file.arrayBuffer();
      const isCSV = /\.(csv|tsv)$/i.test(file.name);
      const wb = XLSX.read(buffer, {
        cellDates: true,
        ...(isCSV ? { type: "array", codepage: 65001 } : {}),
      });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) throw new Error("Excel 不含工作表");
      const sheet = wb.Sheets[sheetName]!;
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        raw: false,
        defval: "",
      });
      if (rawRows.length === 0) throw new Error("工作表为空");

      // Next.js 16 Server Action 只接受 plain object — Date / Buffer 等 class 实例会被拒绝。
      // SheetJS 在 cellDates:true 下日期单元格是 Date 实例,需要先转 ISO 字符串。
      // 服务端 transformer 的 date() 工具能 parse ISO 字符串回 Date。
      const rows = rawRows.map((row) => {
        const clean: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(row)) {
          clean[k] = v instanceof Date ? v.toISOString() : v;
        }
        return clean;
      });

      const columns = Object.keys(rows[0]!);
      const isOpinion = await detectOpinionFormat(columns);
      if (!isOpinion) {
        throw new Error(
          "未识别为舆情数据格式。请确认列名包含:标题、作者昵称、平台、情感倾向、点赞数、链接 等。",
        );
      }

      setTotalRows(rows.length);
      setPhase("importing");

      const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
      let runId: string | undefined;
      const agg: ImportStats = { inserted: 0, merged: 0, failed: 0, skipped: 0, errors: [] };

      for (let bi = 0; bi < totalBatches; bi++) {
        const slice = rows.slice(bi * BATCH_SIZE, (bi + 1) * BATCH_SIZE);
        // server action call
        const result = await importOpinionBatch({
          rows: slice,
          batchIndex: bi,
          totalBatches,
          runId,
        });
        runId = result.runId;
        agg.inserted += result.batchInserted;
        agg.merged += result.batchSkipped;
        agg.failed += result.batchFailed;
        for (const e of result.errorRows) {
          if (e.reason === "标题为空,跳过") agg.skipped++;
          else if (agg.errors.length < 20) agg.errors.push(e);
        }

        const processed = Math.min((bi + 1) * BATCH_SIZE, rows.length);
        setProcessedRows(processed);
        setProgress(Math.round((processed / rows.length) * 100));
        setStats({ ...agg });
      }

      setPhase("done");
      toast.success(`导入完成:新增 ${agg.inserted} 条,合并 ${agg.merged} 条`);
    } catch (e) {
      setPhase("error");
      const msg = e instanceof Error ? e.message : "导入失败";
      setErrMsg(msg);
      toast.error(msg);
    }
  }, [file]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            从 Excel 导入采集数据
          </DialogTitle>
          <DialogDescription>
            支持舆情数据 33 列模板(参考 <code className="text-xs">docs/data.xlsx</code>)。
            含标题、作者、平台、情感、互动指标、IP 属地、命中分析、OCR/ASR 等字段。
            相同标题 + 发布日期 + 链接的条目会自动合并(去重)。
          </DialogDescription>
        </DialogHeader>

        {/* idle / 选文件阶段 */}
        {(phase === "idle" || phase === "error") && (
          <div className="space-y-4">
            <label
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-8 cursor-pointer transition-colors",
                file
                  ? "border-primary/50 bg-primary/5"
                  : "border-gray-300 dark:border-gray-700 hover:border-primary/50 hover:bg-gray-50 dark:hover:bg-gray-900",
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.tsv"
                onChange={handleFileChange}
                className="sr-only"
              />
              <Upload className="h-8 w-8 text-muted-foreground" />
              {file ? (
                <div className="text-center">
                  <div className="text-sm font-medium">{file.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {(file.size / 1024 / 1024).toFixed(2)} MB · 点击重新选择
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">
                    点击选择 .xlsx / .xls / .csv 文件
                  </div>
                </div>
              )}
            </label>

            {errMsg && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>{errMsg}</div>
              </div>
            )}
          </div>
        )}

        {/* 解析/导入中 */}
        {(phase === "parsing" || phase === "importing") && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              {phase === "parsing"
                ? "正在解析 Excel…"
                : `正在导入 ${processedRows} / ${totalRows} 行…`}
            </div>
            {phase === "importing" && (
              <>
                <Progress value={progress} />
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <Stat label="新增" value={stats.inserted} color="text-emerald-600" />
                  <Stat label="合并去重" value={stats.merged} color="text-blue-600" />
                  <Stat label="跳过" value={stats.skipped + stats.failed} color="text-gray-500" />
                </div>
              </>
            )}
          </div>
        )}

        {/* 完成 */}
        {phase === "done" && (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
              导入完成
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="总行数" value={totalRows} />
              <Stat label="新增" value={stats.inserted} color="text-emerald-600" />
              <Stat label="合并去重" value={stats.merged} color="text-blue-600" />
              <Stat label="标题空跳过" value={stats.skipped} color="text-gray-500" />
            </div>
            {stats.errors.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  {stats.errors.length} 行有问题(查看详情)
                </summary>
                <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {stats.errors.map((e, i) => (
                    <li key={i} className="text-destructive">
                      行 {e.rowIndex + 2}:{e.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        <DialogFooter>
          {phase === "done" || phase === "error" ? (
            <Button onClick={() => handleClose(false)}>关闭</Button>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => handleClose(false)}
                disabled={phase === "parsing" || phase === "importing"}
              >
                取消
              </Button>
              <Button onClick={handleImport} disabled={!file || phase !== "idle"}>
                开始导入
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-md bg-muted/50 px-3 py-2">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={cn("text-lg font-medium tabular-nums", color)}>{value.toLocaleString()}</div>
    </div>
  );
}
