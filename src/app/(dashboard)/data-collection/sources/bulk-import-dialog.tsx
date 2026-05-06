"use client";

import { useState } from "react";
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
import { parseExcelFile, type ParsedExcel } from "@/lib/collection/bulk-import/parse";
import { matchColumns } from "@/lib/collection/bulk-import/field-mapper";
import {
  CONTENT_TYPE_VALUES,
  CONTENT_TYPE_LABELS,
  OUTLET_TIER_VALUES,
  OUTLET_TIER_LABELS,
} from "@/lib/collection/constants";

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
  }

  const stepNumber: Record<Step, number> = {
    upload: 1,
    mapping: 2,
    preview: 3,
    execute: 4,
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && (reset(), onClose())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>批量导入 Excel/CSV</DialogTitle>
          <p className="text-sm text-muted-foreground">
            步骤 {stepNumber[step]} / 4
          </p>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <Input
              type="file"
              accept=".xlsx,.xls,.csv,.ods,.tsv"
              onChange={handleFileChange}
              disabled={parsing}
            />
            {parsing && (
              <p className="text-sm text-muted-foreground">解析中...</p>
            )}
            {parsed && (
              <div className="rounded border p-3 text-sm space-y-1">
                <div>文件名：{parsed.fileName}</div>
                <div>工作表：{parsed.sheetName}</div>
                <div>列数：{parsed.columns.length}</div>
                <div>行数：{parsed.totalRows}</div>
                {parsed.totalRows > 50000 && (
                  <div className="text-amber-600">
                    超过 50000 行建议拆分文件
                  </div>
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

        {/* preview / execute Step 在 Phase 2 Task 2.3 / 2.4 实现 */}
        {(step === "preview" || step === "execute") && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              试运行与全量执行功能将在 Phase 2 实现。
            </p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep("mapping")}>
                上一步
              </Button>
              <Button variant="ghost" onClick={() => { reset(); onClose(); }}>
                关闭
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────
// Step 2: 字段映射
// ────────────────────────────────────────────────

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
        <div className="font-medium text-sm">
          字段映射（系统已自动猜测，可手动修改）
        </div>
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

        {/* 默认 contentType */}
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

        {/* 默认 outletTier */}
        <div className="flex items-center gap-2">
          <label className="text-sm w-40 shrink-0">默认 outletTier</label>
          <Select
            value={defaults.outletTier ?? "__none__"}
            onValueChange={(v) =>
              setDefaults({
                ...defaults,
                outletTier: v === "__none__" ? null : v,
              })
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

        {/* 默认 outletRegion */}
        <div className="flex items-center gap-2">
          <label className="text-sm w-40 shrink-0">默认 outletRegion</label>
          <Input
            value={defaults.outletRegion}
            onChange={(e) =>
              setDefaults({ ...defaults, outletRegion: e.target.value })
            }
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
