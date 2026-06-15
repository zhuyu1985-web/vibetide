# Cowork Artifact Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved cowork artifact preview MVP: vertical artifact cards in conversation, 1:1 split preview/editor workspace, type-specific viewers, and draft save.

**Architecture:** Keep artifact logic in focused modules under `src/lib/cowork` and `src/components/cowork`. Normalize all mission output sources into one `ArtifactPreviewItem` shape, render cards from that shape, and let `CoworkClient` own selected preview state. Reuse existing `mission_artifacts` rows and Tiptap dependencies; avoid schema changes unless required by tests.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind v4, Drizzle, Vitest, Testing Library, Tiptap 3.

---

## Files

- Create: `src/lib/cowork/artifact-preview.ts`
- Create: `src/lib/cowork/__tests__/artifact-preview.test.ts`
- Create: `src/components/cowork/artifact-card.tsx`
- Create: `src/components/cowork/artifact-preview-workspace.tsx`
- Create: `tests/unit/components/cowork/artifact-card.test.tsx`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/dal/missions.ts`
- Modify: `src/app/actions/cowork-submit.ts`
- Modify: `src/app/(dashboard)/cowork/cowork-client.tsx`
- Modify: `src/components/cowork/conversation-thread.tsx`
- Modify: `src/components/cowork/mission-step-stream.tsx`
- Modify: `src/components/cowork/cowork-mission-panel.tsx`
- Modify: `openspec/changes/add-cowork-artifact-preview/tasks.md`

### Task 1: Artifact Normalization

**Files:**
- Create: `src/lib/cowork/artifact-preview.ts`
- Create: `src/lib/cowork/__tests__/artifact-preview.test.ts`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  ARTIFACT_INLINE_TEXT_LIMIT,
  inferArtifactKind,
  normalizeArtifactSources,
} from "@/lib/cowork/artifact-preview";

describe("artifact preview normalization", () => {
  it("classifies short text as inline and long article_draft as editable draft", () => {
    expect(inferArtifactKind({ type: "text", content: "短文本" })).toBe("short_text");
    expect(
      inferArtifactKind({
        type: "article_draft",
        content: "x".repeat(ARTIFACT_INLINE_TEXT_LIMIT + 1),
      }),
    ).toBe("draft");
  });

  it("normalizes live step artifacts before final artifacts and persisted rows", () => {
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
            artifacts: [{ type: "article_draft", title: "稿件", content: "长稿".repeat(200) }],
          },
        },
      ],
      finalOutput: {
        artifacts: [{ type: "image", title: "封面", fileUrl: "https://cdn.example.com/a.png" }],
      },
      persistedArtifacts: [
        {
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
        },
      ],
    });

    expect(items.map((i) => i.title)).toEqual(["稿件", "封面", "视频"]);
    expect(items[0]).toMatchObject({ kind: "draft", editable: true, source: "task_output" });
    expect(items[1]).toMatchObject({ kind: "image", source: "final_output" });
    expect(items[2]).toMatchObject({ kind: "video", source: "mission_artifact" });
  });
});
```

- [ ] **Step 2: Run RED**

Run: `pnpm vitest run src/lib/cowork/__tests__/artifact-preview.test.ts`

Expected: FAIL because `src/lib/cowork/artifact-preview.ts` does not exist.

- [ ] **Step 3: Implement minimal normalization**

Create `ArtifactPreviewItem`, `inferArtifactKind`, `normalizeArtifactSources`, and constants in `src/lib/cowork/artifact-preview.ts`. Keep functions pure and DB-free.

- [ ] **Step 4: Run GREEN**

Run: `pnpm vitest run src/lib/cowork/__tests__/artifact-preview.test.ts`

Expected: PASS.

### Task 2: DAL and Save Action

**Files:**
- Modify: `src/lib/dal/missions.ts`
- Modify: `src/app/actions/cowork-submit.ts`

- [ ] **Step 1: Write failing save tests if server-action test isolation is available**

