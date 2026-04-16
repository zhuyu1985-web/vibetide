"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Plus, X, Star, Trash2 } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import type { TopicSummary } from "@/lib/dal/research/research-topics";
import {
  createTopic,
  updateTopic,
  deleteTopic,
  addKeyword,
  removeKeyword,
  addSample,
  removeSample,
  getTopicDetail,
} from "@/app/actions/research/research-topics";

type KeywordItem = {
  id: string;
  keyword: string;
  isPrimary: boolean;
};

type SampleItem = {
  id: string;
  sampleText: string;
  embeddingStatus: "pending" | "processing" | "done" | "failed";
};

type DialogMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; topicId: string };

type DetailState = {
  id?: string;
  name: string;
  description: string;
  isPreset: boolean;
  keywords: KeywordItem[];
  samples: SampleItem[];
};

function emptyDetail(): DetailState {
  return {
    name: "",
    description: "",
    isPreset: false,
    keywords: [],
    samples: [],
  };
}

const EMBED_STATUS_LABEL: Record<SampleItem["embeddingStatus"], string> = {
  pending: "待处理",
  processing: "处理中",
  done: "已完成",
  failed: "失败",
};

const EMBED_STATUS_CLASS: Record<SampleItem["embeddingStatus"], string> = {
  pending: "bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/40",
  processing: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30",
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30",
  failed: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/30",
};

