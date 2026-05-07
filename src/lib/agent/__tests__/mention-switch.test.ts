/**
 * A6 Phase 5 — detectMentionSwitch 单测
 *
 * 3 case：
 *   1. 合法 `@xiaolei` 前缀 → 提取 targetEmployee + cleanMessage
 *   2. 非法 `@unknown` 前缀 → 不切换，保留原文（避免误识别）
 *   3. 无 `@` 前缀 → 不切换，保留原文（默认行为）
 *
 * 由于 regex 从 EMPLOYEE_META 派生，新增第 N 位员工自动 work（无需改测试）。
 */

import { describe, expect, it } from "vitest";
import { detectMentionSwitch } from "../mention-switch";

describe("detectMentionSwitch", () => {
  it("合法 @xiaolei 前缀 → 提取 targetEmployee + cleanMessage", () => {
    const r = detectMentionSwitch("@xiaolei 帮我看下今天有什么热点");
    expect(r.targetEmployee).toBe("xiaolei");
    expect(r.cleanMessage).toBe("帮我看下今天有什么热点");
  });

  it("非法 @unknown 前缀 → 不切换，保留原文", () => {
    const r = detectMentionSwitch("@unknown 这个不是合法 employee");
    expect(r.targetEmployee).toBeNull();
    expect(r.cleanMessage).toBe("@unknown 这个不是合法 employee");
  });

  it("无 @ 前缀 → 不切换，保留原文", () => {
    const r = detectMentionSwitch("正常对话内容");
    expect(r.targetEmployee).toBeNull();
    expect(r.cleanMessage).toBe("正常对话内容");
  });
});
