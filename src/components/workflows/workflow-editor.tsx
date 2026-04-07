"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  MessageSquare,
  Plus,
  Wrench,
  Sparkles,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkflowCanvas } from "./workflow-canvas";
import { RightPanel } from "./right-panel";
import { BottomActionBar } from "./bottom-action-bar";
import { saveWorkflow, updateWorkflow } from "@/app/actions/workflow-engine";
import type { WorkflowStepDef } from "@/db/schema/workflows";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: "user" | "ai";
  content: string;
  type?: "thinking" | "result" | "error";
}

interface WorkflowEditorProps {
  initialData?: {
    id?: string;
    name: string;
    description: string;
    category: string;
    triggerType: string;
    triggerConfig?: { cron?: string; timezone?: string } | null;
    steps: WorkflowStepDef[];
  };
  mode: "create" | "edit";
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { value: "news", label: "新闻报道" },
  { value: "video", label: "视频生产" },
  { value: "analytics", label: "数据分析" },
  { value: "distribution", label: "渠道运营" },
  { value: "custom", label: "自定义" },
] as const;

type Category = "news" | "video" | "analytics" | "distribution" | "custom";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkflowEditor({ initialData, mode }: WorkflowEditorProps) {
  const router = useRouter();

  // ── Workflow metadata ──
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(
    initialData?.description ?? ""
  );
  const [category, setCategory] = useState<Category>(
    (initialData?.category as Category) ?? "custom"
  );
  const [triggerType, setTriggerType] = useState<"manual" | "scheduled">(
    (initialData?.triggerType as "manual" | "scheduled") ?? "manual"
  );
  const [triggerConfig, setTriggerConfig] = useState(
    initialData?.triggerConfig ?? null
  );
  const [isEnabled, setIsEnabled] = useState(false);

  // ── Steps ──
  const [steps, setSteps] = useState<WorkflowStepDef[]>(
    initialData?.steps ?? []
  );
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  // ── Right panel mode ──
  const [rightPanelMode, setRightPanelMode] = useState<"add" | "detail">(
    "add"
  );

  // ── UI state ──
  const [saving, setSaving] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // ── Test run simulation state ──
  const [triggerStatus, setTriggerStatus] = useState<
    "idle" | "running" | "completed"
  >("idle");
  const [stepStatuses, setStepStatuses] = useState<
    Record<string, { status: string; message?: string }>
  >({});

  // ── AI chat (left panel) ──
  const [chatInput, setChatInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showGuide, setShowGuide] = useState(mode === "create");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // ── Step management handlers ──

  const handleAddSkillStep = useCallback(
    (skillSlug: string, skillName: string, skillCategory: string) => {
      const newStep: WorkflowStepDef = {
        id: crypto.randomUUID(),
        order: steps.length + 1,
        dependsOn: steps.length > 0 ? [steps[steps.length - 1].id] : [],
        name: skillName,
        type: "skill",
        config: {
          skillSlug,
          skillName,
          skillCategory,
          parameters: {},
        },
      };
      setSteps((prev) => [...prev, newStep]);
      setHasChanges(true);
    },
    [steps]
  );

  const handleAddOutputStep = useCallback(
    (action: string, actionLabel: string) => {
      const newStep: WorkflowStepDef = {
        id: crypto.randomUUID(),
        order: steps.length + 1,
        dependsOn: steps.length > 0 ? [steps[steps.length - 1].id] : [],
        name: actionLabel,
        type: "output",
        config: {
          outputAction: action,
          parameters: {},
        },
      };
      setSteps((prev) => [...prev, newStep]);
      setHasChanges(true);
    },
    [steps]
  );

  const handleAddAIStep = useCallback(
    (aiDescription: string) => {
      const newStep: WorkflowStepDef = {
        id: crypto.randomUUID(),
        order: steps.length + 1,
        dependsOn: steps.length > 0 ? [steps[steps.length - 1].id] : [],
        name: "AI 自定义",
        type: "skill",
        config: {
          skillSlug: "ai_custom",
          skillName: "AI 自定义",
          skillCategory: "generation",
          description: aiDescription,
          parameters: {},
        },
      };
      setSteps((prev) => [...prev, newStep]);
      setHasChanges(true);
    },
    [steps]
  );

  const handleStepClick = useCallback(
    (stepId: string) => {
      setSelectedStepId(stepId);
      setRightPanelMode("detail");
    },
    []
  );

  const handleSaveStep = useCallback((updatedStep: WorkflowStepDef) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === updatedStep.id ? updatedStep : s))
    );
    setHasChanges(true);
  }, []);

  const handleDeleteStep = useCallback(
    (stepId: string) => {
      setSteps((prev) => {
        const filtered = prev.filter((s) => s.id !== stepId);
        return filtered.map((s, idx) => ({ ...s, order: idx + 1 }));
      });
      if (selectedStepId === stepId) {
        setSelectedStepId(null);
        setRightPanelMode("add");
      }
      setHasChanges(true);
    },
    [selectedStepId]
  );

  const handleMoveUp = useCallback((stepId: string) => {
    setSteps((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((s) => s.id === stepId);
      if (idx <= 0) return prev;
      const newSteps = [...sorted];
      const temp = newSteps[idx].order;
      newSteps[idx] = { ...newSteps[idx], order: newSteps[idx - 1].order };
      newSteps[idx - 1] = { ...newSteps[idx - 1], order: temp };
      return newSteps;
    });
    setHasChanges(true);
  }, []);

  const handleMoveDown = useCallback((stepId: string) => {
    setSteps((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((s) => s.id === stepId);
      if (idx < 0 || idx >= sorted.length - 1) return prev;
      const newSteps = [...sorted];
      const temp = newSteps[idx].order;
      newSteps[idx] = { ...newSteps[idx], order: newSteps[idx + 1].order };
      newSteps[idx + 1] = { ...newSteps[idx + 1], order: temp };
      return newSteps;
    });
    setHasChanges(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedStepId(null);
    setRightPanelMode("add");
  }, []);

  const handleAddStepFromBar = useCallback(() => {
    setRightPanelMode("add");
    setSelectedStepId(null);
  }, []);

  const handleTriggerClick = useCallback(() => {
    // Toggle trigger type
    setTriggerType((prev) =>
      prev === "manual" ? "scheduled" : "manual"
    );
    setHasChanges(true);
  }, []);

  // ── Workflow actions ──

  const handleSave = useCallback(async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (mode === "edit" && initialData?.id) {
        await updateWorkflow(initialData.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          category,
          triggerType,
          triggerConfig,
          steps,
        });
      } else {
        await saveWorkflow({
          name: name.trim(),
          description: description.trim() || undefined,
          category,
          triggerType,
          triggerConfig,
          steps,
        });
      }
      router.push("/workflows");
    } catch (err) {
      console.error("Failed to save workflow:", err);
    } finally {
      setSaving(false);
    }
  }, [
    mode,
    initialData?.id,
    name,
    description,
    category,
    triggerType,
    triggerConfig,
    steps,
    router,
  ]);

  const handleTestRun = useCallback(async () => {
    if (testRunning) return;
    setTestRunning(true);
    setTriggerStatus("idle");
    setStepStatuses({});

    try {
      const res = await fetch("/api/workflows/test-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps, triggerType, triggerConfig }),
      });

      if (!res.ok || !res.body) {
        console.error("[test-run] Request failed:", res.status);
        setTestRunning(false);
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

              switch (eventType) {
                case "trigger-start":
                  setTriggerStatus("running");
                  break;
                case "trigger-complete":
                  setTriggerStatus("completed");
                  break;
                case "step-start":
                  setStepStatuses((prev) => ({
                    ...prev,
                    [data.stepId as string]: { status: "running" },
                  }));
                  break;
                case "step-progress":
                  setStepStatuses((prev) => ({
                    ...prev,
                    [data.stepId as string]: {
                      status: "running",
                      message: data.message as string,
                    },
                  }));
                  break;
                case "step-complete":
                  setStepStatuses((prev) => ({
                    ...prev,
                    [data.stepId as string]: {
                      status: "completed",
                      message: data.result as string,
                    },
                  }));
                  break;
                case "step-failed":
                  setStepStatuses((prev) => ({
                    ...prev,
                    [data.stepId as string]: {
                      status: "failed",
                      message: data.error as string,
                    },
                  }));
                  break;
                case "done":
                  setTestRunning(false);
                  break;
                case "error":
                  console.error("[test-run] Server error:", data.message);
                  setTestRunning(false);
                  break;
              }
            } catch {
              // Ignore parse errors for incomplete data
            }
            eventType = "";
          }
        }
      }

      // Stream ended — ensure testRunning is reset
      setTestRunning(false);
    } catch (err) {
      console.error("[test-run] Fetch error:", err);
      setTestRunning(false);
    }
  }, [testRunning, steps, triggerType, triggerConfig]);

  const handleToggleEnabled = useCallback(() => {
    setIsEnabled((prev) => !prev);
    setHasChanges(true);
  }, []);

  // ── AI chat ──

  const scrollChatToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      chatScrollRef.current?.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, []);

  const handleChatSend = useCallback(async () => {
    if (!chatInput.trim() || generating) return;
    const userMessage = chatInput.trim();
    setChatInput("");
    setShowGuide(false);

    // Add user message
    setChatMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage },
    ]);
    scrollChatToBottom();

    setGenerating(true);

    try {
      const res = await fetch("/api/workflows/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: userMessage }),
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
                setChatMessages((prev) => [
                  ...prev,
                  {
                    role: "ai",
                    content: data.message as string,
                    type: "thinking",
                  },
                ]);
                scrollChatToBottom();
              } else if (eventType === "result") {
                // Apply the generated workflow
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

                // Set workflow metadata
                setName(generated.name || "");
                setDescription(generated.description || "");
                if (
                  ["news", "video", "analytics", "distribution", "custom"].includes(
                    generated.category
                  )
                ) {
                  setCategory(generated.category as Category);
                }
                if (
                  generated.triggerType === "manual" ||
                  generated.triggerType === "scheduled"
                ) {
                  setTriggerType(generated.triggerType);
                }
                if (generated.triggerConfig) {
                  setTriggerConfig(generated.triggerConfig);
                }

                // Convert to WorkflowStepDef array
                const newSteps: WorkflowStepDef[] = generated.steps.map(
                  (s, idx) => ({
                    id: crypto.randomUUID(),
                    order: idx + 1,
                    dependsOn: idx > 0 ? [/* will be filled below */] : [],
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

                setSteps(newSteps);
                setHasChanges(true);

                setChatMessages((prev) => [
                  ...prev,
                  {
                    role: "ai",
                    content: `已生成 ${newSteps.length} 个步骤的工作流「${generated.name}」`,
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
  }, [chatInput, generating, scrollChatToBottom]);

  // ── Derived ──

  const selectedStep = steps.find((s) => s.id === selectedStepId) ?? null;

  // ── Render ──

  return (
    <div className="flex flex-col h-full">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background shrink-0">
        <button
          onClick={() => router.push("/workflows")}
          className="p-2 rounded-lg bg-transparent text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setHasChanges(true);
          }}
          placeholder="输入工作流名称"
          className="max-w-sm text-base font-medium border-transparent bg-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.04] focus:bg-background focus:border-border transition-colors"
        />

        <Select
          value={category}
          onValueChange={(v) => {
            setCategory(v as Category);
            setHasChanges(true);
          }}
        >
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />
      </div>

      {/* ── Three-column body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── Left: AI Chat Panel ── */}
        <div className="w-[280px] border-r border-border flex flex-col shrink-0 bg-muted/30">
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
                    className="mt-3 px-3 py-1.5 rounded-lg bg-purple-500/10 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition-colors cursor-pointer"
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
                rows={2}
                className="w-full rounded-xl bg-black/[0.03] dark:bg-white/[0.04] px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring transition-colors border-0"
              />
            </div>
            <div className="flex items-center gap-1 mt-2">
              <button className="p-1.5 rounded-lg bg-transparent text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer">
                <Plus className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded-lg bg-transparent text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer">
                <Wrench className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded-lg bg-transparent text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer">
                <MessageSquare className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Center: Canvas + Bottom Bar ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          <div className="flex-1 overflow-y-auto p-6">
            <WorkflowCanvas
              triggerType={triggerType}
              triggerConfig={triggerConfig}
              steps={steps}
              selectedStepId={selectedStepId}
              testRunning={testRunning}
              triggerStatus={triggerStatus}
              stepStatuses={stepStatuses}
              onTriggerClick={handleTriggerClick}
              onStepClick={handleStepClick}
              onStepEdit={handleStepClick}
              onStepDelete={handleDeleteStep}
              onStepMoveUp={handleMoveUp}
              onStepMoveDown={handleMoveDown}
              onAddStep={handleAddStepFromBar}
            />
          </div>
          <BottomActionBar
            onTestRun={handleTestRun}
            onToggleEnabled={handleToggleEnabled}
            onSave={handleSave}
            isEnabled={isEnabled}
            triggerType={triggerType}
            saving={saving}
            testRunning={testRunning}
            hasChanges={hasChanges}
          />
        </div>

        {/* ── Right: Add/Detail Panel ── */}
        <div className="w-[300px] border-l border-border shrink-0 overflow-y-auto bg-background">
          <RightPanel
            mode={rightPanelMode}
            onAddSkillStep={handleAddSkillStep}
            onAddOutputStep={handleAddOutputStep}
            onAddAIStep={handleAddAIStep}
            selectedStep={selectedStep}
            onSaveStep={handleSaveStep}
            onCloseDetail={handleCloseDetail}
          />
        </div>
      </div>
    </div>
  );
}
