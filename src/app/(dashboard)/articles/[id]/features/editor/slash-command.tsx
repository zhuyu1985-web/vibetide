"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { useArticlePageStore } from "../../store";

interface SlashCommandProps {
  editor: Editor | null;
}

interface CommandItem {
  icon: string;
  label: string;
  description?: string;
  action: (editor: Editor) => void;
  category: "block" | "ai";
}

const blockCommands: CommandItem[] = [
  {
    icon: "\u{1F4DD}",
    label: "\u6BB5\u843D",
    description: "\u666E\u901A\u6587\u672C\u6BB5\u843D",
    category: "block",
    action: (e) => e.chain().focus().setParagraph().run(),
  },
  {
    icon: "H1",
    label: "\u6807\u9898 1",
    description: "\u5927\u6807\u9898",
    category: "block",
    action: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    icon: "H2",
    label: "\u6807\u9898 2",
    description: "\u4E2D\u6807\u9898",
    category: "block",
    action: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    icon: "H3",
    label: "\u6807\u9898 3",
    description: "\u5C0F\u6807\u9898",
    category: "block",
    action: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    icon: "\u2630",
    label: "\u65E0\u5E8F\u5217\u8868",
    description: "\u9879\u76EE\u7B26\u5217\u8868",
    category: "block",
    action: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    icon: "\u2611",
    label: "\u4EFB\u52A1\u5217\u8868",
    description: "\u53EF\u52FE\u9009\u4EFB\u52A1",
    category: "block",
    action: (e) => e.chain().focus().toggleTaskList().run(),
  },
  {
    icon: "\u275D",
    label: "\u5F15\u7528\u5757",
    description: "\u5F15\u7528\u6587\u672C",
    category: "block",
    action: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    icon: "\u2014",
    label: "\u5206\u5272\u7EBF",
    description: "\u6C34\u5E73\u5206\u5272\u7EBF",
    category: "block",
    action: (e) => e.chain().focus().setHorizontalRule().run(),
  },
  {
    icon: "</>",
    label: "\u4EE3\u7801\u5757",
    description: "\u4EE3\u7801\u7247\u6BB5",
    category: "block",
    action: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
  {
    icon: "\u{1F5BC}",
    label: "\u56FE\u7247",
    description: "\u63D2\u5165\u56FE\u7247",
    category: "block",
    action: (e) => {
      const url = window.prompt("\u8F93\u5165\u56FE\u7247\u5730\u5740");
      if (url) {
        e.chain().focus().setImage({ src: url }).run();
      }
    },
  },
  {
    icon: "\u229E",
    label: "\u8868\u683C",
    description: "3\u00D73 \u8868\u683C",
    category: "block",
    action: (e) =>
      e
        .chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
];

const aiCommands: CommandItem[] = [
  {
    icon: "\u2726",
    label: "\u6DA6\u8272\u9009\u4E2D\u6BB5\u843D",
    description: "AI \u6DA6\u8272\u4F18\u5316",
    category: "ai",
    action: () => {
      /* handled externally */
    },
  },
  {
    icon: "\u2726",
    label: "\u7EED\u5199\u4E0B\u6587",
    description: "AI \u7EED\u5199\u5185\u5BB9",
    category: "ai",
    action: () => {
      /* handled externally */
    },
  },
  {
    icon: "\u2726",
    label: "\u751F\u6210\u6807\u9898",
    description: "AI \u751F\u6210\u6807\u9898",
    category: "ai",
    action: () => {
      /* handled externally */
    },
  },
  {
    icon: "\u2726",
    label: "\u7FFB\u8BD1",
    description: "AI \u7FFB\u8BD1\u5185\u5BB9",
    category: "ai",
    action: () => {
      /* handled externally */
    },
  },
];

const allCommands: CommandItem[] = [...blockCommands, ...aiCommands];

export function SlashCommand({ editor }: SlashCommandProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const [triggerPos, setTriggerPos] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const store = useArticlePageStore();

  const filteredItems = allCommands.filter(
    (item) =>
      item.label.toLowerCase().includes(query.toLowerCase()) ||
      (item.description ?? "").toLowerCase().includes(query.toLowerCase())
  );

  const blockItems = filteredItems.filter((i) => i.category === "block");
  const aiItems = filteredItems.filter((i) => i.category === "ai");

  // Reset selected index when filtered items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const dismiss = useCallback(() => {
    setOpen(false);
    setQuery("");
    setTriggerPos(null);
  }, []);

  const executeCommand = useCallback(
    (item: CommandItem) => {
      if (!editor || triggerPos === null) return;

      // Delete the "/" and any query characters
      const cursorPos = editor.state.selection.from;
      editor
        .chain()
        .focus()
        .deleteRange({ from: triggerPos, to: cursorPos })
        .run();

      if (item.category === "ai") {
        // For AI commands, set selected text + switch to chat tab
        const { from, to } = editor.state.selection;
        const currentParagraphText = editor.state.doc.textBetween(
          Math.max(0, from - 200),
          to,
          " "
        );
        const instruction =
          item.label === "\u6DA6\u8272\u9009\u4E2D\u6BB5\u843D"
            ? `\u8BF7\u6DA6\u8272\u4EE5\u4E0B\u5185\u5BB9\uFF1A\n${currentParagraphText}`
            : item.label === "\u7EED\u5199\u4E0B\u6587"
              ? `\u8BF7\u7EED\u5199\u4EE5\u4E0B\u5185\u5BB9\uFF1A\n${currentParagraphText}`
              : item.label === "\u751F\u6210\u6807\u9898"
                ? `\u8BF7\u4E3A\u4EE5\u4E0B\u5185\u5BB9\u751F\u6210\u6807\u9898\uFF1A\n${currentParagraphText}`
                : `\u8BF7\u7FFB\u8BD1\u4EE5\u4E0B\u5185\u5BB9\uFF1A\n${currentParagraphText}`;

        store.setSelectedText(instruction);
        store.setLeftTab("chat");
      } else {
        item.action(editor);
      }

      dismiss();
    },
    [editor, triggerPos, dismiss, store]
  );

  // Listen to editor updates to detect "/" trigger
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      const { state } = editor;
      const { from } = state.selection;
      const textBefore = state.doc.textBetween(
        Math.max(0, from - 50),
        from,
        "\0"
      );

      // Find the last "/" that's at start of line or after whitespace
      const match = textBefore.match(/(?:^|[\s\0])\/([^\s\0]*)$/);
      if (match) {
        const queryStr = match[1];
        const slashOffset = textBefore.length - match[0].length + (match[0].startsWith("/") ? 0 : 1);
        const slashPos = from - textBefore.length + slashOffset;

        setQuery(queryStr);
        setTriggerPos(slashPos);

        // Get cursor position for menu placement
        try {
          const coords = editor.view.coordsAtPos(from);
          const editorRect = editor.view.dom.closest(".flex.flex-col.h-full")?.getBoundingClientRect();
          if (editorRect) {
            setPosition({
              top: coords.bottom - editorRect.top + 4,
              left: coords.left - editorRect.left,
            });
          } else {
            setPosition({
              top: coords.bottom + 4,
              left: coords.left,
            });
          }
        } catch {
          // coords might fail at edge positions
        }

        setOpen(true);
      } else if (open) {
        dismiss();
      }
    };

    editor.on("update", handleUpdate);
    editor.on("selectionUpdate", () => {
      // Dismiss if user moves cursor away
      if (open && triggerPos !== null) {
        const { from } = editor.state.selection;
        if (from <= triggerPos) {
          dismiss();
        }
      }
    });

    return () => {
      editor.off("update", handleUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, open, triggerPos]);

  // Keyboard navigation
  useEffect(() => {
    if (!open || !editor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredItems.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredItems.length - 1
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          executeCommand(filteredItems[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        dismiss();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [open, editor, filteredItems, selectedIndex, executeCommand, dismiss]);

  // Click outside to dismiss
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        dismiss();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, dismiss]);

  if (!open || filteredItems.length === 0) return null;

  let flatIndex = 0;

  return (
    <div
      ref={menuRef}
      className="absolute z-50 w-[240px] max-h-[320px] overflow-y-auto bg-popover border border-border rounded-lg shadow-lg py-1"
      style={{ top: position.top, left: position.left }}
    >
      {blockItems.length > 0 && (
        <>
          <div className="text-[10px] text-muted-foreground px-3 py-1 select-none">
            {"\u57FA\u7840\u5757"}
          </div>
          {blockItems.map((item) => {
            const idx = flatIndex++;
            return (
              <button
                key={item.label}
                className={`w-full px-3 py-2 text-xs cursor-pointer flex items-center gap-2 transition-colors ${
                  idx === selectedIndex
                    ? "bg-muted/50"
                    : "hover:bg-muted/50"
                }`}
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => executeCommand(item)}
              >
                <span className="w-6 text-center shrink-0 text-sm">
                  {item.icon}
                </span>
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-foreground">{item.label}</span>
                  {item.description && (
                    <span className="text-[10px] text-muted-foreground truncate">
                      {item.description}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </>
      )}

      {aiItems.length > 0 && (
        <>
          {blockItems.length > 0 && (
            <div className="h-px bg-border mx-2 my-1" />
          )}
          <div className="text-[10px] text-muted-foreground px-3 py-1 select-none">
            AI {"\u52A9\u624B"}
          </div>
          {aiItems.map((item) => {
            const idx = flatIndex++;
            return (
              <button
                key={item.label}
                className={`w-full px-3 py-2 text-xs cursor-pointer flex items-center gap-2 transition-colors ${
                  idx === selectedIndex
                    ? "bg-muted/50"
                    : "hover:bg-muted/50"
                }`}
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => executeCommand(item)}
              >
                <span className="w-6 text-center shrink-0 text-sm text-purple-400">
                  {item.icon}
                </span>
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-foreground">{item.label}</span>
                  {item.description && (
                    <span className="text-[10px] text-muted-foreground truncate">
                      {item.description}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </>
      )}
    </div>
  );
}
