# 帮助中心 (Help Center) 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/help` 路由新建一个独立的、公开访问的产品帮助中心(MDX 内容 + pagefind 搜索 + Shopify 风首页 + Sealos 风详情页),并在 dashboard 左下角挂一个动效精致的 AI 员工"小帮"浮动入口。

**Spec:** `docs/superpowers/specs/2026-05-31-help-center-design.md`

**Architecture:** `src/app/help/`(独立路由段,与 `(dashboard)` / `(auth)` 完全脱钩)+ `content/help/**`(MDX 内容仓库)+ `src/components/help/**`(专属组件)+ `src/lib/help/**`(数据访问层)。MDX 走 `next-mdx-remote-client/rsc` 在 RSC 渲染期编译,所有 `/help/**` 路由 `force-static` 预渲染;客户端搜索用 pagefind(postbuild 钩子构建索引,wasm 延迟加载)。

**Tech Stack:** Next.js 16 App Router + React 19 + RSC, `next-mdx-remote-client@^1`, `@shikijs/rehype`, `remark-gfm`, `rehype-slug`, `pagefind@^1`, `gray-matter`, `reading-time`, `fuse.js`, framer-motion(已有), shadcn/ui accordion(新增), Drizzle ORM(已有), iron-session(已有).

---

## 阶段一览

| Phase | 名称 | 关键产出 | 验证 |
|---|---|---|---|
| 0 | 依赖落地 | npm install + npx shadcn add accordion | `tsc --noEmit` |
| 1 | 数据层基础设施 | frontmatter zod / content.ts / toc remark plugin / proxy 改 | 单元测试 + `tsc` |
| 2 | `/help` Layout + 首页骨架 | layout.tsx / HelpHeader / HelpFooter / 首页占位 | 浏览器访问 `/help` |
| 3 | 小帮浮动入口 | XiaobangAvatar SVG + HelpLauncher 5 态 + dashboard 集成 | 浏览器手测 |
| 4 | 分类页 + 详情页骨架 | `[category]/page.tsx` + `[slug]/page.tsx` + 左目录 + 右 TOC + 反馈 | 浏览器访问示例文档 |
| 5 | MDX 管道 + 自定义组件 | next-mdx-remote-client 集成 + 8 个 MDX 组件 | 单元测试 + 浏览器验渲染 |
| 6 | Pagefind 搜索 | postbuild 脚本 + SearchDialog + `/help/search` | `npm run build` + 搜中文短词 |
| 7 | FAQ + 更新日志 | faq.json + Accordion + changelog MDX + build-help-meta | 浏览器验交互 |
| 8 | 反馈表 | Drizzle schema + migration + server action + DocFeedback | 单元测试 + 落表 |
| 9 | 链路校验脚本 | verify-help-links.ts(构建期检查 DocLink) | `tsx scripts/verify-help-links.ts` |
| 10 | 首批内容 | 5 篇 getting-started + 3 篇 workflows + 20 条 FAQ + 1 篇 changelog | pagefind 索引能搜到 |
| 11 | 整体验证 | tsc + build + axe + 手测全流程 | 全绿 |

**预估代码量**:~3500-4500 行(组件 + 数据层 + 脚本 + 内容文件 frontmatter,不含 MDX 正文文字)。

**分支策略**:直接在 `main` 上推进(单人单线程开发,符合 CLAUDE.md 项目约定);每个 Phase 结束一个原子 commit;Phase 8 因含数据库迁移,单独走 `db:generate` + `db:migrate` 双步。

---

## Phase 0:依赖落地

**目标**:把 spec §18 列出的新依赖一次性装好,确认无类型冲突。

### Task 0.1:安装 npm 依赖

**Files:** Modify `package.json`、`package-lock.json`

- [ ] **Step 1: 安装运行时依赖**

```bash
npm install next-mdx-remote-client@^1 reading-time@^1 github-slugger@^2 \
  @shikijs/rehype@^1 @shikijs/transformers@^1 \
  remark-gfm@^4 rehype-slug@^6 rehype-autolink-headings@^7 \
  unist-util-visit@^5 mdast-util-to-string@^4 gray-matter@^4 fuse.js@^7
```

> **注意**:用 `github-slugger`(不是 `@sindresorhus/slugify`)。`rehype-slug` 内部就用 github-slugger,我们的 TOC 抽取也用同一个包才能保证产出的 heading id 与 DOM 完全一致 — 否则 TOC 锚点点击跳转、IntersectionObserver 监听都会失效(例如"概述" → `slugify` 出 `gai-shu`,`github-slugger` 出 `概述`,两者不匹配)。

- [ ] **Step 2: 安装 dev 依赖**

```bash
npm install -D pagefind@^1 fast-glob@^3
```

- [ ] **Step 3: 加 accordion shadcn 组件**

```bash
npx shadcn@latest add accordion
```

确认生成 `src/components/ui/accordion.tsx`。

- [ ] **Step 4: 验证类型零冲突**

```bash
npx tsc --noEmit
```

Expected: 0 errors. 如果 `@shikijs/rehype` 与现有 `@types/mdx` 冲突,降级到 `@shikijs/rehype@^1.0.0` 或调整 `tsconfig.json` 的 `skipLibCheck`(项目已开,应该没事)。

- [ ] **Step 5: 提交**

```bash
git add package.json package-lock.json src/components/ui/accordion.tsx
git commit -m "feat(help): 安装 MDX/搜索栈依赖 + accordion 组件 (Phase 0)"
```

---

## Phase 1:数据层基础设施

**目标**:把 content 读取、frontmatter 校验、TOC 抽取、proxy 公开访问改动这些"任何 UI 都不能少"的底层管道立起来。无 UI,纯逻辑,**全部要单元测试**。

### Task 1.1:类型定义 + Zod Schema

**Files:** Create `src/lib/help/types.ts`

- [ ] **Step 1: 写 zod schema 与类型(参考 spec §7.1)**

```ts
import { z } from "zod";

export const HELP_CATEGORY_SLUGS = [
  "getting-started", "ai-employees", "workflows", "creation",
  "data-collection", "media-assets", "channels", "admin",
] as const;
export type HelpCategorySlug = (typeof HELP_CATEGORY_SLUGS)[number];

export const HelpFrontmatterSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(200),
  slug: z.string().optional(),
  category: z.enum(HELP_CATEGORY_SLUGS),
  group: z.string().optional(),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  authors: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  popular: z.boolean().optional(),
  order: z.number().int().optional(),
  toc: z.boolean().default(true),
});
export type HelpFrontmatter = z.infer<typeof HelpFrontmatterSchema>;

export const HelpCategoryMetaSchema = z.object({
  title: z.string(),
  description: z.string(),
  icon: z.string(),                                 // Lucide icon name
  groups: z.array(z.object({
    title: z.string(),
    docs: z.array(z.string()),                      // 文件 slug,顺序即排序
  })),
});
export type HelpCategoryMeta = z.infer<typeof HelpCategoryMetaSchema>;

export interface TocEntry { depth: 2 | 3; text: string; id: string; }

export interface HelpDoc {
  category: HelpCategorySlug;
  slug: string;
  frontmatter: HelpFrontmatter;
  filePath: string;
}

export interface HelpDocWithBody extends HelpDoc {
  body: string;                                     // 原始 MDX 内容(不含 frontmatter)
  toc: TocEntry[];
  readingTime: string;                              // "约 5 分钟"
}

export interface HelpCategorySummary {
  slug: HelpCategorySlug;
  meta: HelpCategoryMeta;
  docCount: number;
}
```

- [ ] **Step 2: 单元测试**

**Files:** Create `tests/unit/lib/help/types.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { HelpFrontmatterSchema } from "@/lib/help/types";

describe("HelpFrontmatterSchema", () => {
  it("接受合法 frontmatter", () => {
    const r = HelpFrontmatterSchema.safeParse({
      title: "第一个工作流", description: "5 分钟跑通",
      category: "workflows", publishedAt: "2026-05-31",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.toc).toBe(true);  // 默认值
  });
  it("拒绝非法 category", () => {
    expect(HelpFrontmatterSchema.safeParse({
      title: "x", description: "x", category: "foo", publishedAt: "2026-05-31",
    }).success).toBe(false);
  });
  it("拒绝错误日期格式", () => {
    expect(HelpFrontmatterSchema.safeParse({
      title: "x", description: "x", category: "workflows", publishedAt: "31-05-2026",
    }).success).toBe(false);
  });
  it("title 不能空", () => {
    expect(HelpFrontmatterSchema.safeParse({
      title: "", description: "x", category: "workflows", publishedAt: "2026-05-31",
    }).success).toBe(false);
  });
});
```

- [ ] **Step 3: 跑测试**

```bash
npx vitest run tests/unit/lib/help/types.test.ts
```

Expected: 4 passed.

### Task 1.2:TOC 抽取 remark plugin

**Files:** Create `src/lib/help/toc.ts`

- [ ] **Step 1: 写 plugin(参考 spec §7.4)**

```ts
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
```

- [ ] **Step 2: 单元测试**

**Files:** Create `tests/unit/lib/help/toc.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import { remarkExtractToc } from "@/lib/help/toc";

async function extract(md: string) {
  const file = await unified().use(remarkParse).use(remarkExtractToc).run(
    unified().use(remarkParse).parse(md)
  );
  return file.data.toc;
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
```

- [ ] **Step 3: 跑测试**

```bash
npx vitest run tests/unit/lib/help/toc.test.ts
```

Expected: 2 passed.

### Task 1.3:内容加载层 `content.ts`

**Files:** Create `src/lib/help/content.ts`

- [ ] **Step 1: 实现核心 4 函数 + TOC 单独 pipeline(参考 spec §7.4 修订与 §7.6)**

关键:`getDocBySlug` 内单独跑一次 remark pipeline 抽 toc,**不**依赖 `<MDXRemote>` 透传 vfile.data。

