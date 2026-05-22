/**
 * 扩展 Paragraph + Heading 节点的 inline-style 属性，
 * 让工具栏可以设置：行间距 / 段前距 / 段后距 / 首行缩进。
 *
 * 用法：
 *   editor.chain().focus().setParagraphAttr('lineHeight', '1.8').run()
 *   editor.chain().focus().setParagraphAttr('textIndent', '2em').run()
 *   editor.chain().focus().clearParagraphAttrs().run()
 *
 * 实现：每个 attribute 独立 renderHTML 各自的 style 片段，
 * Tiptap mergeAttributes 会把多个 style 用 `; ` 拼接。
 */

import { Extension } from "@tiptap/core";

export type ParagraphAttrKey =
  | "lineHeight"
  | "textIndent"
  | "marginTop"
  | "marginBottom";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    paragraphAttrs: {
      setParagraphAttr: (key: ParagraphAttrKey, value: string | null) => ReturnType;
      clearParagraphAttrs: () => ReturnType;
    };
  }
}

const ATTR_KEYS: ParagraphAttrKey[] = [
  "lineHeight",
  "textIndent",
  "marginTop",
  "marginBottom",
];

const CSS_KEY: Record<ParagraphAttrKey, string> = {
  lineHeight: "line-height",
  textIndent: "text-indent",
  marginTop: "margin-top",
  marginBottom: "margin-bottom",
};

function styleParser(key: ParagraphAttrKey) {
  return (el: HTMLElement): string | null => {
    const css = key === "lineHeight"
      ? el.style.lineHeight
      : key === "textIndent"
        ? el.style.textIndent
        : key === "marginTop"
          ? el.style.marginTop
          : el.style.marginBottom;
    return css && css.length > 0 ? css : null;
  };
}

function styleRenderer(key: ParagraphAttrKey) {
  return (attrs: Record<string, unknown>): Record<string, string> => {
    const v = attrs[key];
    return v ? { style: `${CSS_KEY[key]}: ${String(v)}` } : {};
  };
}

export const ParagraphAttrs = Extension.create({
  name: "paragraphAttrs",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: Object.fromEntries(
          ATTR_KEYS.map((key) => [
            key,
            {
              default: null,
              parseHTML: styleParser(key),
              renderHTML: styleRenderer(key),
            },
          ]),
        ),
      },
    ];
  },

  addCommands() {
    return {
      setParagraphAttr:
        (key, value) =>
        ({ commands, state }) => {
          const parentType = state.selection.$from.parent.type.name;
          if (parentType === "heading") {
            return commands.updateAttributes("heading", { [key]: value });
          }
          // paragraph or others — 默认走 paragraph
          return commands.updateAttributes("paragraph", { [key]: value });
        },
      clearParagraphAttrs:
        () =>
        ({ commands }) => {
          const reset = Object.fromEntries(ATTR_KEYS.map((k) => [k, null]));
          let ok = false;
          ok = commands.updateAttributes("paragraph", reset) || ok;
          ok = commands.updateAttributes("heading", reset) || ok;
          return ok;
        },
    };
  },
});
