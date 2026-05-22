"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PermissionGate } from "@/components/shared/permission-gate";
import { SearchInput } from "@/components/shared/search-input";
import {
  Search,
  Plus,
  Archive,
  Filter,
  ArrowUpDown,
  LayoutGrid,
  List,
  FileText,
  Edit3,
  Clock,
  CheckCircle,
  Globe,
  FolderOpen,
  Inbox,
  ChevronDown,
  ChevronRight,
  Video,
  Headphones,
  Code2,
  Image as ImageIcon,
  Sparkles,
  Loader2,
} from "lucide-react";
import type { ArticleListItem, ArticleStats, CategoryNode } from "@/lib/types";

interface Props {
  articles: ArticleListItem[];
  stats: ArticleStats;
  categories: CategoryNode[];
}

/* ── Sidebar status items ── */
const statusItems = [
  { key: "all", label: "全部", icon: Inbox, countKey: "totalCount" as const },
  { key: "draft", label: "草稿", icon: Edit3, countKey: "draftCount" as const },
  { key: "reviewing", label: "审核中", icon: Clock, countKey: "reviewingCount" as const },
  { key: "approved", label: "已通过", icon: CheckCircle, countKey: "approvedCount" as const },
  { key: "published", label: "已发布", icon: Globe, countKey: "publishedCount" as const },
  { key: "archived", label: "已归档", icon: Archive, countKey: undefined },
];

const mediaTypeItems = [
  { key: "article", label: "图文", icon: FileText },
  { key: "video", label: "视频", icon: Video },
  { key: "audio", label: "音频", icon: Headphones },
  { key: "h5", label: "H5", icon: Code2 },
];

/* ── Colored dot for bottom-row source indicator ── */
const statusDotColor: Record<string, string> = {
  draft: "bg-gray-400",
  reviewing: "bg-amber-400",
  approved: "bg-blue-500",
  published: "bg-green-500",
  archived: "bg-gray-300",
};

/* ── Thumbnail bg & icon per media type ── */
const thumbConfig: Record<string, { bg: string; darkBg: string; iconColor: string }> = {
  article: { bg: "bg-blue-50", darkBg: "dark:bg-blue-950/30", iconColor: "text-blue-400" },
  video: { bg: "bg-indigo-50", darkBg: "dark:bg-indigo-950/30", iconColor: "text-indigo-400" },
  audio: { bg: "bg-purple-50", darkBg: "dark:bg-purple-950/30", iconColor: "text-purple-400" },
  h5: { bg: "bg-pink-50", darkBg: "dark:bg-pink-950/30", iconColor: "text-pink-400" },
};

const ThumbIcon: Record<string, typeof FileText> = {
  article: ImageIcon,
  video: Video,
  audio: Headphones,
  h5: Code2,
};

