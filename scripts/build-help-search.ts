/* eslint-disable @typescript-eslint/no-explicit-any */
import path from "node:path";
import fs from "node:fs/promises";

const HELP_HTML_ROOT = path.join(process.cwd(), ".next/server/app/help");
const OUTPUT_DIR = path.join(process.cwd(), "public/pagefind");

async function main() {
  try {
    await fs.access(HELP_HTML_ROOT);
  } catch {
    console.warn("⚠ .next/server/app/help not found — skipping pagefind index. (Run `next build` first.)");
    return;
  }
  // 动态 import 避开 tsx CJS resolver 对 ESM-only 包的解析问题
  const { createIndex } = (await import("pagefind")) as any;
  const { index, errors } = await createIndex({
    rootSelector: "main",
    excludeSelectors: [".no-search", "pre"],
    keepIndexUrl: false,
    forceLanguage: "zh-cn",
  });
  if (errors && errors.length > 0) throw new Error(`pagefind init errors: ${errors.join(", ")}`);
  await index!.addDirectory({ path: HELP_HTML_ROOT });
  await index!.writeFiles({ outputPath: OUTPUT_DIR });
  console.log("✓ pagefind index built →", OUTPUT_DIR);
}
main().catch((e) => {
  console.error("✗ pagefind build failed:", e);
  process.exit(1);
});
