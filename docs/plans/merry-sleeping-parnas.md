# AI Asset Restructuring - CMS Foundation + AI Enhancement

## Context

The requirement doc `docs/requirement/01-AI资产重构.md` defines three AI sub-modules (媒资智能理解、频道顾问工坊、资产盘活引擎), but they all assume an underlying Content Management System (CMS) exists. Currently, the project has no media asset library, no article management, and no category/column taxonomy. The 4 existing AI asset pages (`/asset-intelligence`, `/channel-advisor`, `/channel-knowledge`, `/asset-revive`) are all mock-data-only `"use client"` single-file components.

**Goal:** Build a dual-layer CMS foundation (媒资库 + 稿件库 + 栏目分类), then wire up all three AI sub-modules with real database tables, DAL functions, Server Actions, and migrated server/client page splits.

**Architecture chosen:** 媒资库 (Media Assets) + 稿件库 (Articles) dual-layer, with tree-structured categories linking to channels and advisors.

---

## Phase 1: Database Schema (13 new enums + 6 new schema files + 1 modification)

### 1.1 New Enums → `src/db/schema/enums.ts`

Add these pgEnums after the existing `memberTypeEnum`:

| Enum Name | Values |
|-----------|--------|
| `mediaAssetTypeEnum` | video, image, audio, document |
| `assetProcessingStatusEnum` | queued, processing, completed, failed |
| `assetTagCategoryEnum` | topic, event, emotion, person, location, shotType, quality, object, action |
| `tagSourceEnum` | ai_auto, human_correct |
| `entityTypeEnum` | topic, person, event, location, organization |
| `articleStatusEnum` | draft, reviewing, approved, published, archived |
| `advisorStatusEnum` | active, training, draft |
| `knowledgeSourceTypeEnum` | upload, cms, subscription |
| `vectorizationStatusEnum` | pending, processing, done, failed |
| `syncLogStatusEnum` | success, error, warning |
| `reviveScenarioEnum` | topic_match, hot_match, daily_push, intl_broadcast, style_adapt |
| `reviveStatusEnum` | pending, adopted, rejected |
| `adaptationStatusEnum` | completed, in_progress, pending |

### 1.2 New File: `src/db/schema/categories.ts`

**Table: `categories`** — tree-structured content categories
- id (UUID PK), organizationId (FK→organizations), name, slug, description
- parentId (self-ref FK, nullable, using `AnyPgColumn`), level (int, default 0), sortOrder (int, default 0)
- isActive (boolean, default true), createdAt, updatedAt
- Relations: self-ref parent/children, organization

### 1.3 New File: `src/db/schema/media-assets.ts`

**Table: `media_assets`** — core media library (replaces/unifies `IntelligentAsset` + `MediaAsset` types)
- id (UUID PK), organizationId (FK→organizations)
- title, type (mediaAssetTypeEnum), description
- fileUrl, thumbnailUrl, fileName, fileSize (bigint), fileSizeDisplay, mimeType, duration, durationSeconds
- source, sourceId, tags (jsonb string[])
- understandingStatus (assetProcessingStatusEnum, default "queued"), understandingProgress (int, default 0), totalTags (int, default 0), processedAt
- categoryId (FK→categories, nullable), usageCount (int, default 0)
- uploadedBy (FK→user_profiles, nullable), createdAt, updatedAt

### 1.4 New File: `src/db/schema/articles.ts`

**Table: `articles`** — multimedia article/稿件 management
- id (UUID PK), organizationId (FK→organizations)
- title, subtitle, slug, body (text), summary
- content (jsonb — structured blocks: `{ headline, body, imageNotes, blocks[] }`)
- mediaType (text, default "article": article/video/audio/h5)
- status (articleStatusEnum, default "draft"), priority (text, default "P1")
- categoryId (FK→categories), assigneeId (FK→ai_employees), teamId (FK→teams), createdBy (FK→user_profiles)
- advisorNotes (jsonb string[]), tags (jsonb string[]), wordCount (int), version (int)
- publishedAt, archivedAt, taskId (FK→tasks, nullable — backward compat)
- workflowInstanceId (FK→workflow_instances, nullable), createdAt, updatedAt

