"use client";

/**
 * 选中文本时浮出的 AI 快捷菜单。
 *
 * 替代了上一版只有「AI 助手」按钮的实现，现在直接提供 4 个 AI 改写操作
 * + 基础格式按钮（加粗/斜体/下划线/链接）+ 一个「向 AI 提问」入口。
 *
 * 流程：
 *   选中文本 → 浮出菜单 → 点「润色 / 简写 / 扩写 / 总结」→ AiDiffPreview dialog
 *   流式响应 → 用户确认 → editor.chain().setTextSelection(range).insertContent(newText)
 *
 * 「向 AI 提问」则把 selectedText 注入 store + 切换到左栏「AI 助手」tab。
 */

import { useState } from "react";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline,
  Link2,
  Sparkles,
  Scissors,
  PenLine,
  ListTree,
  MessageSquarePlus,
} from "lucide-react";
import { useArticlePageStore } from "../../store";
import { PromptDialog } from "@/components/shared/prompt-dialog";
import { cn } from "@/lib/utils";
import { AiDiffPreview, type AiEditMode } from "./ai-diff-preview";

interface BubbleMenuBarProps {
  editor: Editor | null;
}

function BubbleButton({
  icon,
  label,
  active,
  onClick,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={cn(
        "p-1.5 rounded-md transition-colors",
        active
          ? "bg-blue-500/15 text-blue-500"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
        className,
      )}
    >
      {icon}
    </button>
  );
}

interface AiActionDef {
  mode: AiEditMode;
  label: string;
  icon: React.ReactNode;
}

const AI_ACTIONS: AiActionDef[] = [
  { mode: "polish", label: "润色", icon: <Sparkles className="h-3.5 w-3.5" /> },
  {
    mode: "rewrite-condense",
    label: "简写",
    icon: <Scissors className="h-3.5 w-3.5" />,
  },
  {
    mode: "rewrite-expand",
    label: "扩写",
    icon: <PenLine className="h-3.5 w-3.5" />,
  },
  {
    mode: "summarize",
    label: "总结",
    icon: <ListTree className="h-3.5 w-3.5" />,
  },
];

export function BubbleMenuBar({ editor }: BubbleMenuBarProps) {
  // 精选订阅 setter(setter 引用稳定),避免 store 内任意 state 变化都让本组件重渲。
  const setSelectedText = useArticlePageStore((s) => s.setSelectedText);
  const setLeftTab = useArticlePageStore((s) => s.setLeftTab);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffMode, setDiffMode] = useState<AiEditMode>("polish");
  const [diffOriginal, setDiffOriginal] = useState("");
  const [diffRange, setDiffRange] = useState<{ from: number; to: number } | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkDefault, setLinkDefault] = useState("");

  if (!editor) return null;

  const handleLink = () => {
    setLinkDefault(editor.getAttributes("link").href ?? "");
    setLinkDialogOpen(true);
  };

  const submitLink = (url: string) => {
    setLinkDialogOpen(false);
    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run();
  };

  const openAiAction = (mode: AiEditMode) => {
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, " ");
    if (!selectedText.trim()) return;
    setDiffRange({ from, to });
    setDiffOriginal(selectedText);
    setDiffMode(mode);
    setDiffOpen(true);
  };

  const handleAskAi = () => {
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, " ");
    if (!selectedText.trim()) return;
    setSelectedText(selectedText, { from, to });
    setLeftTab("chat");
  };

  const handleApply = (newText: string) => {
    if (!diffRange) return;
    editor
      .chain()
      .focus()
      .setTextSelection(diffRange)
      .insertContent(newText)
      .run();
  };

  return (
    <>
      <BubbleMenu
        editor={editor}
        options={{
          placement: "top",
        }}
      >
        <div className="flex items-center gap-0.5 bg-popover border border-border rounded-lg shadow-lg p-1">
          {/* 基础格式 */}
          <BubbleButton
            icon={<Bold className="h-4 w-4" />}
            label="粗体"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <BubbleButton
            icon={<Italic className="h-4 w-4" />}
            label="斜体"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <BubbleButton
            icon={<Underline className="h-4 w-4" />}
            label="下划线"
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          />
          <BubbleButton
            icon={<Link2 className="h-4 w-4" />}
            label="链接"
            active={editor.isActive("link")}
            onClick={handleLink}
          />

          <div className="w-px h-5 bg-border mx-0.5" />

          {/* AI 快捷动作 */}
          {AI_ACTIONS.map((a) => (
            <button
              key={a.mode}
              title={`AI ${a.label}`}
              onClick={() => openAiAction(a.mode)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-purple-600 dark:text-purple-300 hover:bg-purple-500/15 transition-colors"
            >
              {a.icon}
              {a.label}
            </button>
          ))}

          <div className="w-px h-5 bg-border mx-0.5" />

          {/* 向 AI 提问（打开左栏 AI 助手 + 注入选中文本） */}
          <BubbleButton
            icon={<MessageSquarePlus className="h-4 w-4" />}
            label="向 AI 提问"
            onClick={handleAskAi}
            className="text-blue-500 hover:text-blue-400 hover:bg-blue-500/15"
          />
        </div>
      </BubbleMenu>

      <AiDiffPreview
        open={diffOpen}
        onOpenChange={setDiffOpen}
        mode={diffMode}
        originalText={diffOriginal}
        fullContext={editor.getText()}
        onApply={handleApply}
      />

      <PromptDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        title="插入 / 编辑链接"
        description="留空可移除链接"
        placeholder="https://example.com"
        defaultValue={linkDefault}
        confirmText="应用"
        onConfirm={submitLink}
      />
    </>
  );
}
