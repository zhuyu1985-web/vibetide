"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useArticlePageStore } from "./store";
import { useAppearance } from "./hooks/use-article-context";
import { useKeyboardShortcuts } from "./hooks/use-keyboard-shortcuts";
import type { ArticleDetailClientProps } from "./types";
import { cn } from "@/lib/utils";
import { ArticleHeader } from "./features/header/article-header";
import { EditorTopBar } from "./features/header/editor-top-bar";
import { LeftOuterNav } from "./features/header/left-outer-nav";
import { RightOuterNav } from "./features/header/right-outer-nav";
import { ArticleReader } from "./features/reader/article-reader";
import { ArticleEditor } from "./features/editor/article-editor";
import { AIChatPanel } from "./features/ai-chat/ai-chat-panel";
import { AIAnalysisPanel } from "./features/ai-analysis/ai-analysis-panel";
import { AnnotationsPanel } from "./features/annotations/annotations-panel";
import { FloatingNote } from "./features/annotations/floating-note";
import { useAnnotations } from "./features/annotations/use-annotations";
import { VideoPlayer } from "./features/video-player/video-player";
import { TranscriptPanel } from "./features/transcript/transcript-panel";
import { ExternalPublishPanel } from "@/components/articles/external-publish-panel";
// Phase 2.3 — 4 个新 panel
import { ArticleInfoPanel } from "./features/info/article-info-panel";
import { ChannelRewritePanel } from "./features/channels/channel-rewrite-panel";
import { MediaLibraryPanel } from "./features/library/media-library-panel";
import { AigcAppsPanel } from "./features/aigc/aigc-apps-panel";
import {
  MOCK_VIDEO_URL,
  MOCK_TRANSCRIPT,
} from "./data/mock-video";

