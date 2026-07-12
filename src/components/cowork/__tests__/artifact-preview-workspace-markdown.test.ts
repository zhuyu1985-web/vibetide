import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/cowork-submit", () => ({
  saveCoworkArtifactDraft: vi.fn(),
}));

import { ArtifactPreviewWorkspace } from "../artifact-preview-workspace";
import type { ArtifactPreviewItem } from "@/lib/cowork/artifact-preview";

describe("ArtifactPreviewWorkspace", () => {
  it("renders Markdown artifacts as formatted preview by default", () => {
    const artifact: ArtifactPreviewItem = {
      id: "artifact-1",
      missionId: "mission-1",
      taskId: null,
      title: "Markdown 产物",
      kind: "markdown",
      source: "final_output",
      content: "# 标题\n\n这是 **重点**\n\n| A | B |\n|---|---|\n| 1 | 2 |",
      fileUrl: null,
      mimeType: null,
      metadata: {},
      createdAt: null,
      version: null,
      editable: false,
      edited: false,
    };

    const html = renderToStaticMarkup(
      createElement(ArtifactPreviewWorkspace, {
        artifact,
        onClose: vi.fn(),
      }),
    );

    expect(html).toContain("<h1>标题</h1>");
    expect(html).toContain("<strong>重点</strong>");
    expect(html).toContain("<table");
  });
});
