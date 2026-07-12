"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  retryStartedCoworkConversation,
} from "@/app/actions/cowork-start";
import {
  canClaimInitialProcessing,
  type InitialProcessingState,
} from "@/lib/cowork/initial-processing";
import { executeStreamingChat } from "@/lib/chat-utils";

interface StreamingReplyState {
  messageId: string | null;
  content: string;
  active: boolean;
  statusLabel?: string;
  error?: string;
}

interface Props {
  conversations: Conversation[];
  projects?: Project[];
  active: { conversation: Conversation; messages: ConversationMessage[] } | null;
  initialProcessing?: InitialProcessingState | null;
}

/**
 * cowork 会话页:左 CoworkSidebar(自包含工作区栏)+ 中居中对话流 + 右 mission 抽屉。
 * 页面按会话 id 给本组件传 key,切换会话整体 remount —— 抽屉状态用 useReducer
 * 初始值派生:会话已有 mission 则默认展开任务执行面板(直接看步骤与产出),否则收起。
 */
export function CoworkClient({
  conversations,
  projects,
  active,
  initialProcessing = null,
}: Props) {
  const router = useRouter();
  const processingStartedRef = useRef(false);
  const [processing, setProcessing] =
    useState<InitialProcessingState | null>(initialProcessing);
  const [streamingReply, setStreamingReply] =
    useState<StreamingReplyState | null>(null);
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

  const runCoworkStream = useCallback(
    async (
      conversationId: string,
      input: { message?: string; initial?: boolean },
    ) => {
      let missionId: string | null = null;
      let noop = false;
      setStreamingReply({
        messageId: null,
        content: "",
        active: true,
        statusLabel: "正在识别意图…",
      });
      try {
        await executeStreamingChat(
          "/api/cowork/stream",
          { conversationId, ...input },
          {
            onStatus: (status) => {
              setStreamingReply((current) => ({
                messageId: current?.messageId ?? null,
                content: current?.content ?? "",
                active: true,
                statusLabel: status.label,
              }));
            },
            onResult: (result) => {
              const kind = typeof result.kind === "string" ? result.kind : "";
              if (kind === "noop") noop = true;
              if (
                kind === "mission" &&
                typeof result.missionId === "string"
              ) {
                missionId = result.missionId;
              }
              if (
                kind === "stream" &&
                typeof result.messageId === "string"
              ) {
                setStreamingReply((current) => ({
                  messageId: result.messageId as string,
                  content: current?.content ?? "",
                  active: true,
                  statusLabel: current?.statusLabel,
                }));
                router.refresh();
              }
            },
            onTextDelta: (_delta, accumulated) => {
              setStreamingReply((current) => ({
                messageId: current?.messageId ?? null,
                content: accumulated,
                active: true,
                // 已有 token 时不再显示阶段文案，交给逐字渲染
                statusLabel: undefined,
              }));
            },
            onError: (message) => {
              setStreamingReply((current) => ({
                messageId: current?.messageId ?? null,
                content:
                  current?.content || `生成失败：${message}`,
                active: false,
                statusLabel: undefined,
                error: message,
              }));
            },
          },
        );
        setStreamingReply((current) =>
          current
            ? { ...current, active: false, statusLabel: undefined }
            : current,
        );
        return { missionId, noop, error: null };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStreamingReply((current) => ({
          messageId: current?.messageId ?? null,
          content: current?.content || `生成失败：${message}`,
          active: false,
          statusLabel: undefined,
          error: message,
        }));
        return { missionId: null, noop: false, error: message };
      } finally {
        router.refresh();
      }
    },
    [router],
  );

  useEffect(() => {
    setProcessing(initialProcessing);
    if (initialProcessing?.status !== "running") {
      processingStartedRef.current = false;
    }
  }, [initialProcessing]);

  useEffect(() => {
    if (
      !active ||
      processingStartedRef.current ||
      !canClaimInitialProcessing(processing)
    ) {
      return;
    }
    processingStartedRef.current = true;
    setProcessing((current) =>
      current
        ? {
            ...current,
            status: "running",
            attempt: current.attempt + 1,
            updatedAt: new Date().toISOString(),
            error: undefined,
          }
        : current,
    );
    void runCoworkStream(active.conversation.id, { initial: true }).then(
      (result) => {
        const status = result.error
          ? "failed"
          : result.noop
            ? "running"
            : "completed";
        setProcessing((current) =>
          current
            ? {
                ...current,
                status,
                updatedAt: new Date().toISOString(),
                ...(result.error
                  ? { error: result.error }
                  : { error: undefined }),
              }
            : current,
        );
        if (result.missionId) {
          dispatch({ type: "focus", missionId: result.missionId });
        }
        router.refresh();
      },
    );
  }, [active, processing, router, runCoworkStream]);

  useEffect(() => {
    // SSE 活跃时由流自身驱动 UI，避免每 2 秒整页刷新抢占资源；
    // 仅对刷新后遗留的 running（无本地流）做低频恢复轮询。
    if (processing?.status !== "running" || streamingReply?.active) return;
    const timer = window.setTimeout(() => router.refresh(), 2_000);
    return () => window.clearTimeout(timer);
  }, [processing?.status, processing?.updatedAt, router, streamingReply?.active]);

  async function retryProcessing() {
    if (!active) return;
    const result = await retryStartedCoworkConversation(active.conversation.id);
    if (!result.ok) return;
    processingStartedRef.current = false;
    setProcessing((current) =>
      current
        ? {
            ...current,
            status: "pending",
            updatedAt: new Date().toISOString(),
            error: undefined,
          }
        : current,
    );
  }

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
          initialProcessing={processing}
          onProcessingRetry={retryProcessing}
          streamingReply={streamingReply}
          onSubmitMessage={async (text) => {
            if (!active) return null;
            const result = await runCoworkStream(active.conversation.id, {
              message: text,
            });
            return result.missionId;
          }}
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
            onOpen={() => dispatch({ type: "open" })}
            onClose={() => dispatch({ type: "close" })}
          />
        )}
      </div>
    </div>
  );
}
