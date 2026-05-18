## Context
`docs/data.xlsx` contains one sheet named `舆情数据2` with 13,129 data rows and 33 columns. The current collection schema already includes most target fields:

- Main table: `collected_items`
- Body/OCR/ASR side table: `collected_item_contents`
- Import source/run tracking: `collection_sources` and `collection_runs`
- Ingestion path: `RawItem` -> `writeItems`

The project also has an existing import flow under `src/app/(dashboard)/data-collection/sources/bulk-import-dialog.tsx`, with parser, field mapper, preview action, and execute action.

## Goals
- Make the import action available from the collection content pool.
- Match the `docs/data.xlsx` template without asking users to manually map most fields.
- Preserve source data fidelity while writing normalized fields used by filtering, details, and future analysis.
- Reuse the existing writer path so dedupe, outlet recognition, and run accounting remain consistent.

## Non-Goals
- No schema migration is expected; current tables already have target columns.
- No background queue conversion for this change; keep the existing client-batched execution.
- No deletion or major redesign of the source page import entry unless requested separately.

## Field Mapping
| Excel column | Target |
| --- | --- |
| 查询时段 | `rawMetadata.queryWindow` |
| 序号 | `rawMetadata.rowNumber` |
| 帖子ID | `RawItem.externalId` -> `collected_items.external_id` |
| 标题 | `RawItem.title` -> `collected_items.title` |
| 内容摘要 | `RawItem.summary` -> `collected_items.summary` |
| 完整内容 | `RawItem.content` -> `collected_item_contents.content` |
| 作者昵称 | `RawItem.author`, `rawMetadata.publicAccountName` |
| 用户ID | `RawItem.accountId` |
| 平台 | `RawItem.platform` |
| 情感倾向 | `RawItem.sentiment` |
| 信息类型 | `RawItem.infoType` |
| 发布时间 | `RawItem.publishedAt` |
| 采集时间 | `rawMetadata.collectedAt` |
| 点赞数 | `RawItem.likeCount` |
| 评论数 | `RawItem.commentCount` |
| 转发数 | `RawItem.shareCount` |
| 阅读数 | `RawItem.viewCount` |
| 收藏数 | `RawItem.favoriteCount` |
| 回复数 | `RawItem.replyCount` |
| 粉丝数 | `RawItem.authorFollowerCount` |
| IP属地 | `RawItem.ipRegion` |
| 发布地 | `RawItem.postRegion` |
| 提及地 | `RawItem.mentionedRegions` split by `；` |
| 命中关键词 | `RawItem.matchedKeywords` split by comma or Chinese comma |
| 命中地域 | `RawItem.matchedRegions` split by `；`, comma, or Chinese comma |
| 行业分类 | `RawItem.industries`; also drives `collected_items.category` through writer priority |
| 链接 | `RawItem.url` -> `canonical_url` / URL hash |
| 封面图 | `RawItem.coverImageUrl` and thumbnail attachment |
| 短ID | `RawItem.accountHandle` |
| MCN | `rawMetadata.mcn` |
| 时长(秒) | `RawItem.durationSeconds` |
| OCR文本 | `RawItem.ocrText` -> `collected_item_contents.ocr_text` |
| ASR文本 | `RawItem.asrText` -> `collected_item_contents.asr_text` |

## Data Normalization
- Empty strings become `undefined`/`null` as appropriate.
- Counts are coerced to non-negative integers, defaulting to `0` through writer behavior when absent.
- Region lists use semicolon-style splitting first to avoid breaking hierarchical region names such as `重庆市，万州区，余家镇`.
- Keyword and industry lists use comma/Chinese comma splitting.
- `contentType` defaults to `image_text`; if duration is greater than zero or ASR exists, infer `video` unless the user maps an explicit content type.

## Risks
- Large files are currently processed in browser memory and server-action batches. The sample file has 13,129 rows and is acceptable, but very large files may need a future background job/import session model.
- Duplicate detection during preview uses the transform fingerprint, while writer also checks URL hash and its own fingerprint. URL hash remains the strongest duplicate path for this template because all rows have links.
