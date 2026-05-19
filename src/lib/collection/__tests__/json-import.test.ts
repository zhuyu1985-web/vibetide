import { describe, expect, it } from "vitest";
import {
  CQNEWS_JSON_IMPORT_ACCOUNT,
  getJsonImportAccountName,
  JSON_IMPORT_PLATFORM,
  PEOPLE_JSON_IMPORT_ACCOUNT,
} from "../json-import";

describe("json import normalization", () => {
  it("JSON 导入数据的平台统一为网站", () => {
    expect(JSON_IMPORT_PLATFORM).toBe("网站");
  });

  it("人民网 JSON 导入数据的账号统一为人民网", () => {
    expect(getJsonImportAccountName("json_import/people", "人民网－江西频道", "张三")).toBe(
      PEOPLE_JSON_IMPORT_ACCOUNT,
    );
  });

  it("华龙网 JSON 导入数据的账号统一为华龙网", () => {
    expect(getJsonImportAccountName("json_import/cqnews", "第1眼TV-华龙网", "李四")).toBe(
      CQNEWS_JSON_IMPORT_ACCOUNT,
    );
  });

  it("未知 JSON 导入来源才回退到来源名作为账号", () => {
    expect(getJsonImportAccountName("json_import/other", "示例网站", "李四")).toBe(
      "示例网站",
    );
  });
});
