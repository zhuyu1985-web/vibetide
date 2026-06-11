"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  FolderPlus,
  MessageSquare,
  Clock,
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
  Plug,
  Puzzle,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Archive,
  Trash2,
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn } from "@/lib/utils";
import {
  createProjectAction,
  updateProjectAction,
  pinProjectAction,
  archiveProjectAction,
  deleteProjectAction,
} from "@/app/actions/projects";
import {
  renameConversationAction,
  pinConversationAction,
  archiveConversationAction,
  deleteConversationAction,
} from "@/app/actions/cowork-conversations";
import type { Project } from "@/db/schema/projects";
import type { Conversation } from "@/db/schema/conversations";

const PROJECT_DOT_COLORS = ["#378ADD", "#1D9E75", "#D85A30", "#7F77DD", "#BA7517"];

/**
 * Cowork 工作区左栏(共享于 /home 与 /cowork/[id])。自包含:内部直接调用
 * server actions + router 处理新建/重命名/置顶/归档/删除,父组件只传数据。
 * 结构:新建对话 → 项目(置顶) → 定时任务 → 定制 → 最近对话(置顶组 + 普通组)。
 */
export function CoworkSidebar({
  projects,
  conversations,
  activeId,
}: {
  projects: Project[];
  conversations: Conversation[];
  activeId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<Project | null>(
    null,
  );
  const [query, setQuery] = useState("");

  const { pinned, recent } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? conversations.filter((c) => c.title.toLowerCase().includes(q))
      : conversations;
    const pinned: Conversation[] = [];
    const recent: Conversation[] = [];
    for (const c of list) (c.pinnedAt ? pinned : recent).push(c);
    return { pinned, recent };
  }, [conversations, query]);
  const searching = query.trim().length > 0;

  // 删除/归档当前正在看的会话后,跳到下一条;无则回 /home
  function jumpAfterRemoval(removedId: string) {
    if (activeId !== removedId) {
      router.refresh();
      return;
    }
    const next = conversations.find((c) => c.id !== removedId);
    router.push(next ? `/cowork/${next.id}` : "/home");
  }

  function handleNewProject() {
    startTransition(async () => {
      await createProjectAction({ name: "新项目" });
      router.refresh();
    });
  }

  function handleRenameProject(id: string, name: string) {
    setRenamingProjectId(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    const current = projects.find((p) => p.id === id);
    if (current && current.name === trimmed) return;
    startTransition(async () => {
      await updateProjectAction({ id, name: trimmed });
      router.refresh();
    });
  }

  function handlePinProject(id: string, pinned: boolean) {
    startTransition(async () => {
      await pinProjectAction(id, pinned);
      router.refresh();
    });
  }

  function handleArchiveProject(id: string) {
    startTransition(async () => {
      await archiveProjectAction(id, true);
      router.refresh();
    });
  }

  function handleDeleteProject(id: string) {
    startTransition(async () => {
      await deleteProjectAction(id);
      router.refresh();
    });
  }

  function handleRename(id: string, title: string) {
    setRenamingId(null);
    const trimmed = title.trim();
    if (!trimmed) return;
    const current = conversations.find((c) => c.id === id);
    if (current && current.title === trimmed) return;
    startTransition(async () => {
      await renameConversationAction(id, trimmed);
      router.refresh();
    });
  }

  function handlePin(id: string, pinned: boolean) {
    startTransition(async () => {
      await pinConversationAction(id, pinned);
      router.refresh();
    });
  }

  function handleArchive(id: string) {
    startTransition(async () => {
      await archiveConversationAction(id, true);
      jumpAfterRemoval(id);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteConversationAction(id);
      jumpAfterRemoval(id);
    });
  }

  return (
    <aside className="flex w-60 flex-none flex-col border-r border-border/60 bg-muted/30">
      <div className="space-y-2 p-2.5">
        <Button
          variant="secondary"
          className="w-full justify-start gap-2"
          onClick={() => router.push("/home")}
        >
          <Plus className="size-4" />
          新建对话
        </Button>
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索对话"
          inputClassName="h-8 text-xs"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {/* 项目 —— 标题链到项目列表页,条目链到项目详情(置顶,在最近对话上方) */}
        <div className="flex items-center justify-between px-2 pb-1 pt-1.5">
          <Link
            href="/cowork/projects"
            className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            项目
          </Link>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="新建项目"
            className="text-muted-foreground"
            disabled={pending}
            onClick={handleNewProject}
          >
            <FolderPlus className="size-3.5" />
          </Button>
        </div>
        {projects.length === 0 ? (
          <p className="px-2.5 py-1 text-[11px] text-muted-foreground/60">暂无项目</p>
        ) : (
          projects.slice(0, 5).map((p, i) => (
            <ProjectRow
              key={p.id}
              project={p}
              color={p.color || PROJECT_DOT_COLORS[i % PROJECT_DOT_COLORS.length]}
              renaming={renamingProjectId === p.id}
              onStartRename={() => setRenamingProjectId(p.id)}
              onRename={handleRenameProject}
              onCancelRename={() => setRenamingProjectId(null)}
              onPin={handlePinProject}
              onArchive={handleArchiveProject}
              onRequestDelete={() => setDeleteProjectTarget(p)}
            />
          ))
        )}

        {/* 定时任务 */}
        <Link
          href="/settings/scheduled-jobs"
          className="mt-1.5 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-foreground/80 transition-colors hover:bg-muted"
        >
          <Clock className="size-3.5 flex-none opacity-70" />
          <span className="truncate">定时任务</span>
        </Link>

        {/* 定制 —— 可展开:SKILLS / 连接器 / 个人插件 */}
        <Button
          variant="ghost"
          className="h-auto w-full justify-start gap-2 px-2.5 py-1.5 text-xs font-normal text-foreground/80"
          aria-expanded={customizeOpen}
          onClick={() => setCustomizeOpen((v) => !v)}
        >
          <SlidersHorizontal className="size-3.5 flex-none opacity-70" />
          <span className="flex-1 text-left">定制</span>
          <ChevronRight
            className={cn(
              "size-3.5 opacity-50 transition-transform",
              customizeOpen && "rotate-90",
            )}
          />
        </Button>
        {customizeOpen && (
          <div className="ml-3 border-l border-border/60 pl-1.5">
            <CustomizeLink href="/skills" icon={Sparkles} label="SKILLS" />
            <CustomizeLink href="/cowork/connectors" icon={Plug} label="连接器" />
            <CustomizeLink href="/cowork/plugins" icon={Puzzle} label="个人插件" />
          </div>
        )}

        {/* 置顶组 */}
        {pinned.length > 0 && (
          <>
            <div className="flex items-center gap-1 px-2 pb-1 pt-3 text-[11px] font-medium text-muted-foreground">
              <Pin className="size-3 text-primary/70" /> 置顶
            </div>
            {pinned.map((c) => (
              <ConversationRow
                key={c.id}
                conversation={c}
                activeId={activeId}
                renaming={renamingId === c.id}
                onStartRename={() => setRenamingId(c.id)}
                onRename={handleRename}
                onCancelRename={() => setRenamingId(null)}
                onPin={handlePin}
                onArchive={handleArchive}
                onRequestDelete={() => setDeleteTarget(c)}
              />
            ))}
          </>
        )}

        {/* 最近对话 */}
        <div className="px-2 pb-1 pt-3 text-[11px] font-medium text-muted-foreground">
          最近对话
        </div>
        {recent.length === 0 ? (
          <p className="px-2.5 py-1 text-[11px] text-muted-foreground/60">
            {searching ? "无匹配的对话" : "还没有对话,点上方新建"}
          </p>
        ) : (
          recent.map((c) => (
            <ConversationRow
              key={c.id}
              conversation={c}
              activeId={activeId}
              renaming={renamingId === c.id}
              onStartRename={() => setRenamingId(c.id)}
              onRename={handleRename}
              onCancelRename={() => setRenamingId(null)}
              onPin={handlePin}
              onArchive={handleArchive}
              onRequestDelete={() => setDeleteTarget(c)}
            />
          ))
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="删除对话"
        description={`确定删除「${deleteTarget?.title ?? ""}」?该对话及其消息将被永久删除,无法恢复。`}
        confirmText="删除"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />

      <ConfirmDialog
        open={deleteProjectTarget != null}
        onOpenChange={(open) => !open && setDeleteProjectTarget(null)}
        title="删除项目"
        description={`确定删除项目「${deleteProjectTarget?.name ?? ""}」?项目下的会话会保留(解除归类),但项目本身将被永久删除。`}
        confirmText="删除"
        variant="danger"
        onConfirm={() => {
          if (deleteProjectTarget) handleDeleteProject(deleteProjectTarget.id);
          setDeleteProjectTarget(null);
        }}
      />
    </aside>
  );
}

function ConversationRow({
  conversation: c,
  activeId,
  renaming,
  onStartRename,
  onRename,
  onCancelRename,
  onPin,
  onArchive,
  onRequestDelete,
}: {
  conversation: Conversation;
  activeId: string | null;
  renaming: boolean;
  onStartRename: () => void;
  onRename: (id: string, title: string) => void;
  onCancelRename: () => void;
  onPin: (id: string, pinned: boolean) => void;
  onArchive: (id: string) => void;
  onRequestDelete: () => void;
}) {
  const isPinned = c.pinnedAt != null;
  const isActive = c.id === activeId;

  if (renaming) {
    return (
      <form
        className="px-1.5 py-0.5"
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem(
            "title",
          ) as HTMLInputElement;
          onRename(c.id, input.value);
        }}
      >
        <Input
          name="title"
          autoFocus
          defaultValue={c.title}
          className="h-7 text-xs"
          onBlur={(e) => onRename(c.id, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancelRename();
          }}
        />
      </form>
    );
  }

  return (
    <div
      className={cn(
        "group/row relative flex items-center rounded-md transition-colors",
        isActive ? "bg-primary/10" : "hover:bg-muted",
      )}
    >
      <Link
        href={`/cowork/${c.id}`}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1.5 py-1.5 pl-2.5 pr-7",
          isActive ? "text-primary" : "text-foreground/80",
        )}
      >
        {isPinned ? (
          <Pin className="size-3 flex-none text-primary/70" />
        ) : (
          <MessageSquare className="size-3 flex-none opacity-60" />
        )}
        <span className="truncate text-xs">{c.title}</span>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="会话操作"
            className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover/row:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreHorizontal className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem onSelect={onStartRename}>
            <Pencil className="size-3.5" /> 重命名
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onPin(c.id, !isPinned)}>
            {isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
            {isPinned ? "取消置顶" : "置顶"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onArchive(c.id)}>
            <Archive className="size-3.5" /> 归档
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={onRequestDelete}>
            <Trash2 className="size-3.5" /> 删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ProjectRow({
  project: p,
  color,
  renaming,
  onStartRename,
  onRename,
  onCancelRename,
  onPin,
  onArchive,
  onRequestDelete,
}: {
  project: Project;
  color: string;
  renaming: boolean;
  onStartRename: () => void;
  onRename: (id: string, name: string) => void;
  onCancelRename: () => void;
  onPin: (id: string, pinned: boolean) => void;
  onArchive: (id: string) => void;
  onRequestDelete: () => void;
}) {
  const isPinned = p.pinnedAt != null;

  if (renaming) {
    return (
      <form
        className="px-1.5 py-0.5"
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem(
            "name",
          ) as HTMLInputElement;
          onRename(p.id, input.value);
        }}
      >
        <Input
          name="name"
          autoFocus
          defaultValue={p.name}
          className="h-7 text-xs"
          onBlur={(e) => onRename(p.id, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancelRename();
          }}
        />
      </form>
    );
  }

  return (
    <div className="group/prow relative flex items-center rounded-md transition-colors hover:bg-muted">
      <Link
        href={`/cowork/projects/${p.id}`}
        className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-2.5 pr-7 text-xs text-foreground/80"
      >
        <span
          className="size-2 flex-none rounded-sm"
          style={{ background: color }}
        />
        <span className="truncate">{p.name}</span>
        {isPinned && <Pin className="size-3 flex-none text-primary/70" />}
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="项目操作"
            className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover/prow:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreHorizontal className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem onSelect={onStartRename}>
            <Pencil className="size-3.5" /> 重命名
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onPin(p.id, !isPinned)}>
            {isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
            {isPinned ? "取消置顶" : "置顶"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onArchive(p.id)}>
            <Archive className="size-3.5" /> 归档
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={onRequestDelete}>
            <Trash2 className="size-3.5" /> 删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function CustomizeLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Plug;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] text-foreground/75 transition-colors hover:bg-muted"
    >
      <Icon className="size-3 flex-none opacity-70" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
