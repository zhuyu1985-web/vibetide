/**
 * verify-help-links — 构建期扫所有 content/help/**.mdx 文件
 * 找出 <DocLink href="/help/..."> 和 markdown 链接 [text](/help/...)
 * 验证每个 /help/* 目标存在(分类页 / 详情页 / 特殊页),否则 fail build
 */
import fg from "fast-glob";
import fs from "node:fs/promises";
import path from "node:path";

const CONTENT_ROOT = path.join(process.cwd(), "content/help");

// 匹配两种写法:
//   <DocLink href="/help/..."> 或 <DocLink ... href={"/help/..."}>(JSX 可有多余属性 + 换行)
//   markdown link: [text](/help/...)
// 路径允许 1-3 段(/help/faq、/help/category、/help/category/slug、含 #hash 等)
const HELP_LINK_RE =
  /(?:<DocLink\b[^>]*?\bhref=|\]\()["'{]?(\/help(?:\/[a-z0-9-]+){0,3})(?:#[^"')\s}]*)?["'\)\s}]/g;

async function getAllValidPaths(): Promise<Set<string>> {
  const mdxFiles = await fg("*/**/*.mdx", {
    cwd: CONTENT_ROOT,
    ignore: ["**/changelog/**"],
  });
  const paths = new Set<string>();
  for (const f of mdxFiles) {
    const parts = f.split(path.sep);
    const cat = parts[0];
    const slug = parts[parts.length - 1].replace(/\.mdx$/, "");
    paths.add(`/help/${cat}/${slug}`);
    paths.add(`/help/${cat}`);                       // 分类索引页本身也是合法目标
  }
  // 固定特殊页
  paths.add("/help");
  paths.add("/help/faq");
  paths.add("/help/changelog");
  paths.add("/help/search");
  return paths;
}

async function main() {
  const valid = await getAllValidPaths();
  const mdxFiles = await fg("**/*.mdx", { cwd: CONTENT_ROOT });
  const broken: Array<{ file: string; href: string }> = [];
  for (const f of mdxFiles) {
    const raw = await fs.readFile(path.join(CONTENT_ROOT, f), "utf-8");
    for (const m of raw.matchAll(HELP_LINK_RE)) {
      const href = m[1];
      if (!valid.has(href)) broken.push({ file: f, href });
    }
  }
  if (broken.length === 0) {
    console.log(`✓ all help links resolve (scanned ${mdxFiles.length} files)`);
    return;
  }
  console.error(`✗ ${broken.length} broken help link(s):`);
  for (const b of broken) console.error(`  ${b.file} → ${b.href}`);
  process.exit(1);
}

main().catch((e) => {
  console.error("✗ verify-help-links failed:", e);
  process.exit(1);
});
