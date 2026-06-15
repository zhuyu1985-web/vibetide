## 1. Data and Normalization
- [x] 1.1 Define `ArtifactPreviewItem` and normalization helpers for `mission_artifacts`, `outputData.artifacts`, and `finalOutput.artifacts`.
- [x] 1.2 Add type inference for short text, draft/markdown, image, video, document, data, and unknown artifacts.
- [x] 1.3 Extend DAL/live mission payloads to expose normalized artifacts needed by cowork UI.

## 2. Conversation Rendering
- [x] 2.1 Render short text artifacts inline in the assistant bubble.
- [x] 2.2 Render long/multimedia/document artifacts as vertical cards in generation order.
- [x] 2.3 Preserve existing step summaries and final result behavior while replacing side-by-side artifact grids.

## 3. Preview Workspace
- [x] 3.1 Add selected artifact state to `CoworkClient`.
- [x] 3.2 Replace the narrow artifact preview behavior with a 1:1 split workspace when an artifact is selected.
- [x] 3.3 Keep the execution checklist accessible when preview is closed or as a secondary panel/tab.

## 4. Artifact Viewers
- [x] 4.1 Implement rich-text draft editor using existing Tiptap dependencies.
- [x] 4.2 Implement image preview with full-width fit, metadata, and open/download actions.
- [x] 4.3 Implement video preview with native player and fallback state.
- [x] 4.4 Implement document preview with browser-safe embed and open/download fallback.

## 5. Persistence
- [x] 5.1 Add a save action for edited draft content.
- [x] 5.2 Persist edits back to the artifact source without mutating unrelated mission output.
- [x] 5.3 Mark edited artifacts visibly in the conversation card.

## 6. Verification
- [x] 6.1 Add unit tests for artifact normalization and inference.
- [x] 6.2 Add component tests for vertical artifact ordering and preview selection.
- [x] 6.3 Run lint and focused tests.
- [ ] 6.4 Verify the cowork page in browser at desktop and narrow widths. Blocked in this session: in-app browser redirects to `/login?next=%2Fcowork`, so no authenticated cowork fixture was available.
