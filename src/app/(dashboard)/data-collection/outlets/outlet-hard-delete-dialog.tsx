"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import {
  getOutletDeletionImpact,
  hardDeleteOutlet,
} from "@/app/actions/media-outlet-dictionary";

interface Props {
  outletId: string;
  outletName: string;
  onClose: () => void;
  onDeleted: () => void;
}

export function OutletHardDeleteDialog({ outletId, outletName, onClose, onDeleted }: Props) {
  const [impact, setImpact] = useState<{ collectedItems: number; collectionSources: number } | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await getOutletDeletionImpact(outletId);
        if (!cancelled) {
          setImpact({ collectedItems: r.collectedItems, collectionSources: r.collectionSources });
          setLoadingImpact(false);
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(`查询影响面失败: ${(e as Error).message}`);
          setLoadingImpact(false);
          onClose();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [outletId, onClose]);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await hardDeleteOutlet(outletId);
      onDeleted();
    } catch (e) {
      toast.error(`删除失败: ${(e as Error).message}`);
      setSubmitting(false);
    }
  }

  const totalAffected = (impact?.collectedItems ?? 0) + (impact?.collectionSources ?? 0);
  // 输入完整 outlet 名才能解锁删除按钮 — 防误点
  const canConfirm = !submitting && !loadingImpact && confirmText.trim() === outletName;

  return (
    <AlertDialog open onOpenChange={(open) => !open && !submitting && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>彻底删除媒体：{outletName}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                此操作<strong className="text-destructive">无法撤销</strong>，会把 outlet
                行从数据库永久删除。如果只想隐藏列表，请使用"停用"。
              </p>
              {loadingImpact ? (
                <p className="text-muted-foreground">查询影响面中…</p>
              ) : (
                <div className="rounded-md border bg-muted/30 px-3 py-2">
                  <div className="text-xs text-muted-foreground">下游引用（删除后将被置为 NULL）</div>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-xs text-muted-foreground">采集稿件 </span>
                      <span className="tabular-nums font-medium">{impact?.collectedItems ?? 0}</span>
                      <span className="text-xs text-muted-foreground"> 条</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">采集源 </span>
                      <span className="tabular-nums font-medium">{impact?.collectionSources ?? 0}</span>
                      <span className="text-xs text-muted-foreground"> 条</span>
                    </div>
                  </div>
                  {totalAffected > 0 && (
                    <div className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                      上述数据本身不会被删除，仅丢失对该媒体的关联（用于历史归属审计将无从追溯）
                    </div>
                  )}
                </div>
              )}
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  请输入完整媒体名 <code className="rounded bg-muted px-1">{outletName}</code> 以确认删除：
                </div>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={outletName}
                  autoFocus
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="ghost" disabled={submitting} onClick={onClose}>
            取消
          </Button>
          <Button variant="destructive" disabled={!canConfirm} onClick={handleConfirm}>
            {submitting ? "删除中…" : "彻底删除"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
