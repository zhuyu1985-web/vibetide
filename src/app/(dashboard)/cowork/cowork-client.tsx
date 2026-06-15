"use client";

import { useReducer, useState } from "react";
import { CoworkSidebar } from "@/components/cowork/cowork-sidebar";
import { ConversationThread } from "@/components/cowork/conversation-thread";
import { MissionDrawer } from "@/components/cowork/mission-drawer";
import { ArtifactPreviewWorkspace } from "@/components/cowork/artifact-preview-workspace";
import { missionDrawerReducer } from "@/lib/cowork/mission-drawer-state";
import type { ArtifactPreviewItem } from "@/lib/cowork/artifact-preview";
import type {
  Conversation,
  ConversationMessage,
} from "@/db/schema/conversations";
import type { Project } from "@/db/schema/projects";

interface Props {
  conversations: Conversation[];
  projects?: Project[];
  active: { conversation: Conversation; messages: ConversationMessage[] } | null;
}

/**
 * cowork 会话页:左 CoworkSidebar(自包含工作区栏)+ 中居中对话流 + 右 mission 抽屉。
 * 页面按会话 id 给本组件传 key,切换会话整体 remount —— 抽屉状态用 useReducer
 * 初始值派生:会话已有 mission 则默认展开任务执行面板(直接看步骤与产出),否则收起。
 */
export function CoworkClient({ conversations, projects, active }: Props) {
  const initialMissionId =
    active?.messages
      .filter((m) => m.kind === "mission_card" && m.missionId)
      .map((m) => m.missionId as string)
      .pop() ?? null;
  const [drawer, dispatch] = useReducer(missionDrawerReducer, {
    missionId: initialMissionId,
    open: initialMissionId != null,
  });
  const [selectedArtifact, setSelectedArtifact] =
    useState<ArtifactPreviewItem | null>(null);
  const [artifactOverrides, setArtifactOverrides] = useState<
    Record<string, ArtifactPreviewItem>
  >({});

  return (
    <div className="flex h-full overflow-hidden rounded-xl border border-border/60">
      <CoworkSidebar
        conversations={conversations}
        projects={projects}
        activeId={active?.conversation.id ?? null}
      />
      <div className="flex min-w-0 flex-1">
        <ConversationThread
          active={active}
          focusedMissionId={drawer.open ? drawer.missionId : null}
          selectedArtifactId={selectedArtifact?.id ?? null}
          artifactOverrides={artifactOverrides}
          onMissionFocus={(missionId) => {
            setSelectedArtifact(null);
            dispatch({ type: "focus", missionId });
          }}
          onArtifactSelect={(artifact) => {
            setSelectedArtifact(artifact);
            dispatch({ type: "focus", missionId: artifact.missionId });
          }}
          onSendStart={() => {
            setSelectedArtifact(null);
            dispatch({ type: "pending" });
          }}
          onSendSettled={(missionId) =>
            dispatch(
              missionId ? { type: "focus", missionId } : { type: "close" },
            )
          }
        />
        {selectedArtifact ? (
          <ArtifactPreviewWorkspace
            artifact={selectedArtifact}
            onClose={() => setSelectedArtifact(null)}
            onSaved={(artifact) => {
              setSelectedArtifact(artifact);
              setArtifactOverrides((prev) => ({
                ...prev,
                [artifact.id]: artifact,
              }));
            }}
          />
        ) : (
          <MissionDrawer
            missionId={drawer.missionId}
            open={drawer.open}
            onClose={() => dispatch({ type: "close" })}
          />
        )}
      </div>
    </div>
  );
}
