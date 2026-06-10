"use client";

import { useState } from "react";
import { ProjectConversationSidebar } from "@/components/cowork/project-conversation-sidebar";
import { ConversationThread } from "@/components/cowork/conversation-thread";
import { CoworkMissionPanel } from "@/components/cowork/cowork-mission-panel";
import type { Project } from "@/db/schema/projects";
import type { Conversation, ConversationMessage } from "@/db/schema/conversations";

interface Props {
  projects: Project[];
  conversations: Conversation[];
  active: { conversation: Conversation; messages: ConversationMessage[] } | null;
}

/**
 * cowork 三栏容器。页面按 active 会话 id 给本组件传 key,使切换会话时整体
 * remount —— 这样右栏聚焦的 missionId 用 useState 初始值即可正确派生该会话
 * 最新的 mission_card,无需额外 effect。提交新消息时由 ConversationThread 的
 * onMissionFocus 即时把右栏切到新 mission。
 */
export function CoworkClient({ projects, conversations, active }: Props) {
  const initialMissionId =
    active?.messages
      .filter((m) => m.kind === "mission_card" && m.missionId)
      .map((m) => m.missionId as string)
      .pop() ?? null;
  const [focusedMissionId, setFocusedMissionId] = useState<string | null>(
    initialMissionId,
  );

  return (
    <div className="flex h-[calc(100vh-7rem)] overflow-hidden rounded-xl border border-border">
      <ProjectConversationSidebar
        projects={projects}
        conversations={conversations}
        activeId={active?.conversation.id ?? null}
      />
      <ConversationThread
        active={active}
        focusedMissionId={focusedMissionId}
        onMissionFocus={setFocusedMissionId}
      />
      <CoworkMissionPanel missionId={focusedMissionId} />
    </div>
  );
}
