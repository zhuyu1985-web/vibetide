"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  Briefcase,
  X,
  Loader2,
  ArrowLeft,
  Sparkles,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  INDUSTRY_DIMENSIONS,
  MAX_INDUSTRIES_PER_TRACKING,
  type IndustryKey,
} from "@/lib/constants";
import {
  previewIndustryOutlines,
  type IndustryOutlinePreview,
} from "@/app/actions/hot-topics";

type Step = "select-industries" | "preview-outlines";

interface DeepTrackingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 用户在概要预览页选定后最终启动深度追踪——父组件调 startTopicMissionMulti */
  onConfirm: (industryKeys: IndustryKey[]) => Promise<void> | void;
  /** 父组件的"启动 mission" pending 状态 */
  isPending?: boolean;
  topicId: string | null;
  topicTitle?: string;
}

/**
 * 深度追踪两步 wizard：
 *
 *   Step 1 「行业选择」  → 选 1~5 个候选行业 → 点"生成概要"
 *   Step 2 「概要预览」 → 后台调 previewIndustryOutlines 拿 N 个概要卡 →
 *                        用户从中再勾选 ≥1 个 → 点"启动深度追踪"
 *                        → 父组件 onConfirm 拿到最终 industryKeys[]
 *
 * 这样用户先看概要再决定花成本生成完整稿件 + 合规审查；不喜欢的概要直接淘汰。
 */
