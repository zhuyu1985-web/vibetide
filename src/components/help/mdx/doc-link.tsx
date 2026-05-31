import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DocLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
}

/**
 * 文档内交叉引用链接:带小箭头,统一样式。
 * 构建期校验目标存在由 Phase 9 的 scripts/verify-help-links.ts 负责,
 * 本组件不在运行时做存在性校验,避免拖慢渲染。
 */
export function DocLink({ href, children, className }: DocLinkProps) {
  const isExternal = /^https?:\/\//.test(href);

  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex items-center gap-0.5 text-primary underline-offset-2 hover:underline",
          className,
        )}
      >
        {children}
        <ArrowUpRight className="size-3.5" aria-hidden />
      </a>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-0.5 text-primary underline-offset-2 hover:underline",
        className,
      )}
    >
      {children}
      <ArrowUpRight className="size-3.5" aria-hidden />
    </Link>
  );
}
