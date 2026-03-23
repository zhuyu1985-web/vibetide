"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExt from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import ImageExt from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import Typography from "@tiptap/extension-typography";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { EditorToolbar } from "./editor-toolbar";
import { EditorStatusBar } from "./editor-status-bar";
import { updateArticle } from "@/app/actions/articles";
import { cn } from "@/lib/utils";
import type { ArticleDetail } from "@/lib/types";
import type { AppearanceSettings } from "../../types";

interface ArticleEditorProps {
  article: ArticleDetail;
  appearance: AppearanceSettings;
  onExitEdit: () => void;
}

const marginWidths: Record<AppearanceSettings["margins"], number> = {
  narrow: 560,
  standard: 680,
  wide: 800,
};

const lineHeightClasses: Record<AppearanceSettings["lineHeight"], string> = {
  compact: "leading-relaxed",
  comfortable: "leading-loose",
  loose: "[line-height:2.25]",
};

const fontFamilyClasses: Record<AppearanceSettings["fontFamily"], string> = {
  system: "font-sans",
  serif: "font-serif",
  sans: "font-sans",
  mono: "font-mono",
};

export function ArticleEditor({
  article,
  appearance,
  onExitEdit,
}: ArticleEditorProps) {
  const [title, setTitle] = useState(article.title);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "saved" | "saving" | "unsaved" | "error"
  >("saved");
  const [isDirty, setIsDirty] = useState(false);
  const originalContent = useRef(article.body ?? "");
  const originalTitle = useRef(article.title);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      UnderlineExt,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      ImageExt.configure({ inline: false }),
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      Placeholder.configure({ placeholder: "开始编辑内容…" }),
      CharacterCount,
      Typography,
      Subscript,
      Superscript,
    ],
    content: article.body ?? "",
    editorProps: {
      attributes: {
        class: cn(
          "prose dark:prose-invert max-w-none focus:outline-none min-h-[400px]",
          lineHeightClasses[appearance.lineHeight],
          fontFamilyClasses[appearance.fontFamily]
        ),
        style: `font-size: ${appearance.fontSize}px`,
      },
    },
    onUpdate: ({ editor: ed }) => {
      setIsDirty(true);
      setSaveStatus("unsaved");
      scheduleAutoSave(ed.getHTML());
    },
  });

  const doSave = useCallback(
    async (body: string, currentTitle: string) => {
      setIsSaving(true);
      setSaveStatus("saving");
      try {
        await updateArticle(article.id, {
          title: currentTitle,
          body,
        });
        setSaveStatus("saved");
        setIsDirty(false);
        originalContent.current = body;
        originalTitle.current = currentTitle;
      } catch {
        setSaveStatus("error");
      } finally {
        setIsSaving(false);
      }
    },
    [article.id]
  );

  const scheduleAutoSave = useCallback(
    (html: string) => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        doSave(html, title);
      }, 3000);
    },
    [doSave, title]
  );

  const handleManualSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    if (!editor) return;
    doSave(editor.getHTML(), title);
  }, [editor, doSave, title]);

  const handleCancel = useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm("有未保存的更改，确定要放弃吗？");
      if (!confirmed) return;
    }
    if (editor) {
      editor.commands.setContent(originalContent.current);
    }
    setTitle(originalTitle.current);
    setIsDirty(false);
    setSaveStatus("saved");
    onExitEdit();
  }, [editor, isDirty, onExitEdit]);

  // Cmd+S shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleManualSave();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleManualSave]);

  // beforeunload protection
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Cleanup auto-save timer
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, []);

  // Title change triggers dirty state + auto-save
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    setIsDirty(true);
    setSaveStatus("unsaved");
    if (editor) {
      scheduleAutoSave(editor.getHTML());
    }
  };

  const maxWidth = marginWidths[appearance.margins];

  const characterCount = editor?.storage.characterCount?.characters() ?? 0;
  const wordCount = editor?.storage.characterCount?.words() ?? 0;

  return (
    <div className="flex flex-col h-full">
      <EditorToolbar
        editor={editor}
        isSaving={isSaving}
        isDirty={isDirty}
        onSave={handleManualSave}
        onCancel={handleCancel}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto px-8 py-6" style={{ maxWidth: `${maxWidth}px` }}>
          {/* Editable title */}
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="输入标题…"
            className="w-full text-2xl font-bold text-foreground bg-transparent focus:outline-none placeholder:text-muted-foreground/50 mb-4"
          />

          {/* Editor content */}
          <EditorContent editor={editor} />
        </div>
      </div>

      <EditorStatusBar
        characterCount={characterCount}
        wordCount={wordCount}
        saveStatus={saveStatus}
      />
    </div>
  );
}
