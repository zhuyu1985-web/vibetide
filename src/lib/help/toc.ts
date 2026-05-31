import { visit } from "unist-util-visit";
import { toString } from "mdast-util-to-string";
import GithubSlugger from "github-slugger";
import type { TocEntry } from "./types";

// 用 github-slugger 与 rehype-slug 内部算法完全一致,避免 TOC id 与 DOM id mismatch
export function remarkExtractToc() {
  return (tree: any, file: any) => {
    const slugger = new GithubSlugger();   // 每次调用 new 一次,自动处理重复 heading 后缀 -1/-2
    const toc: TocEntry[] = [];
    visit(tree, "heading", (node: any) => {
      if (node.depth !== 2 && node.depth !== 3) return;
      const text = toString(node);
      const id = slugger.slug(text);
      toc.push({ depth: node.depth, text, id });
    });
    file.data.toc = toc;
  };
}
