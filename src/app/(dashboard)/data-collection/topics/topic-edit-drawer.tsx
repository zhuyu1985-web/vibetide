"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createTopic,
  updateTopic,
  setTopicGroup,
} from "@/app/actions/research/research-topics";
import type { TopicSummary } from "@/lib/dal/research/research-topics";

const NULL_GROUP_VALUE = "__default__";

interface TopicEditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topic: TopicSummary | null;
  groups: string[];
}

export function TopicEditDrawer({
  open,
  onOpenChange,
  topic,
  groups,
}: TopicEditDrawerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [groupValue, setGroupValue] = useState<string>(NULL_GROUP_VALUE);

  // Reset state on open / topic change.
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (topic) {
      setName(topic.name);
      setDescription(topic.description ?? "");
      setGroupValue(topic.groupName ?? NULL_GROUP_VALUE);
    } else {
      setName("");
      setDescription("");
      setGroupValue(NULL_GROUP_VALUE);
    }
  }, [open, topic]);

  function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("请输入主题名称");
      return;
    }
    startTransition(async () => {
      const targetGroup = groupValue === NULL_GROUP_VALUE ? null : groupValue;

      if (topic) {
        // Update existing.
        const res = await updateTopic({
          id: topic.id,
          name: name.trim(),
          description: description.trim() || undefined,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        if ((topic.groupName ?? null) !== targetGroup) {
          const gr = await setTopicGroup(topic.id, targetGroup);
          if (!gr.ok) {
            setError(gr.error);
            return;
          }
        }
      } else {
        // Create new.
        const res = await createTopic({
          name: name.trim(),
          description: description.trim() || undefined,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        if (targetGroup) {
          const gr = await setTopicGroup(res.id, targetGroup);
          if (!gr.ok) {
            setError(gr.error);
            return;
          }
        }
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{topic ? "编辑方案" : "创建方案"}</SheetTitle>
          <SheetDescription>
            维护方案的基础信息与分组。关键词、近似称谓与语义样本请到主题词库管理页编辑。
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-4">
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>方案名称</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如:城市更新"
            />
          </div>

          <div className="space-y-1.5">
            <Label>描述（可选）</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简要说明该方案的内容范围"
              rows={4}
            />
          </div>

          <div className="space-y-1.5">
            <Label>分组</Label>
            <Select value={groupValue} onValueChange={setGroupValue}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NULL_GROUP_VALUE}>默认分组</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {topic && (
            <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
              <p className="mb-1.5 font-medium text-foreground">
                关键词 / 样本 完整编辑
              </p>
              <p>
                共词「{topic.primaryKeyword ?? "未设置"}」· 别名 {topic.aliasCount}
                {" "}条 · 样本 {topic.sampleCount} 条。
              </p>
              <p className="mt-2">
                <Link
                  href="/research/admin/topics"
                  className="inline-flex items-center gap-1 text-sky-600 hover:underline dark:text-sky-400"
                >
                  到主题词库管理页编辑
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </p>
            </div>
          )}
        </div>

        <SheetFooter className="flex-row justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            取消
          </Button>
          <Button variant="ghost" onClick={handleSave} disabled={pending}>
            {pending ? "保存中…" : "保存"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
