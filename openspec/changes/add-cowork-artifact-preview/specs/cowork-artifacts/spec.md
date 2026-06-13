## ADDED Requirements

### Requirement: Conversation Artifact Cards
The cowork conversation SHALL present completed non-trivial outputs as artifact cards in the message stream.

#### Scenario: Multiple artifacts generated together
- **WHEN** a mission step or final result contains multiple long-form, media, or document artifacts
- **THEN** the conversation renders those artifacts vertically in generation order
- **AND** it does not place draft and media artifacts side by side inside the same message bubble

#### Scenario: Short text output
- **WHEN** an artifact is short text below the configured inline threshold
- **THEN** the conversation renders the text directly in the assistant message instead of requiring a preview card

### Requirement: Split Preview Workspace
The cowork interface SHALL open selected artifacts in a split workspace where the conversation and preview/editor areas each receive at least half of the available desktop width.

#### Scenario: Open long draft
- **WHEN** the user selects a long draft artifact card
- **THEN** the interface opens the draft in the preview/editor area
- **AND** the conversation remains visible beside it
- **AND** the preview/editor area is not constrained to a narrow right rail

#### Scenario: Switch selected artifact
- **WHEN** the user selects another artifact card while the preview workspace is open
- **THEN** the preview/editor area switches to the newly selected artifact
- **AND** the conversation order and scroll position are preserved as much as possible

### Requirement: Rich Text Draft Editing
Long draft artifacts SHALL be editable from the artifact preview workspace with a rich text editor.

#### Scenario: Save edited draft
- **WHEN** the user edits a draft artifact and saves it
- **THEN** the system persists the edited content
- **AND** the artifact card indicates that the draft has been edited

#### Scenario: Save fails
- **WHEN** saving an edited draft fails
- **THEN** the editor keeps the unsaved content visible
- **AND** the user receives a non-destructive error state

### Requirement: Media and Document Preview
The artifact preview workspace SHALL support type-specific viewing for image, video, and document artifacts.

#### Scenario: Preview image
- **WHEN** the user selects an image artifact
- **THEN** the preview workspace displays the image at a usable size with available metadata and open/download actions

#### Scenario: Preview video
- **WHEN** the user selects a video artifact
- **THEN** the preview workspace displays a playable video when a playable URL is available
- **AND** otherwise shows a clear fallback state

#### Scenario: Preview document
- **WHEN** the user selects a document artifact
- **THEN** the preview workspace attempts a browser-safe preview
- **AND** provides open/download fallback actions when inline preview is unavailable

### Requirement: Artifact Source Normalization
The cowork artifact preview SHALL normalize artifacts from mission output sources before rendering them.

#### Scenario: Normalize mission artifacts
- **WHEN** artifacts are available from persisted mission artifact rows
- **THEN** the system maps them into a common preview item shape including identity, title, type, content or file URL, metadata, and editability

#### Scenario: Normalize live step output
- **WHEN** a live mission update includes `outputData.artifacts` or `finalOutput.artifacts`
- **THEN** the system maps those artifacts into the same preview item shape where possible
- **AND** falls back to generic text or unknown preview states for incomplete metadata
