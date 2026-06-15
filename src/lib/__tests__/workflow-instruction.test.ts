import { describe, it, expect } from "vitest";
import {
  renderTemplate,
  buildUserInstruction,
} from "@/lib/workflow-instruction";
import type { InputFieldDef } from "@/lib/types";

// 取自 seed-builtin-workflows.ts 的「AI 早晚报(成都)」真实字段定义——
// 同时覆盖 string options(value 即 label)与 {value,label} options 两种形态。
const briefingFields: InputFieldDef[] = [
  {
    name: "city",
    label: "城市",
    type: "select",
    required: true,
    options: ["成都", "重庆", "深圳"],
  },
  {
    name: "edition",
    label: "时段",
    type: "select",
    required: true,
    options: [
      { value: "morning", label: "早报" },
      { value: "evening", label: "晚报" },
    ],
  },
  { name: "brief_date", label: "汇编日期", type: "date", required: false },
  {
    name: "section_scope",
    label: "板块范围",
    type: "multiselect",
    required: false,
    options: [
      { value: "policy", label: "政务要闻" },
      { value: "livelihood", label: "民生服务" },
      { value: "weather", label: "天气交通" },
    ],
  },
];

const briefingTpl =
  "为 {{city}} 汇编 {{brief_date}} 的{{edition}},聚焦 {{section_scope}}。";

describe("renderTemplate — select/multiselect 用 label 渲染", () => {
  it("select 字段渲染 option 的中文 label 而非 value", () => {
    expect(
      renderTemplate("的{{edition}}", { edition: "morning" }, briefingFields),
    ).toBe("的早报");
  });

  it("string options(value 即 label)原样渲染", () => {
    expect(
      renderTemplate("{{city}}", { city: "成都" }, briefingFields),
    ).toBe("成都");
  });

  it("multiselect 数组渲染为 label 顿号连接", () => {
    expect(
      renderTemplate(
        "{{section_scope}}",
        { section_scope: ["policy", "weather"] },
        briefingFields,
      ),
    ).toBe("政务要闻、天气交通");
  });

  it("值不在 options 中时回退为原始值", () => {
    expect(
      renderTemplate("{{edition}}", { edition: "noon" }, briefingFields),
    ).toBe("noon");
  });

  it("不传 fields 时保持原始值替换(向后兼容)", () => {
    expect(renderTemplate("{{edition}}", { edition: "morning" })).toBe(
      "morning",
    );
  });
});

describe("renderTemplate — 空值残句清理", () => {
  it("实测缺陷用例:可选字段全空时不残留「聚焦 。」碎片", () => {
    expect(
      renderTemplate(
        briefingTpl,
        { city: "成都", edition: "morning" },
        briefingFields,
      ),
    ).toBe("为 成都 汇编的早报。");
  });

  it("全部字段就位时完整渲染", () => {
    expect(
      renderTemplate(
        briefingTpl,
        {
          city: "成都",
          edition: "evening",
          brief_date: "2026-06-11",
          section_scope: ["policy", "livelihood"],
        },
        briefingFields,
      ),
    ).toBe("为 成都 汇编 2026-06-11 的晚报,聚焦 政务要闻、民生服务。");
  });

  it("句中残句(逗号分隔)整段移除", () => {
    expect(
      renderTemplate("围绕 {{topic}} 调研,聚焦 {{aspect}},输出报告。", {
        topic: "AI",
      }),
    ).toBe("围绕 AI 调研,输出报告。");
  });

  it("占位符全空时渲染为空字符串", () => {
    expect(renderTemplate("聚焦 {{section_scope}}。", {})).toBe("");
  });

  it("数字 0 不视为空值", () => {
    expect(renderTemplate("数量 {{n}}。", { n: 0 })).toBe("数量 0。");
  });

  it("西文单词间因空值塌缩后保留一个空格", () => {
    expect(renderTemplate("Compare {{a}} vs {{b}}", { b: "X" })).toBe(
      "Compare vs X",
    );
  });

  it("multiselect 空数组视为空值参与残句清理", () => {
    expect(
      renderTemplate(briefingTpl, {
        city: "成都",
        edition: "morning",
        section_scope: [],
      }, briefingFields),
    ).toBe("为 成都 汇编的早报。");
  });
});

describe("renderTemplate — 值类型人话化", () => {
  it("toggle 布尔值渲染为 是/否", () => {
    expect(renderTemplate("含图表:{{t}};含视频:{{f}}", { t: true, f: false })).toBe(
      "含图表:是;含视频:否",
    );
  });

  it("daterange 对象渲染为「start ~ end」", () => {
    expect(
      renderTemplate("{{range}}", {
        range: { start: "2026-06-01", end: "2026-06-07" },
      }),
    ).toBe("2026-06-01 ~ 2026-06-07");
  });

  it("无 options 的普通数组用顿号连接", () => {
    expect(renderTemplate("{{tags}}", { tags: ["a", "b"] })).toBe("a、b");
  });

  it("其他对象仍 JSON 序列化", () => {
    expect(renderTemplate("{{obj}}", { obj: { k: 1 } })).toBe('{"k":1}');
  });
});

describe("buildUserInstruction", () => {
  it("promptTemplate + fields 端到端:label 渲染且无碎片", () => {
    expect(
      buildUserInstruction(
        "AI 早晚报(成都)",
        { city: "成都", edition: "morning" },
        briefingTpl,
        briefingFields,
      ),
    ).toBe("为 成都 汇编的早报。");
  });

  it("模板渲染为空时回退参数列表,用字段 label 与选项 label", () => {
    expect(
      buildUserInstruction(
        "AI 早晚报(成都)",
        { city: "成都", edition: "morning" },
        "聚焦 {{section_scope}}。",
        briefingFields,
      ),
    ).toBe("启动场景：AI 早晚报(成都)\n参数：\n- 城市: 成都\n- 时段: 早报");
  });

  it("回退列表跳过空值参数,未知 key 保留原名", () => {
    expect(
      buildUserInstruction(
        "AI 早晚报(成都)",
        { city: "成都", note: "", extra_key: "v" },
        null,
        briefingFields,
      ),
    ).toBe("启动场景：AI 早晚报(成都)\n参数：\n- 城市: 成都\n- extra_key: v");
  });

  it("不传 fields 的旧调用方行为保持(原始 key/value 列表)", () => {
    expect(
      buildUserInstruction("测试模板", { foo: "bar" }, null),
    ).toBe("启动场景：测试模板\n参数：\n- foo: bar");
  });

  it("无参数时仅输出启动场景行", () => {
    expect(buildUserInstruction("测试模板", {}, null)).toBe(
      "启动场景：测试模板",
    );
  });
});
