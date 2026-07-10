import { describe, it, expect } from "vitest";
import { validateParams, resolveArgv } from "../argv";
import type { ArgsSchema, ArgvTemplate } from "../argv";

// ─── 共用测试夹具 ─────────────────────────────────────────────────────────────

const schema: ArgsSchema = {
  input: { type: "asset", required: true },
  fmt: { type: "enum", values: ["mp4", "gif"] },
};

const tmpl: ArgvTemplate = [
  "-y",
  "-i",
  { param: "input" },
  "-f",
  { param: "fmt" },
  { output: "out" },
];

// ─── validateParams ───────────────────────────────────────────────────────────

describe("validateParams() — 安全边界", () => {
  it("注入字符串被 enum 字段拒绝", () => {
    expect(() =>
      validateParams(schema, { input: "asset-1", fmt: "mp4; rm -rf /" })
    ).toThrow();
  });

  it("enum 值超范围被拒绝", () => {
    expect(() =>
      validateParams(schema, { input: "asset-1", fmt: "avi" })
    ).toThrow();
  });

  it("缺少 required 字段被拒绝", () => {
    expect(() => validateParams(schema, { fmt: "mp4" })).toThrow();
  });

  it("传入 schema 以外的未知参数被拒绝", () => {
    expect(() =>
      validateParams(schema, { input: "a", fmt: "mp4", evil: "x" })
    ).toThrow();
  });

  it("原型键 toString 走私被拒绝（不能用 in 绕过未知字段门）", () => {
    expect(() =>
      validateParams(
        schema,
        JSON.parse('{"input":"a","fmt":"mp4","toString":"x"}')
      )
    ).toThrow();
  });

  it("原型键 __proto__ 走私被拒绝", () => {
    expect(() =>
      validateParams(
        schema,
        JSON.parse('{"input":"a","fmt":"mp4","__proto__":"x"}')
      )
    ).toThrow();
  });

  it("原型键 constructor 走私被拒绝", () => {
    expect(() =>
      validateParams(
        schema,
        JSON.parse('{"input":"a","fmt":"mp4","constructor":"x"}')
      )
    ).toThrow();
  });

  it("空字符串 asset id 被拒绝", () => {
    expect(() => validateParams(schema, { input: "" })).toThrow();
  });

  it("合法参数通过并原样返回", () => {
    const result = validateParams(schema, { input: "asset-abc", fmt: "gif" });
    expect(result).toEqual({ input: "asset-abc", fmt: "gif" });
  });

  it("可选字段缺失时通过（无 required:true）", () => {
    expect(() => validateParams(schema, { input: "asset-1" })).not.toThrow();
  });
});

describe("validateParams() — number 类型", () => {
  const numSchema: ArgsSchema = {
    bitrate: { type: "number", required: true, min: 64, max: 8000 },
    quality: { type: "number" },
  };

  it("低于 min 被拒绝", () => {
    expect(() =>
      validateParams(numSchema, { bitrate: 32 })
    ).toThrow();
  });

  it("高于 max 被拒绝", () => {
    expect(() =>
      validateParams(numSchema, { bitrate: 10000 })
    ).toThrow();
  });

  it("非数字被拒绝", () => {
    expect(() =>
      validateParams(numSchema, { bitrate: "fast" as unknown as number })
    ).toThrow();
  });

  it("NaN 被拒绝", () => {
    expect(() =>
      validateParams(numSchema, { bitrate: NaN })
    ).toThrow();
  });

  it("Infinity 被拒绝", () => {
    expect(() =>
      validateParams(numSchema, { bitrate: Infinity })
    ).toThrow();
  });

  it("范围内的值通过", () => {
    const result = validateParams(numSchema, { bitrate: 1500 });
    expect(result.bitrate).toBe(1500);
  });

  it("无 min/max 限制时范围内任意数通过", () => {
    expect(() =>
      validateParams(numSchema, { bitrate: 500, quality: 99 })
    ).not.toThrow();
  });
});

describe("validateParams() — string 类型 + regex", () => {
  const strSchema: ArgsSchema = {
    filename: { type: "string", required: true, regex: "^[a-z0-9_-]+$" },
    note: { type: "string" },
  };

  it("不匹配 regex 被拒绝", () => {
    expect(() =>
      validateParams(strSchema, { filename: "my file.txt" })
    ).toThrow();
  });

  it("含路径穿越字符被 regex 拒绝", () => {
    expect(() =>
      validateParams(strSchema, { filename: "../../etc/passwd" })
    ).toThrow();
  });

  it("匹配 regex 的值通过", () => {
    const result = validateParams(strSchema, { filename: "output_2026" });
    expect(result.filename).toBe("output_2026");
  });

  it("无 regex 的 string 字段任意字符串通过", () => {
    expect(() =>
      validateParams(strSchema, { filename: "ok", note: "hello world; $(id)" })
    ).not.toThrow();
  });
});

describe("validateParams() — regex 自动全串锚定", () => {
  // 非锚定 regex "mp4" 不应放行 "mp4; rm -rf /"——引擎须自动包裹 ^(?:...)$
  const anchorSchema: ArgsSchema = {
    fmt: { type: "string", regex: "mp4" },
  };

  it("非锚定模式下尾部注入被拒绝（^(?:...)$ 生效）", () => {
    expect(() =>
      validateParams(anchorSchema, { fmt: "mp4; rm -rf /" })
    ).toThrow();
  });

  it("头部注入被拒绝", () => {
    expect(() =>
      validateParams(anchorSchema, { fmt: "; mp4" })
    ).toThrow();
  });

  it("整串精确匹配通过", () => {
    const result = validateParams(anchorSchema, { fmt: "mp4" });
    expect(result.fmt).toBe("mp4");
  });

  it("交替分组 regex 仍被整体锚定（不会因 | 拆裂）", () => {
    const altSchema: ArgsSchema = {
      fmt: { type: "string", regex: "mp4|gif" },
    };
    expect(() => validateParams(altSchema, { fmt: "mp4" })).not.toThrow();
    expect(() => validateParams(altSchema, { fmt: "gif" })).not.toThrow();
    // "mp4x" 不应通过：若未用 (?:...) 包裹，^mp4|gif$ 会因 | 优先级匹配 "mp4x" 前缀而误放行
    expect(() => validateParams(altSchema, { fmt: "mp4x" })).toThrow();
  });
});

