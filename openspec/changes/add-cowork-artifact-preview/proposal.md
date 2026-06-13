# Change: Add cowork artifact preview

## Why
The cowork conversation is becoming the primary execution surface, but completed outputs are currently flattened into markdown or counted as badges. Users need to inspect and confirm every meaningful output from the conversation flow, including long drafts, images, videos, and documents.

## What Changes
- Add first-class conversation artifact cards for completed mission outputs.
- Render multiple artifacts vertically in the conversation, in generation order, instead of side-by-side grids.
- Open selected artifacts in a 1:1 split preview workspace where the conversation and preview/editor each receive at least half of the available width.
- Support inline display for short text, rich-text editing for long drafts, and type-specific previewers for image, video, and document artifacts.
- Keep the MVP scoped to conversation-local preview and editing; defer full asset library concerns such as cross-conversation reuse, advanced version history, share links, and permission workflows.

## Impact
- Affected specs: `cowork-artifacts`
- Affected code:
  - `src/components/cowork/conversation-thread.tsx`
  - `src/components/cowork/mission-step-stream.tsx`
  - `src/components/cowork/cowork-mission-panel.tsx`
  - `src/app/(dashboard)/cowork/cowork-client.tsx`
  - `src/lib/cowork/use-mission-live.ts`
  - `src/lib/dal/missions.ts`
  - `src/db/schema/missions.ts` if artifact metadata needs an additive field
- Dependencies already available: Tiptap editor packages, existing `mission_artifacts`, existing `outputData.artifacts`, existing cowork split layout.
