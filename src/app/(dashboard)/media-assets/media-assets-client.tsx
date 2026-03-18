"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  Search,
  LayoutGrid,
  List,
  Video,
  Image as ImageIcon,
  Headphones,
  FileText,
  HardDrive,
  Eye,
  Calendar,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  MediaAssetListItem,
  MediaAssetStats,
  CategoryNode,
} from "@/lib/types";

interface Props {
  assets: MediaAssetListItem[];
  stats: MediaAssetStats;
  categories: CategoryNode[];
}

const typeConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  video: { label: "视频", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400", bgColor: "bg-blue-200" },
  image: { label: "图片", color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400", bgColor: "bg-green-200" },
  audio: { label: "音频", color: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400", bgColor: "bg-purple-200" },
  document: { label: "文档", color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400", bgColor: "bg-amber-200" },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  queued: { label: "排队中", color: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400" },
  processing: { label: "处理中", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
  completed: { label: "已完成", color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
  failed: { label: "失败", color: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" },
};

const typeIcons: Record<string, React.ReactNode> = {
  video: <Video size={24} className="text-blue-500" />,
  image: <ImageIcon size={24} className="text-green-500" />,
  audio: <Headphones size={24} className="text-purple-500" />,
  document: <FileText size={24} className="text-amber-500" />,
};

export default function MediaAssetsClient({ assets, stats, categories }: Props) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      !search ||
      asset.title.toLowerCase().includes(search.toLowerCase()) ||
      asset.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchesType = typeFilter === "all" || asset.type === typeFilter;
    const matchesCategory =
      categoryFilter === "all" || asset.categoryName === categories.find((c) => c.id === categoryFilter)?.name;
    return matchesSearch && matchesType && matchesCategory;
  });

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        title="素材库"
        description="管理所有媒体素材资源"
        actions={
          <Button>
            <Upload size={16} className="mr-2" />
            上传素材
          </Button>
        }
      />

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <StatCard
          label="素材总数"
          value={stats.totalCount}
          icon={<HardDrive size={18} />}
          suffix={`/ ${stats.totalStorageDisplay}`}
        />
        <StatCard
          label="视频"
          value={stats.videoCount}
          icon={<Video size={18} />}
        />
        <StatCard
          label="图片"
          value={stats.imageCount}
          icon={<ImageIcon size={18} />}
        />
        <StatCard
          label="音频"
          value={stats.audioCount}
          icon={<Headphones size={18} />}
        />
        <StatCard
          label="文档"
          value={stats.documentCount}
          icon={<FileText size={18} />}
        />
      </div>

      {/* Filter Bar */}
      <GlassCard padding="md" className="mb-6">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
            />
            <Input
              placeholder="搜索素材名称或标签..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="全部类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              <SelectItem value="video">视频</SelectItem>
              <SelectItem value="image">图片</SelectItem>
              <SelectItem value="audio">音频</SelectItem>
              <SelectItem value="document">文档</SelectItem>
            </SelectContent>
          </Select>

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

          <div className="ml-auto flex items-center gap-1 border rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                viewMode === "grid"
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                  : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              )}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                viewMode === "list"
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                  : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              )}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Results count */}
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        共 {filteredAssets.length} 个素材
      </p>

      {/* Asset Grid / List */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-4 gap-4">
          {filteredAssets.map((asset) => (
            <AssetGridCard key={asset.id} asset={asset} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredAssets.map((asset) => (
            <AssetListRow key={asset.id} asset={asset} />
          ))}
        </div>
      )}

      {filteredAssets.length === 0 && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <HardDrive size={48} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">暂无匹配的素材</p>
        </div>
      )}
    </div>
  );
}

function AssetGridCard({ asset }: { asset: MediaAssetListItem }) {
  const typeCfg = typeConfig[asset.type] || typeConfig.document;
  const statusCfg = statusConfig[asset.understandingStatus] || statusConfig.queued;

  return (
    <GlassCard variant="interactive" padding="none" className="overflow-hidden">
      {/* Thumbnail placeholder */}
      <div
        className={cn(
          "h-36 flex items-center justify-center",
          typeCfg.bgColor
        )}
      >
        {typeIcons[asset.type]}
      </div>

      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate mb-2">
          {asset.title}
        </h3>

        <div className="flex items-center gap-1.5 mb-2">
          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium",
              typeCfg.color
            )}
          >
            {typeCfg.label}
          </span>
          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium",
              statusCfg.color
            )}
          >
            {statusCfg.label}
          </span>
        </div>

        {asset.tags.length > 0 && (
          <div className="flex items-center gap-1 mb-2 flex-wrap">
            <Tag size={12} className="text-gray-400 dark:text-gray-500 shrink-0" />
            {asset.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                {tag}
              </Badge>
            ))}
            {asset.tags.length > 3 && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                +{asset.tags.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-gray-400 dark:text-gray-500">
          <span className="flex items-center gap-1">
            <Eye size={12} />
            {asset.usageCount} 次使用
          </span>
          <span className="flex items-center gap-1">
            <Calendar size={12} />
            {new Date(asset.createdAt).toLocaleDateString("zh-CN")}
          </span>
        </div>
      </div>
    </GlassCard>
  );
}

function AssetListRow({ asset }: { asset: MediaAssetListItem }) {
  const typeCfg = typeConfig[asset.type] || typeConfig.document;
  const statusCfg = statusConfig[asset.understandingStatus] || statusConfig.queued;

  return (
    <GlassCard variant="interactive" padding="sm">
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "w-12 h-12 rounded-lg flex items-center justify-center shrink-0",
            typeCfg.bgColor
          )}
        >
          {typeIcons[asset.type]}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
            {asset.title}
          </h3>
          <div className="flex items-center gap-1.5 mt-1">
            {asset.tags.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        <span
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0",
            typeCfg.color
          )}
        >
          {typeCfg.label}
        </span>

        <span
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0",
            statusCfg.color
          )}
        >
          {statusCfg.label}
        </span>

        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 flex items-center gap-1">
          <Eye size={12} />
          {asset.usageCount}
        </span>

        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
          {new Date(asset.createdAt).toLocaleDateString("zh-CN")}
        </span>
      </div>
    </GlassCard>
  );
}