```ts
import "server-only";
import { cache } from "react";
import path from "node:path";
import fs from "node:fs/promises";
import fg from "fast-glob";
import matter from "gray-matter";
import readingTime from "reading-time";
import { unified } from "unified";
import remarkParse from "remark-parse";
import {
  HelpFrontmatterSchema, HelpCategoryMetaSchema,
  HELP_CATEGORY_SLUGS,
  type HelpDoc, type HelpDocWithBody, type HelpCategorySummary,
  type HelpCategorySlug, type TocEntry,
} from "./types";
import { remarkExtractToc } from "./toc";

const CONTENT_ROOT = path.join(process.cwd(), "content/help");

export const listAllDocs = cache(async (): Promise<HelpDoc[]> => {
  const files = await fg("*/**/*.mdx", {
    cwd: CONTENT_ROOT, absolute: true,
    ignore: ["**/changelog/**"],
  });
  const docs: HelpDoc[] = [];
  for (const filePath of files) {
    const raw = await fs.readFile(filePath, "utf-8");
    const { data } = matter(raw);
    const parsed = HelpFrontmatterSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(
        `Frontmatter invalid in ${filePath}: ${JSON.stringify(parsed.error.flatten())}`,
      );
    }
    const rel = path.relative(CONTENT_ROOT, filePath);
    const [category] = rel.split(path.sep);
    if (!HELP_CATEGORY_SLUGS.includes(category as HelpCategorySlug)) {
      throw new Error(`Doc ${rel} lives under unknown category "${category}"`);
    }
    const slug = parsed.data.slug ?? path.basename(filePath, ".mdx");
    docs.push({
      category: category as HelpCategorySlug,
      slug,
      frontmatter: parsed.data,
      filePath,
    });
  }
  return docs;
});

export const listDocsByCategory = cache(async (cat: HelpCategorySlug) => {
  const all = await listAllDocs();
  return all.filter((d) => d.category === cat);
});

export const getCategoryMeta = cache(async (cat: HelpCategorySlug) => {
  const metaPath = path.join(CONTENT_ROOT, cat, "_meta.json");
  try {
    const raw = await fs.readFile(metaPath, "utf-8");
    return HelpCategoryMetaSchema.parse(JSON.parse(raw));
  } catch (e) {
    throw new Error(`_meta.json missing or invalid for ${cat}: ${(e as Error).message}`);
  }
});

export const listCategories = cache(async (): Promise<HelpCategorySummary[]> => {
  const summaries: HelpCategorySummary[] = [];
  for (const slug of HELP_CATEGORY_SLUGS) {
    const docs = await listDocsByCategory(slug);
    if (docs.length === 0) continue;                // 空分类不进首页网格,但分类页可访问
    const meta = await getCategoryMeta(slug);
    summaries.push({ slug, meta, docCount: docs.length });
  }
  return summaries;
});

export const getDocBySlug = cache(
  async (cat: HelpCategorySlug, slug: string): Promise<HelpDocWithBody | null> => {
    const docs = await listDocsByCategory(cat);
    const doc = docs.find((d) => d.slug === slug);
    if (!doc) return null;
    const raw = await fs.readFile(doc.filePath, "utf-8");
    const { content } = matter(raw);

    // 独立跑一次 remark pipeline 抽 TOC,与 <MDXRemote> 渲染解耦
    const file = await unified()
      .use(remarkParse)
      .use(remarkExtractToc)
      .run(unified().use(remarkParse).parse(content));
    const toc = (file.data.toc as TocEntry[] | undefined) ?? [];
    const rtStats = readingTime(content, { wordsPerMinute: 300 });
    const readingTimeText = `约 ${Math.max(1, Math.round(rtStats.minutes))} 分钟`;

    return { ...doc, body: content, toc, readingTime: readingTimeText };
  },
);

export const listPopularDocs = cache(async (limit = 6) => {
  const all = await listAllDocs();
  return all.filter((d) => d.frontmatter.popular).slice(0, limit);
});
```

- [ ] **Step 2: 写 fixture + 单元测试(用临时 content 目录)**

**Files:** Create `tests/unit/lib/help/content.test.ts`、`tests/fixtures/help-content/`

测试要 fixture 目录;最简单的办法是写一个 helper 通过 mocking `process.cwd` 切换到 `tests/fixtures/help-content/`(里面准备 1 个 workflows + 2 篇 mdx + _meta.json)。或者把 `CONTENT_ROOT` 改成模块级 `let` 暴露 `__setContentRoot` 给测试用。

**采用方案 B(轻量):** 把 `CONTENT_ROOT` 改成由 `process.env.HELP_CONTENT_ROOT ?? path.join(process.cwd(), "content/help")` 解析,这样测试 `beforeEach` 里 setEnv 切到 fixture 目录,无侵入。

修改 content.ts:

```ts
const CONTENT_ROOT = process.env.HELP_CONTENT_ROOT
  ?? path.join(process.cwd(), "content/help");
```

Fixture 文件:

```
tests/fixtures/help-content/
├── workflows/
│   ├── _meta.json
│   ├── start.mdx               # title: 第一个工作流, popular: true
│   └── concepts.mdx            # title: 工作流概念
└── creation/
    └── _meta.json              # 空 docs(测空分类被过滤)
```

`start.mdx` 正文含两个 H2、一个 H3,便于测 toc。

测试用例:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";

beforeAll(() => {
  process.env.HELP_CONTENT_ROOT = path.resolve(__dirname, "../../../fixtures/help-content");
});

describe("listAllDocs", () => {
  it("扫所有非 changelog mdx", async () => {
    const { listAllDocs } = await import("@/lib/help/content");
    const docs = await listAllDocs();
    expect(docs).toHaveLength(2);
    expect(docs.map((d) => d.slug).sort()).toEqual(["concepts", "start"]);
  });
});

describe("getDocBySlug", () => {
  it("返回带 toc 与 readingTime 的 doc", async () => {
    const { getDocBySlug } = await import("@/lib/help/content");
    const doc = await getDocBySlug("workflows", "start");
    expect(doc).not.toBeNull();
    expect(doc!.toc.length).toBeGreaterThan(0);
    expect(doc!.readingTime).toMatch(/^约 \d+ 分钟$/);
  });
  it("不存在的 slug 返回 null", async () => {
    const { getDocBySlug } = await import("@/lib/help/content");
    expect(await getDocBySlug("workflows", "nonexistent")).toBeNull();
  });
});

describe("listCategories", () => {
  it("跳过空分类", async () => {
    const { listCategories } = await import("@/lib/help/content");
    const cats = await listCategories();
    expect(cats.map((c) => c.slug)).toEqual(["workflows"]);   // creation 空,被过滤
  });
});

describe("listPopularDocs", () => {
  it("按 frontmatter.popular 过滤", async () => {
    const { listPopularDocs } = await import("@/lib/help/content");
    const pops = await listPopularDocs();
    expect(pops).toHaveLength(1);
    expect(pops[0].slug).toBe("start");
  });
});
```

- [ ] **Step 3: 跑测试**

```bash
npx vitest run tests/unit/lib/help/content.test.ts
```

Expected: 5 passed.

### Task 1.4:proxy.ts 改动 + 单元测试

**Files:** Modify `src/proxy.ts:8-15`

- [ ] **Step 1: 最小改动加 `/help` 公共白名单**

`src/proxy.ts:8`:

```ts
function isPublic(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/help")           // 新增
  );
}
```

- [ ] **Step 2: 写测试覆盖新分支**

**Files:** Modify or create `tests/unit/proxy.test.ts` (如果文件不存在,创建一个;只测 isPublic 这个纯函数,需要 export 它)

`src/proxy.ts` 顶部加 `export` 给 `isPublic`(若已是 export 跳过)。

```ts
import { describe, it, expect } from "vitest";
import { isPublic } from "@/proxy";

describe("isPublic", () => {
  it.each([
    ["/", true],
    ["/login", true],
    ["/help", true],
    ["/help/workflows/start", true],
    ["/help/faq#wf-001", true],
    ["/home", false],
    ["/missions", false],
  ])("isPublic(%s) === %s", (p, expected) => {
    expect(isPublic(p)).toBe(expected);
  });
});
```

- [ ] **Step 3: 跑测试**

```bash
npx vitest run tests/unit/proxy.test.ts
```

Expected: 7 passed.

### Task 1.5:Phase 1 收尾

- [ ] **Step 1: 类型检查**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: 全量测试通过**

```bash
npm test
```

Expected: 所有测试 pass(包括前 4 个任务新加的)。

- [ ] **Step 3: 提交**

```bash
git add src/lib/help src/proxy.ts tests/unit/lib/help tests/unit/proxy.test.ts tests/fixtures/help-content
git commit -m "feat(help): 数据层基础设施 — frontmatter schema / TOC / content 加载 / proxy 放行 (Phase 1)"
```

---

## Phase 2:`/help` Layout + 首页骨架

**目标**:可以在浏览器打开 `/help` 看到顶部导航 + 首页四块占位(分类网格、热门、联系入口先放假数据)。这一阶段**不**接 MDX 也**不**接搜索。

### Task 2.1:HelpLayout 顶栏 + 底栏

**Files:** Create
- `src/app/help/layout.tsx`
- `src/components/help/layout/help-header.tsx`
- `src/components/help/layout/help-footer.tsx`

- [ ] **Step 1: 写 layout(参考 spec §5.1)**

```tsx
// src/app/help/layout.tsx
import type { Metadata } from "next";
import { HelpHeader } from "@/components/help/layout/help-header";
import { HelpFooter } from "@/components/help/layout/help-footer";

export const metadata: Metadata = {
  title: { template: "%s | Vibe Media 帮助中心", default: "Vibe Media 帮助中心" },
  description: "Vibe Media 数智全媒平台使用文档、AI 员工指南、常见问题与更新日志。",
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh flex flex-col bg-white dark:bg-slate-950">
      <HelpHeader />
      <main className="flex-1">{children}</main>
      <HelpFooter />
    </div>
  );
}
```

- [ ] **Step 2: HelpHeader**

```tsx
// src/components/help/layout/help-header.tsx — "use client" 因为含搜索框 + Cmd+K 监听
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function HelpHeader() {
  const router = useRouter();
  return (
    <header className="h-14 border-b border-border/60 sticky top-0 z-30 bg-white/85 dark:bg-slate-950/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto h-full px-4 flex items-center gap-4">
        <Link href="/help" className="flex items-center gap-2.5 shrink-0">
          {/* logo 复用 dashboard 的"M"渐变方块 */}
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0b1224] via-[#1e3a8a] to-[#0ea5e9] flex items-center justify-center text-white font-extrabold text-sm">M</span>
          <span className="text-[15px] font-semibold text-foreground">Vibe Media 帮助中心</span>
        </Link>
        <div className="flex-1 max-w-md mx-auto">
          {/* 搜索 trigger — 用 Button ghost 不带边框,符合 CLAUDE.md 设计系统纪律 */}
          <Button
            data-help-search-input
            variant="ghost"
            onClick={() => router.push("/help/search")}
            className="w-full h-9 justify-start gap-2 px-3 text-muted-foreground"
          >
            <Search size={14} />
            <span className="flex-1 text-left text-[13px]">搜索文档…</span>
            <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-background/60">⌘K</kbd>
          </Button>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/home">返回平台 →</Link>
        </Button>
      </div>
    </header>
  );
}
```

> **关于"返回平台"按钮的登录态行为**:写死 `href="/home"` 即可,**不需要**在 HelpHeader 里读 session 区分已登录/未登录。未登录用户点这个按钮会被 `proxy.ts:37+` 兜底重定向到 `/login?next=/home`,登录后再跳回 `/home`,行为等价。HelpHeader 是 Client Component,本身也无法 server-side 读 session,这条路径反而最优雅。

- [ ] **Step 3: HelpFooter**

```tsx
// src/components/help/layout/help-footer.tsx
import Link from "next/link";

