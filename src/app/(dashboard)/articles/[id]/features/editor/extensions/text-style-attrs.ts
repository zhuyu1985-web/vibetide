/**
 * 扩展 Tiptap TextStyle 为 inline text 添加 font-family / font-size 属性。
 *
 * 不依赖 @tiptap/extension-font-family（官方包只做 font-family，单独再装个 font-size
 * 包太重）。直接基于已装的 @tiptap/extension-text-style 扩 attribute。
 *
 * 用法：
 *   editor.chain().focus().setMark('textStyle', { fontFamily: '宋体' }).run()
 *   editor.chain().focus().setMark('textStyle', { fontSize: '18px' }).run()
 *   editor.chain().focus().unsetMark('textStyle').run()  // 清掉两者
 */

import { TextStyle } from "@tiptap/extension-text-style";

export const TextStyleAttrs = TextStyle.extend({
  addAttributes() {
    const parent = (this.parent as undefined | (() => Record<string, unknown>))?.();
    return {
      ...(parent ?? {}),
      fontFamily: {
        default: null,
        parseHTML: (el: HTMLElement) =>
          el.style.fontFamily?.replace(/^['"]|['"]$/g, "") || null,
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.fontFamily
            ? { style: `font-family: ${String(attrs.fontFamily)}` }
            : {},
      },
      fontSize: {
        default: null,
        parseHTML: (el: HTMLElement) => el.style.fontSize || null,
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.fontSize ? { style: `font-size: ${String(attrs.fontSize)}` } : {},
      },
    };
  },
});
