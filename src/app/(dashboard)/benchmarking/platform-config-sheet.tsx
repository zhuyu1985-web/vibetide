"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Globe, Clock, RefreshCw, Pencil, Check, X } from "lucide-react";
import {
  addMonitoredPlatform,
  updateMonitoredPlatform,
  deleteMonitoredPlatform,
  crawlPlatformDirect,
} from "@/app/actions/benchmarking";
import type { MonitoredPlatformUI, PlatformCategory } from "@/lib/types";

interface PlatformConfigSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platforms: MonitoredPlatformUI[];
}

const categoryLabels: Record<PlatformCategory, string> = {
  central: "央级",
  provincial: "省级",
  municipal: "市级",
  industry: "行业",
};

const categoryColors: Record<PlatformCategory, string> = {
  central: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  provincial: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  municipal: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  industry: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
};

const statusColors = {
  active: "bg-green-500",
  paused: "bg-yellow-500",
  error: "bg-red-500",
};

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return "从未";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

export function PlatformConfigSheet({
  open,
  onOpenChange,
  platforms,
}: PlatformConfigSheetProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isCrawling, startCrawlTransition] = useTransition();
  const [isBatchCrawling, startBatchCrawlTransition] = useTransition();
  const [crawlingPlatformId, setCrawlingPlatformId] = useState<string | null>(null);
  const [crawlResult, setCrawlResult] = useState<string | null>(null);
  const [editingPlatformId, setEditingPlatformId] = useState<string | null>(null);
  const [editSearchQuery, setEditSearchQuery] = useState("");
  const [isEditSaving, startEditTransition] = useTransition();

  // Add form state
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState<PlatformCategory>("central");
  const [province, setProvince] = useState("");
  const [crawlFrequency, setCrawlFrequency] = useState("60");

  function resetForm() {
    setName("");
    setUrl("");
    setCategory("central");
    setProvince("");
    setCrawlFrequency("60");
    setShowAddForm(false);
  }

  function handleAdd() {
    if (!name.trim() || !url.trim()) return;

    startTransition(async () => {
      await addMonitoredPlatform({
        organizationId: "", // Server action will resolve from auth
        name: name.trim(),
        url: url.trim(),
        category,
        province: category === "provincial" ? province.trim() : undefined,
        crawlFrequencyMinutes: parseInt(crawlFrequency, 10) || 60,
      });
      resetForm();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteMonitoredPlatform(id);
    });
  }

  function handleToggleStatus(platform: MonitoredPlatformUI) {
    const newStatus = platform.status === "active" ? "paused" : "active";
    startTransition(async () => {
      await updateMonitoredPlatform(platform.id, { status: newStatus });
    });
  }

  function handleCrawl(platformId: string) {
    setCrawlingPlatformId(platformId);
    setCrawlResult(null);
    startCrawlTransition(async () => {
      try {
        const result = await crawlPlatformDirect(platformId);
        setCrawlResult(result.message);
      } catch {
        setCrawlResult("抓取失败，请检查网络连接");
      }
      setCrawlingPlatformId(null);
      setTimeout(() => setCrawlResult(null), 3000);
    });
  }

  function handleBatchCrawl() {
    setCrawlResult(null);
    startBatchCrawlTransition(async () => {
      let total = 0;
      for (const p of activePlatforms) {
        try {
          const result = await crawlPlatformDirect(p.id);
          total += result.count;
        } catch { /* continue with next */ }
      }
      setCrawlResult(`全部抓取完成，共收录 ${total} 条内容`);
      setTimeout(() => setCrawlResult(null), 3000);
    });
  }

  function handleStartEdit(platform: MonitoredPlatformUI) {
    setEditingPlatformId(platform.id);
    setEditSearchQuery(platform.crawlConfig?.searchQuery ?? "");
  }

  function handleCancelEdit() {
    setEditingPlatformId(null);
    setEditSearchQuery("");
  }

  function handleSaveEdit(platform: MonitoredPlatformUI) {
    startEditTransition(async () => {
      await updateMonitoredPlatform(platform.id, {
        crawlConfig: {
          ...platform.crawlConfig,
          searchQuery: editSearchQuery.trim(),
        },
      });
      setEditingPlatformId(null);
      setEditSearchQuery("");
    });
  }

  const [categoryFilter, setCategoryFilter] = useState<PlatformCategory | "all">("all");
  const activePlatforms = platforms.filter((p) => p.status === "active");
  const filteredPlatforms = categoryFilter === "all"
    ? platforms
    : platforms.filter((p) => p.category === categoryFilter);
  const categoryCounts = platforms.reduce<Record<string, number>>((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1;
    return acc;
  }, {});

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col overflow-hidden">
        <SheetHeader>
          <SheetTitle>监控平台管理</SheetTitle>
          <SheetDescription>管理需要监控的媒体平台列表</SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 flex flex-col px-4">
          {/* Top action bar */}
          <div className="mb-4 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
              disabled={isPending}
            >
              <Plus className="size-4" />
              添加平台
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBatchCrawl}
              disabled={isBatchCrawling || activePlatforms.length === 0}
            >
              <RefreshCw
                className={`size-4 ${isBatchCrawling ? "animate-spin" : ""}`}
              />
              全部抓取
            </Button>
          </div>

          {/* Crawl result feedback */}
          {crawlResult && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-950/30 text-xs text-green-700 dark:text-green-400">
              {crawlResult}
            </div>
          )}

          {/* Add form */}
          {showAddForm && (
            <div className="mb-4 space-y-3 rounded-lg bg-gray-50 dark:bg-gray-900 p-4">
              <Input
                placeholder="平台名称"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                placeholder="平台URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as PlatformCategory)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="central">央级</SelectItem>
                  <SelectItem value="provincial">省级</SelectItem>
                  <SelectItem value="municipal">市级</SelectItem>
                  <SelectItem value="industry">行业</SelectItem>
                </SelectContent>
              </Select>
              {category === "provincial" && (
                <Input
                  placeholder="省份名称"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                />
              )}
              <Input
                placeholder="抓取频率（分钟）"
                type="number"
                value={crawlFrequency}
                onChange={(e) => setCrawlFrequency(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetForm}
                  disabled={isPending}
                >
                  取消
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAdd}
                  disabled={isPending || !name.trim() || !url.trim()}
                >
                  确认添加
                </Button>
              </div>
            </div>
          )}

          {/* Category filter */}
          <div className="flex items-center gap-1 mb-3 flex-wrap">
            {(["all", "central", "provincial", "municipal", "industry"] as const).map((cat) => {
              const count = cat === "all" ? platforms.length : (categoryCounts[cat] || 0);
              if (cat !== "all" && count === 0) return null;
              return (
                <Button
                  key={cat}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "text-xs h-7 px-2.5",
                    categoryFilter === cat
                      ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400"
                      : "text-gray-500 dark:text-gray-400"
                  )}
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat === "all" ? "全部" : categoryLabels[cat]}
                  <span className="ml-1 text-[10px] opacity-60">{count}</span>
                </Button>
              );
            })}
          </div>

          {/* Platform list */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-3 pb-4">
              {filteredPlatforms.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                  {categoryFilter === "all" ? "暂无监控平台，点击上方按钮添加" : "该分类下暂无平台"}
                </p>
              )}
              {filteredPlatforms.map((platform) => (
                <div
                  key={platform.id}
                  className="rounded-lg bg-white/50 dark:bg-white/5 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`size-2 rounded-full shrink-0 ${statusColors[platform.status]}`}
                      />
                      <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                        {platform.name}
                      </span>
                      <Badge
                        variant="secondary"
                        className={categoryColors[platform.category]}
                      >
                        {categoryLabels[platform.category]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleStartEdit(platform)}
                        disabled={isPending}
                        className="text-gray-400 hover:text-blue-500"
                        title="编辑搜索词"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleDelete(platform.id)}
                        disabled={isPending}
                        className="text-gray-400 hover:text-red-500"
                        title="删除"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <Globe className="size-3" />
                    <a
                      href={platform.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate hover:underline max-w-[200px]"
                    >
                      {platform.url}
                    </a>
                  </div>

                  {/* Last error message */}
                  {platform.lastErrorMessage && (
                    <p className="text-xs text-red-500 dark:text-red-400 truncate">
                      {platform.lastErrorMessage}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Clock className="size-3" />
                        <span>每 {platform.crawlFrequencyMinutes} 分钟</span>
                      </div>
                      <span>已收录 {platform.totalContentCount} 篇</span>
                    </div>
                    <span>上次抓取: {formatRelativeTime(platform.lastCrawledAt)}</span>
                  </div>

                  {/* Inline edit search query */}
                  {editingPlatformId === platform.id && (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editSearchQuery}
                        onChange={(e) => setEditSearchQuery(e.target.value)}
                        placeholder="搜索关键词"
                        className="h-7 text-xs flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleSaveEdit(platform)}
                        disabled={isEditSaving}
                        className="text-gray-400 hover:text-green-500"
                      >
                        <Check className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={handleCancelEdit}
                        disabled={isEditSaving}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center justify-between pt-1">
                    {platform.status === "paused" ? (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleToggleStatus(platform)}
                        disabled={isPending}
                        className="text-green-600 dark:text-green-400 hover:text-green-700"
                      >
                        启用监控
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleCrawl(platform.id)}
                        disabled={isCrawling}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700"
                      >
                        <RefreshCw
                          className={`size-3 mr-1 ${
                            crawlingPlatformId === platform.id && isCrawling
                              ? "animate-spin"
                              : ""
                          }`}
                        />
                        {crawlingPlatformId === platform.id && isCrawling
                          ? "抓取中..."
                          : platform.totalContentCount === 0
                          ? "启动抓取"
                          : "手动抓取"}
                      </Button>
                    )}
                    {platform.status === "active" && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleToggleStatus(platform)}
                        disabled={isPending}
                        className="text-gray-400 hover:text-yellow-600 text-xs"
                      >
                        暂停
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