export function HelpFooter() {
  return (
    <footer className="h-20 border-t border-border/60 flex items-center justify-center text-xs text-muted-foreground gap-4">
      <span>© 2026 Vibe Media</span>
      <span>·</span>
      <Link href="/help/changelog" className="hover:text-foreground">更新日志</Link>
      <span>·</span>
      <Link href="/help/faq" className="hover:text-foreground">常见问题</Link>
    </footer>
  );
}
```

- [ ] **Step 4: 临时 placeholder page**

```tsx
// src/app/help/page.tsx — Phase 2.2 写真实首页前的占位
export default function HelpHomePage() {
  return <div className="max-w-7xl mx-auto py-24 text-center text-muted-foreground">帮助中心首页(Phase 2.2 完成)</div>;
}
```

- [ ] **Step 5: 浏览器验**

```bash
npm run dev
```

打开 `http://localhost:3000/help`,检查:
- 顶栏渲染 logo + 搜索 trigger + "返回平台" 按钮
- 底栏渲染 © + 链接
- 没有 dashboard sidebar/topbar(独立 layout 生效)

- [ ] **Step 6: 类型检查 + 提交**

```bash
npx tsc --noEmit
git add src/app/help/layout.tsx src/app/help/page.tsx src/components/help/layout
git commit -m "feat(help): HelpLayout 顶栏底栏 + 首页占位 (Phase 2.1)"
```

### Task 2.2:首页四块组件

**Files:** Create
- `src/components/help/home/hero-search.tsx`
- `src/components/help/home/category-grid.tsx`
- `src/components/help/home/popular-docs.tsx`
- `src/components/help/home/contact-section.tsx`
- `src/components/help/home/category-icon.tsx`(把 _meta.json 的 icon 字符串映射到 Lucide)

Modify `src/app/help/page.tsx`

- [ ] **Step 1: HeroSearch(spec §6.1 ①)**

`hero-search.tsx`:gradient 背景 + H1 + Subtitle + 大输入框(同样跳 `/help/search?q=`)+ 4 个热门搜索 tag。Client component(form submit)。

- [ ] **Step 2: CategoryGrid(spec §6.1 ②)**

`category-grid.tsx`:接受 `summaries: HelpCategorySummary[]`,用 `GlassCard` 渲染 8 张卡。`category-icon.tsx` 用 dynamic key → Lucide icon component 映射(如 `{ Rocket, Bot, Workflow, PenLine, … }`),unknown icon 兜底 `FolderOpen`。

- [ ] **Step 3: PopularDocs(spec §6.1 ③)**

`popular-docs.tsx`:接受 `docs: HelpDoc[]`,横向 scroll 4-6 张 GlassCard 卡(标题 + 阅读时长 + 分类 tag)。

- [ ] **Step 4: ContactSection(spec §6.1 ④)**

`contact-section.tsx`:居中 H3 + 两个 Button("打开 AI 员工对话中心" → `/chat`、"提交文档反馈" → mailto 或 open dialog,MVP 先跳 `/help/feedback` placeholder 或 `mailto:help@vibetide.local`)。

- [ ] **Step 5: 装配首页**

```tsx
// src/app/help/page.tsx
import { listCategories, listPopularDocs } from "@/lib/help/content";
import { HeroSearch } from "@/components/help/home/hero-search";
import { CategoryGrid } from "@/components/help/home/category-grid";
import { PopularDocs } from "@/components/help/home/popular-docs";
import { ContactSection } from "@/components/help/home/contact-section";

export const dynamic = "force-static";

const HOT_SEARCH_TERMS = ["第一个工作流", "AI 员工技能", "CMS 接入", "全渠道发布"];

export default async function HelpHomePage() {
  const categories = await listCategories();
  const popular = await listPopularDocs(6);
  return (
    <>
      <HeroSearch hotTerms={HOT_SEARCH_TERMS} />
      <CategoryGrid summaries={categories} />
      <PopularDocs docs={popular} />
      <ContactSection />
    </>
  );
}
```

- [ ] **Step 6: 浏览器验**

`npm run dev`,打开 `/help`:
- HeroSearch 渲染,搜索框可输入
- CategoryGrid 此时没数据(content/help/ 是空的)所以 0 张卡,这是预期(Phase 10 填内容后补)
- PopularDocs 0 张卡,同理
- ContactSection 渲染两个按钮

只要不报错就 OK。

- [ ] **Step 7: tsc + 提交**

```bash
npx tsc --noEmit
git add src/app/help/page.tsx src/components/help/home
git commit -m "feat(help): 首页四块组件 — Hero/CategoryGrid/PopularDocs/ContactSection (Phase 2.2)"
```

### Task 2.3:404 页

**Files:** Create `src/app/help/not-found.tsx`

