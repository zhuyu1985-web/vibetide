import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { TestResultPanel } from "../test-result-panel";
import type { WorkflowStepDef } from "@/db/schema/workflows";

describe("TestResultPanel", () => {
  const step = {
    id: "step-1",
    order: 1,
    name: "选题策划",
    type: "skill",
    config: {},
  } as WorkflowStepDef;

  it("renders step output as Markdown preview", () => {
    const html = renderToStaticMarkup(
      createElement(TestResultPanel, {
        step,
        stepIndex: 0,
        result: {
          status: "completed",
          fullResult: "## 执行摘要\n\n这是 **重点**\n\n| 项 | 值 |\n|---|---|\n| 分数 | 92 |",
        },
        onClose: vi.fn(),
      }),
    );

    expect(html).toContain("<h2>执行摘要</h2>");
    expect(html).toContain("<strong>重点</strong>");
    expect(html).toContain("<table");
  });

  it("renders pure JSON output as a formatted JSON code preview", () => {
    const html = renderToStaticMarkup(
      createElement(TestResultPanel, {
        step,
        stepIndex: 0,
        result: {
          status: "completed",
          fullResult: '{"title":"稿件","meta":{"score":92}}',
        },
        onClose: vi.fn(),
      }),
    );

    expect(html).toContain("<pre");
    expect(html).toContain("language-json");
    expect(html).toContain("&quot;title&quot;: &quot;稿件&quot;");
    expect(html).toContain("&quot;score&quot;: 92");
  });
});
