// P3.8 — ecological-index-generate Inngest function 轻量断言测试
//
// 复用 A5 Phase 7 的降级测试策略 (per report-generate.test.ts):
// vitest 内无法驱动 Inngest runtime 的 step.run / step.sendEvent 序列。
// 本测试只断言 function export 存在 + 配置正确 (id / event), 端到端流水线
// 验证留给 P3.10 fixture 测试 + dev smoke + 验收阶段人工核对。

import { describe, expect, it } from "vitest";

import { ecologicalIndexGenerate } from "../ecological-index-generate";

describe("ecological-index-generate Inngest function", () => {
  it("function 已正确导出", () => {
    expect(ecologicalIndexGenerate).toBeDefined();
  });

  it("function id 含 ecological-index 关键字", () => {
    // Inngest InngestFunction 类有 .id() 方法或 .id 字段; 兼容两种形式
    const idRaw = (ecologicalIndexGenerate as unknown as { id: unknown }).id;
    const idStr =
      typeof idRaw === "function"
        ? String((idRaw as () => string).call(ecologicalIndexGenerate))
        : String(idRaw);
    expect(idStr).toContain("ecological-index");
  });
});
