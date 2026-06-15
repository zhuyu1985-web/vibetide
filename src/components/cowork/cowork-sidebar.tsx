"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  FolderOpen,
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
  Check,
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
  appendReturnTo,
  consumeCustomizeReturn,
  markCustomizeReturn,
} from "@/lib/navigation-return";
import {
  renameConversationAction,
  pinConversationAction,
  archiveConversationAction,
  deleteConversationAction,
} from "@/app/actions/cowork-conversations";
import type { Conversation } from "@/db/schema/conversations";
import type { Project } from "@/db/schema/projects";

type GroupBy = "none" | "date" | "project";

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "none", label: "默认" },
  { value: "date", label: "按日期" },
  { value: "project", label: "按项目" },
];

const GROUPBY_STORAGE_KEY = "cowork-conv-groupby";

type ConvGroup = { key: string; label: string; items: Conversation[] };

/** 按"自然日"差把会话分到 今天 / 昨天 / 过去 7 天 / 更早。 */
function dateBucket(d: Date, now: Date): { key: string; label: string; order: number } {
  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.floor((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays <= 0) return { key: "today", label: "今天", order: 0 };
  if (diffDays === 1) return { key: "yesterday", label: "昨天", order: 1 };
  if (diffDays <= 7) return { key: "week", label: "过去 7 天", order: 2 };
  return { key: "older", label: "更早", order: 3 };
}

/**
 * Cowork 工作区左栏(共享于 /home 与 /cowork/[id])。自包含:内部直接调用
 * server actions + router 处理会话的新建/重命名/置顶/归档/删除,父组件只传数据。
 *
 * 结构:新建对话 → 项目(单入口)→ 定时任务 → 定制 →(分割线)→ 最近对话
 * (可按 默认/日期/项目 分组;projects 仅用于"按项目"分组的表头,不在侧栏铺列表)。
 */
export function CoworkSidebar({
  conversations,
  projects = [],
  activeId,
}: {
  conversations: Conversation[];
  projects?: Project[];
  activeId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const [query, setQuery] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");

  // groupBy 从 localStorage 恢复(默认 none;挂载后再读,避免 SSR 水合不一致)。
  useEffect(() => {
    const saved = localStorage.getItem(GROUPBY_STORAGE_KEY);
    if (saved === "date" || saved === "project") {
      window.setTimeout(() => setGroupBy(saved), 0);
    }
  }, []);

  // 从 SKILLS / 连接器 / 个人插件返回时,恢复"定制"展开状态。
  useEffect(() => {
    if (consumeCustomizeReturn(sessionStorage)) {
      window.setTimeout(() => setCustomizeOpen(true), 0);
    }
  }, []);

  function changeGroupBy(g: GroupBy) {
    setGroupBy(g);
    try {
      localStorage.setItem(GROUPBY_STORAGE_KEY, g);
    } catch {
      // localStorage 不可用时忽略
    }
  }

  const searching = query.trim().length > 0;

  // 过滤 + 按所选方式归组。
  const groups: ConvGroup[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? conversations.filter((c) => c.title.toLowerCase().includes(q))
      : conversations;
    const byRecency = (a: Conversation, b: Conversation) =>
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();

    if (groupBy === "date") {
      const now = new Date();
      const m = new Map<string, ConvGroup & { order: number }>();
      for (const c of [...filtered].sort(byRecency)) {
        const b = dateBucket(new Date(c.lastMessageAt), now);
        let g = m.get(b.key);
        if (!g) {
          g = { key: b.key, label: b.label, order: b.order, items: [] };
          m.set(b.key, g);
        }
        g.items.push(c);
      }
      return [...m.values()].sort((a, b) => a.order - b.order);
    }

    if (groupBy === "project") {
      const nameOf = new Map(projects.map((p) => [p.id, p.name]));
      const m = new Map<string, ConvGroup>();
      for (const c of [...filtered].sort(byRecency)) {
        const pid = c.projectId ?? "__none__";
        const label = c.projectId
          ? (nameOf.get(c.projectId) ?? "未命名项目")
          : "未归类";
        let g = m.get(pid);
        if (!g) {
          g = { key: pid, label, items: [] };
          m.set(pid, g);
        }
        g.items.push(c);
      }
      // "未归类"排最后,其余保持插入序(已按最近活跃)
      return [...m.values()].sort((a, b) =>
        a.key === "__none__" ? 1 : b.key === "__none__" ? -1 : 0,
      );
    }

    // none —— 单组,置顶排最上
    const sorted = [...filtered].sort((a, b) => {
      const ap = a.pinnedAt ? 1 : 0;
      const bp = b.pinnedAt ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return byRecency(a, b);
    });
    return [{ key: "recent", label: "最近对话", items: sorted }];
  }, [conversations, query, groupBy, projects]);

  const totalConversations = groups.reduce((n, g) => n + g.items.length, 0);
  const currentHref = useMemo(() => {
    const qs = searchParams.toString();
    return `${pathname}${qs ? `?${qs}` : ""}`;
  }, [pathname, searchParams]);

  // 删除/归档当前正在看的会话后,跳到下一条;无则回 /home
  function jumpAfterRemoval(removedId: string) {
    if (activeId !== removedId) {
      router.refresh();
      return;
    }
    const next = conversations.find((c) => c.id !== removedId);
    router.push(next ? `/cowork/${next.id}` : "/home");
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
          inputClassName="h-8 text-sm"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {/* 项目 —— 单入口,点进 /cowork/projects 在主区查看/管理(不在侧栏铺列表) */}
        <NavRow href="/cowork/projects" icon={FolderOpen} label="项目" />
        {/* 定时任务 */}
        <NavRow
          href="/settings/scheduled-jobs"
          icon={Clock}
          label="定时任务"
        />

        {/* 定制 —— 可展开:SKILLS / 连接器 / 个人插件 */}
        <Button
          variant="ghost"
          className="h-auto w-full justify-start gap-2 px-2.5 py-1.5 text-sm font-normal text-foreground/80"
          aria-expanded={customizeOpen}
          onClick={() => setCustomizeOpen((v) => !v)}
        >
          <SlidersHorizontal className="size-4 flex-none opacity-70" />
          <span className="flex-1 text-left">定制</span>
          <ChevronRight
            className={cn(
              "size-4 opacity-50 transition-transform",
              customizeOpen && "rotate-90",
            )}
          />
        </Button>
        {customizeOpen && (
          <div className="ml-3 border-l border-border/60 pl-1.5">
            <CustomizeLink
              href="/skills"
              returnTo={currentHref}
              icon={Sparkles}
              label="SKILLS"
            />
            <CustomizeLink
              href="/cowork/connectors"
              returnTo={currentHref}
              icon={Plug}
              label="连接器"
            />
            <CustomizeLink
              href="/cowork/plugins"
              returnTo={currentHref}
              icon={Puzzle}
              label="个人插件"
            />
          </div>
        )}

        {/* ── 分割线:把"项目/定时任务/定制"与"最近对话"在视觉上隔开 ── */}
        <div className="mx-1 my-2 border-t border-border/50" />

        {/* 最近对话 —— 标题 + 分组方式(默认 / 按日期 / 按项目) */}
        <div className="flex items-center justify-between px-2 pb-1 pt-1">
          <span className="text-xs font-medium text-muted-foreground">
            最近对话
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="对话分组方式"
                className="text-muted-foreground"
              >
                <SlidersHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground">
                分组方式
              </div>
              {GROUP_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onSelect={() => changeGroupBy(opt.value)}
                >
                  <span className="flex-1">{opt.label}</span>
                  {groupBy === opt.value && (
                    <Check className="size-3.5 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {totalConversations === 0 ? (
          <p className="px-2.5 py-1 text-xs text-muted-foreground/60">
            {searching ? "无匹配的对话" : "还没有对话,点上方新建"}
          </p>
        ) : (
          groups.map((g) => (
            <div key={g.key}>
              {groupBy !== "none" && (
                <div className="px-2 pb-0.5 pt-2 text-[11px] font-medium text-muted-foreground/70">
                  {g.label}
                </div>
              )}
              {g.items.map((c) => (
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
            </div>
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
    </aside>
  );
}

/** 侧栏顶层导航行(项目 / 定时任务),与 cowork 一致:图标 + 文案,整行可点。 */
function NavRow({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Clock;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-muted"
    >
      <Icon className="size-4 flex-none opacity-70" />
      <span className="truncate">{label}</span>
    </Link>
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
          className="h-7 text-sm"
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
          "flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-2.5 pr-7",
          isActive ? "text-primary" : "text-foreground/80",
        )}
      >
        {isPinned ? (
          <Pin className="size-3.5 flex-none text-primary/70" />
        ) : (
          <MessageSquare className="size-3.5 flex-none opacity-60" />
        )}
        <span className="truncate text-sm">{c.title}</span>
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

function CustomizeLink({
  href,
  returnTo,
  icon: Icon,
  label,
}: {
  href: string;
  returnTo: string;
  icon: typeof Plug;
  label: string;
}) {
  return (
    <Link
      href={appendReturnTo(href, returnTo)}
      onClick={() => markCustomizeReturn(sessionStorage)}
      className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-foreground/75 transition-colors hover:bg-muted"
    >
      <Icon className="size-3.5 flex-none opacity-70" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
