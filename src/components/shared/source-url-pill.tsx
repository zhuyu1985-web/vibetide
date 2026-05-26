// src/components/shared/source-url-pill.tsx
"use client";

import { ExternalLink } from "lucide-react";

interface SourceUrlPillProps {
  url: string | null | undefined;
  label?: string;
  variant?: "default" | "compact";
  className?: string;
}

export function SourceUrlPill({
  url,
  label = "查看原文",
  variant = "default",
  className = "",
}: SourceUrlPillProps) {
  if (!url) return null;

  let domain = url;
  try {
    domain = new URL(url).host.replace(/^www\./, "");
  } catch {
    // URL parse 失败保留原字符串（如 weibo://... 等非标准 scheme）
  }

  const baseClass =
    "inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors";
  const variantClass =
    variant === "compact"
      ? ""
      : "px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-900/20";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${baseClass} ${variantClass} ${className}`}
      title={url}
    >
      <ExternalLink size={variant === "compact" ? 10 : 12} />
      <span>{label}</span>
      <span className="text-gray-400 dark:text-gray-500">· {domain}</span>
    </a>
  );
}