export default function ArticlesClient({ articles, stats, categories }: Props) {
  const [search, setSearch] = useState("");
  const [activeStatus, setActiveStatus] = useState("all");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeMediaType, setActiveMediaType] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [categoryOpen, setCategoryOpen] = useState(true);
  const [mediaTypeDropdownOpen, setMediaTypeDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"updated" | "created" | "title">("updated");

  const archivedCount = useMemo(
    () => articles.filter((a) => a.status === "archived").length,
    [articles]
  );

  const filteredArticles = useMemo(() => {
    let result = articles.filter((article) => {
      const matchesSearch =
        !search ||
        article.title.toLowerCase().includes(search.toLowerCase()) ||
        article.headline?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        activeStatus === "all" || article.status === activeStatus;
      const matchesCategory =
        activeCategory === "all" || article.categoryId === activeCategory;
      const matchesMediaType =
        activeMediaType === "all" || article.mediaType === activeMediaType;
      return matchesSearch && matchesStatus && matchesCategory && matchesMediaType;
    });

    if (sortBy === "created") {
      result = [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === "title") {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));
    }

    return result;
  }, [articles, search, activeStatus, activeCategory, activeMediaType, sortBy]);

  const activeSectionLabel = useMemo(() => {
    if (activeStatus !== "all") {
      return statusItems.find((s) => s.key === activeStatus)?.label || "全部";
    }
    if (activeCategory !== "all") {
      return categories.find((c) => c.id === activeCategory)?.name || "全部";
    }
    if (activeMediaType !== "all") {
      return mediaTypeItems.find((m) => m.key === activeMediaType)?.label || "全部";
    }
    return "全部稿件";
  }, [activeStatus, activeCategory, activeMediaType, categories]);

  /* Sidebar item renderer */
  const SidebarItem = ({
    icon: Icon,
    label,
    count,
    active,
    onClick,
  }: {
    icon: typeof Inbox;
    label: string;
    count: number;
    active: boolean;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={cn(
        "relative w-full flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] transition-all",
        active
          ? cn(
              // 半透明玻璃效果：白色 60% 透明 + 内阴影 + 蓝色 ring
              "bg-white/65 dark:bg-white/8 backdrop-blur-md",
              "shadow-[0_1px_3px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.7)]",
              "dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)]",
              "ring-1 ring-blue-400/25 dark:ring-blue-400/30",
              "text-blue-600 dark:text-blue-400 font-medium"
            )
          : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5"
      )}
    >
      <Icon
        size={16}
        className={active ? "text-blue-500 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}
      />
      <span className="flex-1 text-left truncate">{label}</span>
      <span
        className={cn(
          "text-xs tabular-nums",
          active ? "text-blue-500 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"
        )}
      >
        {count}
      </span>
    </button>
  );

  return (
    <div className="flex h-[calc(100vh-64px)] -m-6">
      {/* ── Left Sidebar ── */}
      <aside className="w-[220px] shrink-0 border-r border-[var(--glass-border)] bg-[var(--glass-panel-bg)] backdrop-blur-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 pt-5 pb-3">
          <h2 className="text-[15px] font-semibold text-gray-800 dark:text-gray-100">
            稿件管理
          </h2>
        </div>

        <nav className="px-2.5 flex-1 overflow-y-auto space-y-0.5 pb-4">
          {/* ── 栏目分类 ── */}
          <div className="!mb-1">
            <button
              onClick={() => setCategoryOpen(!categoryOpen)}
              className="w-full flex items-center justify-between px-3 py-1 text-[11px] font-medium text-gray-400 dark:text-gray-500 tracking-wider hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
            >
              <span>栏目分类</span>
              {categoryOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          </div>
          {categoryOpen && (
            <>
              <SidebarItem
                icon={Inbox}
                label="全部"
                count={stats.totalCount}
                active={activeCategory === "all"}
                onClick={() => {
                  setActiveCategory("all");
                  setActiveStatus("all");
                  setActiveMediaType("all");
                }}
              />
              {categories.map((cat) => (
                <SidebarItem
                  key={cat.id}
                  icon={FolderOpen}
                  label={cat.name}
                  count={cat.articleCount}
                  active={activeCategory === cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setActiveStatus("all");
                    setActiveMediaType("all");
                  }}
                />
              ))}
              {categories.length === 0 && (
                <p className="px-3 py-1.5 text-[11px] text-gray-400 dark:text-gray-500">暂无栏目</p>
              )}
            </>
          )}

        </nav>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Toolbar ── */}
        <div className="flex items-center gap-3 px-5 h-12 border-b border-[var(--glass-border)] bg-[var(--glass-panel-bg)] backdrop-blur-xl shrink-0 relative z-[100]">
          {/* Search */}
          <SearchInput
            className="flex-1 max-w-md"
            inputClassName="h-8 text-[13px]"
            placeholder="搜索 (⌘B)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* Action Buttons */}
          <div className="flex items-center gap-0.5 ml-auto">
            {/* Status dropdown */}
            <div className="relative">
              <ToolbarButton
                icon={Filter}
                label={activeStatus === "all" ? "状态" : statusItems.find((s) => s.key === activeStatus)?.label || "状态"}
                onClick={() => { setStatusDropdownOpen(!statusDropdownOpen); setMediaTypeDropdownOpen(false); }}
                active={activeStatus !== "all"}
              />
              {statusDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-[999]" onClick={() => setStatusDropdownOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-[1000] w-32 py-1.5 rounded-xl bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black/5 dark:ring-white/10">
                    {[{ key: "all", label: "不限" }, ...statusItems.filter((s) => s.key !== "all")].map((item) => (
                      <button
                        key={item.key}
                        onClick={() => {
                          setActiveStatus(item.key);
                          setStatusDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] transition-colors",
                          activeStatus === item.key
                            ? "text-blue-600 dark:text-blue-400 font-medium"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5"
                        )}
                      >
                        {activeStatus === item.key ? <CheckCircle size={14} className="text-blue-500 dark:text-blue-400" /> : <span className="w-3.5" />}
                        {item.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Media type dropdown */}
            <div className="relative">
              <ToolbarButton
                icon={FileText}
                label={activeMediaType === "all" ? "类型" : mediaTypeItems.find((m) => m.key === activeMediaType)?.label || "类型"}
                onClick={() => { setMediaTypeDropdownOpen(!mediaTypeDropdownOpen); setStatusDropdownOpen(false); }}
                active={activeMediaType !== "all"}
              />
              {mediaTypeDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-[999]" onClick={() => setMediaTypeDropdownOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-[1000] w-32 py-1.5 rounded-xl bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black/5 dark:ring-white/10">
                    {[{ key: "all", label: "不限" }, ...mediaTypeItems].map((item) => (
                      <button
                        key={item.key}
                        onClick={() => {
                          setActiveMediaType(item.key);
                          setMediaTypeDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] transition-colors",
                          activeMediaType === item.key
                            ? "text-blue-600 dark:text-blue-400 font-medium"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5"
                        )}
                      >
                        {activeMediaType === item.key ? <CheckCircle size={14} className="text-blue-500 dark:text-blue-400" /> : <span className="w-3.5" />}
                        {item.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Sort dropdown */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="appearance-none h-8 pl-7 pr-8 rounded-lg bg-transparent text-[13px] text-gray-500 dark:text-gray-400 hover:bg-gray-100/60 dark:hover:bg-white/5 cursor-pointer outline-none transition-colors"
              >
                <option value="updated">排序</option>
                <option value="created">创建时间</option>
                <option value="title">标题排序</option>
              </select>
              <ArrowUpDown size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {/* View toggle */}
            <button
              onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
              className="h-8 flex items-center gap-1.5 px-2.5 rounded-lg text-[13px] text-gray-500 dark:text-gray-400 hover:bg-gray-100/60 dark:hover:bg-white/5 transition-colors"
            >
              {viewMode === "grid" ? <LayoutGrid size={14} /> : <List size={14} />}
              <span>视图</span>
            </button>

            {/* New article */}
            <PermissionGate permission="content:write">
            <Link
              href="/articles/create"
              className="ml-1 h-8 w-8 flex items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            >
              <Plus size={16} />
            </Link>
            </PermissionGate>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto bg-[#f9fafb] dark:bg-transparent">
          {/* Section Header */}
          <div className="flex items-baseline justify-between px-6 pt-5 pb-3">
            <h3 className="text-[15px] font-semibold text-gray-800 dark:text-gray-100">
              {activeSectionLabel}
            </h3>
            <span className="text-[13px] text-gray-400 dark:text-gray-500 tabular-nums">
              {filteredArticles.length} / {stats.totalCount}
            </span>
          </div>

          {/* Grid / List */}
          {filteredArticles.length > 0 ? (
            viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 px-6 pb-6">
                {filteredArticles.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            ) : (
              <div className="space-y-2 px-6 pb-6">
                {filteredArticles.map((article) => (
                  <ArticleListRow key={article.id} article={article} />
                ))}
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400 dark:text-gray-500">
              <FileText size={48} className="mb-3 opacity-40" />
              <p className="text-sm">暂无匹配的稿件</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Toolbar Button ── */
function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: typeof Archive;
  label: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-8 flex items-center gap-1.5 px-2.5 rounded-lg text-[13px] transition-colors",
        active
          ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30"
          : "text-gray-500 dark:text-gray-400 hover:bg-gray-100/60 dark:hover:bg-white/5"
      )}
    >
      <Icon size={14} />
      <span>{label}</span>
    </button>
  );
}

/* ── Article Card (Grid View) ── */
function ArticleCard({ article }: { article: ArticleListItem }) {
  const dotColor = statusDotColor[article.status] || "bg-gray-400";
  const tc = thumbConfig[article.mediaType] || thumbConfig.article;
  const TIcon = ThumbIcon[article.mediaType] || FileText;

  const isOriginal = article.sourceType === "original";
  const sourceLabel = isOriginal
    ? "原创"
    : article.sourceName || "其他来源";

  // 处理中徽章（转码优先，因为更阻塞编辑）
  const processingLabel = article.transcodingStatus === "processing"
    ? "正在转码"
    : article.aiAnalysisStatus === "processing"
      ? "AI 分析中"
      : null;

  return (
    <Link href={`/articles/${article.id}`} className="group block h-full">
      <div className="glass-card-interactive p-4 pb-0 h-full flex flex-col overflow-hidden !border-gray-200/85 dark:!border-white/10">
        {/* Top: Title + Thumbnail side by side */}
        <div className="flex gap-3 mb-2">
          {/* Left: Title + Description */}
          <div className="flex-1 min-w-0 flex flex-col">
            <h4 className="relative z-10 text-[13px] font-semibold text-gray-900 dark:text-gray-100 leading-[1.45] line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {article.title}
            </h4>
            <p className="relative z-10 mt-1.5 text-[12px] text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-2">
              {article.headline || article.title}
            </p>
          </div>

          {/* Right: Thumbnail with glass effect */}
          <div
            className={cn(
              "relative z-10 w-[72px] h-[72px] rounded-xl shrink-0 flex items-center justify-center",
              "backdrop-blur-sm border border-white/40 dark:border-white/10",
              "shadow-sm",
              tc.bg,
              tc.darkBg
            )}
          >
            <TIcon size={24} className={tc.iconColor} />
          </div>
        </div>

        {/* 状态行：状态点 + 分配/栏目 + 处理中徽章 */}
        <div className="relative z-10 flex items-center justify-between mt-3 pb-2.5">
          <div className="flex items-center gap-1.5 min-w-0 text-[11px] text-gray-400 dark:text-gray-500">
            <span className={cn("w-3.5 h-3.5 rounded-full shrink-0", dotColor)} />
            <span className="truncate">
              {article.assigneeName || article.categoryName || "未分配"}
            </span>
          </div>

          {processingLabel && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-500/15 px-1.5 py-0.5 rounded-md shrink-0">
              <Loader2 className="w-3 h-3 animate-spin" />
              {processingLabel}
            </span>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* 来源区（浅蓝 tint，边到边）—— 单行布局，左来源右作者 */}
        <div className="relative z-10 -mx-4 px-4 py-3 bg-blue-50/55 dark:bg-blue-500/[0.06] border-t border-gray-200/80 dark:border-white/10 rounded-b-[18px] flex items-center gap-2">
          {/* 左：来源 icon + 名称 · 创建时间（flex-1 + truncate，过长省略） */}
          <div className={cn(
            "flex items-center gap-1.5 min-w-0 flex-1 text-[11px] font-medium",
            isOriginal
              ? "text-sky-700 dark:text-sky-300"
              : "text-blue-700 dark:text-blue-300"
          )}>
            {isOriginal ? (
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
            ) : article.sourceIconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={article.sourceIconUrl}
                alt={article.sourceName ?? "来源"}
                className="w-3.5 h-3.5 shrink-0 rounded-sm object-contain"
              />
            ) : (
              <Globe className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="truncate min-w-0">{sourceLabel}</span>
            <span className="text-gray-400 dark:text-gray-500 shrink-0">·</span>
            <span className="text-gray-500 dark:text-gray-400 shrink-0 font-normal">
              {formatDate(article.createdAt)}
            </span>
          </div>

          {/* 右：作者（shrink-0，永不挤压） */}
          {article.authorName && (
            <span className="text-[10.5px] text-gray-500 dark:text-gray-400 shrink-0 max-w-[80px] truncate">
              {article.authorName}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ── Article List Row ── */
function ArticleListRow({ article }: { article: ArticleListItem }) {
  const dotColor = statusDotColor[article.status] || "bg-gray-400";

  return (
    <Link href={`/articles/${article.id}`} className="group block">
      <div className="glass-card-interactive flex items-center gap-4 px-5 py-3.5">
        <div className="relative z-10 flex-1 min-w-0">
          <h4 className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {article.title}
          </h4>
          <p className="mt-0.5 text-[12px] text-gray-600 dark:text-gray-400 truncate">
            {article.headline || article.title}
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500 shrink-0">
          <span className={cn("w-3.5 h-3.5 rounded-full shrink-0", dotColor)} />
          <span>{article.assigneeName || article.categoryName || "未分配"}</span>
          <span>·</span>
          <span>{formatDate(article.updatedAt)}</span>
        </div>

        {article.tags.length > 0 && (
          <span className={cn(
            "relative z-10 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium text-white shrink-0",
            article.tags.length >= 3 ? "bg-blue-500" : article.tags.length >= 2 ? "bg-green-500" : "bg-amber-400"
          )}>
            {article.tags.length}
          </span>
        )}
      </div>
    </Link>
  );
}

/* ── Helpers ── */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays < 7) return `${diffDays}天前`;

  const month = d.getMonth() + 1;
  const day = d.getDate();
  if (d.getFullYear() === now.getFullYear()) {
    return `${month}月${day}日`;
  }
  return `${d.getFullYear()}/${month}/${day}`;
}