describe("validateParams() — asset 类型", () => {
  it("asset id 是非空字符串时通过", () => {
    const result = validateParams(schema, { input: "uuid-123", fmt: "mp4" });
    expect(result.input).toBe("uuid-123");
  });

  it("asset id 为空字符串被拒绝", () => {
    expect(() =>
      validateParams(schema, { input: "", fmt: "mp4" })
    ).toThrow();
  });
});

// ─── resolveArgv ─────────────────────────────────────────────────────────────

describe("resolveArgv() — 基础映射", () => {
  it("生成正确的固定位置 argv 数组", () => {
    const argv = resolveArgv(
      tmpl,
      { input: "/scratch/in.mov", fmt: "mp4" },
      "/scratch/out.mp4"
    );
    expect(argv).toEqual([
      "-y",
      "-i",
      "/scratch/in.mov",
      "-f",
      "mp4",
      "/scratch/out.mp4",
    ]);
  });

  it("{param} 引用替换为单个 argv 元素", () => {
    const argv = resolveArgv(
      tmpl,
      { input: "/scratch/in.mov", fmt: "mp4" },
      "/scratch/out.mp4"
    );
    // 总共应有 6 个元素，每个 {param}/{output} 都是 SINGLE 元素
    expect(argv).toHaveLength(6);
  });

  it("{output} 引用替换为 outputPath 单个元素", () => {
    const argv = resolveArgv([{ output: "out" }], {}, "/my/output/path");
    expect(argv).toEqual(["/my/output/path"]);
    expect(argv).toHaveLength(1);
  });
});

describe("resolveArgv() — 安全注入测试（核心）", () => {
  it("含空格和 shell 元字符的 string 值保持为单个 argv 元素", () => {
    const argv = resolveArgv(
      [{ param: "note" }],
      { note: "a b; $(whoami) `id`" },
      ""
    );
    // 必须是 1 个元素，不能被拆分或解释
    expect(argv).toEqual(["a b; $(whoami) `id`"]);
    expect(argv).toHaveLength(1);
  });

  it("含换行符的值保持为单个 argv 元素", () => {
    const argv = resolveArgv(
      [{ param: "note" }],
      { note: "line1\nline2\n--injected-flag" },
      ""
    );
    expect(argv).toHaveLength(1);
    expect(argv[0]).toContain("injected-flag");
  });

  it("含 null byte 的值保持为单个 argv 元素（不截断）", () => {
    const argv = resolveArgv(
      [{ param: "note" }],
      { note: "safe\x00evil" },
      ""
    );
    expect(argv).toHaveLength(1);
  });

  it("数字类型值被转为字符串单元素", () => {
    const numSchema: ArgsSchema = { bitrate: { type: "number", required: true, min: 64, max: 8000 } };
    const argv = resolveArgv(
      ["-b:v", { param: "bitrate" }],
      { bitrate: 1500 },
      ""
    );
    expect(argv).toEqual(["-b:v", "1500"]);
  });

  it("多个参数各占独立位置", () => {
    const twoSchema: ArgsSchema = {
      a: { type: "string", required: true },
      b: { type: "string", required: true },
    };
    const argv = resolveArgv(
      [{ param: "a" }, { param: "b" }],
      { a: "val1", b: "val2" },
      ""
    );
    expect(argv).toEqual(["val1", "val2"]);
    expect(argv).toHaveLength(2);
  });
});

describe("resolveArgv() — 模板中无 {output} 时 outputPath 被忽略", () => {
  it("模板无 {output} token 时 outputPath 不出现在结果中", () => {
    const argv = resolveArgv(
      ["-y", { param: "input" }],
      { input: "/in.mov" },
      "/ignored.mp4"
    );
    expect(argv).toEqual(["-y", "/in.mov"]);
  });
});

describe("resolveArgv() — 防御纵深守卫", () => {
  it("{param} 取到非 string/number 值（array）应 throw", () => {
    expect(() =>
      resolveArgv(
        [{ param: "x" }],
        { x: ["a", "b"] as unknown as string },
        ""
      )
    ).toThrow();
  });

  it("{param} 取到非 string/number 值（object）应 throw", () => {
    expect(() =>
      resolveArgv(
        [{ param: "x" }],
        { x: { evil: 1 } as unknown as string },
        ""
      )
    ).toThrow();
  });

  it("{param} 取到 undefined 值应 throw", () => {
    expect(() =>
      resolveArgv(
        [{ param: "x" }],
        { x: undefined as unknown as string },
        ""
      )
    ).toThrow();
  });

  it("模板引用 validatedParams 中不存在的 param 应 throw", () => {
    expect(() =>
      resolveArgv([{ param: "missing" }], { input: "/in.mov" }, "")
    ).toThrow();
  });
});

describe("resolveArgv() — 只含 literal token 的模板", () => {
  it("全 literal 模板原样输出", () => {
    const argv = resolveArgv(["-version"], {}, "");
    expect(argv).toEqual(["-version"]);
  });
});