- [ ] **Step 1: 简单 404**

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HelpNotFound() {
  return (
    <div className="max-w-2xl mx-auto py-24 text-center">
      <h1 className="text-2xl font-semibold">没找到这篇文档</h1>
      <p className="mt-3 text-muted-foreground">这份资料可能被移动了,或者还在编写中。</p>
      <div className="mt-6 flex gap-3 justify-center">
        <Button asChild><Link href="/help">回到帮助首页</Link></Button>
        {/* CLAUDE.md "按钮不要带边框" — 用 secondary 而非 outline */}
        <Button asChild variant="secondary"><Link href="/help/search">搜索文档</Link></Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add src/app/help/not-found.tsx
git commit -m "feat(help): /help 路由 404 页 (Phase 2.3)"
```

---

## Phase 3:小帮浮动入口

**目标**:dashboard 任意页面左下角出现一个精致动效 AI 员工"小帮",5 态(idle/hover/active/wave/first-tip)+ 红点 + `?` 快捷键全部就位。

### Task 3.1:XiaobangAvatar SVG

**Files:** Create `src/components/help/launcher/xiaobang-avatar.tsx`

- [ ] **Step 1: 写 SVG(参考 spec §4.1,沿用 `employee-svg-avatars.tsx` 的 FaceBase 风格)**

64×64 viewBox,接受 `waving?: boolean` 控制右手 wave 动画。需要细节:
- 底色 `linear-gradient(135deg, #ecfeff → #67e8f9)` 圆角矩形
- 顶部学士帽(梯形 + 流苏)
- 头顶悬浮问号灯泡(黄色发光圈 + ? 字符 + 4 道发散光线)
- 帽角金色小星(`avatar-anim-shimmer` 已有 CSS)
- FaceBase 复用(可以 import 或 inline 复制 — 推荐 inline 避免修改 employee-svg-avatars.tsx,降低对现有员工头像的连带风险)
- 右手 path,`<g className={waving ? "avatar-anim-wave" : ""}>` 包裹,transform-origin 在手腕

如果 employee-svg-avatars.tsx 的 FaceBase 未 export,**复制**到 xiaobang-avatar.tsx 内部(避免修改 employee-svg-avatars.tsx 引入回归风险,符合 CLAUDE.md "只修必要的")。

- [ ] **Step 2: 加 wave CSS**

**Files:** Modify `src/app/globals.css`(找到现有 `.avatar-anim-*` 定义的位置,追加)

```css
@keyframes avatar-wave {
  0%, 100% { transform: rotate(0deg); }
  20%, 60% { transform: rotate(-25deg); }
  40%, 80% { transform: rotate(15deg); }
}
.avatar-anim-wave { animation: avatar-wave 1.2s ease-in-out 1; transform-origin: bottom center; }

@media (prefers-reduced-motion: reduce) {
  .avatar-anim-wave,
  .avatar-anim-float,
  .avatar-anim-shimmer { animation: none !important; }
}
```

- [ ] **Step 3: 视觉手测**

临时在 `src/app/help/page.tsx` 顶部加一行 `<XiaobangAvatar className="w-32 h-32" />`,打开 `/help` 看渲染、眨眼、问号浮动、星星闪烁是否到位。手测完移除临时代码。

- [ ] **Step 4: 提交**

```bash
git add src/components/help/launcher/xiaobang-avatar.tsx src/app/globals.css
git commit -m "feat(help): XiaobangAvatar SVG 头像 + wave 动画 (Phase 3.1)"
```

### Task 3.2:HelpLauncher 状态机

**Files:** Create `src/components/help/launcher/help-launcher.tsx`

- [ ] **Step 1: changelog-meta stub 文件 + .gitignore 排除**

**Files:** Create `src/lib/help/changelog-meta.ts`(临时占位,Phase 7 才被 build-help-meta.ts 覆盖), Modify `.gitignore`

```ts
// AUTO-GENERATED — do not edit. Will be overwritten by scripts/build-help-meta.ts.
export const LATEST_CHANGELOG_AT = 0;
export const LATEST_CHANGELOG_SLUG = "";
export const LATEST_CHANGELOG_TITLE = "";
```

`.gitignore` 追加(避免 `predev` 每次重写让 `git status` 反复闪 dirty):

```
# Help center auto-generated
src/lib/help/changelog-meta.ts
```

**例外**:首次 Phase 3.2 提交时,**不**排除这个文件而是先 commit 一个零值 stub,**之后**再加 .gitignore(同一次 commit),这样新克隆的开发者 `npm install` 后能直接编译,不必先跑 `predev`。具体:

```bash
# 顺序很重要
git add src/lib/help/changelog-meta.ts          # 先提交 stub
# 然后再加 .gitignore 排除它
echo "src/lib/help/changelog-meta.ts" >> .gitignore
git rm --cached src/lib/help/changelog-meta.ts  # 取消追踪
git add .gitignore
# 此时 src/lib/help/changelog-meta.ts 文件还在,只是不再追踪
```

但这么做有微妙的问题:新克隆的人没这个文件会 tsc 失败。**最简方案**:**保留文件被 git 追踪**,接受 `predev` 偶尔会让它变 dirty(开发者可以习惯性 `git checkout` 这一个文件,或者在 commit 时主动跳过)。本 plan 采用最简方案,**不**改 .gitignore。

- [ ] **Step 2: HelpLauncher 实现(参考 spec §4.2~§4.4)**

参考 spec 内 §4.2 完整状态机 + §4.3 挂载示例 + §4.4 快捷键示例 + §4.6 节流。

关键点:
- `usePathname()` 判断 `startsWith("/help")` 自动隐藏
- 五态:idle / hover / active / wave / first-tip
- wave 触发:30 秒鼠标无活动 + `sessionStorage.help-wave-count < 3` + `sessionStorage.help-wave-last-at` 5 分钟前
- first-tip:`localStorage.help-launcher-first-tip-shown` 未设 → 5 秒后弹气泡 3 秒后收起
- 红点 badge:`localStorage.help-changelog-last-seen < LATEST_CHANGELOG_AT`
- `?` 快捷键全局监听
- `prefers-reduced-motion` 关闭花哨动画
- 移动端 < 768px:`bottom-4 left-4 w-12 h-12`

- [ ] **Step 3: dashboard-shell 集成**

**Files:** Modify `src/components/layout/dashboard-shell.tsx:77`

```tsx
// 在 </ChatLauncher /> 之后追加
<HelpLauncher />
```

import 加 `import { HelpLauncher } from "@/components/help/launcher/help-launcher";`。

- [ ] **Step 4: 浏览器手测(关键)**

`npm run dev`,在 dashboard 内验:
- 左下角看到小帮,呼吸眨眼
- hover 弹气泡"需要帮助吗? 按 ? 打开"
- 点击跳 `/help`
- 在 `/help` 内小帮自动消失
- 清空 localStorage 重进 dashboard,5 秒后弹 first-tip
- 不动鼠标 30 秒触发招手
- 按 `?` 跳 `/help`;在 input 里按 `?` 不触发
- 改 LATEST_CHANGELOG_AT 为未来时间,看红点是否出现

- [ ] **Step 5: tsc + 提交**

```bash
npx tsc --noEmit
git add src/components/help/launcher/help-launcher.tsx src/lib/help/changelog-meta.ts src/components/layout/dashboard-shell.tsx
git commit -m "feat(help): HelpLauncher 浮动入口 — 5 态 + 红点 + ? 快捷键 (Phase 3.2)"
```

---

## Phase 4:分类页 + 详情页骨架

**目标**:分类页能列出分类下文档,详情页能渲染**纯 markdown body**(MDX 自定义组件 Phase 5 才加)。三栏 + TOC + 反馈 + 上/下一篇都到位,但反馈按钮目前只是 UI(Phase 8 接 server action)。

### Task 4.1:分类页

**Files:** Create
- `src/app/help/[category]/page.tsx`
- `src/components/help/category/category-hero.tsx`
- `src/components/help/category/doc-list.tsx`

- [ ] **Step 1: 实现页面 + 两个组件(参考 spec §6.2)**

```tsx
// src/app/help/[category]/page.tsx
import { notFound } from "next/navigation";
import { listDocsByCategory, getCategoryMeta, listAllDocs } from "@/lib/help/content";
import { HELP_CATEGORY_SLUGS } from "@/lib/help/types";
import { CategoryHero } from "@/components/help/category/category-hero";
import { DocList } from "@/components/help/category/doc-list";

export const dynamic = "force-static";

export async function generateStaticParams() {
  return HELP_CATEGORY_SLUGS.map((category) => ({ category }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  if (!HELP_CATEGORY_SLUGS.includes(category as any)) return {};
  const meta = await getCategoryMeta(category as any);
  return { title: meta.title, description: meta.description };
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  if (!HELP_CATEGORY_SLUGS.includes(category as any)) notFound();
  const meta = await getCategoryMeta(category as any);
  const docs = await listDocsByCategory(category as any);
  return (
    <div className="max-w-5xl mx-auto px-4">
      <Breadcrumb segments={[{ label: "帮助中心", href: "/help" }, { label: meta.title }]} />
      <CategoryHero meta={meta} docCount={docs.length} />
      <DocList category={category as any} meta={meta} docs={docs} />
    </div>
  );
}
```

`CategoryHero`:大图标 + 标题 + 描述 + 📄 N 篇 + 🕐 最近更新。
`DocList`:按 `meta.groups` 排序成分组列表,每行 `<Link>` 跳详情页 + 标题 + 描述 + 阅读时长(从 frontmatter description 取 + 没有阅读时长就省略,精确阅读时长是详情页才算)。

- [ ] **Step 2: Breadcrumb 共享组件**

**Files:** Create `src/components/help/doc/doc-breadcrumb.tsx`(导出名 `Breadcrumb`,详情页也用)

简单 nav + `<Link>` 链 + `/` 分隔。

- [ ] **Step 3: 提交**

```bash
npx tsc --noEmit
git add src/app/help/[category] src/components/help/category src/components/help/doc/doc-breadcrumb.tsx
git commit -m "feat(help): 分类页 — CategoryHero + DocList + Breadcrumb (Phase 4.1)"
```

### Task 4.2:详情页 — 骨架(无 MDX)

**Files:** Create
- `src/app/help/[category]/[slug]/page.tsx`
- `src/components/help/doc/doc-layout.tsx` (三栏 wrapper)
- `src/components/help/doc/doc-sidebar.tsx` (左目录树)
- `src/components/help/doc/doc-toc.tsx` (右锚点 TOC)
- `src/components/help/doc/doc-feedback.tsx` (底部 👍/👎)
- `src/components/help/doc/doc-pagination.tsx` (上/下一篇)

- [ ] **Step 1: 页面外壳 — 暂用 `<pre>{doc.body}</pre>` 占位渲染**

```tsx
// src/app/help/[category]/[slug]/page.tsx
import { notFound } from "next/navigation";
import { getDocBySlug, listAllDocs, getCategoryMeta } from "@/lib/help/content";
import { HELP_CATEGORY_SLUGS } from "@/lib/help/types";
import { DocLayout } from "@/components/help/doc/doc-layout";

export const dynamic = "force-static";

export async function generateStaticParams() {
  const docs = await listAllDocs();
  return docs.map((d) => ({ category: d.category, slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string; slug: string }> }) {
  const { category, slug } = await params;
  if (!HELP_CATEGORY_SLUGS.includes(category as any)) return {};
  const doc = await getDocBySlug(category as any, slug);
  if (!doc) return {};
  return { title: doc.frontmatter.title, description: doc.frontmatter.description };
}

export default async function DocPage({ params }: { params: Promise<{ category: string; slug: string }> }) {
  const { category, slug } = await params;
  if (!HELP_CATEGORY_SLUGS.includes(category as any)) notFound();
  const doc = await getDocBySlug(category as any, slug);
  if (!doc) notFound();
  const meta = await getCategoryMeta(category as any);
  return (
    <DocLayout category={category as any} meta={meta} doc={doc}>
      {/* Phase 5 替换为 <MDXRemote source={doc.body} /> */}
      <pre className="whitespace-pre-wrap text-sm">{doc.body}</pre>
    </DocLayout>
  );
}
```

- [ ] **Step 2: DocLayout 三栏**

`DocLayout` 接收 `category` / `meta` / `doc` / `children`:

```tsx
const hasToc = doc.toc.length > 0 && doc.frontmatter.toc !== false;
const gridCols = hasToc
  ? "lg:grid-cols-[240px_minmax(0,1fr)_240px]"   // 三栏
  : "lg:grid-cols-[240px_minmax(0,1fr)]";        // 无 TOC 时两栏,右侧不留空白

return (
  <div className={`max-w-7xl mx-auto px-4 grid gap-8 grid-cols-1 ${gridCols} py-8`}>
    <aside className="sticky top-14 h-[calc(100svh-3.5rem)] overflow-y-auto"><DocSidebar … /></aside>
    <article className={hasToc ? "max-w-3xl" : "max-w-4xl"}>
      <Breadcrumb … />
      <h1>{doc.frontmatter.title}</h1>
      <div className="text-xs text-muted-foreground">阅读时长 {doc.readingTime} · 更新 {doc.frontmatter.updatedAt ?? doc.frontmatter.publishedAt}</div>
      {children}
      <DocFeedback docPath={`${category}/${doc.slug}`} />
      <DocPagination category={category} meta={meta} currentSlug={doc.slug} />
    </article>
    {hasToc && (
      <aside className="hidden lg:block sticky top-14 h-[calc(100svh-3.5rem)] overflow-y-auto"><DocToc entries={doc.toc} /></aside>
    )}
  </div>
);
```

短文档(无 TOC)右栏隐藏,中栏样式可扩到 `max-w-4xl`(MVP 不强求,后期 polish)。

- [ ] **Step 3: DocSidebar 左目录树**

按 `meta.groups` 渲染:[Group 标题] → 文档链接列表,高亮当前页(基于 pathname 匹配)。

- [ ] **Step 4: DocToc 右栏锚点**

Client component,接收 `entries: TocEntry[]`,用 `IntersectionObserver` 监听对应 `#id` 的 H2/H3 元素,滚动时高亮当前项。点击平滑滚动到锚点。

- [ ] **Step 5: DocFeedback(纯 UI)**

```tsx
"use client";
const [vote, setVote] = useState<"up" | "down" | null>(null);
// Phase 8 才接 server action;现在点击只本地 setState + alert("感谢反馈")
```

- [ ] **Step 6: DocPagination 上/下一篇**

根据 `meta.groups` 把所有 docs 按出现顺序 flatten,找当前 slug 的前后两位。

- [ ] **Step 7: 浏览器验**

需要先有内容才能验。临时手写一个 fixture:在 `content/help/workflows/start.mdx` 放一个简单 mdx(title + 两个 H2 + 段落)和 `content/help/workflows/_meta.json`。打开 `/help/workflows/start`:
- 三栏布局生效
- 左栏目录显示
- 右栏 TOC 显示两个 H2
- 中栏 `<pre>` 显示 markdown 原文(预期,Phase 5 后才是 HTML)
- 反馈按钮可点

手测完保留这两个 fixture 文件(后面 Phase 5 / Phase 10 还会用到/扩充)。

**⚠ 重要:同步创建 `content/help/workflows/concepts.mdx` 占位文件**(只需 frontmatter + 一行正文),原因:Phase 5.2 的 demo 内容会引用 `<DocLink href="/help/workflows/concepts">`,Phase 9 的 verify-help-links 加入 build 后,如果 concepts.mdx 还没创建会导致中间任何 phase 的 `npm run build` 都挂。Phase 10 时再正式补充内容。

```mdx
---
title: 工作流概念
description: 占位文档,Phase 10 补充
category: workflows
publishedAt: 2026-05-31
---

## 概念

(待补充)
```

- [ ] **Step 8: tsc + 提交**

```bash
npx tsc --noEmit
git add src/app/help/[category]/[slug] src/components/help/doc content/help/workflows
git commit -m "feat(help): 详情页骨架 — 三栏 + TOC + 反馈 UI + 上下页 (Phase 4.2)"
```

---

## Phase 5:MDX 管道 + 自定义组件

**目标**:详情页的 `<pre>` 占位换成真正的 MDX 渲染,8 个自定义组件全部就位。代码块走构建期 Shiki 高亮(含 diff)。

### Task 5.1:核心 MDX 组件

**Files:** Create
- `src/components/help/mdx/callout.tsx`
- `src/components/help/mdx/steps.tsx`
- `src/components/help/mdx/screenshot-zoom.tsx`
- `src/components/help/mdx/video-embed.tsx`
- `src/components/help/mdx/employee-badge.tsx`
- `src/components/help/mdx/keyboard-key.tsx`
- `src/components/help/mdx/doc-link.tsx`
- `src/components/help/mdx/tabs.tsx`(薄薄的 wrapper,内部用 `@/components/ui/tabs`)
- `src/components/help/mdx/index.ts`(导出 `mdxComponents` 对象,含上述 8 个 + 标准 HTML 重写)

- [ ] **Step 1: 8 个组件实现(参考 spec §7.3)**

每个组件实现要点:
- **Callout**:`type: "tip"|"warn"|"note"|"info"`,4 色变体(蓝/橙/灰/紫),左竖条 + icon(Info/AlertTriangle/Pencil/Sparkles)+ 内容
- **Steps**:`<ol>` 包裹,自动给 `<li>` 加左侧时间线(竖线 + 圆点 + 序号),用 `[counter-reset:step] [&_li]:[counter-increment:step]` 实现编号
- **ScreenshotZoom**:`<img>` + click 弹 `<Dialog>` 全屏
- **VideoEmbed**:16:9 wrapper + `<iframe loading="lazy">`
- **EmployeeBadge**:接 `id: EmployeeId`,从 `EMPLOYEE_META` 取数据,渲染 SVG 头像 + 名字 + 1 行职责
- **KeyboardKey**:行内 kbd 灰底圆角
- **DocLink**:`<Link>` + 右侧小箭头,目标存在校验由 Phase 9 的 verify 脚本做
- **Tabs**:`items: Array<{ label, content }>`,内部 `Tabs/TabsList/TabsTrigger/TabsContent`

- [ ] **Step 2: mdxComponents 索引文件**

```tsx
// src/components/help/mdx/index.ts
import { Callout } from "./callout";
import { Steps } from "./steps";
import { ScreenshotZoom } from "./screenshot-zoom";
import { VideoEmbed } from "./video-embed";
import { EmployeeBadge } from "./employee-badge";
import { KeyboardKey } from "./keyboard-key";
import { DocLink } from "./doc-link";
import { Tabs as MdxTabs } from "./tabs";
import Image from "next/image";
import Link from "next/link";

// 标准 HTML 元素重写(prose 风格)
const StandardElements = {
  h1: (p: any) => <h1 className="text-3xl font-bold mt-12 mb-4 scroll-mt-20" {...p} />,
  h2: (p: any) => <h2 className="text-2xl font-semibold mt-10 mb-3 scroll-mt-20" {...p} />,
  h3: (p: any) => <h3 className="text-xl font-semibold mt-8 mb-2 scroll-mt-20" {...p} />,
  p: (p: any) => <p className="my-4 leading-7 text-foreground/90" {...p} />,
  ul: (p: any) => <ul className="my-4 ml-6 list-disc space-y-1" {...p} />,
  ol: (p: any) => <ol className="my-4 ml-6 list-decimal space-y-1" {...p} />,
  li: (p: any) => <li className="leading-7" {...p} />,
  blockquote: (p: any) => <blockquote className="my-4 border-l-4 border-border pl-4 italic text-muted-foreground" {...p} />,
  code: (p: any) => <code className="px-1.5 py-0.5 rounded bg-muted text-[0.9em] font-mono" {...p} />,
  pre: (p: any) => <pre className="my-4 rounded-lg overflow-x-auto text-sm" {...p} />,  // shiki 已加 token 颜色
  table: (p: any) => <div className="my-6 overflow-x-auto"><table className="w-full border-collapse" {...p} /></div>,
  th: (p: any) => <th className="border border-border bg-muted/40 px-3 py-1.5 text-left text-sm font-semibold" {...p} />,
  td: (p: any) => <td className="border border-border px-3 py-1.5 text-sm" {...p} />,
  img: (p: any) => <Image className="my-6 rounded-lg" loading="lazy" {...p} />,
  a: ({ href, ...rest }: any) => {
    // 内链判定:必须以 "/" 或 "#" 开头,但排除 protocol-relative "//cdn.x" 这种伪内链
    const isInternal = href && (
      (href.startsWith("/") && !href.startsWith("//")) || href.startsWith("#")
    );
    if (isInternal) {
      return <Link href={href} className="text-primary underline-offset-2 hover:underline" {...rest} />;
    }
    return <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline" {...rest} />;
  },
};

export const mdxComponents = {
  ...StandardElements,
  Callout, Steps, ScreenshotZoom, VideoEmbed, EmployeeBadge,
  KeyboardKey, DocLink, Tabs: MdxTabs,
};
```

- [ ] **Step 3: 单元测试 — 4 个最关键的组件做 smoke test**

**Files:** Create `tests/unit/components/help/mdx.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Callout } from "@/components/help/mdx/callout";
import { Steps } from "@/components/help/mdx/steps";
import { KeyboardKey } from "@/components/help/mdx/keyboard-key";
import { DocLink } from "@/components/help/mdx/doc-link";

describe("MDX components smoke", () => {
  it("Callout 4 个 type 都渲染不报错", () => {
    ["tip", "warn", "note", "info"].forEach((t) => {
      const { container } = render(<Callout type={t as any}>x</Callout>);
      expect(container.textContent).toContain("x");
    });
  });
  it("Steps 渲染序号", () => {
    const { container } = render(<Steps><ol><li>a</li><li>b</li></ol></Steps>);
    expect(container.textContent).toContain("a");
    expect(container.textContent).toContain("b");
  });
  it("KeyboardKey 渲染文本", () => {
    const { container } = render(<KeyboardKey>Cmd+K</KeyboardKey>);
    expect(container.textContent).toBe("Cmd+K");
  });
  it("DocLink 输出 next/link", () => {
    const { container } = render(<DocLink href="/help/x">link</DocLink>);
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/help/x");
  });
});
```

- [ ] **Step 4: 跑测试**

```bash
npx vitest run tests/unit/components/help/mdx.test.tsx
```

Expected: 4 passed.

- [ ] **Step 5: 提交**

```bash
git add src/components/help/mdx tests/unit/components/help/mdx.test.tsx
git commit -m "feat(help): 8 个 MDX 自定义组件 + 标准元素重写 (Phase 5.1)"
```

### Task 5.2:next-mdx-remote-client RSC 接入

**Files:** Modify `src/app/help/[category]/[slug]/page.tsx`

- [ ] **Step 1: 替换 `<pre>` 占位为 `<MDXRemote>`(参考 spec §7.2)**

```tsx
import { MDXRemote } from "next-mdx-remote-client/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeShiki from "@shikijs/rehype";
import { transformerNotationDiff } from "@shikijs/transformers";
import { mdxComponents } from "@/components/help/mdx";

// 在 DocLayout 内部:
<MDXRemote
  source={doc.body}
  components={mdxComponents}
  options={{
    mdxOptions: {
      remarkPlugins: [remarkGfm],
      rehypePlugins: [
        [rehypeShiki, {
          themes: { light: "github-light", dark: "github-dark-dimmed" },
          transformers: [transformerNotationDiff()],
        }],
        rehypeSlug,
        [rehypeAutolinkHeadings, { behavior: "wrap" }],
      ],
    },
  }}
/>
```

注意:**TOC remark plugin 不放在这里**,因为 `<MDXRemote>` 不透传 vfile.data;TOC 已经在 `getDocBySlug` 内单独 pipeline 抽出来了。

- [ ] **Step 2: 浏览器验**

在 `content/help/workflows/start.mdx` 里增强测试内容:

```mdx
---
title: 第一个工作流
description: 5 分钟跑通最简单的工作流
category: workflows
publishedAt: 2026-05-31
popular: true
---

## 概述

这是一段普通文本。带 *斜体* 和 **加粗**。

## 创建模板

<Callout type="tip">小提示:先选模板再配参数。</Callout>

```ts
function hello() {
  return "world"; // [!code ++]
}
```

<Steps>
1. 选择类型
2. 配置节点
3. 保存
</Steps>

参考 <DocLink href="/help/workflows/concepts">工作流概念</DocLink>。

按 <KeyboardKey>Cmd+S</KeyboardKey> 保存。

<EmployeeBadge id="xiaolei" />
```

打开 `/help/workflows/start`:
- markdown 渲染成 HTML 段落 / 标题
- Callout 蓝色变体显示
- 代码块有 Shiki 颜色,`// [!code ++]` 行有绿色背景(diff 标记)
- Steps 自动编号
- DocLink 蓝色带箭头
- KeyboardKey 灰底圆角
- EmployeeBadge 显示小雷头像

- [ ] **Step 3: tsc + build 全流程**

```bash
npx tsc --noEmit
npm run build
```

Expected: build 通过,产物 `.next/server/app/help/workflows/start.html` 存在。

- [ ] **Step 4: 提交**

```bash
git add src/app/help/[category]/[slug]/page.tsx content/help/workflows/start.mdx
git commit -m "feat(help): next-mdx-remote-client 接入详情页 + Shiki diff 高亮 (Phase 5.2)"
```

---

## Phase 6:Pagefind 搜索

**目标**:`/help/search` 和 Cmd+K 都能用,中文短词("工作流")能搜到内容。

### Task 6.1:Postbuild 索引脚本

**Files:** Create `scripts/build-help-search.ts`, Modify `package.json`

- [ ] **Step 1: 写脚本(参考 spec §8.1)**

```ts
// scripts/build-help-search.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createIndex } from "pagefind";
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
```

- [ ] **Step 2: 改 package.json scripts**

```json
{
  "scripts": {
    "build": "next build && tsx scripts/build-help-search.ts",
    "build:help-search": "tsx scripts/build-help-search.ts"
  }
}
```

(`predev` / `prebuild` 留给 Phase 7 的 build-help-meta 用,不在这一步加。)

- [ ] **Step 3: 跑一次 build 验证**

```bash
npm run build
```

Expected:
- `next build` 通过
- 脚本输出 "✓ pagefind index built"
- `public/pagefind/` 目录存在,含 `pagefind.js`、`pagefind-ui.js`、各种 `*.pf_*` 二进制文件

- [ ] **Step 4: 提交**

```bash
git add scripts/build-help-search.ts package.json package-lock.json
git commit -m "feat(help): postbuild pagefind 索引构建脚本 (Phase 6.1)"
```

### Task 6.2:客户端搜索调用层 + SearchDialog

**Files:** Create
- `src/lib/help/search-client.ts`
- `src/components/help/layout/search-dialog.tsx`

Modify `src/components/help/layout/help-header.tsx`(把搜索 trigger 接到 SearchDialog)

- [ ] **Step 1: search-client.ts(参考 spec §8.2)**

完整代码已在 spec 内。注意 `import(/* webpackIgnore: true */ "/pagefind/pagefind.js" as any)`,Next.js 不打包它,运行时从 `public/pagefind/` fetch。

- [ ] **Step 2: SearchDialog(参考 spec §8.3 + CLAUDE.md "Dialog 内可滚动列表用 h-X 不用 max-h-X")**

```tsx
"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { searchHelp, type PagefindResult } from "@/lib/help/search-client";

const HOT_TERMS = ["第一个工作流", "AI 员工技能", "CMS 接入", "全渠道发布"];

export function SearchDialog({ open, onOpenChange, children }: any) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PagefindResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try { setResults(await searchHelp(query, 8)); } finally { setLoading(false); }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  // 上下箭头切换,Enter 跳转,Esc 关闭
  // ...

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
      <DialogContent className="max-w-2xl p-0">
        <div className="border-b p-3 flex items-center gap-2">
          <Search size={16} className="text-muted-foreground" />
          {/* 用 shadcn Input 而非裸 <input>,符合 CLAUDE.md 设计系统 */}
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索文档…"
            className="flex-1 border-0 bg-transparent text-sm h-7 px-0 focus-visible:ring-0"
          />
        </div>
        {/* 固定高度,避免抖动 — CLAUDE.md 纪律 */}
        <div className="h-[400px] overflow-y-auto">
          {!query.trim() ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              <span>试试搜:</span>
              <div className="flex gap-2 flex-wrap justify-center">
                {HOT_TERMS.map((t) => (
                  // 用 Button 而非裸 button(CLAUDE.md 设计系统纪律 + eslint no-restricted-syntax)
                  <Button key={t} variant="secondary" size="sm" onClick={() => setQuery(t)} className="h-7 px-3 rounded-full text-xs">
                    {t}
                  </Button>
                ))}
              </div>
            </div>
          ) : loading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">正在搜索…</div>
          ) : results.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">没有找到结果</div>
          ) : (
            <ul>
              {results.map((r, i) => (
                <li
                  key={r.url}
                  onClick={() => { router.push(r.url); onOpenChange(false); }}
                  className={`px-4 py-3 cursor-pointer border-b last:border-b-0 ${i === selectedIdx ? "bg-muted" : ""}`}
                >
                  <div className="font-medium text-sm">{r.meta.title}</div>
                  <div className="text-xs text-muted-foreground mt-1" dangerouslySetInnerHTML={{ __html: r.excerpt }} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: 接到 HelpHeader**

`HelpHeader` 增加 `const [searchOpen, setSearchOpen] = useState(false);`,搜索 trigger button 改成 `onClick={() => setSearchOpen(true)}`,顶层加 `<SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />`。Cmd+K 全局监听同上,统一在 HelpHeader 内做(避免每页都 mount)。

- [ ] **Step 4: 浏览器验**

```bash
npm run dev
```

打开 `/help`,Cmd+K 打开 dialog。输入"工作流",应该能搜到 `content/help/workflows/start.mdx`(前提是 build 过一次)。

注意:**dev 模式下 `.next/server/app/help` 不会有 prebuilt HTML**(那是 next build 才有的),所以 dev 模式 pagefind 默认搜不到。两种处理:
- (a) 先 `npm run build` 再 `npm run dev`(dev 会复用部分 build 产物,但 pagefind 索引能用)
- (b) dev 模式跳过 pagefind,SearchDialog 显示提示

实践:**search-client.ts 内 catch 错误后返回 [],SearchDialog 显示"没有找到结果"**;运维上 README 写明 dev 模式搜索不可用是预期。

- [ ] **Step 5: tsc + 提交**

```bash
npx tsc --noEmit
git add src/lib/help/search-client.ts src/components/help/layout/search-dialog.tsx src/components/help/layout/help-header.tsx
git commit -m "feat(help): SearchDialog + Cmd+K + 客户端 pagefind 调用 (Phase 6.2)"
```

### Task 6.3:`/help/search` 结果页

**Files:** Create `src/app/help/search/page.tsx`、`src/components/help/search/search-results.tsx`

- [ ] **Step 1: 页面**

```tsx
// src/app/help/search/page.tsx — client component, 因为 pagefind 在浏览器
"use client";
import { useSearchParams } from "next/navigation";
import { SearchResults } from "@/components/help/search/search-results";

export const dynamic = "force-static";   // 页面本身静态,客户端再水合

export default function SearchPage() {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">搜索结果</h1>
      <SearchResults initialQuery={q} />
    </div>
  );
}
```

- [ ] **Step 2: SearchResults 组件**

含搜索框 + 左侧分类 filter + 右侧结果列表 + "加载更多"分页 20/页 + 零结果兜底显示 3 篇推荐 popular doc。

简单 MVP 实现:不做分类 filter(可后期补),只列结果 + 高亮 + 跳转 + 零结果兜底。

- [ ] **Step 3: HeroSearch 提交跳 `/help/search?q=`**

`hero-search.tsx` form `onSubmit`:`router.push(\`/help/search?q=\${encodeURIComponent(query)}\`)`。

- [ ] **Step 4: 浏览器验**

`/help/search?q=工作流` 应该列出结果 + 高亮。

- [ ] **Step 5: tsc + 提交**

```bash
npx tsc --noEmit
git add src/app/help/search src/components/help/search src/components/help/home/hero-search.tsx
git commit -m "feat(help): /help/search 全量结果页 + Hero 跳转 (Phase 6.3)"
```

---

## Phase 7:FAQ + 更新日志

**目标**:`/help/faq` 用 accordion 展示 30-60 条 FAQ,`/help/changelog` 渲染 MDX 月度日志,build-help-meta 脚本生成 `LATEST_CHANGELOG_AT` 给小帮红点用。

### Task 7.1:FAQ 数据 + 渲染

**Files:** Create
- `content/help/faq.json`(spec §9.1 格式,至少 5 条 demo)
- `src/lib/help/faq.ts`(zod schema + 加载函数)
- `src/app/help/faq/page.tsx`
- `src/components/help/faq/faq-accordion.tsx`

- [ ] **Step 1: faq.json zod schema(`src/lib/help/faq.ts`)**

```ts
import { z } from "zod";
import path from "node:path";
import fs from "node:fs/promises";
import { cache } from "react";

export const FaqCategorySchema = z.object({ id: z.string(), name: z.string() });
export const FaqItemSchema = z.object({
  id: z.string(),
  category: z.string(),
  question: z.string().min(1),
  answer: z.string().min(1),
  relatedDocs: z.array(z.string()).optional(),
  popular: z.boolean().optional(),
  updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export const FaqFileSchema = z.object({
  categories: z.array(FaqCategorySchema),
  items: z.array(FaqItemSchema),
});
export type FaqItem = z.infer<typeof FaqItemSchema>;
export type FaqFile = z.infer<typeof FaqFileSchema>;

const FAQ_PATH = path.join(
  process.env.HELP_CONTENT_ROOT ?? path.join(process.cwd(), "content/help"),
  "faq.json",
);

export const loadFaq = cache(async (): Promise<FaqFile> => {
  const raw = await fs.readFile(FAQ_PATH, "utf-8");
  return FaqFileSchema.parse(JSON.parse(raw));
});
```

- [ ] **Step 2: FaqAccordion 组件**

```tsx
"use client";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { SearchInput } from "@/components/shared/search-input";
import Fuse from "fuse.js";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import type { FaqFile } from "@/lib/help/faq";

export function FaqAccordion({ data }: { data: FaqFile }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [openItems, setOpenItems] = useState<string[]>([]);
  const fuse = useMemo(() => new Fuse(data.items, { keys: ["question", "answer"], threshold: 0.4 }), [data]);
  const filtered = q.trim() ? fuse.search(q).map((r) => r.item) : data.items;
  const visible = cat === "all" ? filtered : filtered.filter((i) => i.category === cat);

  // URL hash → 默认展开 + 滚动到该项
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && data.items.some((i) => i.id === hash)) {
      setOpenItems([hash]);
      // 等渲染完再滚动
      setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }, [data.items]);
  return (
    <div>
      <SearchInput placeholder="搜索常见问题…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-6" />
      <Tabs value={cat} onValueChange={setCat} variant="line">
        <TabsList>
          <TabsTrigger value="all">全部</TabsTrigger>
          {data.categories.map((c) => <TabsTrigger key={c.id} value={c.id}>{c.name}</TabsTrigger>)}
        </TabsList>
      </Tabs>
      {/* URL hash 锚点:进入页面时读 #wf-001 → 默认展开命中项 */}
      <Accordion type="multiple" className="mt-6" value={openItems} onValueChange={setOpenItems}>
        {visible.map((item) => (
          // 外包 div 真正承载 DOM id(Radix AccordionItem 的 id prop 不会透传到 DOM)
          <div key={item.id} id={item.id} className="scroll-mt-20">
            <AccordionItem value={item.id}>
              <AccordionTrigger>
                {item.question}
                {item.popular && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">热门</span>}
              </AccordionTrigger>
              <AccordionContent>
                <ReactMarkdown>{item.answer}</ReactMarkdown>
                {item.relatedDocs && item.relatedDocs.length > 0 && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    相关文档:{item.relatedDocs.map((d) => <Link key={d} href={d} className="text-primary mr-3">{d}</Link>)}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </div>
        ))}
      </Accordion>
    </div>
  );
}
```

- [ ] **Step 3: 页面**

```tsx
// src/app/help/faq/page.tsx
import { loadFaq } from "@/lib/help/faq";
import { FaqAccordion } from "@/components/help/faq/faq-accordion";

export const dynamic = "force-static";
export const metadata = { title: "常见问题", description: "Vibe Media 平台常见问题与解答" };

export default async function FaqPage() {
  const data = await loadFaq();
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">常见问题</h1>
      <p className="text-muted-foreground mb-8">找不到你要的?试试 <Link href="/help/search" className="text-primary">全文搜索</Link>。</p>
      <FaqAccordion data={data} />
    </div>
  );
}
```

- [ ] **Step 4: 写 5 条 demo faq.json**

```json
{
  "categories": [
    { "id": "workflow", "name": "工作流" },
    { "id": "employee", "name": "AI 员工" },
    { "id": "billing", "name": "账户与权限" }
  ],
  "items": [
    {
      "id": "wf-001",
      "category": "workflow",
      "question": "工作流跑到一半失败了,数据会回滚吗?",
      "answer": "默认不会自动回滚。失败的 step 状态变为 `failed`,后续依赖步骤变为 `skipped`,你需要在任务详情页手动修复后重试。",
      "popular": true,
      "updatedAt": "2026-05-31"
    }
    // ...4 more
  ]
}
```

- [ ] **Step 5: 浏览器验**

`/help/faq`,分类 tab 切换、搜索过滤、accordion 展开都正常。

- [ ] **Step 6: tsc + 提交**

```bash
npx tsc --noEmit
git add src/lib/help/faq.ts src/app/help/faq src/components/help/faq content/help/faq.json
git commit -m "feat(help): FAQ accordion + Fuse 搜索 + tab 分类 (Phase 7.1)"
```

### Task 7.2:更新日志 + build-help-meta

**Files:** Create
- `content/help/changelog/2026-05.mdx`
- `scripts/build-help-meta.ts`
- `src/app/help/changelog/page.tsx`
- `src/components/help/changelog/changelog-month.tsx`
- `src/lib/help/changelog.ts`

Modify `package.json`(加 `prebuild` / `predev`)

- [ ] **Step 1: build-help-meta 脚本(参考 spec §10.3)**

完整代码已在 spec 内。读 `content/help/changelog/*.mdx` 的 frontmatter,生成 `src/lib/help/changelog-meta.ts`。

- [ ] **Step 2: package.json 加 prebuild / predev**

```json
{
  "scripts": {
    "predev": "tsx scripts/build-help-meta.ts",
    "prebuild": "tsx scripts/build-help-meta.ts"
  }
}
```

(注意:`build` 已经是 `next build && tsx scripts/build-help-search.ts`,prebuild 在它之前自动运行。)

- [ ] **Step 3: changelog 加载层**

```ts
// src/lib/help/changelog.ts
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";
import { cache } from "react";

const ChangelogFrontmatterSchema = z.object({
  title: z.string(),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  version: z.string(),
  summary: z.string(),
});
export type ChangelogFrontmatter = z.infer<typeof ChangelogFrontmatterSchema>;

const CHANGELOG_DIR = path.join(
  process.env.HELP_CONTENT_ROOT ?? path.join(process.cwd(), "content/help"),
  "changelog",
);

export const listChangelogEntries = cache(async () => {
  const files = await fs.readdir(CHANGELOG_DIR);
  const entries = await Promise.all(
    files.filter((f) => f.endsWith(".mdx")).map(async (f) => {
      const slug = f.replace(/\.mdx$/, "");
      const raw = await fs.readFile(path.join(CHANGELOG_DIR, f), "utf-8");
      const { data, content } = matter(raw);
      const fm = ChangelogFrontmatterSchema.parse(data);
      return { slug, frontmatter: fm, body: content };
    }),
  );
  return entries.sort((a, b) => b.frontmatter.publishedAt.localeCompare(a.frontmatter.publishedAt));
});
```

- [ ] **Step 4: changelog page**

```tsx
// src/app/help/changelog/page.tsx
"use client";  // 因为要写 localStorage
// 实际:把 useEffect 拆到 ChangelogPageClient 子组件,page 本身可以是 server 渲染条目列表
```

实际拆分:`page.tsx`(server,加载条目)+ `ChangelogClient`(client,装条目 + useEffect 写 last-seen)。

- [ ] **Step 5: ChangelogMonth 组件**

每条月度日志:`<details>` 折叠(默认展开最近 3 个月),内容用 `<MDXRemote>` 渲染。

- [ ] **Step 6: 写 1 篇 demo changelog**

`content/help/changelog/2026-05.mdx` — 内容如 spec §10.1。

- [ ] **Step 7: 浏览器验**

`/help/changelog`:
- 最新一篇默认展开
- 进入页面后 localStorage `help-changelog-last-seen` 被设置
- 回到 dashboard,HelpLauncher 红点消失

- [ ] **Step 8: tsc + 提交**

```bash
npm run build  # 触发 build-help-meta 生成 changelog-meta.ts
npx tsc --noEmit
git add scripts/build-help-meta.ts src/lib/help/changelog.ts src/lib/help/changelog-meta.ts src/app/help/changelog src/components/help/changelog content/help/changelog package.json
git commit -m "feat(help): 更新日志渲染 + build-help-meta + 红点联动 (Phase 7.2)"
```

---

## Phase 8:反馈表

**目标**:详情页 👍/👎 落 PostgreSQL,有防滥用,有评论可选输入。

### Task 8.1:Drizzle schema + migration

**Files:** Create `src/db/schema/help-feedback.ts`, Modify `src/db/schema/index.ts`

- [ ] **Step 1: 写 schema(参考 spec §11.1)**

```ts
import { pgTable, uuid, text, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const helpFeedback = pgTable(
  "help_feedback",
  {
    id: uuid().primaryKey().defaultRandom(),
    docPath: text("doc_path").notNull(),
    helpful: boolean().notNull(),
    comment: text(),
    userAgent: text("user_agent"),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    docPathIdx: index("idx_help_feedback_doc").on(t.docPath),
    createdIdx: index("idx_help_feedback_created").on(t.createdAt),
  }),
);
```

- [ ] **Step 2: 在 `src/db/schema/index.ts` re-export**

```ts
export * from "./help-feedback";
```

- [ ] **Step 3: 生成 migration**

```bash
npm run db:generate
```

Expected: `supabase/migrations/NNNN_help_feedback.sql` 生成,同时 `_journal.json` + snapshot 更新。

- [ ] **Step 4: 应用 migration**

```bash
npm run db:migrate
```

Expected: DB 中 `help_feedback` 表存在。

- [ ] **Step 5: 提交**

```bash
git add src/db/schema/help-feedback.ts src/db/schema/index.ts supabase/migrations
git commit -m "feat(help): help_feedback 表 + Drizzle migration (Phase 8.1)"
```

### Task 8.2:server action + DocFeedback 接入

**Files:** Create `src/app/actions/help-feedback.ts`(放在 server actions 标准目录,与项目其他 actions 一致), Modify `src/components/help/doc/doc-feedback.tsx`

- [ ] **Step 1: server action(参考 spec §11.2)— 文件第一行必须是 `"use server";`**

```ts
"use server";   // ⚠ 第一行必须是这个指令,缺了会让 DocFeedback (Client) import 时把 server 代码打进 client bundle
import { db } from "@/db";
import { helpFeedback } from "@/db/schema";
// ... 见 spec §11.2 完整代码
```

放到 `src/app/actions/help-feedback.ts` 而不是 `src/lib/help/feedback.ts`,与项目其他 server action(`src/app/actions/auth.ts`、`workflow-template-schedules.ts` 等)路径约定一致;`src/lib/help/` 只放纯逻辑/类型/数据加载,不放 server action。

**关于限流阈值**:`> 10 条/分钟/IP` 在多人共用 NAT 出口的企业环境下偏紧。**如果上线后运营反馈"内部用户提交被静默丢弃"**,可在 server action 内改成读环境变量:

```ts
const FEEDBACK_RATE_LIMIT = Number(process.env.HELP_FEEDBACK_RATE_LIMIT ?? "10");
if (count > FEEDBACK_RATE_LIMIT) return { ok: true };
```

`.env.local` 加 `HELP_FEEDBACK_RATE_LIMIT=100` 即可放宽。本 plan 默认硬编码 10,有需要时再补这个 env flag(不在 Phase 8 强制做)。

- [ ] **Step 2: 单元测试**

**Files:** Create `tests/unit/app/actions/help-feedback.test.ts`(测试路径与 action 位置对齐)

测试要 mock `db.insert` 和 `db.execute`。

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(() => ({ values: vi.fn(async () => {}) })),
    execute: vi.fn(async () => [{ count: 0 }]),
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (k: string) => k === "x-forwarded-for" ? "1.2.3.4" : "test-ua",
  }),
}));

