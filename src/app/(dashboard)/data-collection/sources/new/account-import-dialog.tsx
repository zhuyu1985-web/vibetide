"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/shared/data-table";
import { parseExcelFile, type ParsedExcel } from "@/lib/collection/bulk-import/parse";
import { OUTLET_TIER_LABELS, type OutletTier } from "@/lib/collection/constants";
import {
  downloadAccountImportTemplate,
  previewAccountImport,
  confirmAccountImport,
} from "@/app/actions/account-import";
import {
  type PreviewRow,
  type ImportedOutletOption,
} from "@/lib/collection/account-import-helpers";

// 每批送后端解析/搜索的行数 — 与计划一致(避免长搜索超时)
const PREVIEW_BATCH = 25;

interface Props {
  open: boolean;
  onClose: () => void;
  onComplete: (result: {
    outletIds: string[];
    outlets: ImportedOutletOption[];
  }) => void;
}

type Step = "upload" | "review" | "done";

function formatFollower(n: number | null): string {
  if (n == null) return "—";
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return String(n);
}

export function AccountImportDialog({ open, onClose, onComplete }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [parsed, setParsed] = useState<ParsedExcel | null>(null);
  const [parsing, setParsing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [searchCost, setSearchCost] = useState(0);

  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    merged: number;
    skipped: number;
    outletIds: string[];
    outlets: ImportedOutletOption[];
  } | null>(null);

  function reset() {
    setStep("upload");
    setParsed(null);
    setParsing(false);
    setRows([]);
    setPreviewLoading(false);
    setPreviewProgress(0);
    setPreviewTotal(0);
    setSearchCost(0);
    setConfirming(false);
    setResult(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleDownloadTemplate() {
    setDownloading(true);
    try {
      const { base64, filename } = await downloadAccountImportTemplate();
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(`模板生成失败：${(err as Error).message}`);
    } finally {
      setDownloading(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    try {
      const r = await parseExcelFile(file);
      setParsed(r);
    } catch (err) {
      toast.error(`解析失败：${(err as Error).message}`);
    } finally {
      setParsing(false);
    }
  }

  async function startPreview() {
    if (!parsed) return;
    setStep("review");
    setPreviewLoading(true);
    setPreviewProgress(0);
    setPreviewTotal(parsed.totalRows);
    setRows([]);
    const all: PreviewRow[] = [];
    let cost = 0;
    try {
      for (let i = 0; i < parsed.rows.length; i += PREVIEW_BATCH) {
        const batch = parsed.rows.slice(i, i + PREVIEW_BATCH);
        const { previewRows, totalSearchCostUsd } = await previewAccountImport(batch);
        previewRows.forEach((r, j) => {
          r.rowIndex = i + j; // 转成全局行号(后端按批内 index 编号)
        });
        all.push(...previewRows);
        cost += totalSearchCostUsd;
        setRows([...all]);
        setPreviewProgress(Math.min(i + PREVIEW_BATCH, parsed.totalRows));
      }
      setSearchCost(cost);
    } catch (err) {
      toast.error(`解析失败：${(err as Error).message}`);
    } finally {
      setPreviewLoading(false);
    }
  }

  function updateIdentifier(rowIndex: number, value: string) {
    const v = value.trim();
    setRows((prev) =>
      prev.map((r) => {
        if (r.rowIndex !== rowIndex) return r;
        if (!v) {
          return { ...r, identifier: null, status: "error", reason: "账号 ID 为空" };
        }
        // 手动改过 → 视为人工确认就绪
        return {
          ...r,
          identifier: v,
          status: "ok",
          matchSource: "id",
          reason: undefined,
        };
      }),
    );
  }

  function removeRow(rowIndex: number) {
    setRows((prev) => prev.filter((r) => r.rowIndex !== rowIndex));
  }

  async function handleConfirm() {
    const importable = rows.filter((r) => r.status !== "error" && r.identifier);
    if (importable.length === 0) {
      toast.error("没有可导入的行（请先补全账号 ID 或修正错误行）");
      return;
    }
    setConfirming(true);
    try {
      const res = await confirmAccountImport(
        importable.map((r) => ({
          outletName: r.outletName,
          platform: r.platform,
          nickname: r.nickname || r.outletName,
          identifier: r.identifier!,
          profileUrl: r.profileUrl,
          outletTier: r.outletTier as OutletTier,
          outletRegion: r.outletRegion,
          groupName: r.groupName,
          description: r.description,
        })),
      );
      setResult({
        created: res.created,
        merged: res.merged,
        skipped: res.skipped,
        outletIds: res.outletIds,
        outlets: res.outlets,
      });
      setStep("done");
    } catch (err) {
      toast.error(`导入失败：${(err as Error).message}`);
    } finally {
      setConfirming(false);
    }
  }

  function finish() {
    if (result) {
      onComplete({ outletIds: result.outletIds, outlets: result.outlets });
    }
    handleClose();
  }

  const counts = {
    auto: rows.filter((r) => r.status === "auto").length,
    ok: rows.filter((r) => r.status === "ok").length,
    duplicate: rows.filter((r) => r.status === "duplicate").length,
    error: rows.filter((r) => r.status === "error").length,
  };
  const importableCount = rows.filter((r) => r.status !== "error" && r.identifier).length;
  const previewPercent =
    previewTotal > 0 ? Math.round((previewProgress / previewTotal) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>批量导入抖音号</DialogTitle>
          <p className="text-sm text-muted-foreground">
            下载模板 → 填好上传 → 核对 → 一键建库并选入本采集源
          </p>
        </DialogHeader>

        {/* ── Step 1: 上传 ── */}
        {step === "upload" && (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/20 p-4 space-y-3">
              <div className="text-sm font-medium">第一步：下载标准模板</div>
              <p className="text-xs text-muted-foreground">
                最省事：只填「媒体名称」一列，系统会自动搜索并匹配「已认证 + 粉丝最高」的抖音号。
                想精确指定就填主页链接或 secUid。分级/区域留空默认「政务新媒体 / 全国」。
              </p>
              <Button variant="ghost" onClick={handleDownloadTemplate} disabled={downloading}>
                {downloading ? "生成中..." : "下载标准模板"}
              </Button>
            </div>

            <div className="rounded-md border p-4 space-y-3">
              <div className="text-sm font-medium">第二步：上传填好的 Excel</div>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv,.tsv"
                onChange={handleFileChange}
                disabled={parsing}
              />
              {parsing && <p className="text-sm text-muted-foreground">解析中...</p>}
              {parsed && (
                <div className="rounded border p-3 text-sm space-y-1">
                  <div>文件名：{parsed.fileName}</div>
                  <div>工作表：{parsed.sheetName}</div>
                  <div>共 {parsed.totalRows} 行</div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={handleClose}>
                取消
              </Button>
              <Button onClick={startPreview} disabled={!parsed}>
                下一步：解析并核对
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── Step 2: 预览核对 ── */}
        {step === "review" && (
          <div className="space-y-4">
            {previewLoading ? (
              <div className="space-y-3 py-6">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>
                    正在解析并自动匹配抖音号... {previewProgress} / {previewTotal}
                  </span>
                  <span>{previewPercent}%</span>
                </div>
                <div className="h-2 rounded bg-muted overflow-hidden">
                  <div
                    className="h-full rounded bg-primary transition-all duration-300"
                    style={{ width: `${previewPercent}%` }}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-1">
                    就绪 {counts.ok}
                  </span>
                  <span className="rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-1">
                    自动匹配·请核对 {counts.auto}
                  </span>
                  <span className="rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1">
                    已存在·将合并 {counts.duplicate}
                  </span>
                  <span className="rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-1">
                    待补 secUid {counts.error}
                  </span>
                  {searchCost > 0 && (
                    <span className="ml-auto text-muted-foreground">
                      本次搜索约 ${searchCost.toFixed(4)}
                    </span>
                  )}
                </div>

                <div className="h-[380px] overflow-y-auto">
                  <DataTable
                    framed={false}
                    rows={rows}
                    rowKey={(r) => String(r.rowIndex)}
                    emptyMessage="没有可导入的行"
                    columns={[
                      {
                        key: "outletName",
                        header: "媒体名称",
                        width: "w-28",
                        render: (r) => (
                          <span className="truncate font-medium">{r.outletName}</span>
                        ),
                      },
                      {
                        key: "platform",
                        header: "平台",
                        width: "w-16",
                        render: (r) => (
                          <span className="text-xs text-muted-foreground">{r.platformLabel}</span>
                        ),
                      },
                      {
                        key: "nickname",
                        header: "昵称",
                        width: "w-24",
                        render: (r) => (
                          <span className="truncate text-muted-foreground">
                            {r.nickname || "—"}
                          </span>
                        ),
                      },
                      {
                        key: "fans",
                        header: "粉丝 / 认证",
                        width: "w-24",
                        render: (r) => (
                          <span className="text-xs text-muted-foreground">
                            {formatFollower(r.followerCount)}
                            {r.verified === true && " · 已认证"}
                          </span>
                        ),
                      },
                      {
                        key: "identifier",
                        header: "账号ID",
                        render: (r) => (
                          <Input
                            value={r.identifier ?? ""}
                            onChange={(e) => updateIdentifier(r.rowIndex, e.target.value)}
                            placeholder={r.identifierLabel}
                            className="h-8 text-xs"
                            title={r.identifier ?? ""}
                          />
                        ),
                      },
                      {
                        key: "meta",
                        header: "分级 / 区域",
                        width: "w-28",
                        render: (r) => (
                          <span className="text-xs text-muted-foreground">
                            {OUTLET_TIER_LABELS[r.outletTier as OutletTier] ?? r.outletTier}
                            {" / "}
                            {r.outletRegion}
                          </span>
                        ),
                      },
                      {
                        key: "status",
                        header: "状态",
                        width: "w-32",
                        render: (r) => <StatusBadge row={r} />,
                      },
                      {
                        key: "action",
                        header: "",
                        width: "w-10",
                        align: "center",
                        render: (r) => (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => removeRow(r.rowIndex)}
                            title="删除此行"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        ),
                      },
                    ]}
                  />
                </div>

                <DialogFooter>
                  <Button variant="ghost" onClick={() => setStep("upload")}>
                    上一步
                  </Button>
                  <Button onClick={handleConfirm} disabled={confirming || importableCount === 0}>
                    {confirming ? "导入中..." : `确认导入（${importableCount} 行）`}
                  </Button>
                </DialogFooter>
              </>
            )}
          </div>
        )}

        {/* ── Step 3: 完成 ── */}
        {step === "done" && result && (
          <div className="space-y-4">
            <div className="rounded border-2 border-emerald-500/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-5 text-center space-y-2">
              <div className="font-medium text-emerald-700 dark:text-emerald-400">
                导入完成！
              </div>
              <div className="text-sm text-muted-foreground">
                新建媒体 {result.created} · 合并到已有 {result.merged} · 跳过重复 {result.skipped}
              </div>
              <div className="text-xs text-muted-foreground">
                已自动选入本采集源，共 {result.outletIds.length} 个媒体
              </div>
            </div>
            <DialogFooter>
              <Button onClick={finish}>完成</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ row }: { row: PreviewRow }) {
  const map: Record<PreviewRow["status"], { label: string; cls: string }> = {
    ok: {
      label: "就绪",
      cls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
    },
    auto: {
      label: "请核对",
      cls: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
    },
    duplicate: {
      label: "已存在",
      cls: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
    },
    error: {
      label: "待补",
      cls: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
    },
  };
  const { label, cls } = map[row.status];
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] ${cls}`} title={row.reason ?? ""}>
      {label}
    </span>
  );
}
