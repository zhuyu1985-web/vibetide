"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Folder,
  Save,
  FileText,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createCategory, updateCategory } from "@/app/actions/categories";
import type { CategoryNode } from "@/lib/types";

interface Props {
  categoryTree: CategoryNode[];
}

export default function CategoriesClient({ categoryTree }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Flatten tree for lookups
  const flatCategories = flattenTree(categoryTree);
  const selectedCategory = selectedId
    ? flatCategories.find((c) => c.id === selectedId)
    : null;

  // New category dialog state
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newParentId, setNewParentId] = useState("none");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Edit state
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editParentId, setEditParentId] = useState("none");

  function selectCategory(cat: CategoryNode) {
    setSelectedId(cat.id);
    setEditName(cat.name);
    setEditSlug(cat.slug);
    setEditDescription(cat.description || "");
    setEditParentId(cat.parentId || "none");
  }

  function handleCreate() {
    if (!newName.trim() || !newSlug.trim()) return;
    startTransition(async () => {
      await createCategory({
        organizationId: "",
        name: newName,
        slug: newSlug,
        description: newDescription || undefined,
        parentId: newParentId !== "none" ? newParentId : undefined,
        level: newParentId !== "none" ? 1 : 0,
      });
      setNewName("");
      setNewSlug("");
      setNewDescription("");
      setNewParentId("none");
      setDialogOpen(false);
      router.refresh();
    });
  }

  function handleUpdate() {
    if (!selectedId || !editName.trim() || !editSlug.trim()) return;
    startTransition(async () => {
      await updateCategory(selectedId, {
        name: editName,
        slug: editSlug,
        description: editDescription || undefined,
        parentId: editParentId !== "none" ? editParentId : null,
      });
      router.refresh();
    });
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        title="栏目管理"
        description="管理内容栏目的层级结构"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus size={16} className="mr-2" />
                新建栏目
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新建栏目</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label htmlFor="newName" className="mb-2">
                    栏目名称
                  </Label>
                  <Input
                    id="newName"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="例如：时政要闻"
                  />
                </div>
                <div>
                  <Label htmlFor="newSlug" className="mb-2">
                    栏目标识
                  </Label>
                  <Input
                    id="newSlug"
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value)}
                    placeholder="例如：politics-news"
                  />
                </div>
                <div>
                  <Label htmlFor="newDesc" className="mb-2">
                    描述（可选）
                  </Label>
                  <Textarea
                    id="newDesc"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="栏目简要描述..."
                    className="min-h-[80px]"
                  />
                </div>
                <div>
                  <Label htmlFor="newParent" className="mb-2">
                    父栏目
                  </Label>
                  <Select value={newParentId} onValueChange={setNewParentId}>
                    <SelectTrigger id="newParent" className="w-full">
                      <SelectValue placeholder="无（顶级栏目）" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">无（顶级栏目）</SelectItem>
                      {flatCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">取消</Button>
                </DialogClose>
                <Button
                  onClick={handleCreate}
                  disabled={isPending || !newName.trim() || !newSlug.trim()}
                >
                  创建
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Category Tree */}
        <div className="col-span-1">
          <GlassCard padding="md">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
              <FolderOpen size={16} className="text-blue-500" />
              栏目结构
            </h3>

            {categoryTree.length > 0 ? (
              <div className="space-y-0.5">
                {categoryTree.map((node) => (
                  <CategoryTreeNode
                    key={node.id}
                    node={node}
                    level={0}
                    selectedId={selectedId}
                    onSelect={selectCategory}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                <Folder size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">暂无栏目</p>
                <p className="text-xs mt-1">点击上方按钮创建第一个栏目</p>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Right: Selected Category Detail */}
        <div className="col-span-2">
          {selectedCategory ? (
            <GlassCard padding="lg">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  {selectedCategory.name}
                </h3>
                <Badge variant="secondary" className="text-xs">
                  <FileText size={12} className="mr-1" />
                  {selectedCategory.articleCount} 篇稿件
                </Badge>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="editName" className="mb-2">
                    栏目名称
                  </Label>
                  <Input
                    id="editName"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="editSlug" className="mb-2">
                    <Hash size={14} className="text-gray-400 dark:text-gray-500" />
                    栏目标识
                  </Label>
                  <Input
                    id="editSlug"
                    value={editSlug}
                    onChange={(e) => setEditSlug(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="editDesc" className="mb-2">
                    描述
                  </Label>
                  <Textarea
                    id="editDesc"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="栏目简要描述..."
                    className="min-h-[100px]"
                  />
                </div>

                <div>
                  <Label htmlFor="editParent" className="mb-2">
                    父栏目
                  </Label>
                  <Select value={editParentId} onValueChange={setEditParentId}>
                    <SelectTrigger id="editParent" className="w-full">
                      <SelectValue placeholder="无（顶级栏目）" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">无（顶级栏目）</SelectItem>
                      {flatCategories
                        .filter((c) => c.id !== selectedId)
                        .map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={handleUpdate}
                    disabled={isPending || !editName.trim() || !editSlug.trim()}
                  >
                    <Save size={16} className="mr-2" />
                    保存修改
                  </Button>
                </div>
              </div>
            </GlassCard>
          ) : (
            <GlassCard padding="lg">
              <div className="text-center py-16 text-gray-400 dark:text-gray-500">
                <FolderOpen size={48} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm">请在左侧选择一个栏目查看详情</p>
              </div>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryTreeNode({
  node,
  level,
  selectedId,
  onSelect,
}: {
  node: CategoryNode;
  level: number;
  selectedId: string | null;
  onSelect: (cat: CategoryNode) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = node.id === selectedId;

  return (
    <div>
      <button
        onClick={() => onSelect(node)}
        className={cn(
          "w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors",
          isSelected
            ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400"
            : "hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-700 dark:text-gray-300"
        )}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="p-0.5 rounded hover:bg-gray-200/50 transition-colors"
          >
            {expanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
          </button>
        ) : (
          <span className="w-[18px]" />
        )}

        <Folder
          size={14}
          className={cn(
            "shrink-0",
            isSelected ? "text-blue-500" : "text-gray-400 dark:text-gray-500"
          )}
        />

        <span className="text-sm font-medium truncate flex-1">
          {node.name}
        </span>

        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
          {node.articleCount}
        </Badge>
      </button>

      {hasChildren && expanded && (
        <div>
          {node.children!.map((child) => (
            <CategoryTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function flattenTree(nodes: CategoryNode[]): CategoryNode[] {
  const result: CategoryNode[] = [];
  function walk(list: CategoryNode[]) {
    for (const node of list) {
      result.push(node);
      if (node.children && node.children.length > 0) {
        walk(node.children);
      }
    }
  }
  walk(nodes);
  return result;
}
