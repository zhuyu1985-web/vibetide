import { describe, it, expect } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import { VFile } from "vfile";
import { remarkExtractToc } from "@/lib/help/toc";
import type { TocEntry } from "@/lib/help/types";

// 注:unified@11 的 `.run(tree)` 返回 Promise<Node>(不是 VFile),plugin 写到
// file.data.toc 的数据必须通过显式传入的 VFile 取回。
async function extract(md: string): Promise<TocEntry[]> {
  const processor = unified().use(remarkParse).use(remarkExtractToc);
  const tree = processor.parse(md);
  const file = new VFile(md);
  await processor.run(tree, file);
  return (file.data.toc as TocEntry[]) ?? [];
}

describe("remarkExtractToc", () => {
  it("抽取 H2 与 H3,跳过 H1/H4", async () => {
    const toc = await extract(`# h1\n## 概述\n### 子节\n## 安装\n#### h4`);
    expect(toc).toHaveLength(3);
    expect(toc[0]).toMatchObject({ depth: 2, text: "概述" });
    expect(toc[1]).toMatchObject({ depth: 3, text: "子节" });
    expect(toc[2]).toMatchObject({ depth: 2, text: "安装" });
    // id 与 rehype-slug 输出一致(都用 github-slugger)
    expect(toc[0].id).toBe("概述");                 // 中文保留(github-slugger 不转拼音)
  });
  it("重复 heading 自动加后缀", async () => {
    const toc = await extract(`## 概述\n## 概述\n## 概述`);
    expect(toc.map((t) => t.id)).toEqual(["概述", "概述-1", "概述-2"]);
  });
  it("无 heading 时返回空数组", async () => {
    expect(await extract("just text")).toEqual([]);
  });
});
