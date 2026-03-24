import { Mark } from "@tiptap/core";

export const AIHighlight = Mark.create({
  name: "aiHighlight",

  addAttributes() {
    return {};
  },

  parseHTML() {
    return [{ tag: "span[data-ai-highlight]" }];
  },

  renderHTML() {
    return [
      "span",
      {
        "data-ai-highlight": "",
        class: "ai-highlight-fade",
      },
      0,
    ];
  },
});
