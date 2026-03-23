import { create } from "zustand";
import type { ViewMode, ContentType, ActiveView, LeftTab, RightTab } from "./types";

interface ArticlePageStore {
  viewMode: ViewMode;
  contentType: ContentType;
  activeView: ActiveView;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  leftTab: LeftTab;
  rightTab: RightTab;
  zenMode: boolean;
  selectedText: string | null;
  selectedRange: { from: number; to: number } | null;
  scrollToPosition: number | null;
  highlightAnnotationId: string | null;

  setViewMode: (mode: ViewMode) => void;
  setContentType: (type: ContentType) => void;
  setActiveView: (view: ActiveView) => void;
  setLeftTab: (tab: LeftTab) => void;
  setRightTab: (tab: RightTab) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  toggleZenMode: () => void;
  setSelectedText: (text: string | null, range?: { from: number; to: number }) => void;
  scrollToAnnotation: (annotationId: string) => void;
  clearScrollTarget: () => void;
}

export const useArticlePageStore = create<ArticlePageStore>((set) => ({
  viewMode: "read",
  contentType: "article",
  activeView: "immersive",
  leftPanelOpen: true,
  rightPanelOpen: true,
  leftTab: "outline",
  rightTab: "analysis",
  zenMode: false,
  selectedText: null,
  selectedRange: null,
  scrollToPosition: null,
  highlightAnnotationId: null,

  setViewMode: (mode) => set({ viewMode: mode }),
  setContentType: (type) => set({ contentType: type }),
  setActiveView: (view) => set({ activeView: view }),
  setLeftTab: (tab) => set({ leftTab: tab }),
  setRightTab: (tab) => set({ rightTab: tab }),
  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen, zenMode: false })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen, zenMode: false })),
  toggleZenMode: () =>
    set((s) => ({
      zenMode: !s.zenMode,
      leftPanelOpen: s.zenMode,
      rightPanelOpen: s.zenMode,
    })),
  setSelectedText: (text, range) => set({ selectedText: text, selectedRange: range ?? null }),
  scrollToAnnotation: (id) => set({ highlightAnnotationId: id, scrollToPosition: Date.now() }),
  clearScrollTarget: () => set({ highlightAnnotationId: null, scrollToPosition: null }),
}));