**Table: `article_assets`** — M:N linking articles to media assets
- id (UUID PK), articleId (FK→articles, cascade), assetId (FK→media_assets, cascade)
- usageType (text: "cover"|"inline"|"reference"|"source_material"), caption, sortOrder
- segmentId (FK→asset_segments, nullable), startTime, endTime
- createdAt

**Relationship to existing `tasks` table:** Articles coexist with tasks. `articles.taskId` FK provides backward compatibility. Tasks remain for generic work tracking; articles become the CMS source of truth for publishable content.

### 1.5 New File: `src/db/schema/asset-intelligence.ts`

**Table: `asset_segments`** — video/audio time-based segments
- id (UUID PK), assetId (FK→media_assets, cascade)
- startTime, endTime, startTimeSeconds (real), endTimeSeconds (real)
- transcript, ocrTexts (jsonb string[]), nluSummary, sceneType, visualQuality (real)
- segmentOrder (int), createdAt

**Table: `asset_tags`** — AI or human-corrected labels
- id (UUID PK), assetId (FK→media_assets, cascade), segmentId (FK→asset_segments, cascade, nullable)
- category (assetTagCategoryEnum), label, confidence (real)
- source (tagSourceEnum, default "ai_auto"), correctedBy (FK→user_profiles, nullable), originalLabel
- createdAt

**Table: `detected_faces`** — face detection records
- id (UUID PK), segmentId (FK→asset_segments, cascade), assetId (FK→media_assets, cascade)
- name, role, confidence (real), appearances (int)
- boundingBox (jsonb), thumbnailUrl, createdAt

### 1.6 New File: `src/db/schema/knowledge-graph.ts`

**Table: `knowledge_nodes`** — entity graph nodes
- id (UUID PK), organizationId (FK→organizations)
- entityType (entityTypeEnum), entityName, description
- metadata (jsonb: aliases, imageUrl, externalId, properties)
- connectionCount (int, default 0), sourceAssetId (FK→media_assets, nullable)
- createdAt, updatedAt

**Table: `knowledge_relations`** — entity graph edges
- id (UUID PK), sourceNodeId (FK→knowledge_nodes, cascade), targetNodeId (FK→knowledge_nodes, cascade)
- relationType, weight (real), metadata (jsonb)
- sourceAssetId (FK→media_assets, nullable), createdAt

### 1.7 New File: `src/db/schema/channel-advisors.ts`

**Table: `channel_advisors`** — advisor instances
- id (UUID PK), organizationId (FK→organizations)
- name, channelType, personality, avatar, style, strengths (jsonb string[]), catchphrase
- systemPrompt (text), styleConstraints (jsonb: tone, preferredWords, forbiddenWords, replacementRules)
- status (advisorStatusEnum, default "draft"), aiEmployeeId (FK→ai_employees, nullable)
- targetAudience, channelPositioning, createdAt, updatedAt

**Table: `channel_dna_profiles`** — channel DNA analysis
- id (UUID PK), advisorId (FK→channel_advisors, cascade)
- dimensions (jsonb array of {dimension, score}), report (text)
- wordCloud (jsonb), styleExamples (jsonb), analyzedAt, createdAt

### 1.8 Modify: `src/db/schema/knowledge-bases.ts`

Add 6 columns to existing `knowledge_bases` table:
- vectorizationStatus (vectorizationStatusEnum, default "pending")
- chunkCount (int, default 0), lastSyncAt (timestamp, nullable)
- syncConfig (jsonb), sourceUrl (text, nullable)
- sourceType (knowledgeSourceTypeEnum, default "upload")

