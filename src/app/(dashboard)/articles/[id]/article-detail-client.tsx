"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useArticlePageStore } from "./store";
import { useAppearance } from "./hooks/use-article-context";
import { useKeyboardShortcuts } from "./hooks/use-keyboard-shortcuts";
import type { ArticleDetailClientProps } from "./types";
import { cn } from "@/lib/utils";
import { ArticleHeader } from "./features/header/article-header";
import { ArticleReader } from "./features/reader/article-reader";
import { ArticleEditor } from "./features/editor/article-editor";
import { OutlinePanel } from "./features/outline/outline-panel";
import { VideoChapters } from "./features/outline/video-chapters";
import { AIChatPanel } from "./features/ai-chat/ai-chat-panel";
import { ChatHistoryPanel } from "./features/ai-chat/chat-history-panel";
import { AIAnalysisPanel } from "./features/ai-analysis/ai-analysis-panel";
import { AnnotationsPanel } from "./features/annotations/annotations-panel";
import { FloatingNote } from "./features/annotations/floating-note";
import { useAnnotations } from "./features/annotations/use-annotations";
import { VideoPlayer } from "./features/video-player/video-player";
import { TranscriptPanel } from "./features/transcript/transcript-panel";
import {
  MOCK_VIDEO_URL,
  MOCK_CHAPTERS,
  MOCK_TRANSCRIPT,
} from "./data/mock-video";

export default function ArticleDetailClient({
  article,
  organizationId,
  initialAnnotations,
  initialAIAnalysis,
}: ArticleDetailClientProps) {
  const {
    viewMode,
    setViewMode,
    activeView,
    leftPanelOpen,
    rightPanelOpen,
    zenMode,
    leftTab,
    rightTab,
    toggleLeftPanel,
    toggleRightPanel,
    setLeftTab,
    setRightTab,
  } = useArticlePageStore();
  const { appearance, setAppearance } = useAppearance();

  // Global keyboard shortcuts
  useKeyboardShortcuts();

  // Annotations state — lifted here so floating notes can render outside the panel
  const { annotations, editAnnotation, removeAnnotation } = useAnnotations(
    article.id,
    organizationId,
    initialAnnotations
  );

  // Video mode state
  const isVideo = article.mediaType === "video";
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const videoSeekRef = useRef<((time: number) => void) | null>(null);

  // Reading progress state
  const [readProgress, setReadProgress] = useState(0);
  const centerRef = useRef<HTMLDivElement>(null);

  // Set contentType in store on mount
  useEffect(() => {
    useArticlePageStore.getState().setContentType(isVideo ? "video" : "article");
  }, [isVideo]);

  // Track scroll progress in center pane
  useEffect(() => {
    const el = centerRef.current;
    if (!el) return;
    const handler = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const progress =
        scrollHeight <= clientHeight
          ? 100
          : Math.round((scrollTop / (scrollHeight - clientHeight)) * 100);
      setReadProgress(progress);
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, []);

  // Build right panel tabs dynamically
  const rightTabs = isVideo
    ? (["analysis", "annotations", "transcript"] as const)
    : (["analysis", "annotations"] as const);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {/* Reading progress bar */}
      <div className="h-0.5 bg-muted">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300"
          style={{ width: `${readProgress}%` }}
        />
      </div>

      {/* Zen mode hint — fades out after 3s */}
      {zenMode && (
        <div
          key={String(zenMode)}
          className="fixed top-16 left-1/2 -translate-x-1/2 z-40 text-xs text-muted-foreground bg-popover/80 backdrop-blur-sm px-3 py-1.5 rounded-full pointer-events-none"
          style={{
            animation: "zenHintFadeOut 3s ease-out forwards",
          }}
        >
          按 ⌘\ 退出禅模式
        </div>
      )}

      {/* Header */}
      <ArticleHeader
        article={article}
        annotationCount={annotations.length}
        appearance={appearance}
        onUpdateAppearance={setAppearance}
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
                      ? isVideo
                        ? "章节"
                        : "大纲"
                      : tab === "chat"
                        ? "对话"
                        : "历史"}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-hidden flex flex-col">
                {leftTab === "outline" &&
                  (isVideo ? (
                    <VideoChapters
                      chapters={MOCK_CHAPTERS}
                      currentTime={videoCurrentTime}
                      onChapterClick={(time) => videoSeekRef.current?.(time)}
                    />
                  ) : (
                    <OutlinePanel htmlContent={article.body ?? ""} />
                  ))}
                {leftTab === "chat" && (
                  <AIChatPanel
                    articleId={article.id}
                    articleContent={article.body ?? ""}
                    viewMode={viewMode}
                    contentType={isVideo ? "video" : "article"}
                  />
                )}
                {leftTab === "history" && (
                  <ChatHistoryPanel articleId={article.id} />
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
        <div className="flex-1 overflow-hidden flex flex-col">
          {isVideo ? (
            <div ref={centerRef} className="h-full overflow-y-auto">
              <VideoPlayer
                videoUrl={article.videoUrl ?? MOCK_VIDEO_URL}
                onTimeUpdate={setVideoCurrentTime}
                seekRef={videoSeekRef}
              />
            </div>
          ) : activeView === "immersive" ? (
            viewMode === "edit" ? (
              <ArticleEditor
                article={article}
                appearance={appearance}
                onExitEdit={() => setViewMode("read")}
              />
            ) : (
              <div ref={centerRef} className="h-full overflow-y-auto">
                <ArticleReader
                  article={article}
                  appearance={appearance}
                  organizationId={organizationId}
                />
              </div>
            )
          ) : activeView === "web" ? (
            <div className="flex-1 flex flex-col h-full">
              {article.sourceAssetId ? (
                <iframe
                  src={article.sourceAssetId}
                  className="w-full h-full border-0"
                  sandbox="allow-same-origin allow-scripts"
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                  无原始链接
                </div>
              )}
            </div>
          ) : activeView === "brief" ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="max-w-[600px] text-center">
                <Sparkles className="w-8 h-8 mx-auto mb-4 text-blue-500" />
                <p className="text-sm text-muted-foreground">AI 速览视图</p>
                <p className="text-xs text-muted-foreground mt-2">
                  点击右侧 AI 解读面板查看分析结果
                </p>
              </div>
            </div>
          ) : activeView === "archive" ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="max-w-[600px] text-center">
                <p className="text-sm text-muted-foreground">网页存档</p>
                <p className="text-xs text-muted-foreground mt-2">暂无存档</p>
              </div>
            </div>
          ) : null}
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
                {rightTabs.map((tab) => (
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
                ))}
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
                    annotations={annotations}
                    editAnnotation={editAnnotation}
                    removeAnnotation={removeAnnotation}
                  />
                )}
                {rightTab === "transcript" && isVideo && (
                  <TranscriptPanel
                    segments={MOCK_TRANSCRIPT}
                    currentTime={videoCurrentTime}
                    onSeek={(time) => videoSeekRef.current?.(time)}
                  />
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

      {/* Floating sticky notes — rendered above everything via fixed positioning */}
      {annotations
        .filter((a) => a.isPinned)
        .map((annotation) => (
          <FloatingNote
            key={annotation.id}
            annotation={annotation}
            onUnpin={() => editAnnotation(annotation.id, { isPinned: false })}
            onClose={() => editAnnotation(annotation.id, { isPinned: false })}
            onPositionChange={(position) =>
              editAnnotation(annotation.id, { pinnedPosition: position })
            }
          />
        ))}
    </div>
  );
}
