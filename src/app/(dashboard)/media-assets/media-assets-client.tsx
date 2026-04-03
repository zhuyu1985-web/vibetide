"use client";

import { useState, useCallback, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { HardDrive } from "lucide-react";
import { LibrarySidebar } from "@/components/media-assets/library-sidebar";
import { ResourceToolbar } from "@/components/media-assets/resource-toolbar";
import { ResourceGrid } from "@/components/media-assets/resource-grid";
import { ResourceList } from "@/components/media-assets/resource-list";
// Pagination removed — using infinite scroll
import { BatchActionBar } from "@/components/media-assets/batch-action-bar";
import { UploadDialog } from "@/components/media-assets/upload-dialog";
import { MoveToDialog } from "@/components/media-assets/move-to-dialog";
import { PermissionGate } from "@/components/shared/permission-gate";
import { CategoryPermissionDialog } from "@/components/media-assets/category-permission-dialog";
import {
  softDeleteAsset, batchSoftDelete, moveToProductLibrary,
  batchMove, batchSubmitForReview, batchTriggerUnderstanding,
  fetchMoreAssets,
} from "@/app/actions/assets";
import {
  createMediaCategory, renameMediaCategory, deleteMediaCategory,
  fetchCategoryPermissions, fetchOrgUsers,
} from "@/app/actions/categories";
import type {
  MediaLibraryType, MediaAssetFull, MediaAssetStats,
  MediaCategoryNode, PaginatedAssets, CategoryPermissionItem,
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
  const [localCategories, setLocalCategories] = useState<MediaCategoryNode[]>(categories);
  // Sync from server when props update (after router.refresh)
  useEffect(() => { setLocalCategories(categories); }, [categories]);
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

  // Permission dialog
  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const [permCategoryId, setPermCategoryId] = useState("");
  const [permCategoryName, setPermCategoryName] = useState("");
  const [permList, setPermList] = useState<CategoryPermissionItem[]>([]);
  const [orgUsers, setOrgUsers] = useState<{ id: string; displayName: string; role: string }[]>([]);

  // Infinite scroll state
  const [allAssets, setAllAssets] = useState<MediaAssetFull[]>(initialAssets.items);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialAssets.page < initialAssets.totalPages);
  const [loadingMore, setLoadingMore] = useState(false);
  const stats = initialStats;

  // Load more handler
  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const result = await fetchMoreAssets(library, activeCategoryId, nextPage, 20, search, typeFilter);
    setAllAssets((prev) => [...prev, ...result.items]);
    setPage(nextPage);
    setHasMore(nextPage < result.totalPages);
    setLoadingMore(false);
  }, [loadingMore, hasMore, page, library, activeCategoryId, search, typeFilter]);

  // Reset scroll state when library/category/filters change
  const resetAndRefresh = useCallback((lib: MediaLibraryType, catId: string | null) => {
    setAllAssets([]);
    setPage(0);
    setHasMore(true);
    setLoadingMore(false);
    setSelectedIds(new Set());
  }, []);

  // Navigation
  const changeLibrary = useCallback((lib: MediaLibraryType) => {
    setLibrary(lib);
    setSearch("");
    setTypeFilter("all");
    setActiveCategoryId(null);
    resetAndRefresh(lib, null);
    startTransition(() => {
      router.push(`/media-assets?library=${lib}`);
    });
  }, [router, resetAndRefresh]);

  // Selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(allAssets.map((a) => a.id)));
  }, [allAssets]);

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

  // Category management — optimistic updates
  const handleCreateCategory = async (name: string, parentId?: string) => {
    const tempId = `temp-${Date.now()}`;
    const tempNode: MediaCategoryNode = {
      id: tempId,
      name,
      slug: "",
      sortOrder: 999,
      articleCount: 0,
      children: [],
      mediaAssetCount: 0,
    };

    // Optimistic: add to local state immediately
    setLocalCategories((prev) => {
      if (!parentId) {
        return [...prev, tempNode];
      }
      return addChildToTree(prev, parentId, tempNode);
    });

    // Fire server action in background
    createMediaCategory({ name, parentId }).then(() => {
      router.refresh();
    });
  };

  const handleRenameCategory = async (categoryId: string, newName: string) => {
    // Optimistic: rename in local state immediately
    setLocalCategories((prev) => renameInTree(prev, categoryId, newName));

    // Fire server action in background
    renameMediaCategory(categoryId, newName).then(() => {
      router.refresh();
    });
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const result = await deleteMediaCategory(categoryId);
    if (result?.error) {
      return { error: result.error };
    }
    // Optimistic: remove from local state immediately
    setLocalCategories((prev) => removeFromTree(prev, categoryId));
    if (activeCategoryId === categoryId) {
      setActiveCategoryId(null);
    }
    router.refresh();
    return {};
  };

  // Permission management
  const handlePermissionClick = async (categoryId: string, categoryName: string) => {
    setPermCategoryId(categoryId);
    setPermCategoryName(categoryName);
    const [perms, users] = await Promise.all([
      fetchCategoryPermissions(categoryId),
      fetchOrgUsers(),
    ]);
    setPermList(perms);
    setOrgUsers(users);
    setPermDialogOpen(true);
  };

  const handlePermRefresh = async () => {
    const perms = await fetchCategoryPermissions(permCategoryId);
    setPermList(perms);
  };

  const selectable = library !== "public";

  // Client-side filtering
  let displayAssets = allAssets;
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
        categories={localCategories}
        storageDisplay={stats.totalStorageDisplay}
        onLibraryChange={changeLibrary}
        onCategorySelect={setActiveCategoryId}
        onCreateCategory={handleCreateCategory}
        onRenameCategory={handleRenameCategory}
        onDeleteCategory={handleDeleteCategory}
        onPermissionClick={handlePermissionClick}
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
            <span>共 {initialAssets.total} 项</span>
            {stats.videoCount > 0 && <span>视频 {stats.videoCount}</span>}
            {stats.imageCount > 0 && <span>图片 {stats.imageCount}</span>}
            {stats.audioCount > 0 && <span>音频 {stats.audioCount}</span>}
            {stats.documentCount > 0 && <span>文档 {stats.documentCount}</span>}
          </div>

          {/* Content — infinite scroll */}
          {displayAssets.length === 0 && !loadingMore ? (
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
              hasMore={hasMore}
              loading={loadingMore}
              onLoadMore={handleLoadMore}
            />
          ) : (
            <ResourceList
              assets={displayAssets}
              selectedIds={selectedIds}
              selectable={selectable}
              onSelect={toggleSelect}
            />
          )}
        </div>
      </div>

      {/* Upload dialog */}
      <PermissionGate permission="content:write">
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        libraryType={library === "product" ? "product" : "personal"}
        categoryId={activeCategoryId || undefined}
      />
      </PermissionGate>

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

      {/* Permission dialog */}
      <CategoryPermissionDialog
        open={permDialogOpen}
        onOpenChange={setPermDialogOpen}
        categoryId={permCategoryId}
        categoryName={permCategoryName}
        permissions={permList}
        orgUsers={orgUsers}
        onRefresh={handlePermRefresh}
      />
    </div>
  );
}

// ── Tree manipulation helpers ──────────────────────

function addChildToTree(
  nodes: MediaCategoryNode[],
  parentId: string,
  child: MediaCategoryNode,
): MediaCategoryNode[] {
  return nodes.map((n) => {
    if (n.id === parentId) {
      return { ...n, children: [...(n.children || []), child] };
    }
    if (n.children && n.children.length > 0) {
      return { ...n, children: addChildToTree(n.children as MediaCategoryNode[], parentId, child) };
    }
    return n;
  });
}

function renameInTree(
  nodes: MediaCategoryNode[],
  id: string,
  newName: string,
): MediaCategoryNode[] {
  return nodes.map((n) => {
    if (n.id === id) return { ...n, name: newName };
    if (n.children && n.children.length > 0) {
      return { ...n, children: renameInTree(n.children as MediaCategoryNode[], id, newName) };
    }
    return n;
  });
}

function removeFromTree(
  nodes: MediaCategoryNode[],
  id: string,
): MediaCategoryNode[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => {
      if (n.children && n.children.length > 0) {
        return { ...n, children: removeFromTree(n.children as MediaCategoryNode[], id) };
      }
      return n;
    });
}
