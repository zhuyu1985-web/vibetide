"use client";

import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { Bold, Italic, Underline, Link2, Sparkles } from "lucide-react";
import { useArticlePageStore } from "../../store";
import { cn } from "@/lib/utils";

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
        className
      )}
    >
      {icon}
    </button>
  );
}

export function BubbleMenuBar({ editor }: BubbleMenuBarProps) {
  const store = useArticlePageStore();

  if (!editor) return null;

  const handleLink = () => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("\u8F93\u5165\u94FE\u63A5\u5730\u5740", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  };

  const handleAI = () => {
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, " ");
    if (!selectedText) return;

    store.setSelectedText(selectedText, { from, to });
    store.setLeftTab("chat");
  };

  return (
    <BubbleMenu
      editor={editor}
      options={{
        placement: "top",
      }}
    >
      <div className="flex items-center gap-0.5 bg-popover border border-border rounded-lg shadow-lg p-1">
        <BubbleButton
          icon={<Bold className="h-4 w-4" />}
          label={"\u7C97\u4F53"}
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <BubbleButton
          icon={<Italic className="h-4 w-4" />}
          label={"\u659C\u4F53"}
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <BubbleButton
          icon={<Underline className="h-4 w-4" />}
          label={"\u4E0B\u5212\u7EBF"}
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />
        <BubbleButton
          icon={<Link2 className="h-4 w-4" />}
          label={"\u94FE\u63A5"}
          active={editor.isActive("link")}
          onClick={handleLink}
        />

        {/* Separator */}
        <div className="w-px h-5 bg-border mx-0.5" />

        {/* AI button */}
        <BubbleButton
          icon={<Sparkles className="h-4 w-4" />}
          label="AI \u52A9\u624B"
          onClick={handleAI}
          className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/15"
        />
      </div>
    </BubbleMenu>
  );
}
