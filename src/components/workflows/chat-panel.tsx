"use client";

import { useState, useCallback, useRef, type ChangeEvent } from "react";
import {
  Loader2,
  Plus,
  Wrench,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  SendHorizonal,
} from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { WorkflowStepDef } from "@/db/schema/workflows";
import {
  ModelSwitcher,
  DEFAULT_MODEL_ID,
} from "@/components/shared/model-switcher";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: "user" | "ai";
  content: string;
  type?: "thinking" | "result" | "error";
}

type Category = "news" | "video" | "analytics" | "distribution" | "custom";

interface ChatPanelProps {
  mode: "create" | "edit";
  onWorkflowGenerated: (data: {
    name: string;
    description: string;
    category: Category;
    triggerType: "manual" | "scheduled";
    triggerConfig: { cron?: string; timezone?: string } | null;
    steps: WorkflowStepDef[];
  }) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatPanel({ mode, onWorkflowGenerated }: ChatPanelProps) {
  const [chatInput, setChatInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showGuide, setShowGuide] = useState(mode === "create");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [connectorOpen, setConnectorOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL_ID);

  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      toast.info("文件上传功能即将上线", {
        description: `已选择 ${files.length} 个文件`,
      });
    }
    e.target.value = "";
  }, []);

  const scrollChatToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      chatScrollRef.current?.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, []);

  // Build API messages from chat history (exclude thinking/error, map roles)
  const buildApiMessages = useCallback(
    (extraUserMsg: string) => {
      const apiMsgs: Array<{ role: "user" | "assistant"; content: string }> =
        [];
      for (const msg of chatMessages) {
        if (msg.type === "thinking" || msg.type === "error") continue;
        apiMsgs.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
        });
      }
      apiMsgs.push({ role: "user", content: extraUserMsg });
      return apiMsgs;
    },
    [chatMessages]
  );

  const handleChatSend = useCallback(async () => {
    if (!chatInput.trim() || generating) return;
    const userMessage = chatInput.trim();
    setChatInput("");
    setShowGuide(false);

    setChatMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage },
    ]);
    scrollChatToBottom();
    setGenerating(true);

    try {
      const apiMessages = buildApiMessages(userMessage);

      const res = await fetch("/api/workflows/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.ok || !res.body) {
        setChatMessages((prev) => [
          ...prev,
          { role: "ai", content: "请求失败，请重试", type: "error" },
        ]);
        setGenerating(false);
        scrollChatToBottom();
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ") && eventType) {
            try {
              const data = JSON.parse(line.slice(6));

              if (eventType === "thinking") {
                // Don't accumulate thinking messages, just show spinner
              } else if (eventType === "reply") {
                // Conversational reply — AI is asking questions or confirming
                setChatMessages((prev) => [
                  ...prev,
                  {
                    role: "ai",
                    content: data.message as string,
                  },
                ]);
                scrollChatToBottom();
              } else if (eventType === "result") {
                const generated = data as {
                  name: string;
                  description: string;
                  category: string;
                  triggerType: string;
                  triggerConfig: {
                    cron?: string;
                    timezone?: string;
                  } | null;
                  steps: Array<{
                    name: string;
                    skillSlug: string;
                    skillName: string;
                    skillCategory: string;
                    description: string;
                  }>;
                };

                // Convert to WorkflowStepDef array
                const newSteps: WorkflowStepDef[] = generated.steps.map(
                  (s, idx) => ({
                    id: crypto.randomUUID(),
                    order: idx + 1,
                    dependsOn: [],
                    name: s.name,
                    type: "skill" as const,
                    config: {
                      skillSlug: s.skillSlug,
                      skillName: s.skillName,
                      skillCategory: s.skillCategory,
                      description: s.description,
                      parameters: {},
                    },
                  })
                );

                // Wire up linear dependencies
                for (let i = 1; i < newSteps.length; i++) {
                  newSteps[i].dependsOn = [newSteps[i - 1].id];
                }

                const validCategories = [
                  "news",
                  "video",
                  "analytics",
                  "distribution",
                  "custom",
                ];
                const cat = validCategories.includes(generated.category)
                  ? (generated.category as Category)
                  : "custom";
                const trigger =
                  generated.triggerType === "manual" ||
                  generated.triggerType === "scheduled"
                    ? generated.triggerType
                    : "manual";

                onWorkflowGenerated({
                  name: generated.name || "",
                  description: generated.description || "",
                  category: cat,
                  triggerType: trigger,
                  triggerConfig: generated.triggerConfig ?? null,
                  steps: newSteps,
                });

                setChatMessages((prev) => [
                  ...prev,
                  {
                    role: "ai",
                    content: `已生成 ${newSteps.length} 个步骤的工作流「${generated.name}」，你可以在画布上查看和调整。`,
                    type: "result",
                  },
                ]);
                scrollChatToBottom();
              } else if (eventType === "error") {
                setChatMessages((prev) => [
                  ...prev,
                  {
                    role: "ai",
                    content: (data.message as string) || "生成失败",
                    type: "error",
                  },
                ]);
                scrollChatToBottom();
              }
            } catch {
              // Ignore parse errors for incomplete data
            }
            eventType = "";
          }
        }
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content:
            err instanceof Error ? err.message : "网络错误，请重试",
          type: "error",
        },
      ]);
      scrollChatToBottom();
    } finally {
      setGenerating(false);
    }
  }, [chatInput, generating, scrollChatToBottom, onWorkflowGenerated, buildApiMessages]);

  return (
    <div className="w-[360px] border-r border-border flex flex-col shrink-0 bg-muted/30">
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <h2 className="text-sm font-semibold text-foreground">
          创建您的自定义工作流
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          描述您的任务，让 AI 自动完成
        </p>
      </div>

      {/* Content area */}
      <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 py-2">
        {/* Guide bubble */}
        {showGuide && chatMessages.length === 0 && (
          <div className="relative mt-4 mb-4">
            <div className="rounded-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 p-4">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    从这里开始！
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    描述要自动化的内容，AI 将为您构建
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="mt-3 px-3 py-1.5 rounded-lg bg-purple-500/10 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition-colors cursor-pointer border-0"
              >
                知道了
              </button>
            </div>
            {/* Arrow pointing down to input */}
            <div className="flex justify-center mt-2">
              <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-purple-500/20" />
            </div>
          </div>
        )}

        {/* Chat messages */}
        {chatMessages.map((msg, idx) => (
          <div
            key={idx}
            className={`mb-3 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "user" ? (
              <div className="max-w-[85%] rounded-xl bg-primary/10 px-3 py-2 text-xs text-foreground">
                {msg.content}
              </div>
            ) : (
              <div className="max-w-[85%] flex items-start gap-1.5">
                {msg.type === "thinking" && (
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground mt-0.5 shrink-0" />
                )}
                {msg.type === "result" && (
                  <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                )}
                {msg.type === "error" && (
                  <AlertCircle className="w-3 h-3 text-destructive mt-0.5 shrink-0" />
                )}
                <span
                  className={`text-xs ${
                    msg.type === "error"
                      ? "text-destructive"
                      : msg.type === "result"
                        ? "text-green-600 dark:text-green-400 font-medium"
                        : "text-muted-foreground"
                  }`}
                >
                  {msg.content}
                </span>
              </div>
            )}
          </div>
        ))}

        {/* Generating spinner */}
        {generating && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>AI 正在生成工作流...</span>
          </div>
        )}
      </div>

      {/* Input area at bottom */}
      <div className="px-4 py-3 border-t border-border shrink-0">
        <div className="relative">
          <textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleChatSend();
              }
            }}
            placeholder="描述要自动化的内容..."
            rows={5}
            className="w-full rounded-xl bg-black/[0.03] dark:bg-white/[0.04] px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring transition-colors border-0"
          />
        </div>
        <div className="flex items-center flex-wrap gap-1 mt-2">
          {/* Attachment button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-lg border-0 bg-transparent text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
            title="添加附件"
          >
            <Plus className="w-4 h-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx"
            onChange={handleFileSelect}
          />

          {/* Connector manager */}
          <Popover open={connectorOpen} onOpenChange={setConnectorOpen}>
            <PopoverTrigger asChild>
              <button
                className="p-1.5 rounded-lg border-0 bg-transparent text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                title="管理连接器"
              >
                <Wrench className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              sideOffset={8}
              className="w-60 p-1.5"
            >
              <div className="px-2 pt-1 pb-2 text-xs font-medium text-muted-foreground">
                管理连接器
              </div>
              <div className="space-y-0.5">
                {["微信公众号", "抖音", "微博", "邮箱"].map((cname) => (
                  <button
                    key={cname}
                    onClick={() => {
                      toast.info("连接器管理即将上线");
                      setConnectorOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg border-0 bg-transparent text-left text-sm text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    <span>{cname}</span>
                    <span className="text-[10px] text-muted-foreground">
                      未授权
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-1 pt-1 border-t border-border">
                <button
                  onClick={() => {
                    toast.info("连接器管理即将上线");
                    setConnectorOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg border-0 bg-transparent text-xs text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  前往连接器中心 →
                </button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Model switcher */}
          <ModelSwitcher
            value={selectedModel}
            onChange={setSelectedModel}
            size="sm"
          />

          {/* Spacer + Send button */}
          <div className="flex-1" />
          <button
            onClick={handleChatSend}
            disabled={!chatInput.trim() || generating}
            className="p-1.5 rounded-lg border-0 bg-blue-500 text-white cursor-pointer transition-all hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="发送"
          >
            <SendHorizonal className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
