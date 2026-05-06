import { Fragment } from "react";

/**
 * 简版命中高亮：substring 匹配，命中部分包 <mark>
 * 用 React 组件分段 wrap，不用 dangerouslySetInnerHTML 避免 XSS
 */
export function highlightKeyword(
  text: string,
  keyword: string | undefined,
): React.ReactNode {
  if (!text || !keyword) return text;
  const lower = text.toLowerCase();
  const lk = keyword.toLowerCase();
  if (!lower.includes(lk)) return text;

  const parts: React.ReactNode[] = [];
  let lastEnd = 0;
  let idx = lower.indexOf(lk);
  let key = 0;
  while (idx !== -1) {
    if (idx > lastEnd) {
      parts.push(
        <Fragment key={key++}>{text.slice(lastEnd, idx)}</Fragment>,
      );
    }
    parts.push(
      <mark
        key={key++}
        className="bg-yellow-200 text-foreground rounded px-0.5"
      >
        {text.slice(idx, idx + keyword.length)}
      </mark>,
    );
    lastEnd = idx + keyword.length;
    idx = lower.indexOf(lk, lastEnd);
  }
  if (lastEnd < text.length) {
    parts.push(<Fragment key={key++}>{text.slice(lastEnd)}</Fragment>);
  }
  return <>{parts}</>;
}
