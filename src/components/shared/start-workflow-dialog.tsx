"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StartWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams?: unknown[];
  templates?: unknown[];
  organizationId?: string;
}

/**
 * Placeholder — old workflow dialog removed during mission migration.
 * Will be replaced by StartMissionDialog.
 */
export function StartWorkflowDialog({
  open,
  onOpenChange,
}: StartWorkflowDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>功能迁移中</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500 py-4">
          工作流已迁移为任务系统，请使用新的任务入口。
        </p>
      </DialogContent>
    </Dialog>
  );
}
