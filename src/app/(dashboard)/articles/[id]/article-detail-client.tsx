"use client";

import { useArticlePageStore } from "./store";
import { useAppearance } from "./hooks/use-article-context";
import type { ArticleDetailClientProps } from "./types";
import { cn } from "@/lib/utils";
import { ArticleHeader } from "./features/header/article-header";
import { ArticleReader } from "./features/reader/article-reader";
import { ArticleEditor } from "./features/editor/article-editor";
import { OutlinePanel } from "./features/outline/outline-panel";
import { AIChatPanel } from "./features/ai-chat/ai-chat-panel";
import { AIAnalysisPanel } from "./features/ai-analysis/ai-analysis-panel";
import { AnnotationsPanel } from "./features/annotations/annotations-panel";

export default function ArticleDetailClient({
  article,
  organizationId,
  initialAnnotations,
  initialAIAnalysis,
}: ArticleDetailClientProps) {
  const {
    viewMode,
    setViewMode,
    leftPanelOpen,
    rightPanelOpen,
    leftTab,
    rightTab,
    toggleLeftPanel,
    toggleRightPanel,
    setLeftTab,
    setRightTab,
  } = useArticlePageStore();
  const { appearance } = useAppearance();

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {/* Reading progress bar */}
      <div className="h-0.5 bg-muted">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300"
          style={{ width: "0%" }}
        />
      </div>

      {/* Header */}
      <ArticleHeader
        article={article}
        annotationCount={initialAnnotations.length}
      />

      {/* Three-column body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <div
          className={cn(
            "border-r border-[var(--glass-border)] bg-[var(--glass-panel-bg)] backdrop-blur-xl transition-all duration-300 ease-out overflow-hidden shrink-0",
            leftPanelOpen ? "w-[22%] min-w-[280px]" : "w-7"
          )}
        >
          {leftPanelOpen ? (
            <div className="flex flex-col h-full">
              <div className="px-3 py-2 text-sm font-medium border-b border-[var(--glass-border)] flex items-center justify-between">
                <span>✦ AI 助手</span>
                <button
                  className="text-muted-foreground hover:text-foreground text-xs"
                  onClick={toggleLeftPanel}
                >
                  ◀
                </button>
              </div>
              <div className="flex border-b border-[var(--glass-border)] text-xs">
                {(["outline", "chat", "history"] as const).map((tab) => (
                  <button
                    key={tab}
                    className={cn(
                      "flex-1 text-center py-2 transition-colors",
                      leftTab === tab
                        ? "text-blue-500 border-b-2 border-blue-500"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setLeftTab(tab)}
                  >
                    {tab === "outline"
                      ? "大纲"
                      : tab === "chat"
                        ? "对话"
                        : "历史"}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-hidden flex flex-col">
                {leftTab === "outline" && (
                  <OutlinePanel htmlContent={article.body ?? ""} />
                )}
                {leftTab === "chat" && (
                  <AIChatPanel
                    articleContent={article.body ?? ""}
                    viewMode={viewMode}
                    contentType={article.mediaType === "video" ? "video" : "article"}
                  />
                )}
                {leftTab === "history" && (
                  <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                    [对话历史 — Phase 5]
                  </div>
                )}
              </div>
            </div>
          ) : (
            <button
              className="w-full h-full flex items-start justify-center pt-3 text-blue-500 hover:text-blue-400"
              onClick={toggleLeftPanel}
            >
              ✦
            </button>
          )}
        </div>

        {/* Center stage */}
        <div className="flex-1 overflow-hidden">
          {viewMode === "edit" ? (
            <ArticleEditor
              article={article}
              appearance={appearance}
              onExitEdit={() => setViewMode("read")}
            />
          ) : (
            <div className="h-full overflow-y-auto">
              <ArticleReader article={article} appearance={appearance} />
            </div>
          )}
        </div>

        {/* Right panel */}
        <div
          className={cn(
            "border-l border-[var(--glass-border)] bg-[var(--glass-panel-bg)] backdrop-blur-xl transition-all duration-300 ease-out overflow-hidden shrink-0",
            rightPanelOpen ? "w-[27%] min-w-[300px]" : "w-7"
          )}
        >
          {rightPanelOpen ? (
            <div className="flex flex-col h-full">
              <div className="flex border-b border-[var(--glass-border)] text-xs">
                {(["analysis", "annotations", "transcript"] as const).map(
                  (tab) => (
                    <button
                      key={tab}
                      className={cn(
                        "flex-1 text-center py-2 transition-colors",
                        rightTab === tab
                          ? "text-blue-500 border-b-2 border-blue-500"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => setRightTab(tab)}
                    >
                      {tab === "analysis"
                        ? "AI 解读"
                        : tab === "annotations"
                          ? "批注"
                          : "听记"}
                    </button>
                  )
                )}
              </div>
              <div className="flex-1 overflow-hidden flex flex-col">
                {rightTab === "analysis" && (
                  <AIAnalysisPanel
                    articleId={article.id}
                    articleContent={article.body ?? ""}
                    initialCache={initialAIAnalysis}
                  />
                )}
                {rightTab === "annotations" && (
                  <AnnotationsPanel
                    articleId={article.id}
                    organizationId={organizationId}
                    initialAnnotations={initialAnnotations}
                  />
                )}
                {rightTab === "transcript" && (
                  <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                    [听记 — 后续 Task 填充]
                  </div>
                )}
              </div>
            </div>
          ) : (
            <button
              className="w-full h-full flex items-start justify-center pt-3 text-muted-foreground hover:text-foreground"
              onClick={toggleRightPanel}
            >
              📝
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
