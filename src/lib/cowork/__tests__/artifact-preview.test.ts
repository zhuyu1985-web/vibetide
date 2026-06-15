import { describe, expect, it } from "vitest";
import type { MissionArtifact } from "@/lib/types";
import {
  ARTIFACT_INLINE_TEXT_LIMIT,
  inferArtifactKind,
  normalizeArtifactSources,
} from "@/lib/cowork/artifact-preview";

describe("artifact preview normalization", () => {
  it("classifies short text as inline and long article_draft as editable draft", () => {
    expect(inferArtifactKind({ type: "text", content: "短文本" })).toBe(
      "short_text",
    );
    expect(
      inferArtifactKind({
        type: "article_draft",
        content: "x".repeat(ARTIFACT_INLINE_TEXT_LIMIT + 1),
      }),
    ).toBe("draft");
  });

  it("classifies media and document artifacts from URLs and mime metadata", () => {
    expect(
      inferArtifactKind({
        type: "asset",
        fileUrl: "https://cdn.example.com/cover.png",
      }),
    ).toBe("image");
    expect(
      inferArtifactKind({
        type: "asset",
        fileUrl: "https://cdn.example.com/clip.mp4",
      }),
    ).toBe("video");
    expect(
      inferArtifactKind({
        type: "file",
        metadata: { mimeType: "application/pdf" },
      }),
    ).toBe("document");
  });

  it("normalizes live step artifacts before final artifacts and persisted rows", () => {
    const persisted: MissionArtifact = {
      id: "pa1",
      missionId: "m1",
      taskId: "t2",
      producedBy: "e1",
      type: "video",
      title: "视频",
      content: null,
      fileUrl: "https://cdn.example.com/a.mp4",
      metadata: {},
      version: 1,
      createdAt: "2026-01-01T00:03:00.000Z",
    };

    const items = normalizeArtifactSources({
      missionId: "m1",
      tasks: [
        {
          id: "t1",
          missionId: "m1",
          title: "写稿",
          priority: 1,
          createdAt: "2026-01-01T00:00:00.000Z",
          completedAt: "2026-01-01T00:01:00.000Z",
          outputData: {
            artifacts: [
              {
                type: "article_draft",
                title: "稿件",
                content: "长稿".repeat(200),
              },
            ],
          },
        },
      ],
      finalOutput: {
        artifacts: [
          {
            type: "image",
            title: "封面",
            fileUrl: "https://cdn.example.com/a.png",
          },
        ],
      },
      persistedArtifacts: [persisted],
    });

    expect(items.map((i) => i.title)).toEqual(["稿件", "封面", "视频"]);
    expect(items[0]).toMatchObject({
      kind: "draft",
      editable: false,
      source: "task_output",
      taskId: "t1",
    });
    expect(items[1]).toMatchObject({
      kind: "image",
      editable: false,
      source: "final_output",
    });
    expect(items[2]).toMatchObject({
      id: "pa1",
      kind: "video",
      editable: false,
      source: "mission_artifact",
    });
  });

  it("marks persisted draft artifacts as editable", () => {
    const items = normalizeArtifactSources({
      missionId: "m1",
      tasks: [],
      finalOutput: null,
      persistedArtifacts: [
        {
          id: "draft-1",
          missionId: "m1",
          taskId: "t1",
          producedBy: "e1",
          type: "article_draft",
          title: "可编辑稿件",
          content: "正文".repeat(200),
          fileUrl: null,
          metadata: { edited: true },
          version: 2,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    expect(items[0]).toMatchObject({
      source: "mission_artifact",
      kind: "draft",
      editable: true,
      edited: true,
      version: 2,
    });
  });
});
