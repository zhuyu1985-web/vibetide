// @vitest-environment jsdom
import { render, fireEvent, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArtifactList } from "@/components/cowork/artifact-card";
import type { ArtifactPreviewItem } from "@/lib/cowork/artifact-preview";

function item(
  patch: Partial<ArtifactPreviewItem> & Pick<ArtifactPreviewItem, "id" | "title">,
): ArtifactPreviewItem {
  const { id, title, ...rest } = patch;
  return {
    missionId: "m1",
    taskId: "t1",
    kind: "draft",
    source: "mission_artifact",
    content: "这是一篇较长的稿件内容。".repeat(50),
    fileUrl: null,
    mimeType: null,
    metadata: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    version: 1,
    editable: true,
    edited: false,
    ...rest,
    id,
    title,
  };
}

describe("ArtifactList", () => {
  it("renders draft card title, type, length, and excerpt", () => {
    const onSelect = vi.fn();
    render(
      <ArtifactList
        artifacts={[item({ id: "a1", title: "AI 教育稿件" })]}
        selectedArtifactId={null}
        onSelect={onSelect}
      />,
    );

    const card = within(
      document.body,
    ).getByRole("button", { name: /打开产物：AI 教育稿件/ });
    expect(card.textContent).toContain("AI 教育稿件");
    expect(card.textContent).toContain("稿件");
    expect(card.textContent).toContain("可编辑");
    expect(card.textContent).toContain("字");

    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "a1", title: "AI 教育稿件" }),
    );
  });

  it("renders multiple artifacts vertically in provided order", () => {
    render(
      <ArtifactList
        artifacts={[
          item({ id: "draft", title: "稿件" }),
          item({
            id: "image-1",
            title: "封面图 1",
            kind: "image",
            fileUrl: "https://cdn.example.com/cover.png",
            content: "",
            editable: false,
          }),
          item({
            id: "video-1",
            title: "视频脚本",
            kind: "video",
            fileUrl: "https://cdn.example.com/clip.mp4",
            content: "",
            editable: false,
          }),
        ]}
        selectedArtifactId="image-1"
        onSelect={vi.fn()}
      />,
    );

    const cards = document.body.querySelectorAll("[data-artifact-card]");
    expect(cards).toHaveLength(3);
    expect(cards[0].textContent).toContain("稿件");
    expect(cards[1].textContent).toContain("封面图 1");
    expect(cards[2].textContent).toContain("视频脚本");
    expect(cards[1].getAttribute("data-selected")).toBe("true");
  });
});
