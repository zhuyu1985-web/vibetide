import { describe, it, expect } from "vitest";
import { resolveStepDomainId } from "@/lib/mission-core";

describe("resolveStepDomainId — 节点>场景>空", () => {
  it("节点 domainId 覆盖场景默认", () => {
    expect(resolveStepDomainId({ config: { domainId: "tech" } }, "finance")).toBe("tech");
  });
  it("节点无 → 回退场景默认", () => {
    expect(resolveStepDomainId({ config: {} }, "finance")).toBe("finance");
  });
  it("节点 config 整体缺失 → 场景默认", () => {
    expect(resolveStepDomainId({}, "finance")).toBe("finance");
  });
  it("都无 → null", () => {
    expect(resolveStepDomainId({ config: {} }, null)).toBeNull();
    expect(resolveStepDomainId({}, undefined)).toBeNull();
  });
  it("节点 domainId 为 null 视作未设 → 场景默认", () => {
    expect(resolveStepDomainId({ config: { domainId: null } }, "finance")).toBe("finance");
  });
});