export function IndustrySelectionDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
  topicId,
  topicTitle,
}: DeepTrackingDialogProps) {
  const [step, setStep] = useState<Step>("select-industries");

  // Step 1: 候选行业选择
  const [candidates, setCandidates] = useState<Set<IndustryKey>>(new Set());

  // Step 2: 概要预览结果 + 用户最终勾选
  const [outlines, setOutlines] = useState<IndustryOutlinePreview[]>([]);
  const [picked, setPicked] = useState<Set<IndustryKey>>(new Set());
  const [previewLoading, setPreviewLoading] = useState(false);

  // 关闭对话框时重置全部状态（开新一轮干净）
  useEffect(() => {
    if (!open) {
      setStep("select-industries");
      setCandidates(new Set());
      setOutlines([]);
      setPicked(new Set());
      setPreviewLoading(false);
    }
  }, [open]);

  const toggleCandidate = useCallback((key: IndustryKey) => {
    setCandidates((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        return next;
      }
      if (next.size >= MAX_INDUSTRIES_PER_TRACKING) return prev;
      next.add(key);
      return next;
    });
  }, []);

  const togglePicked = useCallback((key: IndustryKey) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Step 1 → Step 2：调 previewIndustryOutlines
  const handleGenerateOutlines = useCallback(async () => {
    if (!topicId || candidates.size === 0) return;
    setPreviewLoading(true);
    try {
      const res = await previewIndustryOutlines(topicId, [...candidates]);
      setOutlines(res);
      setPicked(new Set(res.map((o) => o.industryKey))); // 默认全选
      setStep("preview-outlines");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "概要生成失败";
      toast.error(msg);
    } finally {
      setPreviewLoading(false);
    }
  }, [topicId, candidates]);

  const handleBackToSelect = useCallback(() => {
    setStep("select-industries");
  }, []);

  const handleFinalConfirm = useCallback(async () => {
    if (picked.size === 0) return;
    await onConfirm([...picked]);
  }, [picked, onConfirm]);

  const counterColor = useMemo(() => {
    const count = candidates.size;
    if (count === 0) return "text-gray-400 dark:text-gray-500";
    if (count === MAX_INDUSTRIES_PER_TRACKING)
      return "text-amber-600 dark:text-amber-400";
    return "text-blue-600 dark:text-blue-400";
  }, [candidates.size]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-5xl w-[min(90vw,1200px)] max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "preview-outlines" && (
              <button
                onClick={handleBackToSelect}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                disabled={isPending}
                aria-label="返回上一步"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            {step === "select-industries" ? "Step 1 · 行业选择" : "Step 2 · 概要预览"}
          </DialogTitle>
          {topicTitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
              热点：{topicTitle}
            </p>
          )}
        </DialogHeader>

        {step === "select-industries" ? (
          <div className="px-1 pt-2 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <Briefcase size={14} />
                <span>选择候选行业（1~{MAX_INDUSTRIES_PER_TRACKING} 个）</span>
              </div>
              <div className={cn("text-sm font-semibold tabular-nums", counterColor)}>
                {candidates.size}/{MAX_INDUSTRIES_PER_TRACKING}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 overflow-y-auto">
              {INDUSTRY_DIMENSIONS.map((dim) => {
                const isSelected = candidates.has(dim.key);
                const reachedMax =
                  !isSelected && candidates.size >= MAX_INDUSTRIES_PER_TRACKING;
                return (
                  <button
                    key={dim.key}
                    type="button"
                    onClick={() => toggleCandidate(dim.key)}
                    disabled={reachedMax || previewLoading}
                    title={dim.angle}
                    className={cn(
                      "px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border-0",
                      isSelected
                        ? "bg-blue-500 text-white shadow-sm"
                        : reachedMax
                          ? "bg-gray-50 dark:bg-white/5 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                          : "bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 shadow-sm",
                    )}
                  >
                    {dim.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1 -mx-2">
            <div className="px-2 pt-2">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <Sparkles size={14} className="text-purple-500 dark:text-purple-400" />
                  <span>勾选要继续生成完整稿件的概要（≥1 个）</span>
                </div>
                <div className="text-sm font-semibold tabular-nums text-purple-600 dark:text-purple-400">
                  {picked.size}/{outlines.length}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {outlines.map((o) => {
                  const isPicked = picked.has(o.industryKey);
                  return (
                    <button
                      key={o.industryKey}
                      type="button"
                      onClick={() => togglePicked(o.industryKey)}
                      disabled={isPending}
                      className={cn(
                        "text-left rounded-xl border-0 p-3 transition-all flex flex-col gap-2",
                        isPicked
                          ? "bg-purple-50 dark:bg-purple-950/30 ring-2 ring-purple-400/60"
                          : "bg-white dark:bg-white/[0.03] hover:bg-gray-50 dark:hover:bg-white/[0.06] shadow-sm",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                          {o.industryLabel}
                        </span>
                        {isPicked && (
                          <Check size={14} className="text-purple-600 dark:text-purple-400 shrink-0" />
                        )}
                      </div>
                      <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100 line-clamp-2">
                        {o.headline}
                      </h4>
                      <ul className="text-[11px] text-gray-600 dark:text-gray-300 space-y-0.5">
                        {o.keyPoints.slice(0, 4).map((p, i) => (
                          <li key={i} className="flex gap-1">
                            <span className="text-purple-400 shrink-0">·</span>
                            <span className="line-clamp-1">{p}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-3 mt-1">
                        {o.summary}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="mt-2 flex-row items-center justify-between gap-2">
          {step === "select-industries" ? (
            <>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mr-auto">
                先生成概要再决定哪些值得花成本写完整稿
              </p>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={previewLoading}>
                <X size={14} className="mr-1" />
                取消
              </Button>
              <Button
                onClick={handleGenerateOutlines}
                disabled={candidates.size === 0 || previewLoading}
              >
                {previewLoading ? (
                  <>
                    <Loader2 size={14} className="mr-1 animate-spin" />
                    生成概要中...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} className="mr-1" />
                    生成概要 ({candidates.size})
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mr-auto">
                只对勾选的行业生成完整稿件 + 合规审查
              </p>
              <Button variant="ghost" onClick={handleBackToSelect} disabled={isPending}>
                <ArrowLeft size={14} className="mr-1" />
                上一步
              </Button>
              <Button onClick={handleFinalConfirm} disabled={picked.size === 0 || isPending}>
                {isPending ? (
                  <>
                    <Loader2 size={14} className="mr-1 animate-spin" />
                    启动中...
                  </>
                ) : (
                  `启动深度追踪 (${picked.size})`
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
