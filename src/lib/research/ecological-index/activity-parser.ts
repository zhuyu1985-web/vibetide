// 生态文明传播指数报告 - 线下活动 xlsx 解析
//
// Spec: docs/superpowers/specs/2026-05-26-ecological-index-report-design.md §5.1
// Plan: docs/superpowers/plans/2026-05-26-ecological-index-report-plan.md Task 2.2
//
// 输入: 39 区县 × 5 主题活动统计 xlsx (L5-L43 数据区,L1-L4 表头)
// 输出: ParsedActivityDataset { data[] / activityThemes / totalActivities / warnings }
//
// 移植自 scripts/parse-activity-xlsx.py 的 vetted Python 逻辑,关键规则:
//   1. 数据行 L5-L43 (1-based) → JS array index 4..42 (共 39 行)
//   2. 显式 sheet range 'A1:Lxx' 确保 sheet col B 在 array index 1 (不依赖
//      sheet `!ref` 起始列自动推断,避免 sheet 范围变化导致列错位)
//   3. 列对齐 (0-based JS array index):
//        B(1)=序号  C(2)=区县  D-H(3-7)=5 主题场数  I(8)=活动总数
//        J(9)=最晚日期(excel serial)  K(10)=最早日期(excel serial)
//   4. Excel 日期序号 → ISO YYYY-MM-DD,基准 1899-12-30,UTC 计算避免时区漂移
//   5. NAME_MAP: "西部科学城重庆高新区" → "科学城重庆高新区"
//   6. spanDays = (last - first) + 1 (含两端),与 Python 一致
//   7. freq = total / spanDays,spanDays<=0 时为 0
//   8. 日期序号无效 → 跳过该区县 + warning
//   9. 日期含 2026 年 → 保留数据但记录 warning (原始数据偶有录入错误)

import * as XLSX from "@e965/xlsx";
import type { ActivityDataPoint } from "@/db/schema/research/activity-datasets";

/** xlsx 中区县名 → DB 中标准 39 区县名映射 */
const NAME_MAP: Record<string, string> = {
  "西部科学城重庆高新区": "科学城重庆高新区",
};

/** 5 个标准活动主题列(与 xlsx D-H 列对齐) */
export const ACTIVITY_THEMES = [
  "六五环境日",
  "815全国生态日",
  "志愿服务活动",
  "环保设施向公众开放",
  "美丽重庆六进活动",
] as const;

/** Excel 1900 日期系统基准 (UTC, 避开本地时区) */
const EXCEL_BASE_MS = Date.UTC(1899, 11, 30);

/**
 * Excel 日期序号 → ISO YYYY-MM-DD (UTC)
 *
 * @example excelDateSerialToISO(45995) === "2025-12-04"
 */
export function excelDateSerialToISO(serial: number): string {
  const ms = EXCEL_BASE_MS + serial * 86400 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

export type ParsedActivityDataset = {
  data: ActivityDataPoint[];
  activityThemes: string[];
  totalActivities: number;
  warnings: string[];
};

/** 数据区行号 (1-based xlsx 行号: L5..L43) */
const ROW_START = 4; // L5 → JS array index 4
const ROW_END_EXCLUSIVE = 43; // L44 → 不含

/** 列索引 (0-based, 基于显式 sheet range 'A1:Lxx') */
const COL = {
  DISTRICT: 2,
  THEMES_START: 3,
  TOTAL: 8,
  LAST_DATE: 9,
  FIRST_DATE: 10,
} as const;

/** ms in one day */
const DAY_MS = 86400 * 1000;

/**
 * 解析活动 xlsx
 *
 * @param buffer xlsx 文件 Buffer(由调用方读取后传入)
 * @returns ParsedActivityDataset { data / activityThemes / totalActivities / warnings }
 * @throws 当 xlsx 无可用 sheet 时
 */
export function parseActivityXlsx(buffer: Buffer): ParsedActivityDataset {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("xlsx 文件无 sheet");
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error("xlsx 第一个 sheet 无内容");

  // 显式 range 'A1:Lxx',强制 sheet col A 对齐到 array index 0
  // (不依赖 sheet `!ref` 自动推断起始列,避免 sheet 范围变化导致列错位)
  const rows = XLSX.utils.sheet_to_json<Array<unknown>>(ws, {
    header: 1,
    defval: null,
    range: "A1:L50",
  });

  const data: ActivityDataPoint[] = [];
  const warnings: string[] = [];
  let totalActivities = 0;

  for (let r = ROW_START; r < Math.min(rows.length, ROW_END_EXCLUSIVE); r += 1) {
    const row = rows[r];
    if (!row) continue;
    const rawName = row[COL.DISTRICT];
    if (rawName === null || rawName === undefined || rawName === "") continue;
    let districtName = String(rawName).trim();
    if (!districtName) continue;
    districtName = NAME_MAP[districtName] ?? districtName;

    // 5 主题场数(缺失或非数字 → 0)
    const themes: Record<string, number> = {};
    let themeSum = 0;
    for (let i = 0; i < ACTIVITY_THEMES.length; i += 1) {
      const themeName = ACTIVITY_THEMES[i]!;
      const v = Number(row[COL.THEMES_START + i] ?? 0);
      const safe = Number.isFinite(v) ? v : 0;
      themes[themeName] = safe;
      themeSum += safe;
    }

    // 优先用 xlsx I 列"活动总数",fallback 5 主题之和
    const totalCell = row[COL.TOTAL];
    const totalNum = Number(totalCell);
    const total =
      totalCell !== null && totalCell !== undefined && Number.isFinite(totalNum)
        ? totalNum
        : themeSum;

    // 日期序号解析
    const lastSerial = Number(row[COL.LAST_DATE]);
    const firstSerial = Number(row[COL.FIRST_DATE]);
    if (!Number.isFinite(lastSerial) || !Number.isFinite(firstSerial)) {
      warnings.push(
        `${districtName} (L${r + 1}): 日期序号无效, 跳过该区县`,
      );
      continue;
    }
    const lastDate = excelDateSerialToISO(lastSerial);
    const firstDate = excelDateSerialToISO(firstSerial);
    if (lastDate.startsWith("2026") || firstDate.startsWith("2026")) {
      warnings.push(
        `${districtName} (L${r + 1}): 日期范围含 2026 年 (${firstDate} → ${lastDate}), 可能录入错误`,
      );
    }
    // 含两端 +1,与 Python 实现一致
    const spanDays =
      Math.floor((new Date(lastDate).getTime() - new Date(firstDate).getTime()) / DAY_MS) + 1;
    const freq = spanDays > 0 ? total / spanDays : 0;

    data.push({
      district: districtName,
      themes,
      total,
      firstDate,
      lastDate,
      spanDays,
      freq,
    });
    totalActivities += total;
  }

  return {
    data,
    activityThemes: [...ACTIVITY_THEMES],
    totalActivities,
    warnings,
  };
}
