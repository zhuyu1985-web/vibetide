"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  Folder,
  Plus,
  MoreHorizontal,
  Pin,
  PinOff,
  Archive,
  Trash2,
  Pencil,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/shared/search-input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn } from "@/lib/utils";
import {
  createProjectAction,
  updateProjectAction,
  pinProjectAction,
  archiveProjectAction,
  deleteProjectAction,
} from "@/app/actions/projects";
import type { Project } from "@/db/schema/projects";

export function ProjectsClient({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [renameTarget, setRenameTarget] = useState<Project | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : projects;
  }, [projects, query]);

  function handleNew() {
    startTransition(async () => {
      const res = await createProjectAction({ name: "新项目" });
      if (res.ok) {
        setRenameTarget(res.data);
        setRenameDraft(res.data.name);
        router.refresh();
      }
    });
  }

  function commitRename() {
    const target = renameTarget;
    const name = renameDraft.trim();
    setRenameTarget(null);
    if (!target || !name || name === target.name) return;
    startTransition(async () => {
      await updateProjectAction({ id: target.id, name });
      router.refresh();
    });
  }

  function handlePin(p: Project) {
    startTransition(async () => {
      await pinProjectAction(p.id, p.pinnedAt == null);
      router.refresh();
    });
  }

  function handleArchive(id: string) {
    startTransition(async () => {
      await archiveProjectAction(id, true);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteProjectAction(id);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-medium">项目</h1>
        <Button variant="secondary" className="gap-1.5" disabled={pending} onClick={handleNew}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          新建项目
        </Button>
      </div>

      <SearchInput
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索项目…"
        className="mb-5"
      />

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
          <Folder className="size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {query ? "无匹配的项目" : "还没有项目,点「新建项目」开始"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map((p) => (
            <div key={p.id} className="group relative">
              <Link
                href={`/cowork/projects/${p.id}`}
                className="block rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-primary/30 hover:bg-muted/40"
              >
                <div className="flex items-center gap-2 pr-6">
                  <span
                    className="flex size-8 flex-none items-center justify-center rounded-lg"
                    style={{ background: `${p.color ?? "#6b7280"}1f` }}
                  >
                    <Folder className="size-4" style={{ color: p.color ?? "#6b7280" }} />
                  </span>
                  <span className="truncate font-medium">{p.name}</span>
                  {p.pinnedAt && <Pin className="size-3.5 flex-none text-primary/70" />}
                </div>
                {p.description && (
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                    {p.description}
                  </p>
                )}
                <p className="mt-3 text-[11px] text-muted-foreground/60">
                  更新于{" "}
                  {formatDistanceToNow(new Date(p.updatedAt), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </p>
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="项目操作"
                    className={cn(
                      "absolute right-2 top-2 text-muted-foreground",
                      "opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100",
                    )}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem
                    onSelect={() => {
                      setRenameTarget(p);
                      setRenameDraft(p.name);
                    }}
                  >
                    <Pencil className="size-3.5" /> 重命名
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handlePin(p)}>
                    {p.pinnedAt ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                    {p.pinnedAt ? "取消置顶" : "置顶"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleArchive(p.id)}>
                    <Archive className="size-3.5" /> 归档
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(p)}>
                    <Trash2 className="size-3.5" /> 删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      {/* 重命名弹窗 */}
      <Dialog open={renameTarget != null} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent className="glass-panel sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>重命名项目</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
            }}
            placeholder="项目名称"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>
              取消
            </Button>
            <Button onClick={commitRename} disabled={!renameDraft.trim()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="删除项目"
        description={`确定删除项目「${deleteTarget?.name ?? ""}」?项目下的会话会保留(解除归类),但项目本身将被永久删除。`}
        confirmText="删除"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
