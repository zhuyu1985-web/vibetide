import { create } from "zustand";
import type { Editor } from "@tiptap/react";
import type { ViewMode, ContentType, ActiveView, LeftTab, RightTab } from "./types";

interface EditorHandlers {
  save: () => void;
  saveAndSubmit: () => void;
  cancel: () => void;
}

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
  editorInstance: Editor | null;
  // 顶部品牌栏与编辑器之间共享的状态/handler
  editorIsSaving: boolean;
  editorIsDirty: boolean;
  editorHandlers: EditorHandlers | null;

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
  setEditorInstance: (editor: Editor | null) => void;
  setEditorState: (state: { isSaving?: boolean; isDirty?: boolean }) => void;
  setEditorHandlers: (handlers: EditorHandlers | null) => void;
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
  editorInstance: null,
  editorIsSaving: false,
  editorIsDirty: false,
  editorHandlers: null,

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
  setEditorInstance: (editor) => set({ editorInstance: editor }),
  setEditorState: (state) =>
    set((s) => ({
      editorIsSaving: state.isSaving ?? s.editorIsSaving,
      editorIsDirty: state.isDirty ?? s.editorIsDirty,
    })),
  setEditorHandlers: (handlers) => set({ editorHandlers: handlers }),
}));
