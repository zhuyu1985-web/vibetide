"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { softDeleteOutlet } from "@/app/actions/media-outlet-dictionary";

interface Props {
  outletId: string;
  outletName: string;
  onClose: () => void;
  onDeleted: () => void;
}

export function OutletDeleteConfirmDialog({ outletId, outletName, onClose, onDeleted }: Props) {
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await softDeleteOutlet(outletId);
      onDeleted();
    } catch (e) {
      toast.error(`停用失败：${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>停用 {outletName}？</AlertDialogTitle>
          <AlertDialogDescription>
            停用后该媒体不参与新采集项的自动识别（已识别的历史项不变）。可以在筛选器选「停用」状态查看，或编辑后恢复启用。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting ? "处理中..." : "确认停用"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
