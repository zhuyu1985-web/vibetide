"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
  Image as ImageIcon,
  Video,
  Music,
  FileUp,
  Undo2,
  Redo2,
  Save,
  X,
  ChevronDown,
  Eraser,
  Search,
  Paintbrush,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  IndentDecrease,
  IndentIncrease,
  Type,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FONT_FAMILIES = [
  { label: "系统默认", value: "" },
  { label: "宋体", value: "SimSun, '宋体', serif" },
  { label: "黑体", value: "SimHei, '黑体', sans-serif" },
  { label: "微软雅黑", value: "'Microsoft YaHei', sans-serif" },
  { label: "思源黑体", value: "'Source Han Sans CN', sans-serif" },
  { label: "苹方", value: "'PingFang SC', sans-serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "等宽", value: "ui-monospace, 'SF Mono', Menlo, monospace" },
];

const FONT_SIZES = ["12", "14", "16", "18", "20", "24", "28", "32", "36", "48"];

const FONT_COLORS = [
  "#000000",
  "#1f2937",
  "#dc2626",
  "#ea580c",
  "#d97706",
  "#16a34a",
  "#0891b2",
  "#2563eb",
  "#7c3aed",
  "#db2777",
];

const HIGHLIGHT_COLORS = [
  { label: "无", value: "" },
  { label: "黄色", value: "#fef08a" },
  { label: "绿色", value: "#bbf7d0" },
  { label: "蓝色", value: "#bfdbfe" },
  { label: "粉色", value: "#fbcfe8" },
  { label: "紫色", value: "#ddd6fe" },
];

const LINE_HEIGHTS = [
  { label: "默认", value: "" },
  { label: "1.0", value: "1" },
  { label: "1.5", value: "1.5" },
  { label: "1.75", value: "1.75" },
  { label: "2.0", value: "2" },
  { label: "2.5", value: "2.5" },
];

const HEADING_LEVELS = [
  { label: "正文", level: 0 as const },
  { label: "标题 1", level: 1 as const, fontSize: "1.875em" },
  { label: "标题 2", level: 2 as const, fontSize: "1.5em" },
  { label: "标题 3", level: 3 as const, fontSize: "1.25em" },
  { label: "标题 4", level: 4 as const, fontSize: "1.125em" },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EditorToolbarProps {
  editor: Editor | null;
  isSaving: boolean;
  isDirty: boolean;
  onSave: () => void;
  onSaveAndSubmit: () => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// 基础按钮 + 分隔符 + Dropdown
// ---------------------------------------------------------------------------

function ToolbarIconButton({
  icon,
  label,
  active,
  disabled,
  onClick,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "p-1.5 rounded-md transition-colors shrink-0",
        active
          ? "bg-blue-500/15 text-blue-500"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
        disabled && "opacity-40 pointer-events-none",
        className,
      )}
    >
      {icon}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-border mx-1 shrink-0" />;
}

function useClickOutside<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  onClose: () => void,
  open: boolean,
) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onClose, open]);
}

