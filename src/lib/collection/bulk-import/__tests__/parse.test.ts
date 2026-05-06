// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseExcelFile, type ParsedExcel } from "../parse";

describe("parseExcelFile", () => {
  it("解析 CSV 字符串为 columns + rows", async () => {
    // 用 File API mock CSV 内容
    const csv = "标题,正文,发布时间\n新闻1,内容A,2025-06-01\n新闻2,内容B,2025-06-02\n";
    const file = new File([csv], "test.csv", { type: "text/csv" });
    const result = await parseExcelFile(file);
    expect(result.columns).toEqual(["标题", "正文", "发布时间"]);
    expect(result.rows.length).toBe(2);
    expect(result.rows[0]).toEqual({ "标题": "新闻1", "正文": "内容A", "发布时间": "2025-06-01" });
    expect(result.fileName).toBe("test.csv");
    expect(result.sheetName).toBe("Sheet1"); // CSV 默认 sheet 名
  });

  it("空文件抛错", async () => {
    const file = new File([""], "empty.csv", { type: "text/csv" });
    await expect(parseExcelFile(file)).rejects.toThrow(/empty|空/i);
  });

  it("非法格式抛错", async () => {
    const file = new File(["not a real spreadsheet"], "junk.xlsx", {
      type: "application/octet-stream",
    });
    await expect(parseExcelFile(file)).rejects.toThrow();
  });
});
