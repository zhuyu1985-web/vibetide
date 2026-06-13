## 1. Data and Normalization
- [ ] 1.1 Define `ArtifactPreviewItem` and normalization helpers for `mission_artifacts`, `outputData.artifacts`, and `finalOutput.artifacts`.
- [ ] 1.2 Add type inference for short text, draft/markdown, image, video, document, data, and unknown artifacts.
- [ ] 1.3 Extend DAL/live mission payloads to expose normalized artifacts needed by cowork UI.

## 2. Conversation Rendering
- [ ] 2.1 Render short text artifacts inline in the assistant bubble.
- [ ] 2.2 Render long/multimedia/document artifacts as vertical cards in generation order.
- [ ] 2.3 Preserve existing step summaries and final result behavior while replacing side-by-side artifact grids.

## 3. Preview Workspace
- [ ] 3.1 Add selected artifact state to `CoworkClient`.
- [ ] 3.2 Replace the narrow artifact preview behavior with a 1:1 split workspace when an artifact is selected.
- [ ] 3.3 Keep the execution checklist accessible when preview is closed or as a secondary panel/tab.

## 4. Artifact Viewers
- [ ] 4.1 Implement rich-text draft editor using existing Tiptap dependencies.
- [ ] 4.2 Implement image preview with full-width fit, metadata, and open/download actions.
- [ ] 4.3 Implement video preview with native player and fallback state.
- [ ] 4.4 Implement document preview with browser-safe embed and open/download fallback.

## 5. Persistence
- [ ] 5.1 Add a save action for edited draft content.
- [ ] 5.2 Persist edits back to the artifact source without mutating unrelated mission output.
- [ ] 5.3 Mark edited artifacts visibly in the conversation card.

## 6. Verification
- [ ] 6.1 Add unit tests for artifact normalization and inference.
- [ ] 6.2 Add component tests for vertical artifact ordering and preview selection.
- [ ] 6.3 Run lint and focused tests.
- [ ] 6.4 Verify the cowork page in browser at desktop and narrow widths.