function Dropdown({
  trigger,
  children,
  align = "left",
  width = "w-32",
}: {
  trigger: (open: boolean) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useClickOutside(ref, () => setOpen(false), open);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="h-7 flex items-center gap-0.5 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
      >
        {trigger(open)}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <div
          className={cn(
            "absolute top-full mt-1 z-50 py-1 rounded-xl bg-popover shadow-lg ring-1 ring-black/5 dark:ring-white/10 max-h-[320px] overflow-y-auto",
            width,
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function DropdownItem({
  active,
  onClick,
  children,
  className,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors",
        active
          ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 font-medium"
          : "text-foreground hover:bg-muted/60",
        className,
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function EditorToolbar({
  editor,
  isSaving,
  isDirty,
  onSave,
  onSaveAndSubmit,
  onCancel,
}: EditorToolbarProps) {
  const showStub = useCallback((feature: string) => {
    // 暂未实现的功能用 alert 占位；后续按需补实现
    alert(`「${feature}」即将上线。`);
  }, []);

  if (!editor) return null;

  // ── 段落级别（正文 / H1-H4） ──
  const currentHeading = (() => {
    for (const lv of [1, 2, 3, 4] as const) {
      if (editor.isActive("heading", { level: lv })) return lv;
    }
    return 0;
  })();
  const currentHeadingLabel =
    HEADING_LEVELS.find((h) => h.level === currentHeading)?.label ?? "正文";

  const setHeading = (level: 0 | 1 | 2 | 3 | 4) => {
    if (level === 0) {
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().toggleHeading({ level }).run();
    }
  };

  // ── 字体 ──
  const currentFontFamily =
    (editor.getAttributes("textStyle").fontFamily as string | null) ?? "";
  const currentFontFamilyLabel =
    FONT_FAMILIES.find((f) => f.value === currentFontFamily)?.label ?? "系统默认";

  const setFontFamily = (value: string) => {
    if (value === "") {
      editor.chain().focus().setMark("textStyle", { fontFamily: null }).run();
    } else {
      editor.chain().focus().setMark("textStyle", { fontFamily: value }).run();
    }
  };

  // ── 字号 ──
  const currentFontSize =
    (editor.getAttributes("textStyle").fontSize as string | null)?.replace(
      "px",
      "",
    ) ?? "16";

  const setFontSize = (size: string) => {
    editor.chain().focus().setMark("textStyle", { fontSize: `${size}px` }).run();
  };

  // ── 字体颜色 ──
  const currentColor =
    (editor.getAttributes("textStyle").color as string | null) ?? "#000000";

  const setColor = (color: string) => {
    editor.chain().focus().setMark("textStyle", { color }).run();
  };

  // ── 高亮 ──
  const setHighlight = (color: string) => {
    if (color === "") {
      editor.chain().focus().unsetHighlight().run();
    } else {
      editor.chain().focus().setHighlight({ color }).run();
    }
  };

  // ── 对齐 ──
  const setAlign = (align: "left" | "center" | "right" | "justify") => {
    editor.chain().focus().setTextAlign(align).run();
  };

  // ── 行间距 ──
  const setLineHeight = (value: string) => {
    if (value === "") {
      editor.chain().focus().setParagraphAttr("lineHeight", null).run();
    } else {
      editor.chain().focus().setParagraphAttr("lineHeight", value).run();
    }
  };

  // ── 缩进 ── (textIndent 操作首行缩进 em 单位)
  const adjustIndent = (delta: number) => {
    const attrs = editor.getAttributes(
      editor.isActive("heading") ? "heading" : "paragraph",
    );
    const current = parseFloat(
      String(attrs.textIndent ?? "0").replace("em", "") || "0",
    );
    const next = Math.max(0, Math.min(8, current + delta));
    editor
      .chain()
      .focus()
      .setParagraphAttr("textIndent", next === 0 ? null : `${next}em`)
      .run();
  };

  // ── 链接 / 图片 ──
  const handleLink = () => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("输入链接地址", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const handleImage = () => {
    const url = window.prompt("输入图片地址（也可以从左栏「资源库」拖入）");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  // ── 清除格式 ──
  const clearFormat = () => {
    editor.chain().focus().unsetAllMarks().clearNodes().run();
  };

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-[var(--glass-border)] bg-[var(--glass-panel-bg)] backdrop-blur-xl overflow-x-auto shrink-0">
      {/* 撤销 / 重做 */}
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
      <Divider />

      {/* 格式刷 / 清除格式 / 查替换 */}
      <ToolbarIconButton
        icon={<Paintbrush className="h-4 w-4" />}
        label="格式刷（即将上线）"
        onClick={() => showStub("格式刷")}
      />
      <ToolbarIconButton
        icon={<Eraser className="h-4 w-4" />}
        label="清除格式"
        onClick={clearFormat}
      />
      <ToolbarIconButton
        icon={<Search className="h-4 w-4" />}
        label="查找替换（即将上线）"
        onClick={() => showStub("查找替换")}
      />
      <Divider />

      {/* 段落级别 dropdown */}
      <Dropdown
        width="w-28"
        trigger={() => <span className="text-xs">{currentHeadingLabel}</span>}
      >
        {(close) =>
          HEADING_LEVELS.map((h) => (
            <DropdownItem
              key={h.level}
              active={h.level === currentHeading}
              onClick={() => {
                setHeading(h.level);
                close();
              }}
            >
              <span style={{ fontSize: h.fontSize, fontWeight: h.level > 0 ? 600 : 400 }}>
                {h.label}
              </span>
            </DropdownItem>
          ))
        }
      </Dropdown>

      {/* 字体 dropdown */}
      <Dropdown
        width="w-36"
        trigger={() => <span className="text-xs truncate max-w-[80px]">{currentFontFamilyLabel}</span>}
      >
        {(close) =>
          FONT_FAMILIES.map((f) => (
            <DropdownItem
              key={f.value}
              active={f.value === currentFontFamily}
              onClick={() => {
                setFontFamily(f.value);
                close();
              }}
            >
              <span style={{ fontFamily: f.value || undefined }}>{f.label}</span>
            </DropdownItem>
          ))
        }
      </Dropdown>

      {/* 字号 dropdown */}
      <Dropdown
        width="w-20"
        trigger={() => <span className="text-xs">{currentFontSize}</span>}
      >
        {(close) =>
          FONT_SIZES.map((s) => (
            <DropdownItem
              key={s}
              active={s === currentFontSize}
              onClick={() => {
                setFontSize(s);
                close();
              }}
            >
              {s}
            </DropdownItem>
          ))
        }
      </Dropdown>
      <Divider />

      {/* 加粗 / 斜体 / 下划线 / 删除线 */}
      <ToolbarIconButton
        icon={<Bold className="h-4 w-4" />}
        label="粗体"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarIconButton
        icon={<Italic className="h-4 w-4" />}
        label="斜体"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarIconButton
        icon={<Underline className="h-4 w-4" />}
        label="下划线"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <ToolbarIconButton
        icon={<Strikethrough className="h-4 w-4" />}
        label="删除线"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <Divider />

      {/* 字体颜色 */}
      <Dropdown
        width="w-32"
        trigger={() => (
          <span className="flex items-center gap-1">
            <Type className="h-3.5 w-3.5" />
            <span
              className="w-3 h-3 rounded-sm border border-border"
              style={{ backgroundColor: currentColor }}
            />
          </span>
        )}
      >
        {(close) => (
          <div className="grid grid-cols-5 gap-1 p-2">
            {FONT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setColor(c);
                  close();
                }}
                className={cn(
                  "w-5 h-5 rounded-sm border border-border hover:scale-110 transition-transform",
                  c === currentColor && "ring-2 ring-blue-500 ring-offset-1",
                )}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        )}
      </Dropdown>

      {/* 高亮 */}
      <Dropdown
        width="w-32"
        trigger={() => (
          <span className="flex items-center gap-1">
            <span className="text-xs font-bold">A</span>
            <span
              className="w-3 h-3 rounded-sm border border-border"
              style={{
                backgroundColor:
                  (editor.getAttributes("highlight").color as string) ||
                  "transparent",
              }}
            />
          </span>
        )}
      >
        {(close) =>
          HIGHLIGHT_COLORS.map((h) => (
            <DropdownItem
              key={h.value}
              onClick={() => {
                setHighlight(h.value);
                close();
              }}
            >
              <span
                className="inline-block w-4 h-4 rounded-sm border border-border mr-1"
                style={{ backgroundColor: h.value || "transparent" }}
              />
              {h.label}
            </DropdownItem>
          ))
        }
      </Dropdown>
      <Divider />

      {/* 对齐 */}
      <ToolbarIconButton
        icon={<AlignLeft className="h-4 w-4" />}
        label="左对齐"
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => setAlign("left")}
      />
      <ToolbarIconButton
        icon={<AlignCenter className="h-4 w-4" />}
        label="居中"
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => setAlign("center")}
      />
      <ToolbarIconButton
        icon={<AlignRight className="h-4 w-4" />}
        label="右对齐"
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => setAlign("right")}
      />
      <ToolbarIconButton
        icon={<AlignJustify className="h-4 w-4" />}
        label="两端对齐"
        active={editor.isActive({ textAlign: "justify" })}
        onClick={() => setAlign("justify")}
      />
      <Divider />

      {/* 行间距 dropdown */}
      <Dropdown
        width="w-24"
        trigger={() => <span className="text-xs">行距</span>}
      >
        {(close) =>
          LINE_HEIGHTS.map((lh) => (
            <DropdownItem
              key={lh.value}
              onClick={() => {
                setLineHeight(lh.value);
                close();
              }}
            >
              {lh.label}
            </DropdownItem>
          ))
        }
      </Dropdown>

      {/* 缩进 */}
      <ToolbarIconButton
        icon={<IndentDecrease className="h-4 w-4" />}
        label="减少缩进"
        onClick={() => adjustIndent(-1)}
      />
      <ToolbarIconButton
        icon={<IndentIncrease className="h-4 w-4" />}
        label="增加缩进（首行）"
        onClick={() => adjustIndent(1)}
      />
      <Divider />

      {/* 列表 / 块 */}
      <ToolbarIconButton
        icon={<List className="h-4 w-4" />}
        label="无序列表"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarIconButton
        icon={<ListOrdered className="h-4 w-4" />}
        label="有序列表"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarIconButton
        icon={<ListChecks className="h-4 w-4" />}
        label="任务列表"
        active={editor.isActive("taskList")}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      />
      <ToolbarIconButton
        icon={<Quote className="h-4 w-4" />}
        label="引用"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolbarIconButton
        icon={<Code2 className="h-4 w-4" />}
        label="代码块"
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      />
      <ToolbarIconButton
        icon={<Minus className="h-4 w-4" />}
        label="分割线"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      />
      <Divider />

      {/* 插入 */}
      <ToolbarIconButton
        icon={<Link2 className="h-4 w-4" />}
        label="超链接"
        active={editor.isActive("link")}
        onClick={handleLink}
      />
      <ToolbarIconButton
        icon={<ImageIcon className="h-4 w-4" />}
        label="插入图片"
        onClick={handleImage}
      />
      <ToolbarIconButton
        icon={<Video className="h-4 w-4" />}
        label="插入视频（即将上线）"
        onClick={() => showStub("插入视频")}
      />
      <ToolbarIconButton
        icon={<Music className="h-4 w-4" />}
        label="插入音频（即将上线）"
        onClick={() => showStub("插入音频")}
      />
      <ToolbarIconButton
        icon={<FileUp className="h-4 w-4" />}
        label="导入文章（即将上线）"
        onClick={() => showStub("导入文章")}
      />

      {/* Spacer */}
      <div className="flex-1" />

      {/* 保存 / 取消 */}
      <button
        onClick={onCancel}
        className="flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
      >
        <X className="h-3.5 w-3.5" />
        取消
      </button>
      <button
        onClick={onSave}
        disabled={isSaving || !isDirty}
        className={cn(
          "flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors shrink-0",
          isDirty
            ? "bg-green-500/15 text-green-600 hover:bg-green-500/25"
            : "text-muted-foreground opacity-50",
        )}
      >
        <Save className="h-3.5 w-3.5" />
        {isSaving ? "保存中…" : "保存"}
      </button>
      <button
        onClick={onSaveAndSubmit}
        disabled={isSaving}
        className="flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors shrink-0 disabled:opacity-50"
      >
        保存并提交
      </button>
    </div>
  );
}