describe("submitDocFeedback", () => {
  beforeEach(() => vi.clearAllMocks());
  it("接受合法输入并落表", async () => {
    const { submitDocFeedback } = await import("@/app/actions/help-feedback");
    const r = await submitDocFeedback({ docPath: "workflows/start", helpful: true });
    expect(r.ok).toBe(true);
  });
  it("拒绝空 docPath", async () => {
    const { submitDocFeedback } = await import("@/app/actions/help-feedback");
    const r = await submitDocFeedback({ docPath: "", helpful: true });
    expect(r.ok).toBe(false);
  });
  it("拒绝超长 comment", async () => {
    const { submitDocFeedback } = await import("@/app/actions/help-feedback");
    const r = await submitDocFeedback({ docPath: "x/y", helpful: true, comment: "a".repeat(501) });
    expect(r.ok).toBe(false);
  });
  it("1 分钟 > 10 条时静默假成功", async () => {
    const { submitDocFeedback } = await import("@/app/actions/help-feedback");
    const { db } = await import("@/db");
    (db.execute as any).mockResolvedValueOnce([{ count: 11 }]);
    const r = await submitDocFeedback({ docPath: "x/y", helpful: true });
    expect(r.ok).toBe(true);
    expect((db.insert as any)).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: DocFeedback 接 server action**

```tsx
"use client";
import { useState, useTransition } from "react";
import { submitDocFeedback } from "@/app/actions/help-feedback";   // 与 Task 8.2 Step 1 的 server action 路径保持一致
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function DocFeedback({ docPath }: { docPath: string }) {
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const submit = (helpful: boolean) => {
    setVote(helpful ? "up" : "down");
    startTransition(async () => {
      await submitDocFeedback({ docPath, helpful });
      // 不立即设 submitted,等用户写完评论再 commit
    });
  };
  const submitComment = () => {
    if (!comment.trim() || !vote) return;
    startTransition(async () => {
      await submitDocFeedback({ docPath, helpful: vote === "up", comment });
      setSubmitted(true);
    });
  };
  if (submitted) return <div className="my-12 text-center text-sm text-muted-foreground">感谢反馈,我们会持续改进。</div>;
  return (
    <div className="my-12 rounded-lg border border-border/60 p-6">
      <div className="text-sm font-medium mb-3">这篇文档对你有帮助吗?</div>
      <div className="flex gap-3">
        {/* 用 default / ghost 切换,避免 outline variant 自带边框(CLAUDE.md "按钮不要带边框") */}
        <Button variant={vote === "up" ? "default" : "ghost"} size="sm" onClick={() => submit(true)} disabled={isPending}>👍 有帮助</Button>
        <Button variant={vote === "down" ? "default" : "ghost"} size="sm" onClick={() => submit(false)} disabled={isPending}>👎 没帮助</Button>
      </div>
      {vote && (
        <div className="mt-4 space-y-3">
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="怎么改进?(可选,最多 500 字)" maxLength={500} />
          <Button size="sm" onClick={submitComment} disabled={isPending || !comment.trim()}>提交评论</Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 跑测试**

```bash
npx vitest run tests/unit/app/actions/help-feedback.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: 浏览器验**

在 `/help/workflows/start` 点 👍 → 看 DB:`select * from help_feedback`。

- [ ] **Step 6: tsc + 提交**

```bash
npx tsc --noEmit
git add src/app/actions/help-feedback.ts src/components/help/doc/doc-feedback.tsx tests/unit/app/actions/help-feedback.test.ts
git commit -m "feat(help): DocFeedback 接 server action 落表 + 防滥用 (Phase 8.2)"
```

---

## Phase 9:链路校验脚本

**目标**:构建期扫所有 `<DocLink href="/help/...">` 和 markdown `[text](/help/...)` 链接,目标必须存在;否则构建挂掉。

### Task 9.1:verify-help-links 脚本

**Files:** Create `scripts/verify-help-links.ts`, Modify `package.json`

- [ ] **Step 1: 写脚本**

```ts
// scripts/verify-help-links.ts
import fg from "fast-glob";
import fs from "node:fs/promises";
import path from "node:path";

const CONTENT_ROOT = path.join(process.cwd(), "content/help");

// 匹配两种写法:
//   <DocLink href="/help/..."> 或 <DocLink ... href={"/help/..."}>(JSX 可有多余属性 + 换行)
//   markdown link: [text](/help/...)
// 路径允许 1-3 段(/help/faq、/help/category、/help/category/slug、/help/category/slug#hash 等)
const HELP_LINK_RE = /(?:<DocLink\b[^>]*?\bhref=|\]\()["'{]?(\/help(?:\/[a-z0-9-]+){0,3})(?:#[^"')\s}]*)?["'\)\s}]/g;

async function getAllValidPaths() {
  const mdxFiles = await fg("*/**/*.mdx", { cwd: CONTENT_ROOT, ignore: ["**/changelog/**"] });
  const paths = new Set<string>();
  // 单文档路径
  for (const f of mdxFiles) {
    const parts = f.split(path.sep);
    const cat = parts[0];
    const slug = parts[parts.length - 1].replace(/\.mdx$/, "");
    paths.add(`/help/${cat}/${slug}`);
    paths.add(`/help/${cat}`);                    // 分类索引页本身也是合法目标
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
main();
```

- [ ] **Step 2: 接到 build**

```json
{
  "scripts": {
    "build": "tsx scripts/verify-help-links.ts && next build && tsx scripts/build-help-search.ts"
  }
}
```

(prebuild 留给 build-help-meta,verify 放 build 命令开头,失败立即挂。)

- [ ] **Step 3: 验**

```bash
npx tsx scripts/verify-help-links.ts
```

Expected: `✓ all help links resolve`(因为目前只有 1 篇 mdx + 它引用 `/help/workflows/concepts` 可能不存在,得修)。如果有 broken,加一个 `concepts.mdx` 兜底或者改 start.mdx 的引用。

- [ ] **Step 4: 提交**

```bash
git add scripts/verify-help-links.ts package.json
git commit -m "feat(help): verify-help-links 构建期校验 DocLink 目标 (Phase 9)"
```

---

## Phase 10:首批内容

**目标**:写够首批文档,让帮助中心"看起来真有内容"。

> **注**:这一阶段主要是写文字,代码工作量少。重点是把 8 个分类至少各填一个 `_meta.json` + 一篇文档,核心分类(getting-started / workflows / ai-employees)填得稍多。

### Task 10.1:8 个分类 _meta.json

**Files:** Create `content/help/<category>/_meta.json` × 8

每个分类 `_meta.json` 至少含 `title / description / icon / groups`。groups 内 docs 即使还没写也先列出来(后续 verify 脚本不会扫 _meta.json 里的 doc 引用,只扫 mdx 内 DocLink)。

### Task 10.2:首批 MDX(~ 10 篇)

**Files:** Create
- `content/help/getting-started/{overview,first-week-guide,login-register}.mdx`
- `content/help/workflows/{start,concepts,scheduling}.mdx`(`start`、`concepts` 已在 Phase 4 / 5 创建占位,此处扩充正文)
- `content/help/ai-employees/{intro,skills,memories}.mdx`
- `content/help/admin/{users-roles}.mdx`

每篇至少:title + description + popular(2-3 篇) + 3 个 H2 + 一段 demo callout / steps / employeebadge。

**⚠ Pagefind 中文搜索可验证性**:首批文档的**标题与第一段正文必须出现"工作流"、"AI 员工"、"CMS"、"采集"等核心中文关键词**(不要只把关键词埋在代码块里 — Phase 6.1 的 `excludeSelectors: ["pre"]` 让 `<pre>` 内容不进搜索索引)。这样 Cmd+K 搜索"工作流"时能立刻命中,Phase 11 手测才能跑通。

### Task 10.3:扩充 FAQ 到 20 条

**Files:** Modify `content/help/faq.json`

每个 category 至少 5 条问题。

### Task 10.4:验证 + 提交

- [ ] **Step 1: build 全过**

```bash
npm run build
```

Expected:
- verify-help-links 过
- next build 过
- pagefind 索引含 ~10 篇文档

- [ ] **Step 2: 浏览器手测**

- 首页 CategoryGrid 显示 8 张分类卡(每张文档数 ≥ 1)
- PopularDocs 显示 2-3 张卡(popular: true 的)
- 点进任意分类,DocList 渲染
- 详情页 MDX 自定义组件全显示
- Cmd+K 能搜到中文短词
- /help/faq 显示 20 条
- /help/changelog 显示 1 个月
- 小帮红点(localStorage 清掉后)+ wave + first-tip 都触发

- [ ] **Step 3: 提交**

```bash
git add content/help
git commit -m "feat(help): 首批 8 分类 _meta + 10 篇文档 + 20 条 FAQ (Phase 10)"
```

---

## Phase 11:整体验证 + 收尾

### Task 11.1:类型 + 测试 + 构建

- [ ] **Step 1: TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: 全量测试**

```bash
npm test
```

Expected: 所有 test 通过(预计本 plan 新增约 15-20 条测试)。

- [ ] **Step 3: 生产构建**

```bash
npm run build
```

Expected:
- verify-help-links ✓
- next build ✓
- pagefind ✓
- 产物 `.next/server/app/help/**/*.html` ~ 15-25 个
- `public/pagefind/` 含索引文件

### Task 11.2:可访问性

- [ ] **Step 1: 手测 axe**

项目目前没有 Playwright 测试设施,**不**装 `@axe-core/playwright` 避免半套基础设施。两种走法选一种:

- **(推荐)** Chrome / Edge 装 [axe DevTools 浏览器扩展](https://chrome.google.com/webstore/detail/axe-devtools-web-accessib/lhdoppojpmngadmnindnejefpokejbdd),打开 `/help`、`/help/workflows`、`/help/workflows/start` 各跑一次
- **(备选)** 全局装 `@axe-core/cli`:`npm install -g @axe-core/cli`,然后 `axe http://localhost:3000/help`

- [ ] **Step 2: 跑三页**

A 级 0 violation。常见命中:对比度不足、缺 aria-label、表单缺 label;按提示修。如果命中是 shadcn 原语自身的(罕见),不在本期修。

### Task 11.3:手测完整流程

- [ ] **Step 1: 键盘流程**

- 在 dashboard 任意页按 `?` → 跳 `/help`(focus 不在 input 时)
- 在 input 里按 `?` → 不跳(允许输入问号)
- Cmd+K 开 SearchDialog,输入"工作流",上下箭头切换,Enter 跳转,Esc 关闭

- [ ] **Step 2: 5 态浮动小人**

- 清 localStorage 重进 dashboard:5 秒后弹 first-tip,3 秒后收起
- idle:呼吸眨眼
- hover:气泡"需要帮助吗? 按 ? 打开"
- 不动鼠标 30 秒:招手
- 改 `LATEST_CHANGELOG_AT` 大于 `localStorage.help-changelog-last-seen`:红点显示;进 changelog 页:红点消失

- [ ] **Step 3: 反馈表落表**

`/help/workflows/start` 点 👍 + 写一段评论 + 提交;`select * from help_feedback` 看到落表。

- [ ] **Step 4: 暗色模式**

切到 dark mode,`/help` 全部页面无样式断裂(顶栏底栏背景、Shiki 代码块、accordion 背景、SearchDialog)。

- [ ] **Step 5: 移动端**

Chrome DevTools 设为 iPhone 14 Pro,验:
- 首页 CategoryGrid 单列堆叠
- 详情页三栏 → 单栏 + 顶部抽屉(左目录)+ 折叠 TOC
- HelpLauncher 缩到 48×48

- [ ] **Step 6: 未登录访问**

清 `vibetide-session` cookie,访问 `/help` → 直接打开(不跳 login);访问 `/missions` → 跳 `/login?next=/missions`(原行为保留)。

### Task 11.4:更新日志

- [ ] **Step 1: 给 2026-05.mdx 加一条**

在 `content/help/changelog/2026-05.mdx` 加一条 "新增帮助中心" 的条目(其实已经在 demo 里写了,这步检查/精修)。

- [ ] **Step 2: 提交**

```bash
git add content/help/changelog/2026-05.mdx
git commit -m "docs(changelog): 2026-05 加入帮助中心上线条目 (Phase 11.4)"
```

### Task 11.5:CLAUDE.md 文档化

- [ ] **Step 1: 在 CLAUDE.md 加一节"Help Center"概览**

简短一节(< 30 行),说明:
- 帮助中心位于 `/help`,公开访问
- 内容在 `content/help/`,frontmatter + zod 校验
- 走 next-mdx-remote-client RSC + pagefind 搜索
- 关键文件位置 + 反馈表 `help_feedback`
- 修文档怎么做(写 MDX,跑 npm run build 校验)

- [ ] **Step 2: 提交**

```bash
git add CLAUDE.md
git commit -m "docs(CLAUDE): 加入帮助中心模块概览 (Phase 11.5)"
```

---

## 完成判定

帮助中心被视为"完成"当且仅当:

- [x] `npx tsc --noEmit` 0 error
- [x] `npm test` 全绿
- [x] `npm run build` 通过(含 verify-help-links + build-help-meta + pagefind)
- [x] `/help`、`/help/[category]`、`/help/[category]/[slug]`、`/help/faq`、`/help/changelog`、`/help/search` 6 类路由都可访问
- [x] 小帮浮动入口 5 态 + 红点 + `?` 快捷键全部生效
- [x] 反馈表落 PostgreSQL,1 分钟限流验证
- [x] 公开访问(未登录可看)+ 已登录"返回平台"按钮可用
- [x] axe-core A 级零 violation
- [x] 移动端单栏堆叠无断裂
- [x] 暗色模式无样式断裂
- [x] pagefind 中文搜索可用
- [x] CLAUDE.md 加入模块概览章节

---

## 风险与缓解(plan 阶段补充)

| 风险 | 缓解 |
|---|---|
| `next-mdx-remote-client` 与 Next.js 16.1.6 不兼容 | Phase 0 装完依赖立刻跑一次 `next build` 验证;不兼容则降级到 `@^0.x` 或换 `@next/mdx`(但需要重大调整,先尽量避免) |
| pagefind wasm 在国内 CDN 慢 | Vercel CDN 应该足够;实在不行可以把 `public/pagefind/` 提到自家 CDN |
| Drizzle migration 在远程 cloud DB 跑挂 | Phase 8 前先在本地 DB 跑 `db:generate` + `db:migrate`,确认无误再切到远程;cloud DB 跑 migrate 前先备份 |
| Shiki 主题增加 bundle | RSC 模式下 Shiki 完全在服务端跑,客户端零 JS |
| 招手动画在低端机抽帧 | CSS transform + opacity,GPU 加速;reduced-motion 全关 |
| 红点 LATEST_CHANGELOG_AT 在 dev 模式不更新 | 加 `predev` 钩子定期跑 build-help-meta;运营改 changelog 后重启 dev |

---

## 备注

- 本 plan **不**包含 `<= 100 行代码可独立完成的"微优化"**(比如 `<DocPagination>` 内的具体 CSS 渐变),交给执行者按 spec §6.3 风格自由发挥
- 写 MDX 内容时,遇到引用尚未存在的文档(`<DocLink href="/help/...">`),先写 placeholder TODO 占位,Phase 10 收尾时用 verify 脚本统一捞漏
- 反馈表的"运营后台 UI"(`/admin/help-feedback`)在本期 **out of scope**;直接 Drizzle Studio 看数据即可
