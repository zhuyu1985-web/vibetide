// 客户端 CSV 生成 helper — 不含任何 server-only import，可在 "use client" 组件中直接调用

export interface ErrorRow {
  rowIndex: number;
  reason: string;
  row: Record<string, unknown>;
}

/**
 * 将错误行列表转成 UTF-8 BOM CSV Blob。
 * BOM (\uFEFF) 使 Excel 打开中文时不乱码。
 */
export function buildErrorCsv(errors: ErrorRow[]): Blob {
  const header = "行号,错误类型,Excel 原始数据 JSON\n";
  const rows = errors
    .map((e) => {
      const rowNum = e.rowIndex + 1;
      const reason = `"${e.reason.replace(/"/g, '""')}"`;
      const rawJson = `"${JSON.stringify(e.row).replace(/"/g, '""')}"`;
      return `${rowNum},${reason},${rawJson}`;
    })
    .join("\n");

  const bom = "\uFEFF";
  return new Blob([bom + header + rows], { type: "text/csv;charset=utf-8" });
}

/**
 * 触发浏览器下载错误清单 CSV 文件。
 */
export function downloadErrorCsv(errors: ErrorRow[], fileName = "import-errors.csv"): void {
  const blob = buildErrorCsv(errors);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
