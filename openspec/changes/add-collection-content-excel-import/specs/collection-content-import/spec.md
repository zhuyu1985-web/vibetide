## ADDED Requirements

### Requirement: Collection Content Excel Import Entry
The system SHALL provide an Excel/CSV import entry from the collection content pool page.

#### Scenario: User starts import from collection content
- **GIVEN** an authenticated user is viewing `/data-collection/content`
- **WHEN** the user clicks the Excel import action
- **THEN** the system opens the bulk import flow for collection content items

### Requirement: Template Field Auto-Mapping
The system SHALL automatically map the `docs/data.xlsx` template columns to collection item fields.

#### Scenario: User uploads the template workbook
- **GIVEN** a workbook whose first sheet has columns matching `docs/data.xlsx`
- **WHEN** the workbook is parsed
- **THEN** the field mapping step preselects the corresponding system fields for title, content, summary, URL, publish time, platform, account, sentiment, metrics, regions, keywords, industries, cover, duration, OCR, and ASR

### Requirement: Public Opinion Field Persistence
The system SHALL persist imported public opinion fields into normalized collection tables.

#### Scenario: User imports a valid template row
- **GIVEN** a row with title, link, author, platform, sentiment, metrics, region fields, industry fields, OCR text, and ASR text
- **WHEN** the row is imported
- **THEN** the system stores base item fields in `collected_items`
- **AND** stores content, OCR text, and ASR text in `collected_item_contents`
- **AND** preserves the original row in item metadata

### Requirement: Import Execution Feedback
The system SHALL report preview and execution outcomes for collection content imports.

#### Scenario: Import completes with mixed results
- **GIVEN** some rows are valid and some rows are invalid or duplicated
- **WHEN** the import finishes
- **THEN** the system displays inserted, skipped, and failed counts
- **AND** the user can download an error CSV for failed rows
- **AND** the collection content list refreshes to include newly imported items

### Requirement: Import Source And Run Tracking
The system SHALL track Excel content imports through the existing virtual Excel import source and collection run records.

#### Scenario: First batch executes
- **GIVEN** the user starts a content Excel import
- **WHEN** the first batch is written
- **THEN** the system creates or reuses the virtual `excel_import` source
- **AND** creates a `collection_runs` row for the import
- **AND** updates run counters as batches complete
