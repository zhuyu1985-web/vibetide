# Change: Add Excel import to collection content pool

## Why
运营需要把 `docs/data.xlsx` 这类舆情导出数据导入“采集池/内容”中。当前项目已有 Excel 解析、预览和写入采集项的底层能力，但入口放在采集源页面，且字段映射只覆盖标题、正文、链接等基础字段，没有完整承接模板中的平台、作者、情感、互动、地域、行业、OCR/ASR 等舆情字段。

## What Changes
- 在“采集池/内容”页面提供 Excel/CSV 导入入口，复用现有四步导入流程：上传、字段映射、试运行、执行。
- 以 `docs/data.xlsx` 的 `舆情数据2` sheet 作为默认模板参考，自动识别 33 个模板列并映射到 `RawItem` / `collected_items` / `collected_item_contents`。
- 导入时保留完整原始行到 `rawMetadata.originalRow`，并把模板中的非主字段写入现有舆情字段、附件字段和正文副表。
- 继续使用 `excel_import` 虚拟采集源、`collection_runs` 运行记录、`writeItems` 去重与 outlet 自动识别机制。
- 导入完成后刷新采集池列表，错误行仍支持 CSV 下载。

## Impact
- Affected specs: `collection-content-import`
- Affected code:
  - `src/app/(dashboard)/data-collection/content/content-client.tsx`
  - `src/app/(dashboard)/data-collection/sources/bulk-import-dialog.tsx`
  - `src/app/actions/bulk-import.ts`
  - `src/lib/collection/bulk-import/field-mapper.ts`
  - `src/lib/collection/bulk-import/transform.ts`
  - `src/lib/collection/bulk-import/__tests__/transform.test.ts`
