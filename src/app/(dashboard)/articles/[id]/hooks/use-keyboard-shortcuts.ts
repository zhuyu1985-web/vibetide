"use client";
import { useEffect } from "react";
import { useArticlePageStore } from "../store";

export function useKeyboardShortcuts() {
  const store = useArticlePageStore;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;

      // Don't trigger shortcuts when typing in inputs/textareas/editors
      const isEditing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        !!target.closest(".tiptap");

      // ⌘E — toggle read/edit mode
      if (meta && e.key === "e") {
        e.preventDefault();
        const { viewMode, setViewMode } = store.getState();
        setViewMode(viewMode === "read" ? "edit" : "read");
        return;
      }

      // ⌘/ — toggle left panel
      if (meta && e.key === "/") {
        e.preventDefault();
        store.getState().toggleLeftPanel();
        return;
      }

      // ⌘. — toggle right panel
      if (meta && e.key === ".") {
        e.preventDefault();
        store.getState().toggleRightPanel();
        return;
      }

      // ⌘\ — zen mode
      if (meta && e.key === "\\") {
        e.preventDefault();
        store.getState().toggleZenMode();
        return;
      }

      // Skip number keys if in editing context
      if (isEditing) return;

      // 1/2/3/4 — switch view (only when not editing)
      const viewMap: Record<string, "immersive" | "web" | "brief" | "archive"> = {
        "1": "immersive",
        "2": "web",
        "3": "brief",
        "4": "archive",
      };
      if (viewMap[e.key]) {
        e.preventDefault();
        store.getState().setActiveView(viewMap[e.key]);
        return;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
}
