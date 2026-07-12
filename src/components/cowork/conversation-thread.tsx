"use client";

import {
  useRef,
  useState,
  useTransition,
  useEffect,
  type KeyboardEvent,
} from "react";
import {
  Loader2,
  ListChecks,
  Sparkles,
  Mic,
  Paperclip,
  Route,
  ArrowUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MissionStepStream } from "@/components/cowork/mission-step-stream";
import { MessageActions } from "@/components/cowork/message-actions";
import { CreationPlanForm } from "@/components/cowork/creation-plan-form";
import {
  DraftResultCard,
  type DraftResultMeta,
} from "@/components/cowork/draft-result-card";
import { IntentChip, readIntentFromMeta } from "@/components/cowork/intent-chip";
import { InputSuggestions } from "@/components/cowork/input-suggestions";
import { MultiVersionCard } from "@/components/cowork/multi-version-card";
import { ImportCard, type ImportCardMeta } from "@/components/cowork/import-card";
import { suggestInputs } from "@/lib/cowork/input-suggestions";
import type { CreationPlan } from "@/lib/cowork/creation-plan-types";
import type { MessageFeedback } from "@/app/actions/cowork-conversations";
import type { ArtifactPreviewItem } from "@/lib/cowork/artifact-preview";
import type {
  Conversation,
  ConversationMessage,
} from "@/db/schema/conversations";
import type { InitialProcessingState } from "@/lib/cowork/initial-processing";
import { CollapsibleMessageContent } from "@/app/(dashboard)/employee/[id]/collapsible-markdown";

/** 从消息 meta 里安全取出反馈值 */
function feedbackOf(message: ConversationMessage): MessageFeedback {
  const f = (message.meta as { feedback?: unknown } | null)?.feedback;
  return f === "like" || f === "dislike" ? f : null;
}

interface Props {
  active: { conversation: Conversation; messages: ConversationMessage[] } | null;
  initialProcessing?: InitialProcessingState | null;
  onProcessingRetry?: () => void;
  focusedMissionId: string | null;
  /** 点对话里 mission 卡片 → 打开抽屉加载该 mission */
  onMissionFocus: (missionId: string) => void;
  /** 发送瞬间 → 乐观打开抽屉 loading 态 */
  onSendStart?: () => void;
  /** 结果回来 → 有 mission 则加载,无则关抽屉 */
  onSendSettled?: (missionId: string | null) => void;
  selectedArtifactId?: string | null;
  onArtifactSelect?: (artifact: ArtifactPreviewItem) => void;
  artifactOverrides?: Record<string, ArtifactPreviewItem>;
  streamingReply?: {
    messageId: string | null;
    content: string;
    active: boolean;
    statusLabel?: string;
    error?: string;
  } | null;
  onSubmitMessage?: (text: string) => Promise<string | null>;
}

