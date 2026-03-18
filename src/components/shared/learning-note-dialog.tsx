"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Loader2, GraduationCap } from "lucide-react";
import { addLearningMemory } from "@/app/actions/learning";

const memoryTypeLabels: Record<string, string> = {
  feedback: "反馈记录",
  pattern: "模式发现",
  preference: "偏好记录",
};

interface LearningNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
}

export function LearningNoteDialog({
  open,
  onOpenChange,
  employeeId,
}: LearningNoteDialogProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState("");
  const [memoryType, setMemoryType] = useState<"feedback" | "pattern" | "preference">("feedback");
  const [importance, setImportance] = useState(0.5);

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await addLearningMemory(employeeId, content.trim(), memoryType, importance);
      setContent("");
      setMemoryType("feedback");
      setImportance(0.5);
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      console.error("Failed to add learning note:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap size={18} className="text-blue-500" />
            添加学习笔记
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-gray-500 dark:text-gray-400">记忆类型</Label>
            <Select value={memoryType} onValueChange={(v) => setMemoryType(v as typeof memoryType)}>
              <SelectTrigger className="mt-1 glass-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(memoryTypeLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-gray-500 dark:text-gray-400">内容</Label>
            <textarea
              className="mt-1 w-full min-h-[100px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/60 px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
              placeholder="输入学习笔记内容..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          <div>
            <Label className="text-xs text-gray-500 dark:text-gray-400">
              重要性: {Math.round(importance * 100)}%
            </Label>
            <Slider
              value={[importance]}
              min={0}
              max={1}
              step={0.1}
              className="mt-2"
              onValueChange={(v: number[]) => setImportance(v[0])}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            取消
          </Button>
          <Button
            size="sm"
            className="text-xs"
            onClick={handleSave}
            disabled={saving || !content.trim()}
          >
            {saving && <Loader2 size={12} className="mr-1 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
