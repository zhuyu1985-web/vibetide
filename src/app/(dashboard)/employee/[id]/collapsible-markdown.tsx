"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/* ── Shared remark plugins ── */

export const remarkPlugins = [remarkGfm];

/* ── HAST text extraction (for detecting time-based lists) ── */

function extractNodeText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as Record<string, unknown>;
  if (n.type === "text" && typeof n.value === "string") return n.value;
  if (Array.isArray(n.children))
    return n.children.map(extractNodeText).join("");
  return "";
}

const TIME_RE =
  /^\s*\**(\d{4}[-年./]|\d{1,2}[月:：]\d|第[一二三四五六七八九十]|阶段[一二三四五六七八九十\d])/;

const BLOCK_TAGS = new Set([
  "p", "ul", "ol", "blockquote", "table", "pre",
  "h1", "h2", "h3", "h4", "h5", "h6",
]);

/** Check if an ol node contains "rich" li items (multiple block children). */
function isRichList(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const n = node as Record<string, unknown>;
  if (!Array.isArray(n.children)) return false;

  for (const child of n.children) {
    if (!child || typeof child !== "object") continue;
    const c = child as Record<string, unknown>;
    if (c.tagName !== "li" || !Array.isArray(c.children)) continue;
    const blocks = (c.children as Record<string, unknown>[]).filter(
      (gc) => gc?.type === "element" && BLOCK_TAGS.has(gc.tagName as string)
    );
    if (blocks.length > 1) return true;
  }
  return false;
}

/* ── Shared markdown component overrides ── */

export const markdownComponents: Components = {
  /* ── Tables ── */
  table: ({ children }) => (
    <div className="overflow-x-auto my-3 rounded-lg border border-gray-200/60 dark:border-gray-700/50">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-gray-50/80 dark:bg-gray-800/60">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap border-b border-gray-200/60 dark:border-gray-700/50">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-[12px] text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-800/60 whitespace-nowrap">
      {children}
    </td>
  ),
  tr: ({ children }) => (
    <tr className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors last:[&_td]:border-b-0">
      {children}
    </tr>
  ),

  /* ── Ordered lists: divider / timeline / simple ── */
  ol: ({ children, node }) => {
    const firstText = node?.children?.[0]
      ? extractNodeText(node.children[0])
      : "";
    const isTimeline = TIME_RE.test(firstText);

    if (isTimeline) {
      return (
        <ol className="list-none my-3 ml-2 pl-5 border-l-2 border-blue-300/70 dark:border-blue-700/50 [&>li]:relative [&>li]:py-2.5 [&>li:last-child]:pb-0 [&>li]:before:content-[''] [&>li]:before:absolute [&>li]:before:-left-[21px] [&>li]:before:top-[16px] [&>li]:before:w-2 [&>li]:before:h-2 [&>li]:before:rounded-full [&>li]:before:bg-blue-400 dark:[&>li]:before:bg-blue-500 [&>li]:before:ring-[3px] [&>li]:before:ring-white dark:[&>li]:before:ring-gray-900">
          {children}
        </ol>
      );
    }

    // Only add dividers for rich lists (li with multiple block children)
    if (isRichList(node)) {
      return (
        <ol className="list-none pl-0 my-3 [&>li]:py-5 [&>li+li]:border-t [&>li+li]:border-gray-200 dark:[&>li+li]:border-gray-700 [&>li+li]:pt-5">
          {children}
        </ol>
      );
    }

    // Simple list — compact, no dividers
    return (
      <ol className="list-none pl-0 my-3 [&>li]:py-1">
        {children}
      </ol>
    );
  },

  /* ── Unordered lists: keep default ── */
  ul: ({ children }) => (
    <ul className="my-2 pl-4 list-disc [&>li]:py-1">{children}</ul>
  ),
};

/* ── Prose class ── */

const PROSE_CLASS =
  "prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed [&_p]:my-1.5 [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-2.5 [&_h2]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_strong]:text-gray-900 dark:[&_strong]:text-gray-100 [&_code]:text-xs [&_code]:bg-gray-100 dark:[&_code]:bg-gray-700 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded";

/* ── MessageContent (flat render, no folding) ── */

export function CollapsibleMessageContent({
  markdown,
}: {
  markdown: string;
}) {
  return (
    <div className={PROSE_CLASS}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        components={markdownComponents}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