export function ConversationThread({
  active,
  initialProcessing = null,
  onProcessingRetry,
  focusedMissionId,
  onMissionFocus,
  onSendStart,
  onSendSettled,
  selectedArtifactId = null,
  onArtifactSelect,
  artifactOverrides,
  streamingReply = null,
  onSubmitMessage,
}: Props) {
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 只滚消息容器自身的 scrollTop,绝不用 scrollIntoView —— 后者会向上冒泡
  // 滚动外层 overflow-hidden 的 dashboard <main>,把整页推上去且拖不回(实测 bug)。
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [active?.messages.length]);

  function handleSend() {
    const text = input.trim();
    if (!text || !active || pending) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    onSendStart?.(); // 乐观打开右侧执行面板(loading)
    startTransition(async () => {
      const missionId = await onSubmitMessage?.(text);
      onSendSettled?.(missionId ?? null);
    });
  }

  // 重新生成:重发指定文本(文本回答=上一条用户消息;交付结果=任务原指令)。
  function regenerate(text: string) {
    const t = text.trim();
    if (!t || !active || pending) return;
    onSendStart?.();
    startTransition(async () => {
      const missionId = await onSubmitMessage?.(t);
      onSendSettled?.(missionId ?? null);
    });
  }

  if (!active) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <Sparkles className="size-7 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">新建或选择一个对话,开始协作</p>
      </main>
    );
  }

  const empty = active.messages.length === 0;
  const hasActiveStreamingStatus = Boolean(
    streamingReply?.active && streamingReply.statusLabel,
  );
  const hasUnpersistedStreamingMessage = Boolean(
    streamingReply?.messageId &&
      !active.messages.some(
        (message) => message.id === streamingReply.messageId,
      ),
  );
  const shouldRenderUnpersistedStreamingReply = Boolean(
    hasUnpersistedStreamingMessage &&
      (streamingReply?.content.trim() || !streamingReply?.active),
  );

  // 输入框语义建议：从会话上下文派生（纯规则、零延迟）
  const inputSuggestions = suggestInputs({
    messageCount: active.messages.length,
    hasDraft: active.messages.some((m) => m.kind === "draft_result"),
    hasRunningMission: false, // TODO: 接 mission 实时状态后改为真实「未终态」判断
  });

  return (
    <main className="flex flex-1 flex-col bg-background">
      {/* 顶栏 */}
      <div className="flex h-12 flex-none items-center border-b border-border/60 px-4">
        <span className="truncate text-sm font-medium">
          {active.conversation.title}
        </span>
      </div>

      {/* 消息流 —— 居中、最大宽度约束(贴 Claude) */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
              <Sparkles className="size-7 text-primary" />
            </div>
            <h3 className="mt-4 text-base font-medium text-foreground">
              说点什么,开始新会话
            </h3>
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
              描述你的需求,我会解析意图、组建 AI 团队并安排任务执行。
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
            {active.messages.map((m, i) => {
              // 该助手回答对应的"上一条用户消息"(供「重新生成」重发)
              let precedingUserText: string | null = null;
              for (let j = i - 1; j >= 0; j--) {
                if (active.messages[j].role === "user") {
                  precedingUserText = active.messages[j].content;
                  break;
                }
              }
              return (
                <MessageBubble
                  key={m.id}
                  message={m}
                  focused={
                    m.missionId != null && m.missionId === focusedMissionId
                  }
                  onMissionFocus={onMissionFocus}
                  onRegenerate={regenerate}
                  precedingUserText={precedingUserText}
                  selectedArtifactId={selectedArtifactId}
                  onArtifactSelect={onArtifactSelect}
                  artifactOverrides={artifactOverrides}
                  contentOverride={
                    streamingReply?.messageId === m.id
                      ? streamingReply.content
                      : undefined
                  }
                  streaming={
                    streamingReply?.messageId === m.id &&
                    streamingReply.active
                  }
                />
              );
            })}
            {hasActiveStreamingStatus ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span>{streamingReply?.statusLabel}</span>
              </div>
            ) : null}
            {shouldRenderUnpersistedStreamingReply ? (
              <AssistantTextContent
                content={streamingReply?.content ?? ""}
                streaming={streamingReply?.active ?? false}
              />
            ) : null}
            {!hasActiveStreamingStatus &&
            !streamingReply?.active &&
            (initialProcessing?.status === "pending" ||
              initialProcessing?.status === "running") ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span>正在解析意图并安排 AI 团队处理…</span>
              </div>
            ) : initialProcessing?.status === "failed" ? (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <span>
                  处理失败：
                  {initialProcessing.error ?? "请求中断，请重试"}
                </span>
                <Button variant="ghost" size="sm" onClick={onProcessingRetry}>
                  重试
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* 输入框 —— gemini-border 玻璃容器,与落地页一致 */}
      <div className="px-4 pb-4 pt-2">
        <div className="mx-auto max-w-3xl">
          <InputSuggestions
            items={inputSuggestions}
            onPick={(fill) => {
              setInput(fill);
              textareaRef.current?.focus();
            }}
          />
          <div className="gemini-border rounded-2xl bg-card transition-shadow duration-300 ease-out dark:bg-white/[0.06]">
            <div className="px-4 pb-1.5 pt-3">
              {/* 容器即输入框,故用裸 textarea(透明无边框、JS 自动撑高),与落地页同款 */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                onInput={(e) => {
                  const t = e.currentTarget;
                  t.style.height = "auto";
                  t.style.height = `${Math.min(t.scrollHeight, 160)}px`;
                }}
                placeholder="输入需求,我会解析意图并安排任务执行…"
                rows={1}
                className="max-h-[160px] min-h-[24px] w-full resize-none bg-transparent text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/50"
              />
            </div>
            <div className="flex items-center justify-between px-3 pb-2.5 pt-0.5">
              <div className="flex items-center gap-0.5 text-muted-foreground">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-lg"
                  aria-label="添加附件"
                  title="敬请期待"
                  disabled
                >
                  <Paperclip className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-lg"
                  aria-label="语音输入"
                  title="敬请期待"
                  disabled
                >
                  <Mic className="size-4" />
                </Button>
                <span className="mx-1 h-3.5 w-px bg-border" />
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/80">
                  <Route className="size-3.5" /> 智能路由
                </span>
              </div>
              <Button
                size="icon-sm"
                className="rounded-lg"
                disabled={pending || !input.trim()}
                onClick={handleSend}
                aria-label="发送"
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowUp className="size-4" strokeWidth={2.5} />
                )}
              </Button>
            </div>
          </div>
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground/40">
            回车发送,Shift + Enter 换行
          </p>
        </div>
      </div>
    </main>
  );
}