If server-action tests would require the unavailable local database, skip automated save tests and cover normalization with Task 1 plus manual save verification. Do not add DB-dependent tests while `127.0.0.1:5433` is unavailable.

- [ ] **Step 2: Load persisted artifacts**

Modify `getMissionById` to query `missionArtifacts` with the existing mission detail queries and map rows into `MissionArtifact[]` instead of returning `artifacts: []`.

- [ ] **Step 3: Add draft save server action**

Add `saveCoworkArtifactDraft(input)` in `src/app/actions/cowork-submit.ts`. It MUST require auth, verify the mission belongs to the current org through `getMissionById`, and update only persisted `mission_artifacts.content` when `source === "mission_artifact"`. For live/final JSON artifacts, return a controlled error until a persisted row exists.

### Task 3: Conversation Artifact Cards

**Files:**
- Create: `src/components/cowork/artifact-card.tsx`
- Create: `tests/unit/components/cowork/artifact-card.test.tsx`
- Modify: `src/components/cowork/mission-step-stream.tsx`

- [ ] **Step 1: Write failing component tests**

Test that a long draft card displays title/type/length and that multiple cards render in DOM order. Use a callback spy for selection.

- [ ] **Step 2: Run RED**

Run: `pnpm vitest run tests/unit/components/cowork/artifact-card.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement card/list components**

Implement `ArtifactCard` and `ArtifactList` with vertical layout, type badges, thumbnail area for media, excerpt for text, and accessible button labels.

- [ ] **Step 4: Run GREEN**

Run: `pnpm vitest run tests/unit/components/cowork/artifact-card.test.tsx`

Expected: PASS.

### Task 4: Split Preview Workspace

**Files:**
- Create: `src/components/cowork/artifact-preview-workspace.tsx`
- Modify: `src/app/(dashboard)/cowork/cowork-client.tsx`
- Modify: `src/components/cowork/conversation-thread.tsx`
- Modify: `src/components/cowork/cowork-mission-panel.tsx`

- [ ] **Step 1: Add selected artifact state**

Add `selectedArtifact` state in `CoworkClient`, pass `onArtifactSelect` to `ConversationThread`, and render a 1:1 split preview workspace when selected. Keep the mission checklist available when no artifact is selected.

- [ ] **Step 2: Implement preview modes**

In `ArtifactPreviewWorkspace`, render:
- Draft/markdown/text: Tiptap editor with `immediatelyRender: false`.
- Image: full-width `img` with metadata and open/download buttons.
- Video: native `video` when `fileUrl` exists; fallback when missing.
- Document: `iframe` for safe URLs plus open/download fallback.
- Unknown/data: markdown/text fallback.

- [ ] **Step 3: Wire artifact card clicks**

Update `MissionStepStream` to normalize artifacts from the live mission and render `ArtifactList` vertically under completed output. Short text artifacts remain inline in the result bubble.

### Task 5: Verification and Checklist

**Files:**
- Modify: `openspec/changes/add-cowork-artifact-preview/tasks.md`

- [ ] **Step 1: Run focused tests**

Run:
```bash
pnpm vitest run src/lib/cowork/__tests__/artifact-preview.test.ts tests/unit/components/cowork/artifact-card.test.tsx src/lib/cowork/__tests__/mission-drawer-state.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run lint on touched files if practical**

Run: `pnpm lint --file src/lib/cowork/artifact-preview.ts --file src/components/cowork/artifact-card.tsx --file src/components/cowork/artifact-preview-workspace.tsx`

Expected: PASS or report if this Next 16 script does not support `--file`.

- [ ] **Step 3: Browser QA**

Run the dev server, open `/cowork/[conversationId]` for a conversation with mission output, verify desktop 1:1 split and narrow fallback. If no seeded mission has artifacts, use component tests as the hard evidence and report the missing fixture.

- [ ] **Step 4: Update OpenSpec tasks**

Mark completed tasks in `openspec/changes/add-cowork-artifact-preview/tasks.md`; leave DB-dependent or fixture-dependent verification unchecked with a note if blocked by local DB.
