"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HardDrive } from "lucide-react";
import { LibrarySidebar } from "@/components/media-assets/library-sidebar";
import { ResourceToolbar } from "@/components/media-assets/resource-toolbar";
import { ResourceGrid } from "@/components/media-assets/resource-grid";
import { ResourceList } from "@/components/media-assets/resource-list";
import { ResourcePagination } from "@/components/media-assets/resource-pagination";
import { BatchActionBar } from "@/components/media-assets/batch-action-bar";
import { UploadDialog } from "@/components/media-assets/upload-dialog";
import { MoveToDialog } from "@/components/media-assets/move-to-dialog";
import {
  softDeleteAsset, batchSoftDelete, moveToProductLibrary,
  batchMove, batchSubmitForReview, batchTriggerUnderstanding,
} from "@/app/actions/assets";
import type {
  MediaLibraryType, MediaAssetFull, MediaAssetStats,
  MediaCategoryNode, PaginatedAssets,
} from "@/lib/types";

interface Props {
  initialAssets: PaginatedAssets;
  initialStats: MediaAssetStats;
  categories: MediaCategoryNode[];
  initialLibrary: MediaLibraryType;
}

export default function MediaAssetsModuleClient({
  initialAssets, initialStats, categories, initialLibrary,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // State
  const [library, setLibrary] = useState<MediaLibraryType>(initialLibrary);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortField, setSortField] = useState("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialogs
  const [uploadOpen, setUploadOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveDialogMode, setMoveDialogMode] = useState<"moveToProduct" | "move">("moveToProduct");

  // Data (initially from server, refreshes via router.refresh)
  const assets = initialAssets;
  const stats = initialStats;

  // Navigation
  const changeLibrary = useCallback((lib: MediaLibraryType) => {
    setLibrary(lib);
    setSelectedIds(new Set());
    setSearch("");
    setTypeFilter("all");
    setActiveCategoryId(null);
    startTransition(() => {
      router.push(`/media-assets?library=${lib}`);
    });
  }, [router]);

  const changePage = useCallback((page: number) => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  // Selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(assets.items.map((a) => a.id)));
  }, [assets.items]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Batch actions
  const handleBatchDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await batchSoftDelete(ids);
    clearSelection();
    router.refresh();
  };

  const handleBatchMoveToProduct = () => {
    setMoveDialogMode("moveToProduct");
    setMoveDialogOpen(true);
  };

  const handleBatchMove = () => {
    setMoveDialogMode("move");
    setMoveDialogOpen(true);
  };

  const handleMoveConfirm = async (categoryId: string) => {
    const ids = Array.from(selectedIds);
    if (moveDialogMode === "moveToProduct") {
      for (const id of ids) await moveToProductLibrary(id, categoryId);
    } else {
      await batchMove(ids, categoryId);
    }
    setMoveDialogOpen(false);
    clearSelection();
    router.refresh();
  };

  const handleBatchReview = async () => {
    await batchSubmitForReview(Array.from(selectedIds));
    clearSelection();
    router.refresh();
  };

  const handleBatchSmartProcess = async () => {
    await batchTriggerUnderstanding(Array.from(selectedIds));
    clearSelection();
    router.refresh();
  };

  const selectable = library !== "public";

  // Client-side filtering (supplements server-side pagination)
  let displayAssets = assets.items;
  if (search) {
    const q = search.toLowerCase();
    displayAssets = displayAssets.filter(
      (a) => a.title.toLowerCase().includes(q) || a.tags.some((t) => t.toLowerCase().includes(q))
    );
  }
  if (typeFilter !== "all") {
    displayAssets = displayAssets.filter((a) => a.type === typeFilter);
  }

  return (
    <div className="flex h-[calc(100vh-64px)] -m-6">
      {/* Sidebar */}
      <LibrarySidebar
        activeLibrary={library}
        activeCategoryId={activeCategoryId}
        categories={categories}
        storageDisplay={stats.totalStorageDisplay}
        onLibraryChange={changeLibrary}
        onCategorySelect={setActiveCategoryId}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Toolbar */}
          <ResourceToolbar
            library={library}
            search={search}
            onSearchChange={setSearch}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            sortField={sortField}
            sortDirection={sortDirection}
            onSortChange={(f, d) => { setSortField(f); setSortDirection(d); }}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onUploadClick={() => setUploadOpen(true)}
            infoPanelOpen={infoPanelOpen}
            onInfoPanelToggle={() => setInfoPanelOpen(!infoPanelOpen)}
          />

          {/* Batch action bar */}
          <BatchActionBar
            library={library}
            selectedCount={selectedIds.size}
            onSelectAll={selectAll}
            onClearSelection={clearSelection}
            onDelete={handleBatchDelete}
            onShare={() => {}}
            onMoveToProduct={library === "personal" ? handleBatchMoveToProduct : undefined}
            onMove={library === "product" ? handleBatchMove : undefined}
            onSubmitReview={library === "product" ? handleBatchReview : undefined}
            onSmartProcess={handleBatchSmartProcess}
          />

          {/* Stats summary */}
          <div className="flex items-center gap-4 mb-4 text-[12px] text-gray-400 dark:text-gray-500">
            <span>共 {assets.total} 项</span>
            {stats.videoCount > 0 && <span>视频 {stats.videoCount}</span>}
            {stats.imageCount > 0 && <span>图片 {stats.imageCount}</span>}
            {stats.audioCount > 0 && <span>音频 {stats.audioCount}</span>}
            {stats.documentCount > 0 && <span>文档 {stats.documentCount}</span>}
          </div>

          {/* Content */}
          {displayAssets.length === 0 ? (
            <div className="text-center py-20 text-gray-400 dark:text-gray-500">
              <HardDrive size={48} className="mx-auto mb-3 opacity-50" />
              <p className="text-[13px]">
                {library === "recycle" ? "回收站为空" : "暂无资源"}
              </p>
            </div>
          ) : viewMode === "grid" ? (
            <ResourceGrid
              assets={displayAssets}
              selectedIds={selectedIds}
              selectable={selectable}
              onSelect={toggleSelect}
            />
          ) : (
            <ResourceList
              assets={displayAssets}
              selectedIds={selectedIds}
              selectable={selectable}
              onSelect={toggleSelect}
            />
          )}

          {/* Pagination */}
          <ResourcePagination
            total={assets.total}
            page={assets.page}
            pageSize={assets.pageSize}
            totalPages={assets.totalPages}
            onPageChange={changePage}
            onPageSizeChange={() => {}}
          />
        </div>
      </div>

      {/* Upload dialog */}
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        libraryType={library === "product" ? "product" : "personal"}
        categoryId={activeCategoryId || undefined}
      />

      {/* Move dialog */}
      <MoveToDialog
        open={moveDialogOpen}
        onOpenChange={setMoveDialogOpen}
        title={moveDialogMode === "moveToProduct" ? "入成品库" : "移动到栏目"}
        description={
          moveDialogMode === "moveToProduct"
            ? "选择目标栏目，视频/音频将按栏目转码组重新转码"
            : "选择目标栏目"
        }
        categories={categories}
        onConfirm={handleMoveConfirm}
      />
    </div>
  );
}
