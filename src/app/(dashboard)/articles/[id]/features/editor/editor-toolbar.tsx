"use client";

import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Minus,
  Code2,
  Link2,
  ImageIcon,
  Undo2,
  Redo2,
  Save,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EditorToolbarProps {
  editor: Editor | null;
  isSaving: boolean;
  isDirty: boolean;
  onSave: () => void;
  onCancel: () => void;
}

interface ToolbarButton {
  icon: React.ReactNode;
  label: string;
  action: (editor: Editor) => void;
  isActive?: (editor: Editor) => boolean;
}

function ToolbarIconButton({
  icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "p-1.5 rounded-md transition-colors",
        active
          ? "bg-blue-500/15 text-blue-500"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
        disabled && "opacity-40 pointer-events-none"
      )}
    >
      {icon}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-border mx-1" />;
}

export function EditorToolbar({
  editor,
  isSaving,
  isDirty,
  onSave,
  onCancel,
}: EditorToolbarProps) {
  if (!editor) return null;

  const headingButtons: ToolbarButton[] = [
    {
      icon: <span className="text-xs font-bold">H1</span>,
      label: "标题一",
      action: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
      isActive: (e) => e.isActive("heading", { level: 1 }),
    },
    {
      icon: <span className="text-xs font-bold">H2</span>,
      label: "标题二",
      action: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: (e) => e.isActive("heading", { level: 2 }),
    },
    {
      icon: <span className="text-xs font-bold">H3</span>,
      label: "标题三",
      action: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
      isActive: (e) => e.isActive("heading", { level: 3 }),
    },
  ];

  const formatButtons: ToolbarButton[] = [
    {
      icon: <Bold className="h-4 w-4" />,
      label: "粗体",
      action: (e) => e.chain().focus().toggleBold().run(),
      isActive: (e) => e.isActive("bold"),
    },
    {
      icon: <Italic className="h-4 w-4" />,
      label: "斜体",
      action: (e) => e.chain().focus().toggleItalic().run(),
      isActive: (e) => e.isActive("italic"),
    },
    {
      icon: <Underline className="h-4 w-4" />,
      label: "下划线",
      action: (e) => e.chain().focus().toggleUnderline().run(),
      isActive: (e) => e.isActive("underline"),
    },
    {
      icon: <Strikethrough className="h-4 w-4" />,
      label: "删除线",
      action: (e) => e.chain().focus().toggleStrike().run(),
      isActive: (e) => e.isActive("strike"),
    },
  ];

  const listButtons: ToolbarButton[] = [
    {
      icon: <List className="h-4 w-4" />,
      label: "无序列表",
      action: (e) => e.chain().focus().toggleBulletList().run(),
      isActive: (e) => e.isActive("bulletList"),
    },
    {
      icon: <ListOrdered className="h-4 w-4" />,
      label: "有序列表",
      action: (e) => e.chain().focus().toggleOrderedList().run(),
      isActive: (e) => e.isActive("orderedList"),
    },
    {
      icon: <ListChecks className="h-4 w-4" />,
      label: "任务列表",
      action: (e) => e.chain().focus().toggleTaskList().run(),
      isActive: (e) => e.isActive("taskList"),
    },
  ];

  const blockButtons: ToolbarButton[] = [
    {
      icon: <Quote className="h-4 w-4" />,
      label: "引用",
      action: (e) => e.chain().focus().toggleBlockquote().run(),
      isActive: (e) => e.isActive("blockquote"),
    },
    {
      icon: <Minus className="h-4 w-4" />,
      label: "分割线",
      action: (e) => e.chain().focus().setHorizontalRule().run(),
    },
    {
      icon: <Code2 className="h-4 w-4" />,
      label: "代码块",
      action: (e) => e.chain().focus().toggleCodeBlock().run(),
      isActive: (e) => e.isActive("codeBlock"),
    },
  ];

  const handleLink = () => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("输入链接地址", previousUrl);
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

  const handleImage = () => {
    const url = window.prompt("输入图片地址");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const renderGroup = (buttons: ToolbarButton[]) =>
    buttons.map((btn, i) => (
      <ToolbarIconButton
        key={i}
        icon={btn.icon}
        label={btn.label}
        active={btn.isActive?.(editor)}
        onClick={() => btn.action(editor)}
      />
    ));

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-[var(--glass-border)] bg-[var(--glass-panel-bg)] backdrop-blur-xl overflow-x-auto shrink-0">
      {renderGroup(headingButtons)}
      <Divider />
      {renderGroup(formatButtons)}
      <Divider />
      {renderGroup(listButtons)}
      <Divider />
      {renderGroup(blockButtons)}
      <Divider />
      {/* Media */}
      <ToolbarIconButton
        icon={<Link2 className="h-4 w-4" />}
        label="链接"
        active={editor.isActive("link")}
        onClick={handleLink}
      />
      <ToolbarIconButton
        icon={<ImageIcon className="h-4 w-4" />}
        label="图片"
        onClick={handleImage}
      />
      <Divider />
      {/* Undo / Redo */}
      <ToolbarIconButton
        icon={<Undo2 className="h-4 w-4" />}
        label="撤销"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <ToolbarIconButton
        icon={<Redo2 className="h-4 w-4" />}
        label="重做"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Save + Cancel */}
      <button
        onClick={onCancel}
        className="flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
        取消
      </button>
      <button
        onClick={onSave}
        disabled={isSaving || !isDirty}
        className={cn(
          "flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors",
          isDirty
            ? "bg-green-500/15 text-green-600 hover:bg-green-500/25"
            : "text-muted-foreground opacity-50"
        )}
      >
        <Save className="h-3.5 w-3.5" />
        {isSaving ? "保存中…" : "保存"}
      </button>
    </div>
  );
}