Add 2 new tables in same file:

**Table: `knowledge_items`** — knowledge chunks/entries
- id (UUID PK), knowledgeBaseId (FK→knowledge_bases, cascade)
- title, snippet, fullContent, sourceDocument
- sourceType (knowledgeSourceTypeEnum), chunkIndex (int), tags (jsonb string[])
- embedding (jsonb number[] — migrate to pgvector later), embeddingModel
- relevanceScore (real), expiresAt (nullable), createdAt, updatedAt

**Table: `knowledge_sync_logs`** — sync event log
- id (UUID PK), knowledgeBaseId (FK→knowledge_bases, cascade)
- action, status (syncLogStatusEnum), detail
- documentsProcessed (int), chunksGenerated (int), errorsCount (int), createdAt

Update `knowledgeBasesRelations` to add `items: many(knowledgeItems)` and `syncLogs: many(knowledgeSyncLogs)`.

### 1.9 New File: `src/db/schema/asset-revive.ts`

**Table: `revive_recommendations`**
- id (UUID PK), organizationId (FK→organizations), assetId (FK→media_assets)
- scenario (reviveScenarioEnum), matchedTopic, reason, matchScore (real), suggestedAction, estimatedReach
- status (reviveStatusEnum, default "pending"), adoptedBy (FK→user_profiles, nullable), respondedAt
- createdAt

**Table: `revive_records`**
- id (UUID PK), organizationId (FK→organizations)
- recommendationId (FK→revive_recommendations), assetId (FK→media_assets)
- scenario (reviveScenarioEnum), resultReach (int), createdContentId (UUID, nullable)
- summary, status (text), createdAt, completedAt

**Table: `style_adaptations`**
- id (UUID PK), organizationId (FK→organizations), sourceAssetId (FK→media_assets)
- style, styleLabel, generatedTitle, generatedExcerpt, tone, createdAt

**Table: `international_adaptations`**
- id (UUID PK), organizationId (FK→organizations), sourceAssetId (FK→media_assets)
- language, languageCode, flag, generatedTitle, generatedExcerpt, adaptationNotes
- status (adaptationStatusEnum, default "pending"), createdAt, completedAt

### 1.10 Update `src/db/schema/index.ts`

Add exports for all 6 new schema files:
```
export * from "./categories";
export * from "./media-assets";
export * from "./articles";
export * from "./asset-intelligence";
export * from "./knowledge-graph";
export * from "./channel-advisors";
export * from "./asset-revive";
```

### 1.11 Update `src/db/types.ts`

Add `InferSelectModel` / `InferInsertModel` types for all 17 new tables (categories, mediaAssets, articles, articleAssets, assetSegments, assetTags, detectedFaces, knowledgeNodes, knowledgeRelations, channelAdvisors, channelDnaProfiles, knowledgeItems, knowledgeSyncLogs, reviveRecommendations, reviveRecords, styleAdaptations, internationalAdaptations).

### 1.12 Update `src/db/seed.ts`

Add seed data for:
- 8-10 categories (tree: 3 root + children)
- 10-15 media assets (mix of video/image/audio/document)
- 5-8 articles with different statuses
- Sample asset segments, tags, faces for 2-3 assets
- 4 channel advisors (matching existing mock: 老陈/小暖/阿强/学姐)
- Knowledge items + sync logs
- Sample revive recommendations
- Knowledge graph nodes + relations

### 1.13 Run Migrations

```bash
npm run db:generate   # Generate SQL migration
npm run db:push       # Push to Supabase
npm run db:seed       # Seed data
```

---

## Phase 2: Frontend Types → `src/lib/types.ts`

Add new types (some already exist for AI pages, add CMS types):

