"use client";

import { useReducer } from "react";
import { CoworkSidebar } from "@/components/cowork/cowork-sidebar";
import { ConversationThread } from "@/components/cowork/conversation-thread";
import { MissionDrawer } from "@/components/cowork/mission-drawer";
import { missionDrawerReducer } from "@/lib/cowork/mission-drawer-state";
import type { Project } from "@/db/schema/projects";
import type {
  Conversation,
  ConversationMessage,
} from "@/db/schema/conversations";

interface Props {
  projects: Project[];
  conversations: Conversation[];
  active: { conversation: Conversation; messages: ConversationMessage[] } | null;
}

/**
 * cowork 会话页:左 CoworkSidebar(自包含工作区栏)+ 中居中对话流 + 右 mission 抽屉。
 * 页面按会话 id 给本组件传 key,切换会话整体 remount —— 抽屉状态用 useReducer
 * 初始值派生:会话已有 mission 则默认展开任务执行面板(直接看步骤与产出),否则收起。
 */
export function CoworkClient({ projects, conversations, active }: Props) {
  const initialMissionId =
    active?.messages
      .filter((m) => m.kind === "mission_card" && m.missionId)
      .map((m) => m.missionId as string)
      .pop() ?? null;
  const [drawer, dispatch] = useReducer(missionDrawerReducer, {
    missionId: initialMissionId,
    open: initialMissionId != null,
  });

  return (
    <div className="flex h-full overflow-hidden rounded-xl border border-border/60">
      <CoworkSidebar
        projects={projects}
        conversations={conversations}
        activeId={active?.conversation.id ?? null}
      />
      <ConversationThread
        active={active}
        focusedMissionId={drawer.open ? drawer.missionId : null}
        onMissionFocus={(missionId) => dispatch({ type: "focus", missionId })}
        onSendStart={() => dispatch({ type: "pending" })}
        onSendSettled={(missionId) =>
          dispatch(
            missionId ? { type: "focus", missionId } : { type: "close" },
          )
        }
      />
      <MissionDrawer
        missionId={drawer.missionId}
        open={drawer.open}
        onClose={() => dispatch({ type: "close" })}
      />
    </div>
  );
}