export function TopicsClient({ topics }: { topics: TopicSummary[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<DialogMode>({ kind: "closed" });
  const [detail, setDetail] = useState<DetailState>(emptyDetail());
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // inline add inputs
  const [newKeyword, setNewKeyword] = useState("");
  const [newKeywordPrimary, setNewKeywordPrimary] = useState<"true" | "false">(
    "false",
  );
  const [newSampleText, setNewSampleText] = useState("");

  function flashMsg(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2000);
  }

  function closeDialog() {
    setDialog({ kind: "closed" });
    setDetail(emptyDetail());
    setError(null);
    setFlash(null);
    setNewKeyword("");
    setNewKeywordPrimary("false");
    setNewSampleText("");
  }

  function openCreate() {
    setDetail(emptyDetail());
    setError(null);
    setFlash(null);
    setDialog({ kind: "create" });
  }

  async function openEdit(topic: TopicSummary) {
    setError(null);
    setFlash(null);
    setDialog({ kind: "edit", topicId: topic.id });
    setLoadingDetail(true);
    try {
      const res = await getTopicDetail(topic.id);
      if (!res) {
        setError("主题不存在或无权限");
        setDetail(emptyDetail());
      } else {
        setDetail({
          id: res.topic.id,
          name: res.topic.name,
          description: res.topic.description ?? "",
          isPreset: res.topic.isPreset,
          keywords: res.keywords.map((k) => ({
            id: k.id,
            keyword: k.keyword,
            isPrimary: k.isPrimary,
          })),
          samples: res.samples.map((s) => ({
            id: s.id,
            sampleText: s.sampleText,
            embeddingStatus: s.embeddingStatus as SampleItem["embeddingStatus"],
          })),
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingDetail(false);
    }
  }

  function saveBasics() {
    setError(null);
    if (!detail.name.trim()) {
      setError("请输入主题名称");
      return;
    }
    startTransition(async () => {
      if (dialog.kind === "create") {
        const res = await createTopic({
          name: detail.name.trim(),
          description: detail.description.trim() || undefined,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        // upgrade dialog into edit mode so user can add keywords/samples
        setDialog({ kind: "edit", topicId: res.id });
        setDetail((d) => ({ ...d, id: res.id }));
        flashMsg("已创建，可继续添加关键词与样本");
        router.refresh();
      } else if (dialog.kind === "edit" && detail.id) {
        const res = await updateTopic({
          id: detail.id,
          name: detail.name.trim(),
          description: detail.description.trim() || undefined,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        flashMsg("基础信息已更新");
        router.refresh();
      }
    });
  }

  function handleAddKeyword() {
    if (!detail.id) {
      setError("请先保存基础信息");
      return;
    }
    const kw = newKeyword.trim();
    if (!kw) return;
    startTransition(async () => {
      const res = await addKeyword({
        topicId: detail.id!,
        keyword: kw,
        isPrimary: newKeywordPrimary === "true",
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDetail((d) => ({
        ...d,
        keywords: [
          ...d.keywords,
          { id: res.id, keyword: kw, isPrimary: newKeywordPrimary === "true" },
        ],
      }));
      setNewKeyword("");
      setNewKeywordPrimary("false");
      router.refresh();
    });
  }

  function handleRemoveKeyword(id: string) {
    startTransition(async () => {
      const res = await removeKeyword(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDetail((d) => ({
        ...d,
        keywords: d.keywords.filter((k) => k.id !== id),
      }));
      router.refresh();
    });
  }

  function handleAddSample() {
    if (!detail.id) {
      setError("请先保存基础信息");
      return;
    }
    const txt = newSampleText.trim();
    if (txt.length < 10) {
      setError("样本至少 10 个字符");
      return;
    }
    startTransition(async () => {
      const res = await addSample({ topicId: detail.id!, sampleText: txt });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDetail((d) => ({
        ...d,
        samples: [
          ...d.samples,
          { id: res.id, sampleText: txt, embeddingStatus: "pending" },
        ],
      }));
      setNewSampleText("");
      router.refresh();
    });
  }

  function handleRemoveSample(id: string) {
    startTransition(async () => {
      const res = await removeSample(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDetail((d) => ({
        ...d,
        samples: d.samples.filter((s) => s.id !== id),
      }));
      router.refresh();
    });
  }

  function handleDeleteTopic() {
    if (!detail.id) return;
    if (
      !window.confirm(
        "确定删除该主题吗？此操作将级联删除相关关键词与样本，不可恢复。",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await deleteTopic(detail.id!);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      closeDialog();
      router.refresh();
    });
  }

  const primaryKeywords = detail.keywords.filter((k) => k.isPrimary);
  const aliasKeywords = detail.keywords.filter((k) => !k.isPrimary);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">主题词库管理</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            管理研究主题、共词别名与语义样本
          </p>
        </div>
        <Button variant="ghost" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          新增主题
        </Button>
      </div>

      {topics.length === 0 ? (
        <GlassCard variant="default" padding="lg">
          <div className="text-center text-gray-500 dark:text-gray-400 py-10">
            还没有主题，点击右上角「新增主题」开始创建
          </div>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {topics.map((t) => (
            <GlassCard
              key={t.id}
              variant="interactive"
              padding="md"
              hover
              onClick={() => openEdit(t)}
              className="text-left cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-lg font-semibold leading-tight">
                  {t.name}
                </h3>
                {t.isPreset && (
                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 shrink-0">
                    预置
                  </Badge>
                )}
              </div>
              <div className="mt-3 text-sm">
                <span className="text-gray-500 dark:text-gray-400">共词：</span>
                <span className="font-medium">
                  {t.primaryKeyword ?? "未设置"}
                </span>
              </div>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                别名 {t.aliasCount} 条 · 样本 {t.sampleCount} 条
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <Dialog
        open={dialog.kind !== "closed"}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dialog.kind === "edit" ? "编辑主题" : "新增主题"}
              {detail.isPreset && (
                <Badge className="ml-2 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 align-middle">
                  预置
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {loadingDetail ? (
            <div className="py-10 text-center text-muted-foreground">
              加载中...
            </div>
          ) : (
            <div className="space-y-3">
              {error && (
                <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                  {error}
                </div>
              )}
              {flash && (
                <div className="text-sm text-emerald-700 bg-emerald-50 rounded-md px-3 py-2">
                  {flash}
                </div>
              )}

              <Tabs defaultValue="basic">
                <TabsList>
                  <TabsTrigger value="basic">基础信息</TabsTrigger>
                  <TabsTrigger
                    value="keywords"
                    disabled={dialog.kind === "create" && !detail.id}
                  >
                    关键词
                  </TabsTrigger>
                  <TabsTrigger
                    value="samples"
                    disabled={dialog.kind === "create" && !detail.id}
                  >
                    样本
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1: Basic */}
                <TabsContent value="basic" className="space-y-4 pt-4">
                  <div className="space-y-1">
                    <Label>名称</Label>
                    <Input
                      value={detail.name}
                      onChange={(e) =>
                        setDetail({ ...detail, name: e.target.value })
                      }
                      placeholder="如：城市更新"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>描述（可选）</Label>
                    <Textarea
                      value={detail.description}
                      onChange={(e) =>
                        setDetail({ ...detail, description: e.target.value })
                      }
                      placeholder="简要说明该主题的内容范围"
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      onClick={saveBasics}
                      disabled={pending}
                    >
                      {pending ? "保存中..." : "保存基础信息"}
                    </Button>
                  </div>
                </TabsContent>

                {/* Tab 2: Keywords */}
                <TabsContent value="keywords" className="space-y-5 pt-4">
                  <div>
                    <div className="text-sm font-medium mb-2 flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 text-amber-500" />
                      共词
                    </div>
                    {primaryKeywords.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        暂无共词，建议在下方添加一条作为主关键词
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {primaryKeywords.map((k) => (
                          <div key={k.id} className="flex gap-2 items-center">
                            <Star className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            <Input value={k.keyword} readOnly />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveKeyword(k.id)}
                              disabled={pending}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-2">近似称谓</div>
                    {aliasKeywords.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        暂无近似称谓
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {aliasKeywords.map((k) => (
                          <div key={k.id} className="flex gap-2 items-center">
                            <Input value={k.keyword} readOnly />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveKeyword(k.id)}
                              disabled={pending}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg bg-muted/40 p-3 space-y-2">
                    <div className="text-sm font-medium">添加新关键词</div>
                    <div className="flex gap-2">
                      <Input
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        placeholder="关键词"
                      />
                      <Select
                        value={newKeywordPrimary}
                        onValueChange={(v) =>
                          setNewKeywordPrimary(v as "true" | "false")
                        }
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="false">近似称谓</SelectItem>
                          <SelectItem value="true">共词</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        onClick={handleAddKeyword}
                        disabled={pending || !newKeyword.trim()}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        添加
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab 3: Samples */}
                <TabsContent value="samples" className="space-y-4 pt-4">
                  {detail.samples.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      暂无样本，建议添加 3-5 条代表性语料用于语义匹配
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {detail.samples.map((s) => (
                        <div key={s.id} className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Badge
                              className={EMBED_STATUS_CLASS[s.embeddingStatus]}
                            >
                              {EMBED_STATUS_LABEL[s.embeddingStatus]}
                            </Badge>
                            <div className="flex-1" />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveSample(s.id)}
                              disabled={pending}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <Textarea
                            value={s.sampleText}
                            readOnly
                            rows={3}
                            className="bg-muted/30"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="rounded-lg bg-muted/40 p-3 space-y-2">
                    <div className="text-sm font-medium">添加新样本</div>
                    <Textarea
                      value={newSampleText}
                      onChange={(e) => setNewSampleText(e.target.value)}
                      placeholder="粘贴一段代表该主题的语料（至少 10 字）"
                      rows={5}
                    />
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        onClick={handleAddSample}
                        disabled={pending || newSampleText.trim().length < 10}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        添加样本
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          <DialogFooter className="sm:justify-between">
            <div>
              {dialog.kind === "edit" && detail.id && !detail.isPreset && (
                <Button
                  variant="ghost"
                  onClick={handleDeleteTopic}
                  disabled={pending}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  删除主题
                </Button>
              )}
            </div>
            <Button variant="ghost" onClick={closeDialog}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
