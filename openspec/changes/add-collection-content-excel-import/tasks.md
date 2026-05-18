## 1. Excel Template Analysis
- [ ] 1.1 Document `docs/data.xlsx` column mapping against `RawItem` and collected item tables.
- [ ] 1.2 Identify required fields, optional fields, array delimiters, numeric coercions, and date coercions.

## 2. Import Mapping
- [ ] 2.1 Extend import mapping aliases to cover the `docs/data.xlsx` 33-column template.
- [ ] 2.2 Extend row transformation to populate platform/account fields, sentiment/info fields, metrics, regions, keywords, industries, cover image, duration, OCR, and ASR.
- [ ] 2.3 Preserve query window, row number, short ID, and MCN in `rawMetadata`.
- [ ] 2.4 Infer `contentType` from duration/OCR/ASR/cover fields when no explicit content type column exists.

## 3. Collection Pool UI
- [ ] 3.1 Add an Excel import button to `/data-collection/content`.
- [ ] 3.2 Reuse the existing bulk import dialog from the content page and refresh the content list after completion.
- [ ] 3.3 Keep the existing source-management page behavior intact unless product decides to remove that duplicate entry point.

## 4. Validation And Tests
- [ ] 4.1 Add transform tests for the `docs/data.xlsx` template fields.
- [ ] 4.2 Add/adjust field-mapper tests for template aliases.
- [ ] 4.3 Run focused tests for bulk import parsing/transform and a TypeScript/lint check if feasible.