```typescript
// CMS: Media Asset list item
interface MediaAssetListItem {
  id, title, type, duration?, fileSize, thumbnailUrl?,
  understandingStatus, tags, usageCount, categoryName?, createdAt
}
interface MediaAssetStats {
  totalCount, videoCount, imageCount, audioCount, documentCount, totalStorageDisplay
}

// CMS: Article list item
interface ArticleListItem {
  id, title, headline?, mediaType, status, assigneeId?, assigneeName?,
  categoryId?, categoryName?, wordCount, tags, createdAt, updatedAt
}
interface ArticleDetail extends ArticleListItem {
  body, summary?, imageNotes, advisorNotes, sourceAssetId?, taskId?, publishedAt?
}
interface ArticleStats {
  totalCount, draftCount, reviewingCount, approvedCount, publishedCount, todayCount
}

// CMS: Category tree node
interface CategoryNode {
  id, name, slug, description?, parentId?, sortOrder, articleCount,
  children?: CategoryNode[]
}

// Asset Intelligence additions
interface ProcessingQueueItem { id, title, type, status, progress, duration }
interface QueueStats { queued, processing, completed, failed }
interface TagDistributionItem { name, value, color }

// Channel Advisor additions
interface ChannelAdvisorDetail extends ChannelAdvisor {
  systemPrompt?, aiEmployeeId?, knowledgeBaseIds, createdAt
}

// Asset Revive additions
interface ReviveRecord { id, asset, scenario, matchScore, status, date, reach }
interface TrendDataPoint { date, value }
interface ScenarioDistribution { name, value }
```

---

## Phase 3: DAL Functions (5 new files)

### 3.1 `src/lib/dal/assets.ts` — media asset + intelligence queries
- `getAssets(filters?)` → MediaAssetListItem[]
- `getAssetStats()` → MediaAssetStats
- `getAssetDetail(assetId)` → IntelligentAsset | undefined
- `getAssetForUnderstanding()` → latest processed asset with segments
- `getAssetSegments(assetId)` → VideoSegment[]
- `getProcessingQueue()` → ProcessingQueueItem[]
- `getQueueStats()` → QueueStats
- `getTagDistribution()` → TagDistributionItem[]
- `getKnowledgeGraph()` → { nodes, edges }

### 3.2 `src/lib/dal/articles.ts` — article queries
- `getArticles(filters?)` → ArticleListItem[]
- `getArticleStats()` → ArticleStats
- `getArticle(id)` → ArticleDetail | undefined
- `getArticlesByCategory(categoryId)` → ArticleListItem[]

### 3.3 `src/lib/dal/categories.ts` — category queries
- `getCategories()` → CategoryNode[] (flat)
- `getCategoryTree()` → CategoryNode[] (hierarchical with children)
- `getCategory(id)` → CategoryNode | undefined

### 3.4 `src/lib/dal/channel-advisors.ts` — advisor + knowledge queries
- `getChannelAdvisors()` → ChannelAdvisor[]
- `getChannelAdvisorDetail(advisorId)` → ChannelAdvisorDetail | undefined
- `getKnowledgeSources()` → { upload, cms, subscription, stats }
- `getKnowledgeItems(filters?)` → KnowledgeItem[]
- `getChannelDNA(advisorId?)` → { dimensions, report }
- `getSyncLogs(knowledgeBaseId?)` → KnowledgeSyncLog[]

### 3.5 `src/lib/dal/asset-revive.ts` — revive queries
- `getDailyRecommendations()` → ReviveRecommendation[]
- `getHotTopicMatches()` → HotTopicMatch[]
- `getReviveMetrics()` → ReviveMetrics
- `getReviveRecords(filters?)` → ReviveRecord[]
- `getReviveTrend(days)` → TrendDataPoint[]
- `getScenarioDistribution()` → ScenarioDistribution[]

All DAL functions use `getCurrentUserOrg()` from `src/lib/dal/auth.ts` for org-scoping.

---

## Phase 4: Server Actions (5 new files)

All actions: `"use server"`, `requireAuth()`, Drizzle mutations, `revalidatePath()`.

