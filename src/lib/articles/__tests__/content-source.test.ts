import { describe, it, expect } from "vitest";
import { deriveContentSource } from "../content-source";

describe("deriveContentSource", () => {
  it("metadata.ingestedFromChannel 存在 → channel", () => {
    expect(
      deriveContentSource({
        missionId: null,
        metadata: { ingestedFromChannel: { platform: "dingtalk" } },
      }),
    ).toBe("channel");
  });

  it("有 missionId、无渠道标记 → workflow", () => {
    expect(
      deriveContentSource({ missionId: "m-1", metadata: { language: "zh" } as never }),
    ).toBe("workflow");
  });

  it("既无渠道标记也无 missionId → manual", () => {
    expect(deriveContentSource({ missionId: null, metadata: null })).toBe("manual");
    expect(deriveContentSource({})).toBe("manual");
  });

  it("渠道标记优先于 missionId（渠道收稿后又被 mission 加工的边界）", () => {
    expect(
      deriveContentSource({
        missionId: "m-1",
        metadata: { ingestedFromChannel: { platform: "wechat_work" } },
      }),
    ).toBe("channel");
  });

  it("metadata 存在但 ingestedFromChannel 为 null → 不算 channel", () => {
    expect(
      deriveContentSource({ missionId: "m-2", metadata: { ingestedFromChannel: null } }),
    ).toBe("workflow");
  });
});
