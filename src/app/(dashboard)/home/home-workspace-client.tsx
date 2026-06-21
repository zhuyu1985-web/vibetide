"use client";

import {
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Mic, Paperclip, ArrowUp, Route, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ParticleBackground } from "@/components/shared/particle-background";
import { HeroSection } from "@/components/home/hero-section";
import { EmployeeQuickPanel } from "@/components/home/employee-quick-panel";
import { ScenarioGrid } from "@/components/home/scenario-grid";
import { CoworkSidebar } from "@/components/cowork/cowork-sidebar";
import { startCoworkConversation } from "@/app/actions/cowork-start";
import type { Conversation } from "@/db/schema/conversations";
import type { Project } from "@/db/schema/projects";
import type { WorkflowTemplateRow } from "@/db/types";

interface HomeWorkspaceClientProps {
  conversations: Conversation[];
  projects?: Project[];
  templatesByTab?: Record<
    string,
    (WorkflowTemplateRow & { __homepagePinnedAt?: Date | null })[]
  >;
  canManageHomepage?: boolean;
}

/**
 * 统一工作台落地页:左 CoworkSidebar(工作区栏) + 主区(问候/输入/员工/场景)。
 * 输入提交 → startCoworkConversation → 跳 /cowork/[id];点员工 = 预填输入聚焦。
 */
export function HomeWorkspaceClient({
  conversations,
  projects,
  templatesByTab = {},
  canManageHomepage = false,
}: HomeWorkspaceClientProps) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [submitting, startSubmit] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const text = input.trim();
    if (!text || submitting) return;
    setInput("");
    startSubmit(async () => {
      const res = await startCoworkConversation(text);
      if (res.ok) router.push(`/cowork/${res.conversationId}`);
      else setInput(text);
    });
  }

  return (
    <div className="flex h-full overflow-hidden">
      <CoworkSidebar
        conversations={conversations}
        projects={projects}
        activeId={null}
      />

      <div className="relative flex-1 overflow-y-auto scrollbar-thin">
        <ParticleBackground
          particleCount={60}
          className="pointer-events-none fixed inset-0 z-0 opacity-20 dark:opacity-50"
        />

        <div className="relative z-10 mx-auto max-w-4xl px-6 pb-12">
          <HeroSection />

          {/* 居中输入框 */}
          <div className="mx-auto mt-2 max-w-[760px]">
            <div className="gemini-border rounded-2xl bg-white transition-shadow duration-300 ease-out dark:bg-white/[0.06]">
              <div className="px-5 pb-2 pt-4">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  placeholder="有什么想法?告诉 AI 团队…"
                  rows={2}
                  className="max-h-[160px] min-h-[52px] w-full resize-none bg-transparent text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/50"
                  onInput={(e) => {
                    const t = e.target as HTMLTextAreaElement;
                    t.style.height = "auto";
                    t.style.height = `${Math.min(t.scrollHeight, 160)}px`;
                  }}
                />
              </div>
              <div className="flex items-center justify-between px-4 pb-3 pt-1">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <span className="rounded-xl p-2 transition-colors hover:bg-accent/50 hover:text-foreground">
                    <Mic size={16} />
                  </span>
                  <span className="rounded-xl p-2 transition-colors hover:bg-accent/50 hover:text-foreground">
                    <Paperclip size={16} />
                  </span>
                  <span className="mx-1 h-4 w-px bg-border" />
                  <span className="inline-flex items-center gap-1 text-xs">
                    <Route size={13} /> 智能路由
                  </span>
                </div>
                <button
                  onClick={submit}
                  disabled={submitting || !input.trim()}
                  aria-label="发送"
                  className={cn(
                    "flex size-8 items-center justify-center rounded-xl transition-all duration-200",
                    input.trim() && !submitting
                      ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white hover:scale-105"
                      : "cursor-not-allowed bg-muted text-muted-foreground/40",
                  )}
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <ArrowUp size={16} strokeWidth={2.5} />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* AI 专家团队（信任条） */}
          <div className="mx-auto mt-3 max-w-[760px]">
            <EmployeeQuickPanel />
          </div>

          {/* 场景快捷启动 */}
          <div className="mt-6 px-4">
            <ScenarioGrid
              templatesByTab={templatesByTab}
              canManageHomepage={canManageHomepage}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