### 4.1 `src/app/actions/assets.ts`
- `createAsset(data)` → { assetId }
- `updateAsset(assetId, data)` → void
- `deleteAsset(assetId)` → void
- `triggerUnderstanding(assetId)` → void
- `batchTriggerUnderstanding(assetIds)` → void
- `correctTag(tagId, correctedLabel, correctedCategory?)` → void

### 4.2 `src/app/actions/articles.ts`
- `createArticle(data)` → { articleId }
- `updateArticle(articleId, data)` → void
- `updateArticleStatus(articleId, status)` → void
- `deleteArticle(articleId)` → void
- `batchUpdateArticleStatus(articleIds, status)` → void

### 4.3 `src/app/actions/categories.ts`
- `createCategory(data)` → { categoryId }
- `updateCategory(categoryId, data)` → void
- `deleteCategory(categoryId)` → void
- `reorderCategories(orderedIds)` → void

### 4.4 `src/app/actions/channel-advisors.ts`
- `createChannelAdvisor(data)` → { advisorId }
- `updateAdvisorPersonality(advisorId, data)` → void
- `toggleAdvisorStatus(advisorId, status)` → void
- `uploadKnowledgeDocument(knowledgeBaseId, formData)` → { documentId, chunkCount }
- `addKnowledgeSubscription(knowledgeBaseId, config)` → void
- `syncKnowledgeBase(knowledgeBaseId)` → void
- `testAdvisorChat(advisorId, message)` → { response }
- `analyzeChannelDNA(advisorId)` → void

### 4.5 `src/app/actions/asset-revive.ts`
- `triggerDailyReviveScan()` → void
- `respondToRecommendation(recommendationId, action)` → void
- `generateStyleVariant(assetId, targetStyle)` → StyleVariant
- `generateInternationalAdaptation(assetId, targetLanguage)` → InternationalAdaptation

---

## Phase 5: New CMS Pages (3 new routes)

### 5.1 `/media-assets` — Media Asset Library
- **Server:** `src/app/(dashboard)/media-assets/page.tsx`
  - Calls: `getAssets()`, `getAssetStats()`, `getCategories()`
- **Client:** `src/app/(dashboard)/media-assets/media-assets-client.tsx`
  - Stats row (total count, by type, storage)
  - Filter bar (search, type, category, status)
  - Grid/list view toggle, asset cards with thumbnail/title/type/tags/status
  - Upload dialog, bulk actions (trigger AI understanding, delete)

### 5.2 `/articles` — Article Management
- **Server:** `src/app/(dashboard)/articles/page.tsx`
  - Calls: `getArticles()`, `getArticleStats()`, `getCategories()`
- **Client:** `src/app/(dashboard)/articles/articles-client.tsx`
  - Stats row (total, by status)
  - Tabs: all / draft / reviewing / approved / published
  - Filter bar (search, category, media type, assignee)
  - Article list with title/status/type/assignee/category/wordCount
  - "新建稿件" button → `/articles/create`

### 5.3 `/articles/[id]` — Article Edit
- **Server:** `src/app/(dashboard)/articles/[id]/page.tsx`
  - Calls: `getArticle(id)`, `getCategories()`, `getChannelAdvisors()`
- **Client:** `src/app/(dashboard)/articles/[id]/article-edit-client.tsx`
  - Left: headline input, body editor, image notes
  - Right: metadata form (category, media type, tags), advisor notes, AI assist buttons
  - Top: save / submit / preview actions

### 5.4 `/articles/create` — Create Article
- **Server:** `src/app/(dashboard)/articles/create/page.tsx`
  - Calls: `getCategories()`
- **Client:** `src/app/(dashboard)/articles/create/article-create-client.tsx`
  - Same layout as edit, empty initial state

### 5.5 `/categories` — Category Management
- **Server:** `src/app/(dashboard)/categories/page.tsx`
  - Calls: `getCategoryTree()`
