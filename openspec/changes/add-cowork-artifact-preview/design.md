# Design: Cowork Artifact Preview MVP

## Context
Cowork conversations now stream mission execution steps directly into the dialog. Completed outputs appear either as markdown in the final result or as artifact counts in the right mission panel. This makes it hard to inspect long drafts, generated images, videos, and documents during execution, and it forces users to leave the conversation for confirmation work.

The approved MVP layout follows a Codex-like conversation workspace:
- Conversation and artifact preview/editor use a `1:1` split when an artifact is open.
- Multiple artifacts appear vertically in the conversation, ordered by generation/completion time.
- Selecting an artifact switches the preview/editor surface on the right.

## Goals
- Make every completed output discoverable in the conversation.
- Avoid cramped right-rail previews for long drafts by giving the editor at least half of the workspace width.
- Avoid side-by-side artifact cards inside a message when multiple outputs are produced.
- Preserve short text as inline conversation content.
- Support draft editing with the existing Tiptap dependency.
- Support image, video, and document preview states with clear fallbacks.

## Non-Goals
- No full asset library or cross-conversation asset reuse in this MVP.
- No collaborative editing, comment threads, approval workflow, or rich version browser.
- No new external document conversion service.
- No permissions model beyond the existing conversation and mission access checks.

## UX Decisions
- Artifact cards are rendered as a vertical list below the relevant step or final result.
- Short text artifacts below the configured length threshold render directly in the assistant bubble.
- Long text and draft artifacts render as cards with title, type, length, and excerpt; opening the card shows a rich-text editor.
- Images render as cards with thumbnail, dimensions if known, and title; opening the card shows a full-width image preview in the right workspace.
- Videos render as cards with poster/metadata where available; opening the card shows a video player.
- Documents render as cards with file type and size where available; opening the card uses browser preview when safe and offers download/open fallback.
- The existing execution checklist remains available but no longer monopolizes the right side when an artifact is open.

## Data Model
Use existing sources first:
- `mission_artifacts` for persisted artifact rows.
- `mission_tasks.outputData.artifacts` for step-level output during live updates.
- `missions.finalOutput.artifacts` for final consolidated outputs.

Normalize client-side into an `ArtifactPreviewItem` shape:
- `id`
- `missionId`
- `taskId`
- `title`
- `kind`: `short_text | draft | image | video | document | markdown | data | unknown`
- `content`
- `fileUrl`
- `mimeType`
- `metadata`
- `createdAt`
- `editable`

If existing rows lack MIME/type metadata, infer kind conservatively from `type`, `fileUrl`, and content shape. Additive schema changes are allowed only if inference is insufficient for documents/media.

## Component Boundaries
- `ConversationThread` remains responsible for message flow and artifact card placement.
- New artifact card/list components own vertical artifact rendering and click targets.
- `CoworkClient` owns selected preview state and split sizing.
- A new preview workspace component owns draft editor, image viewer, video player, and document fallback views.
- Mission live/DAL layers expose artifacts in a normalized shape without duplicating rendering decisions.

## Error Handling
- Missing `fileUrl` media artifacts show metadata and a “preview unavailable” state while preserving text content if present.
- Unsupported document types show a download/open fallback.
- Draft save failures keep the editor dirty state and show a non-destructive error.
- Malformed artifact metadata falls back to generic markdown/text preview.

## Testing
- Unit test artifact normalization and type inference.
- Component test vertical rendering order and short-text inline behavior.
- Component test selection switches preview mode without losing conversation scroll.
- Component test draft editor dirty/save/error states.
- Manual browser verification for desktop 1:1 split and narrow viewport fallback.
