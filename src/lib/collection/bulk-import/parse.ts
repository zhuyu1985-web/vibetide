export interface ParsedExcel {
  columns: string[];
  rows: Record<string, unknown>[];
  fileName: string;
  sheetName: string;
  totalRows: number;
}

export async function parseExcelFile(file: File): Promise<ParsedExcel> {
  if (!file || file.size === 0) {
    throw new Error("文件为空");
  }

  // dynamic import — 主 bundle 不增加
  const XLSX = await import("@e965/xlsx");

  const buffer = await file.arrayBuffer();
  const isCSV = /\.(csv|tsv)$/i.test(file.name);
  const workbook = XLSX.read(buffer, {
    cellDates: true,
    // CSV 文件强制使用 UTF-8 编码（SheetJS 默认 Latin-1 解析 CSV）
    ...(isCSV ? { type: "array", codepage: 65001 } : {}),
  });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Excel 文件不含任何工作表");
  }

  const sheet = workbook.Sheets[sheetName]!;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: false,
    defval: "",
  });

  if (rows.length === 0) {
    throw new Error("工作表为空");
  }

  const columns = Object.keys(rows[0]!);

  return {
    columns,
    rows,
    fileName: file.name,
    sheetName,
    totalRows: rows.length,
  };
}