- **Client:** `src/app/(dashboard)/categories/categories-client.tsx`
  - Left: collapsible category tree with drag-reorder
  - Right: selected category detail panel (edit name, description, parent)
  - Create category dialog

---

## Phase 6: Migrate Existing AI Pages (5 pages)

For each page: extract existing `"use client"` code into `*-client.tsx`, create new server `page.tsx` that fetches from DAL.

### 6.1 `/asset-intelligence`
- **Server page.tsx:** calls `getAssetForUnderstanding()`, `getProcessingQueue()`, `getQueueStats()`, `getTagDistribution()`, `getKnowledgeGraph()`
- **Client `asset-intelligence-client.tsx`:** receives data as props, keeps all existing UI (4 tabs: understand, tagging, graph, queue)
- Static UI constants (`tagCategoryMeta`, `nodeTypeColor`) remain client-side

### 6.2 `/channel-advisor`
- **Server page.tsx:** calls `getChannelAdvisors()`
- **Client `channel-advisor-client.tsx`:** advisor card grid, status badges

### 6.3 `/channel-advisor/create`
- **Server page.tsx:** calls `getKnowledgeSources()`
- **Client `create-advisor-client.tsx`:** 5-step wizard, connected to server actions

### 6.4 `/channel-knowledge`
- **Server page.tsx:** calls `getKnowledgeSources()`, `getKnowledgeItems()`, `getChannelDNA()`, `getSyncLogs()`
- **Client `channel-knowledge-client.tsx`:** 4 tabs (sources, browse, dna, logs)

### 6.5 `/asset-revive`
- **Server page.tsx:** calls `getDailyRecommendations()`, `getHotTopicMatches()`, `getReviveMetrics()`, `getReviveRecords()`, `getReviveTrend(7)`, `getScenarioDistribution()`
- **Client `asset-revive-client.tsx`:** 5 tabs (daily, hotmatch, style, international, dashboard)

---

## Phase 7: Navigation Update

### Update `src/components/layout/app-sidebar.tsx`

Add new "内容管理" collapsible group between "工作空间" and "智能媒资":

```typescript
import { Film, FileText, FolderTree } from "lucide-react"; // add imports

const cmsItems: NavItem[] = [
  { label: "媒资管理", href: "/media-assets", icon: Film },
  { label: "稿件管理", href: "/articles", icon: FileText },
  { label: "栏目管理", href: "/categories", icon: FolderTree },
];
```

Add `isCmsActive` detection and render as collapsible group with `Archive` icon and "内容管理" label, using same pattern as "智能媒资" group.

Final sidebar order:
1. 工作空间 (existing)
2. **内容管理** (NEW: 媒资管理, 稿件管理, 栏目管理)
3. 智能媒资 (existing, migrated to DB)
4. 创作者中心 (existing)
5. 运营分析 (existing)

---

## Phase 8: Retire Mock Data

After all pages are migrated, remove mock data imports from:
- `src/data/asset-intelligence-data.ts`
- `src/data/channel-advisors.ts`
- `src/data/channel-knowledge-data.ts`
- `src/data/asset-revive-data.ts`

Do NOT delete the files yet — other unmigrated pages may reference shared type patterns.

---

## Implementation Order (Sequential Steps)

