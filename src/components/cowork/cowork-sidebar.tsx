"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  FolderPlus,
  Loader2,
  MessageSquare,
  Clock,
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
  Plug,
  Puzzle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Project } from "@/db/schema/projects";
import type { Conversation } from "@/db/schema/conversations";

const PROJECT_DOT_COLORS = ["#378ADD", "#1D9E75", "#D85A30", "#7F77DD", "#BA7517"];

interface CoworkSidebarProps {
  projects: Project[];
  conversations: Conversation[];
  activeId: string | null;
  onNewConversation: () => void;
  onNewProject: () => void;
  pending?: boolean;
}

/**
 * Cowork 工作区左栏(共享于落地页 /home 与会话页 /cowork/[id])。
 * 结构(owner 指定):新建对话 → 项目(置顶) → 定时任务 → 定制 → 最近对话。
 * 纯展示组件:新建对话/项目的副作用由父组件通过回调注入,便于独立渲染测试,
 * 也避免组件耦合 server actions。
 */
export function CoworkSidebar({
  projects,
  conversations,
  activeId,
  onNewConversation,
  onNewProject,
  pending = false,
}: CoworkSidebarProps) {
  const [customizeOpen, setCustomizeOpen] = useState(false);

  return (
    <aside className="flex w-56 flex-none flex-col border-r border-border bg-muted/30">
      <div className="p-2.5">
        <Button
          variant="secondary"
          className="w-full justify-center gap-1.5"
          disabled={pending}
          onClick={onNewConversation}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          新建对话
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {/* 项目 —— 置顶,在最近对话上方 */}
        <div className="flex items-center justify-between px-2 pb-1 pt-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">项目</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="新建项目"
            className="size-5 text-muted-foreground"
            onClick={onNewProject}
          >
            <FolderPlus className="size-3.5" />
          </Button>
        </div>
        {projects.length === 0 ? (
          <p className="px-2.5 py-1 text-[11px] text-muted-foreground/60">暂无项目</p>
        ) : (
          projects.map((p, i) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-foreground/80 hover:bg-muted"
            >
              <span
                className="size-2 flex-none rounded-sm"
                style={{
                  background:
                    p.color || PROJECT_DOT_COLORS[i % PROJECT_DOT_COLORS.length],
                }}
              />
              <span className="truncate">{p.name}</span>
            </div>
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
            <Link
              href="/skills"
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] text-foreground/75 transition-colors hover:bg-muted"
            >
              <Sparkles className="size-3 flex-none opacity-70" />
              <span className="truncate">SKILLS</span>
            </Link>
            <PlaceholderItem icon={Plug} label="连接器" />
            <PlaceholderItem icon={Puzzle} label="个人插件" />
          </div>
        )}

        {/* 最近对话 */}
        <div className="px-2 pb-1 pt-3 text-[11px] font-medium text-muted-foreground">
          最近对话
        </div>
        {conversations.length === 0 ? (
          <p className="px-2.5 py-1 text-[11px] text-muted-foreground/60">
            还没有对话,点上方新建
          </p>
        ) : (
          conversations.map((c) => (
            <Link
              key={c.id}
              href={`/cowork/${c.id}`}
              className={cn(
                "block rounded-md px-2.5 py-1.5 transition-colors",
                c.id === activeId
                  ? "bg-primary/10 text-primary"
                  : "text-foreground/80 hover:bg-muted",
              )}
            >
              <span className="flex items-center gap-1.5">
                <MessageSquare className="size-3 flex-none opacity-60" />
                <span className="truncate text-xs">{c.title}</span>
              </span>
            </Link>
          ))
        )}
      </div>
    </aside>
  );
}

function PlaceholderItem({
  icon: Icon,
  label,
}: {
  icon: typeof Plug;
  label: string;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] text-muted-foreground/50"
      title="敬请期待"
    >
      <Icon className="size-3 flex-none opacity-50" />
      <span className="truncate">{label}</span>
      <span className="ml-auto rounded bg-muted px-1 py-px text-[10px] text-muted-foreground/60">
        待建
      </span>
    </div>
  );
}
