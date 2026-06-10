"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, FolderPlus, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createConversationAction } from "@/app/actions/cowork-conversations";
import { createProjectAction } from "@/app/actions/projects";
import type { Project } from "@/db/schema/projects";
import type { Conversation } from "@/db/schema/conversations";

const PROJECT_DOT_COLORS = [
  "#378ADD",
  "#1D9E75",
  "#D85A30",
  "#7F77DD",
  "#BA7517",
];

export function ProjectConversationSidebar({
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

  function handleNewConversation(projectId?: string | null) {
    startTransition(async () => {
      const res = await createConversationAction({ projectId: projectId ?? null });
      if (res.ok) router.push(`/cowork/${res.data.id}`);
    });
  }

  function handleNewProject() {
    startTransition(async () => {
      await createProjectAction({ name: "新项目" });
      router.refresh();
    });
  }

  return (
    <aside className="flex w-56 flex-none flex-col border-r border-border bg-muted/30">
      <div className="p-2.5">
        <Button
          variant="secondary"
          className="w-full justify-center gap-1.5"
          disabled={pending}
          onClick={() => handleNewConversation(null)}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          新建对话
        </Button>
      </div>

      {/* 项目 */}
      <div className="flex items-center justify-between px-3 pb-1.5 pt-1">
        <span className="text-[11px] font-medium text-muted-foreground">项目</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="新建项目"
          className="size-6 text-muted-foreground"
          onClick={handleNewProject}
        >
          <FolderPlus className="size-3.5" />
        </Button>
      </div>
      <div className="px-1.5">
        {projects.length === 0 ? (
          <p className="px-2 py-1 text-[11px] text-muted-foreground/60">暂无项目</p>
        ) : (
          projects.map((p, i) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-foreground/80"
            >
              <span
                className="size-2 flex-none rounded-sm"
                style={{ background: p.color || PROJECT_DOT_COLORS[i % PROJECT_DOT_COLORS.length] }}
              />
              <span className="truncate">{p.name}</span>
            </div>
          ))
        )}
      </div>

      {/* 最近对话 */}
      <div className="px-3 pb-1.5 pt-3 text-[11px] font-medium text-muted-foreground">
        最近对话
      </div>
      <nav className="flex-1 overflow-y-auto px-1.5 pb-2">
        {conversations.length === 0 ? (
          <p className="px-2 py-1 text-[11px] text-muted-foreground/60">
            还没有对话，点上方新建
          </p>
        ) : (
          conversations.map((c) => (
            <Link
              key={c.id}
              href={`/cowork/${c.id}`}
              className={cn(
                "block rounded-md px-2 py-1.5 transition-colors",
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
      </nav>
    </aside>
  );
}