function MessageBubble({
  message,
  focused,
  onMissionFocus,
  onRegenerate,
  precedingUserText,
  selectedArtifactId,
  onArtifactSelect,
  artifactOverrides,
  contentOverride,
  streaming = false,
}: {
  message: ConversationMessage;
  focused: boolean;
  onMissionFocus: (missionId: string) => void;
  onRegenerate: (text: string) => void;
  precedingUserText: string | null;
  selectedArtifactId: string | null;
  onArtifactSelect?: (artifact: ArtifactPreviewItem) => void;
  artifactOverrides?: Record<string, ArtifactPreviewItem>;
  contentOverride?: string;
  streaming?: boolean;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] leading-relaxed text-primary-foreground">
          {message.content}
        </div>
      </div>
    );
  }

  // 意图识别 chip：所有 assistant 分支顶部展示（旧消息无 meta.intent 则为 null）
  const intentMeta = readIntentFromMeta(message.meta);
  const intentChip = intentMeta ? <IntentChip intent={intentMeta} /> : null;

  if (message.kind === "mission_card" && message.missionId) {
    const missionId = message.missionId;
    return (
      <div className="space-y-2">
        {intentChip}
        <div className="flex justify-start">
          <button
            type="button"
            onClick={() => onMissionFocus(missionId)}
            className={cn(
              "group flex max-w-[88%] items-center gap-2.5 rounded-2xl rounded-bl-md px-3 py-2 text-left transition-all duration-200",
              focused
                ? "bg-primary/10 ring-1 ring-inset ring-primary/30"
                : "bg-card shadow-sm ring-1 ring-inset ring-border/60 hover:ring-primary/30",
            )}
          >
            <span className="flex size-7 flex-none items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ListChecks className="size-4" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-foreground">
                {message.content || "已组建 AI 团队并开始执行"}
              </div>
              <div className="text-[11px] text-muted-foreground">
                执行步骤见下方,右侧面板可看清单进度
              </div>
            </div>
          </button>
        </div>
        {/* 步骤流式输出到对话框 + 终态交付/失败气泡(自带操作工具栏) */}
        <MissionStepStream
          missionId={missionId}
          missionCardMessageId={message.id}
          initialFeedback={feedbackOf(message)}
          onRegenerate={onRegenerate}
          selectedArtifactId={selectedArtifactId}
          onArtifactSelect={onArtifactSelect}
          artifactOverrides={artifactOverrides}
        />
      </div>
    );
  }

  if (message.kind === "plan_card") {
    const plan = (message.meta as { plan?: CreationPlan } | null)?.plan;
    if (!plan) return null;
    return (
      <div className="flex flex-col items-start gap-1.5">
        {intentChip}
        <CreationPlanForm conversationId={message.conversationId} plan={plan} />
      </div>
    );
  }

  if (message.kind === "draft_result") {
    const meta = message.meta as DraftResultMeta | null;
    if (!meta) return null;
    return (
      <div className="flex flex-col items-start gap-1.5">
        {intentChip}
        <DraftResultCard meta={meta} conversationId={message.conversationId} />
      </div>
    );
  }

  if (message.kind === "import_card") {
    return (
      <div className="flex flex-col items-start gap-1.5">
        {intentChip}
        <ImportCard
          content={message.content}
          meta={message.meta as ImportCardMeta | null}
        />
      </div>
    );
  }

  if (message.kind === "multi_version_card") {
    const vmeta = message.meta as
      | { articleId?: string; platforms?: string[] }
      | null;
    if (!vmeta?.articleId) return null;
    return (
      <div className="flex flex-col items-start gap-1.5">
        {intentChip}
        <MultiVersionCard
          articleId={vmeta.articleId}
          platforms={vmeta.platforms ?? []}
        />
      </div>
    );
  }

  // assistant text —— hover 时在气泡下方露出操作工具栏
  const displayContent = contentOverride ?? message.content;
  return (
    <div className="group flex flex-col items-start gap-1">
      {intentChip}
      <AssistantTextContent content={displayContent} streaming={streaming} />
      {!streaming ? (
        <MessageActions
          text={displayContent}
          messageId={message.id}
          initialFeedback={feedbackOf(message)}
          onRegenerate={
            precedingUserText
              ? () => onRegenerate(precedingUserText)
              : undefined
          }
          className="pl-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
        />
      ) : null}
    </div>
  );
}

function AssistantTextContent({
  content,
  streaming,
}: {
  content: string;
  streaming: boolean;
}) {
  return (
    <div className="max-w-[80%] break-words rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 text-foreground">
      {content ? (
        <CollapsibleMessageContent markdown={content} />
      ) : (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      )}
      {streaming ? (
        <span
          data-streaming-cursor
          className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current align-middle"
        />
      ) : null}
    </div>
  );
}
