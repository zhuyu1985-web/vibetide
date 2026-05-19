"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Star, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  addKeyword,
  createTopic,
  getTopicDetail,
  removeKeyword,
  updateTopic,
  updateKeyword,
  setTopicGroup,
} from "@/app/actions/research/research-topics";
import type { TopicSummary } from "@/lib/dal/research/research-topics";

const NULL_GROUP_VALUE = "__default__";

type KeywordRow = {
  id: string;
  keyword: string;
  isPrimary: boolean;
};

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
  const [keywords, setKeywords] = useState<KeywordRow[]>([]);
  const [keywordsLoading, setKeywordsLoading] = useState(false);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [keywordAsPrimary, setKeywordAsPrimary] = useState(false);

  const loadKeywords = useCallback(async () => {
    if (!open || !topic) {
      setKeywords([]);
      return;
    }
    setKeywordsLoading(true);
    try {
      const detail = await getTopicDetail(topic.id);
      setKeywords(
        detail?.keywords.map((keyword) => ({
          id: keyword.id,
          keyword: keyword.keyword,
          isPrimary: keyword.isPrimary,
        })) ?? [],
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载关键词失败");
    } finally {
      setKeywordsLoading(false);
    }
  }, [open, topic]);

  // Reset state on open / topic change.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setKeywordDraft("");
    setKeywordAsPrimary(false);
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

  useEffect(() => {
    void loadKeywords();
  }, [loadKeywords]);

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

  function handleAddKeyword() {
    if (!topic) return;
    const keyword = keywordDraft.trim();
    if (!keyword) {
      setError("请输入关键词");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await addKeyword({
        topicId: topic.id,
        keyword,
        isPrimary: keywordAsPrimary,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setKeywordDraft("");
      setKeywordAsPrimary(false);
      await loadKeywords();
      router.refresh();
    });
  }

  function handleSetPrimary(keyword: KeywordRow) {
    if (keyword.isPrimary) return;
    setError(null);
    startTransition(async () => {
      const res = await updateKeyword({ id: keyword.id, isPrimary: true });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      await loadKeywords();
      router.refresh();
    });
  }

  function handleRemoveKeyword(keyword: KeywordRow) {
    setError(null);
    startTransition(async () => {
      const res = await removeKeyword(keyword.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      await loadKeywords();
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{topic ? "编辑方案" : "创建方案"}</SheetTitle>
          <SheetDescription>
            维护方案基础信息、分组与检索关键词。
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
            <div className="space-y-3 rounded-md border border-border/70 bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <Label>关键词</Label>
                <span className="text-xs text-muted-foreground">
                  样本 {topic.sampleCount} 条
                </span>
              </div>

              <div className="flex gap-2">
                <Input
                  value={keywordDraft}
                  onChange={(e) => setKeywordDraft(e.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleAddKeyword();
                    }
                  }}
                  placeholder="输入主题关键词"
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleAddKeyword}
                  disabled={pending || keywordsLoading}
                >
                  添加
                </Button>
              </div>

              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={keywordAsPrimary}
                  onCheckedChange={(checked) => setKeywordAsPrimary(checked === true)}
                />
                设为共词
              </label>

              {keywordsLoading ? (
                <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  加载关键词...
                </div>
              ) : keywords.length === 0 ? (
                <div className="rounded-md bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                  暂无关键词，检索会使用方案名称兜底。
                </div>
              ) : (
                <div className="space-y-2">
                  {keywords.map((keyword) => (
                    <div
                      key={keyword.id}
                      className="flex items-center gap-2 rounded-md bg-background/70 px-2 py-2"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {keyword.keyword}
                      </span>
                      {keyword.isPrimary ? (
                        <Badge variant="secondary" className="shrink-0">
                          共词
                        </Badge>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="设为共词"
                          onClick={() => handleSetPrimary(keyword)}
                          disabled={pending}
                        >
                          <Star className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="删除关键词"
                        onClick={() => handleRemoveKeyword(keyword)}
                        disabled={pending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
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