| Step | Description | Files |
|------|-------------|-------|
| 1 | Add 13 new enums | `src/db/schema/enums.ts` |
| 2 | Create categories schema | `src/db/schema/categories.ts` |
| 3 | Create media-assets schema | `src/db/schema/media-assets.ts` |
| 4 | Create articles schema | `src/db/schema/articles.ts` |
| 5 | Create asset-intelligence schema | `src/db/schema/asset-intelligence.ts` |
| 6 | Create knowledge-graph schema | `src/db/schema/knowledge-graph.ts` |
| 7 | Create channel-advisors schema | `src/db/schema/channel-advisors.ts` |
| 8 | Extend knowledge-bases + add items/logs | `src/db/schema/knowledge-bases.ts` |
| 9 | Create asset-revive schema | `src/db/schema/asset-revive.ts` |
| 10 | Update schema index | `src/db/schema/index.ts` |
| 11 | Update DB types | `src/db/types.ts` |
| 12 | Add frontend types | `src/lib/types.ts` |
| 13 | Run db:generate + db:push | terminal |
| 14 | Update seed file + run db:seed | `src/db/seed.ts` |
| 15 | Create DAL: assets.ts | `src/lib/dal/assets.ts` |
| 16 | Create DAL: articles.ts | `src/lib/dal/articles.ts` |
| 17 | Create DAL: categories.ts | `src/lib/dal/categories.ts` |
| 18 | Create DAL: channel-advisors.ts | `src/lib/dal/channel-advisors.ts` |
| 19 | Create DAL: asset-revive.ts | `src/lib/dal/asset-revive.ts` |
| 20 | Create actions: assets.ts | `src/app/actions/assets.ts` |
| 21 | Create actions: articles.ts | `src/app/actions/articles.ts` |
| 22 | Create actions: categories.ts | `src/app/actions/categories.ts` |
| 23 | Create actions: channel-advisors.ts | `src/app/actions/channel-advisors.ts` |
| 24 | Create actions: asset-revive.ts | `src/app/actions/asset-revive.ts` |
| 25 | Update sidebar navigation | `src/components/layout/app-sidebar.tsx` |
| 26 | Create /media-assets page | `src/app/(dashboard)/media-assets/` |
| 27 | Create /articles page | `src/app/(dashboard)/articles/` |
| 28 | Create /articles/[id] page | `src/app/(dashboard)/articles/[id]/` |
| 29 | Create /articles/create page | `src/app/(dashboard)/articles/create/` |
| 30 | Create /categories page | `src/app/(dashboard)/categories/` |
| 31 | Migrate /asset-intelligence | split server/client |
| 32 | Migrate /channel-advisor | split server/client |
| 33 | Migrate /channel-advisor/create | split server/client |
| 34 | Migrate /channel-knowledge | split server/client |
| 35 | Migrate /asset-revive | split server/client |
| 36 | Retire mock data imports | remove imports from migrated pages |

---

## Verification

1. **Type check:** `npx tsc --noEmit` — no type errors
2. **Build:** `npm run build` — successful production build
3. **Seed:** `npm run db:seed` — seed data populates all new tables
4. **Pages load:** Visit each route, verify data renders:
   - `/media-assets` — asset grid with filters
   - `/articles` — article list with status tabs
   - `/categories` — tree view with edit panel
   - `/asset-intelligence` — 4 tabs with DB data
   - `/channel-advisor` — advisor cards from DB
   - `/channel-advisor/create` — wizard functional
   - `/channel-knowledge` — 4 tabs with DB data
   - `/asset-revive` — 5 tabs with DB data
5. **Mutations:** Test create/update/delete for articles, assets, categories
6. **Lint:** `npm run lint` — no lint errors

---

## Key Reference Files

| Purpose | File |
|---------|------|
| Existing DAL pattern | `src/lib/dal/employees.ts` |
| Existing action pattern | `src/app/actions/employees.ts` |
| Server/client split example | `src/app/(dashboard)/team-hub/page.tsx` + `team-hub-client.tsx` |
| Auth helper | `src/lib/dal/auth.ts` → `getCurrentUserOrg()` |
| Frontend types contract | `src/lib/types.ts` |
| Current sidebar | `src/components/layout/app-sidebar.tsx` |
| Existing knowledge-bases | `src/db/schema/knowledge-bases.ts` |
| Existing enums | `src/db/schema/enums.ts` |
| Drizzle config | `drizzle.config.ts` |
