"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  FileText,
  Edit3,
  Clock,
  CheckCircle,
  Globe,
  CalendarDays,
  User,
  FolderOpen,
  Type,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ArticleListItem, ArticleStats, CategoryNode } from "@/lib/types";

interface Props {
  articles: ArticleListItem[];
  stats: ArticleStats;
  categories: CategoryNode[];
}

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "草稿", color: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400" },
  reviewing: { label: "审核中", color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" },
  approved: { label: "已通过", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
  published: { label: "已发布", color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
  archived: { label: "已归档", color: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400" },
};

const mediaTypeConfig: Record<string, { label: string; color: string }> = {
  article: { label: "图文", color: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400" },
  video: { label: "视频", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
  audio: { label: "音频", color: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400" },
  h5: { label: "H5", color: "bg-pink-100 dark:bg-pink-950/50 text-pink-700 dark:text-pink-400" },
};

export default function ArticlesClient({ articles, stats, categories }: Props) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [mediaTypeFilter, setMediaTypeFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");

  const filteredArticles = articles.filter((article) => {
    const matchesSearch =
      !search ||
      article.title.toLowerCase().includes(search.toLowerCase()) ||
      article.headline?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || article.categoryId === categoryFilter;
    const matchesMediaType =
      mediaTypeFilter === "all" || article.mediaType === mediaTypeFilter;
    const matchesTab =
      activeTab === "all" || article.status === activeTab;
    return matchesSearch && matchesCategory && matchesMediaType && matchesTab;
  });

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        title="稿件管理"
        description="创建、编辑和管理所有内容稿件"
        actions={
          <Button asChild>
            <Link href="/articles/create">
              <Plus size={16} className="mr-2" />
              新建稿件
            </Link>
          </Button>
        }
      />

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <StatCard
          label="稿件总数"
          value={stats.totalCount}
          icon={<FileText size={18} />}
        />
        <StatCard
          label="草稿"
          value={stats.draftCount}
          icon={<Edit3 size={18} />}
        />
        <StatCard
          label="审核中"
          value={stats.reviewingCount}
          icon={<Clock size={18} />}
        />
        <StatCard
          label="已通过"
          value={stats.approvedCount}
          icon={<CheckCircle size={18} />}
        />
        <StatCard
          label="已发布"
          value={stats.publishedCount}
          icon={<Globe size={18} />}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">
            全部
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">
              {stats.totalCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="draft">
            草稿
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">
              {stats.draftCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="reviewing">
            审核中
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">
              {stats.reviewingCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="approved">
            已通过
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">
              {stats.approvedCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="published">
            已发布
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">
              {stats.publishedCount}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {/* Filter Bar */}
          <GlassCard padding="md" className="mb-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                />
                <Input
                  placeholder="搜索稿件标题..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="全部栏目" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部栏目</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={mediaTypeFilter} onValueChange={setMediaTypeFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="全部类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="article">图文</SelectItem>
                  <SelectItem value="video">视频</SelectItem>
                  <SelectItem value="audio">音频</SelectItem>
                  <SelectItem value="h5">H5</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </GlassCard>

          {/* Results count */}
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            共 {filteredArticles.length} 篇稿件
          </p>

          {/* Article List */}
          <div className="space-y-2">
            {filteredArticles.map((article) => (
              <ArticleRow key={article.id} article={article} />
            ))}
          </div>

          {filteredArticles.length === 0 && (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500">
              <FileText size={48} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">暂无匹配的稿件</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ArticleRow({ article }: { article: ArticleListItem }) {
  const statusCfg = statusConfig[article.status] || statusConfig.draft;
  const mediaTypeCfg = mediaTypeConfig[article.mediaType] || mediaTypeConfig.article;

  return (
    <Link href={`/articles/${article.id}`}>
      <GlassCard variant="interactive" padding="md">
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
              {article.title}
            </h3>
            <div className="flex items-center gap-3 mt-1.5">
              {article.assigneeName && (
                <span className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                  <User size={11} />
                  {article.assigneeName}
                </span>
              )}
              {article.categoryName && (
                <span className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                  <FolderOpen size={11} />
                  {article.categoryName}
                </span>
              )}
              <span className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                <Type size={11} />
                {article.wordCount} 字
              </span>
            </div>
          </div>

          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0",
              mediaTypeCfg.color
            )}
          >
            {mediaTypeCfg.label}
          </span>

          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0",
              statusCfg.color
            )}
          >
            {statusCfg.label}
          </span>

          {article.tags.length > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              {article.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 flex items-center gap-1">
            <CalendarDays size={12} />
            {new Date(article.updatedAt).toLocaleDateString("zh-CN")}
          </span>
        </div>
      </GlassCard>
    </Link>
  );
}
