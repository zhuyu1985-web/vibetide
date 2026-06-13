# Cowork Artifact Preview MVP Design

## Summary
The cowork conversation should make every completed output inspectable from the dialog. The approved MVP uses a Codex-like split workspace: the conversation remains on the left, and the selected artifact opens on the right with at least a 1:1 width ratio. Multiple artifacts appear vertically in the conversation, in generation order, instead of as side-by-side cards.

## Scope
In scope:
- Short text outputs render directly in the conversation.
- Long drafts render as artifact cards and open in a rich text editor.
- Images, videos, and documents render as artifact cards and open in type-specific previewers.
- Edited draft content can be saved back to the artifact source.
- The existing execution checklist remains accessible when no artifact is selected or as secondary context.

Out of scope:
- Full asset library, cross-conversation reuse, advanced version history, sharing links, approval workflows, and new permission models.

## User Experience
Artifact cards are placed under the step or final result that produced them. If a mission generates a draft and several images, the conversation shows them as a vertical sequence: draft first, then image one, image two, and so on. This avoids the double-scroll problem where a long draft and visual preview compete inside a cramped horizontal layout.

Opening a card switches the workspace to a 1:1 split. The user can continue reading the conversation while editing a draft or reviewing media. Selecting a different card changes the preview surface without rearranging the conversation.

## Data Flow
The MVP should reuse current mission output sources:
- `mission_artifacts` for persisted rows.
- `mission_tasks.outputData.artifacts` for live step output.
- `missions.finalOutput.artifacts` for consolidated results.

The UI consumes a normalized `ArtifactPreviewItem` shape with fields for identity, mission/task ownership, title, kind, content, file URL, MIME/type metadata, created time, and editability.

## Components
- `ConversationThread`: keeps ownership of the message stream and vertical artifact card placement.
- Artifact card/list components: render type badges, excerpts, thumbnails, and selection actions.
- `CoworkClient`: owns the selected artifact state and split workspace mode.
- Preview workspace: renders rich text editor, image viewer, video player, document preview/fallback, and generic text fallback.
- DAL/live helpers: expose normalized artifacts without encoding UI layout decisions.

## Risks
- Existing artifacts may not include enough MIME or file metadata. Mitigation: infer conservatively and show generic fallback states.
- Draft editing could mutate mission output unexpectedly. Mitigation: save only the selected artifact content and visibly mark edited artifacts.
- The current right mission panel is only 18rem wide. Mitigation: treat artifact preview as a workspace mode, not as a narrow panel.

## Verification
- Unit test artifact normalization and type inference.
- Component test vertical artifact order and preview selection.
- Component test draft dirty/save/error states.
- Browser-check desktop split and narrow viewport fallback.
