/**
 * Import crawled JSON article data into collection pool.
 *
 * Input shape:
 *   [{ keyword, source, url, title, date, author, content }, ...]
 *
 * Dedupe policy for this script is intentionally URL-only:
 *   - normalize URL with src/lib/collection/normalize.ts
 *   - compute URL hash
 *   - use URL hash as content_fingerprint
 *   - skip any row whose URL hash already exists in collected_items for the org
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import fs from "node:fs";
import path from "node:path";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

const JSON_IMPORT_SOURCE_NAME = "__system_json_import__";
const JSON_IMPORT_SOURCE_TYPE = "json_import";
const BATCH_SIZE = 500;

let db: typeof import("@/db").db;
let collectedItemContents: typeof import("@/db/schema").collectedItemContents;
let collectedItems: typeof import("@/db/schema").collectedItems;
let collectionRuns: typeof import("@/db/schema").collectionRuns;
let collectionSources: typeof import("@/db/schema").collectionSources;
let organizations: typeof import("@/db/schema").organizations;
let computeUrlHash: typeof import("@/lib/collection/normalize").computeUrlHash;
let normalizeUrl: typeof import("@/lib/collection/normalize").normalizeUrl;
let JSON_IMPORT_PLATFORM: typeof import("@/lib/collection/json-import").JSON_IMPORT_PLATFORM;
let getJsonImportAccountName: typeof import("@/lib/collection/json-import").getJsonImportAccountName;

async function initModules() {
  ({ db } = await import("@/db"));
  ({
    collectedItemContents,
    collectedItems,
    collectionRuns,
    collectionSources,
    organizations,
  } = await import("@/db/schema"));
  ({ computeUrlHash, normalizeUrl } = await import("@/lib/collection/normalize"));
  ({ JSON_IMPORT_PLATFORM, getJsonImportAccountName } = await import("@/lib/collection/json-import"));
}

interface JsonArticleRow {
  keyword?: unknown;
  source?: unknown;
  url?: unknown;
  title?: unknown;
  date?: unknown;
  author?: unknown;
  content?: unknown;
}

function text(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s || undefined;
}

function parseDate(value: unknown): Date | undefined {
  const s = text(value);
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function summaryFrom(content: string | undefined): string | undefined {
  if (!content) return undefined;
  return content.replace(/\s+/g, " ").trim().slice(0, 240) || undefined;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function getOrgId(): Promise<string> {
  const [org] = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .orderBy(asc(organizations.createdAt))
    .limit(1);
  if (!org) throw new Error("No organization found. Seed or create an organization first.");
  console.log(`Using organization: ${org.name} (${org.id})`);
  return org.id;
}

async function getOrCreateJsonImportSource(orgId: string): Promise<string> {
  await db
    .insert(collectionSources)
    .values({
      organizationId: orgId,
      name: JSON_IMPORT_SOURCE_NAME,
      sourceType: JSON_IMPORT_SOURCE_TYPE,
      config: {},
      targetModules: [],
      enabled: false,
    })
    .onConflictDoNothing();

  const [source] = await db
    .select({ id: collectionSources.id })
    .from(collectionSources)
    .where(
      and(
        eq(collectionSources.organizationId, orgId),
        eq(collectionSources.name, JSON_IMPORT_SOURCE_NAME),
      ),
    )
    .limit(1);
  if (!source) throw new Error("Failed to create json import source.");
  return source.id;
}

async function createRun(orgId: string, sourceId: string, filePaths: string[]): Promise<string> {
  const [run] = await db
    .insert(collectionRuns)
    .values({
      sourceId,
      organizationId: orgId,
      trigger: "manual",
      startedAt: new Date(),
      status: "running",
      itemsAttempted: 0,
      itemsInserted: 0,
      itemsMerged: 0,
      itemsFailed: 0,
      metadata: {
        source: "json_import",
        files: filePaths,
        dedupe: "url_hash_only",
      },
    })
    .returning({ id: collectionRuns.id });
  if (!run) throw new Error("Failed to create collection run.");
  return run.id;
}

async function loadExistingUrlHashes(orgId: string, hashes: string[]): Promise<Set<string>> {
  const existing = new Set<string>();
  for (const part of chunk(hashes, 1000)) {
    if (part.length === 0) continue;
    const rows = await db
      .select({ hash: collectedItems.canonicalUrlHash })
      .from(collectedItems)
      .where(
        and(
          eq(collectedItems.organizationId, orgId),
          inArray(collectedItems.canonicalUrlHash, part),
        ),
      );
    for (const row of rows) {
      if (row.hash) existing.add(row.hash);
    }
  }
  return existing;
}

async function main() {
  await initModules();

  const rawPaths = process.argv.slice(2);
  if (rawPaths.length === 0) {
    throw new Error("Usage: pnpm tsx scripts/import-json-collected-items.ts <file.json> [...]");
  }

  const filePaths = rawPaths.map((p) => path.resolve(p));
  const orgId = await getOrgId();
  const sourceId = await getOrCreateJsonImportSource(orgId);
  const runId = await createRun(orgId, sourceId, filePaths);
  const capturedAt = new Date();

  let readRows = 0;
  let invalidRows = 0;
  let duplicateInInput = 0;
  let duplicateInDb = 0;
  let inserted = 0;
  let failed = 0;

  const seenInInput = new Set<string>();
  const pending: Array<{
    hash: string;
    canonicalUrl: string;
    rawUrl: string;
    title: string;
    content?: string;
    summary?: string;
    publishedAt?: Date;
    channel: string;
    keyword?: string;
    sourceName?: string;
    author?: string;
    rawRowMetadata: Omit<JsonArticleRow, "content">;
  }> = [];

  for (const filePath of filePaths) {
    const fileName = path.basename(filePath, ".json");
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as JsonArticleRow[];
    if (!Array.isArray(parsed)) throw new Error(`${filePath} is not a JSON array.`);

    for (const row of parsed) {
      readRows++;
      const rawUrl = text(row.url);
      const canonicalUrl = rawUrl ? normalizeUrl(rawUrl) : null;
      const hash = rawUrl ? computeUrlHash(rawUrl) : null;
      const title = text(row.title);
      if (!rawUrl || !canonicalUrl || !hash || !title) {
        invalidRows++;
        continue;
      }
      if (seenInInput.has(hash)) {
        duplicateInInput++;
        continue;
      }
      seenInInput.add(hash);

      const content = text(row.content);
      pending.push({
        hash,
        canonicalUrl,
        rawUrl,
        title,
        content,
        summary: summaryFrom(content),
        publishedAt: parseDate(row.date),
        channel: `json_import/${fileName}`,
        keyword: text(row.keyword),
        sourceName: text(row.source),
        author: text(row.author),
        rawRowMetadata: {
          keyword: row.keyword,
          source: row.source,
          url: row.url,
          title: row.title,
          date: row.date,
          author: row.author,
        },
      });
    }
  }

  console.log(`Read rows: ${readRows}`);
  console.log(`Unique valid URLs in input: ${pending.length}`);
  console.log(`Invalid rows skipped: ${invalidRows}`);
  console.log(`Duplicate URLs inside input skipped: ${duplicateInInput}`);

  const existingHashes = await loadExistingUrlHashes(
    orgId,
    pending.map((item) => item.hash),
  );
  duplicateInDb = existingHashes.size;
  const toInsert = pending.filter((item) => !existingHashes.has(item.hash));
  console.log(`Existing URL duplicates in DB skipped: ${duplicateInDb}`);
  console.log(`Rows to insert: ${toInsert.length}`);

  for (const part of chunk(toInsert, BATCH_SIZE)) {
    try {
      const now = new Date();
      const insertedRows = await db
        .insert(collectedItems)
        .values(
          part.map((item) => {
            const accountName = getJsonImportAccountName(
              item.channel,
              item.sourceName,
              item.author,
            );
            return {
              organizationId: orgId,
              contentFingerprint: item.hash,
              canonicalUrl: item.canonicalUrl,
              canonicalUrlHash: item.hash,
              title: item.title,
              summary: item.summary,
              publishedAt: item.publishedAt,
              firstSeenSourceId: sourceId,
              firstSeenChannel: item.channel,
              firstSeenAt: capturedAt,
              sourceChannels: [
                {
                  channel: item.channel,
                  url: item.rawUrl,
                  sourceId,
                  runId,
                  capturedAt: capturedAt.toISOString(),
                },
              ],
              category: [],
              tags: item.keyword ? [item.keyword] : null,
              rawMetadata: {
                importedFromJson: true,
                jsonImportDedupe: "url_hash_only",
                keyword: item.keyword ?? null,
                source: item.sourceName ?? null,
                publicAccountName: accountName,
                author: accountName,
                reporterAuthor: item.author ?? null,
                originalRow: item.rawRowMetadata,
              },
              contentType: "image_text",
              attachments: [],
              externalId: null,
              platform: JSON_IMPORT_PLATFORM,
              author: accountName,
              accountId: null,
              accountHandle: null,
              authorFollowerCount: null,
              sentiment: null,
              infoType: null,
              likeCount: 0,
              commentCount: 0,
              shareCount: 0,
              viewCount: 0,
              favoriteCount: 0,
              replyCount: 0,
              ipRegion: null,
              postRegion: null,
              mentionedRegions: null,
              matchedKeywords: item.keyword ? [item.keyword] : null,
              matchedRegions: null,
              industries: null,
              coverImageUrl: null,
              durationSeconds: null,
              createdAt: now,
              updatedAt: now,
            };
          }),
        )
        .onConflictDoNothing({
          target: [collectedItems.organizationId, collectedItems.contentFingerprint],
        })
        .returning({ id: collectedItems.id, hash: collectedItems.contentFingerprint });

      inserted += insertedRows.length;
      const idByHash = new Map(insertedRows.map((row) => [row.hash, row.id]));
      const contentRows = part
        .map((item) => {
          const itemId = idByHash.get(item.hash);
          if (!itemId || !item.content) return null;
          return {
            itemId,
            content: item.content,
            ocrText: null,
            asrText: null,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);
      if (contentRows.length > 0) {
        await db.insert(collectedItemContents).values(contentRows).onConflictDoNothing();
      }
      process.stdout.write(".");
    } catch (err) {
      failed += part.length;
      console.error("\nBatch failed:", err instanceof Error ? err.message : String(err));
    }
  }

  await db
    .update(collectionRuns)
    .set({
      finishedAt: new Date(),
      status: failed > 0 ? "partial" : "success",
      itemsAttempted: readRows,
      itemsInserted: inserted,
      itemsMerged: duplicateInInput + duplicateInDb,
      itemsFailed: invalidRows + failed,
      metadata: sql`${collectionRuns.metadata} || ${JSON.stringify({
        readRows,
        uniqueValidInputUrls: pending.length,
        invalidRows,
        duplicateInInput,
        duplicateInDb,
        inserted,
        failed,
      })}::jsonb`,
    })
    .where(eq(collectionRuns.id, runId));

  console.log("\nImport result");
  console.log(`Run ID: ${runId}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped duplicate URLs: ${duplicateInInput + duplicateInDb}`);
  console.log(`Invalid/failed: ${invalidRows + failed}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