export default function ArticleDetailClient({
  article,
  organizationId,
  initialAnnotations,
  initialAIAnalysis,
  articleLanguage,
  externalPublications,
}: ArticleDetailClientProps) {
  const {
    viewMode,
    setViewMode,
    activeView,
    leftPanelOpen,
    rightPanelOpen,
    zenMode,
    rightTab,
    leftCategory,
    rightCategory,
    activeChannel,
    toggleLeftPanel,
    toggleRightPanel,
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

  // 识别 ?mode=edit URL 参数（由 /articles/create 跳转过来的请求）
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams?.get("mode") === "edit") {
      useArticlePageStore.getState().setViewMode("edit");
    }
  }, [searchParams]);

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

  // Build right panel tabs dynamically — Phase 2.3 加 info / channels
  const rightTabs = isVideo
    ? (["info", "analysis", "annotations", "transcript", "channels"] as const)
    : (["info", "analysis", "annotations", "channels"] as const);

  const RIGHT_TAB_LABEL: Record<string, string> = {
    info: "信息",
    analysis: "解读",
    annotations: "批注",
    transcript: "听记",
    channels: "渠道",
  };

  const LEFT_CATEGORY_LABEL: Record<string, string> = {
    ai: "✦ AI 助手",
    library: "资源库",
    apps: "AIGC 应用",
  };

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

      {/* Header — edit 模式用品牌顶栏，read 模式保留原 breadcrumb header */}
      {viewMode === "edit" ? (
        <EditorTopBar articleId={article.id} />
      ) : (
        <ArticleHeader
          article={article}
          annotationCount={annotations.length}
          appearance={appearance}
          onUpdateAppearance={setAppearance}
        />
      )}

      {/* Three-column body */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧 80px 外层 icon nav（仅 edit 模式显示）+ 内层 panel */}
        <LeftOuterNav />

        <div
          className={cn(
            "border-r border-[var(--glass-border)] bg-[var(--glass-panel-bg)] backdrop-blur-xl transition-all duration-300 ease-out overflow-hidden shrink-0",
            leftPanelOpen ? "w-[clamp(300px,24%,400px)]" : "w-7"
          )}
        >
          {leftPanelOpen ? (
            <div className="flex flex-col h-full">
              <div className="px-3 py-2 text-sm font-medium border-b border-[var(--glass-border)] flex items-center justify-between">
                <span>{LEFT_CATEGORY_LABEL[leftCategory]}</span>
                <button
                  className="text-muted-foreground hover:text-foreground text-xs"
                  onClick={toggleLeftPanel}
                >
                  ◀
                </button>
              </div>
              {/* 左侧三个真实分类（用户原始需求：只要 AI助手 / 资源库 / AIGC）：
                  AI 助手 直接渲染 AIChatPanel（包含对话区 + 输入框），
                  不再有 outline / history 子 tab。 */}
              <div className="flex-1 overflow-hidden flex flex-col">
                {leftCategory === "ai" && (
                  <AIChatPanel
                    articleId={article.id}
                    articleContent={article.body ?? ""}
                    viewMode={viewMode}
                    contentType={isVideo ? "video" : "article"}
                  />
                )}
                {leftCategory === "library" && <MediaLibraryPanel />}
                {leftCategory === "apps" && <AigcAppsPanel />}
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

        {/* Center stage —— 淡蓝透明背景（edit 模式下尤其需要弱化与三栏的色差） */}
        <div className="flex-1 overflow-hidden flex flex-col bg-blue-50/30 dark:bg-blue-500/[0.03]">
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

        {/* Right panel —— edit 模式用「基本信息 + 渠道」外层 nav 切换；
            read 模式保留原 5 tab 横排 */}
        <div
          className={cn(
            "border-l border-[var(--glass-border)] bg-[var(--glass-panel-bg)] backdrop-blur-xl transition-all duration-300 ease-out overflow-hidden shrink-0",
            rightPanelOpen ? "w-[clamp(300px,24%,400px)]" : "w-7"
          )}
        >
          {rightPanelOpen ? (
            viewMode === "edit" ? (
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-hidden flex flex-col">
                  {rightCategory === "info" && (
                    <ArticleInfoPanel
                      articleId={article.id}
                      initial={{
                        authorName: article.authorName,
                        sourceName: article.sourceName,
                        summary: article.summary,
                        keywords: article.keywords,
                        coverImageUrl: article.coverImageUrl,
                        shareImageUrl: article.shareImageUrl,
                        listStyle: article.listStyle,
                      }}
                    />
                  )}
                  {rightCategory === "channel" && (
                    <ChannelRewritePanel
                      articleId={article.id}
                      initialPlatform={activeChannel}
                      hidePlatformPicker
                    />
                  )}
                </div>
                {/* 海外英文稿件专属面板 */}
                {articleLanguage === "en" && (
                  <div className="border-t border-[var(--glass-border)] p-3 shrink-0">
                    <ExternalPublishPanel
                      articleId={article.id}
                      articleLanguage={articleLanguage}
                      existingPublications={externalPublications}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="flex border-b border-[var(--glass-border)] text-[12px]">
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
                      {RIGHT_TAB_LABEL[tab]}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-hidden flex flex-col">
                  {rightTab === "info" && (
                    <ArticleInfoPanel
                      articleId={article.id}
                      initial={{
                        authorName: article.authorName,
                        sourceName: article.sourceName,
                        summary: article.summary,
                        keywords: article.keywords,
                        coverImageUrl: article.coverImageUrl,
                        shareImageUrl: article.shareImageUrl,
                        listStyle: article.listStyle,
                      }}
                    />
                  )}
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
                  {rightTab === "channels" && (
                    <ChannelRewritePanel articleId={article.id} />
                  )}
                </div>
                {articleLanguage === "en" && (
                  <div className="border-t border-[var(--glass-border)] p-3 shrink-0">
                    <ExternalPublishPanel
                      articleId={article.id}
                      articleLanguage={articleLanguage}
                      existingPublications={externalPublications}
                    />
                  </div>
                )}
              </div>
            )
          ) : (
            <button
              className="w-full h-full flex items-start justify-center pt-3 text-muted-foreground hover:text-foreground"
              onClick={toggleRightPanel}
            >
              📝
            </button>
          )}
        </div>

        {/* 最右侧 80px 渠道 nav，仅 edit 模式显示 */}
        {viewMode === "edit" && <RightOuterNav />}
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
