"use client";

interface FallbackRendererProps {
  outputData: unknown;
  reason: string;
}

/**
 * 当 step renderer 无法解析 outputData 期望 shape 时使用。
 * 显示原始 markdown / summary + 顶部红色提示 + 一个折叠的 raw JSON 给调试用。
 */
export function FallbackRenderer({ outputData, reason }: FallbackRendererProps) {
  const summary =
    outputData && typeof outputData === "object" && "summary" in outputData
      ? String((outputData as { summary: unknown }).summary)
      : "";
  const text =
    outputData && typeof outputData === "object" && "text" in outputData
      ? String((outputData as { text: unknown }).text)
      : "";
  return (
    <div className="space-y-2">
      <div className="rounded-md bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-300">
        ⚠️ {reason}（可能 short-circuit 未触发或老 mission 数据）。下方是原始输出。
      </div>
      {summary && (
        <div className="text-sm text-muted-foreground">{summary}</div>
      )}
      {text && (
        <pre className="whitespace-pre-wrap text-xs bg-muted/30 rounded p-2">{text}</pre>
      )}
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">查看原始 outputData JSON</summary>
        <pre className="mt-1 overflow-auto bg-muted/30 rounded p-2 text-xs">{JSON.stringify(outputData, null, 2)}</pre>
      </details>
    </div>
  );
}
