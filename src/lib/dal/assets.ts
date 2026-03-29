import { db } from "@/db";
import { mediaAssets, assetSegments, assetTags, detectedFaces, knowledgeNodes, knowledgeRelations_, categories } from "@/db/schema";
import { eq, desc, and, count, sql, asc, like, or, ilike } from "drizzle-orm";
import { getCurrentUserOrg } from "./auth";
import type {
  MediaAssetListItem, MediaAssetStats, IntelligentAsset, VideoSegment, AssetTag, DetectedFace,
  ProcessingQueueItem, QueueStats, TagDistributionItem, KnowledgeGraphNode, KnowledgeGraphEdge,
  MediaAssetFull, PaginatedAssets, MediaCategoryNode, AssetDetailFull, MediaLibraryType,
} from "@/lib/types";

export async function getAssets(): Promise<MediaAssetListItem[]> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return [];

  const rows = await db.query.mediaAssets.findMany({
    where: eq(mediaAssets.organizationId, orgId),
    orderBy: [desc(mediaAssets.createdAt)],
    with: { category: true },
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type,
    duration: r.duration || undefined,
    fileSize: Number(r.fileSize) || 0,
    fileSizeDisplay: r.fileSizeDisplay || undefined,
    thumbnailUrl: r.thumbnailUrl || undefined,
    understandingStatus: r.understandingStatus,
    tags: (r.tags as string[]) || [],
    usageCount: r.usageCount,
    categoryName: r.category?.name,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getAssetStats(): Promise<MediaAssetStats> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { totalCount: 0, videoCount: 0, imageCount: 0, audioCount: 0, documentCount: 0, totalStorageDisplay: "0" };

  const rows = await db.query.mediaAssets.findMany({
    where: eq(mediaAssets.organizationId, orgId),
  });

  let totalSize = 0;
  let videoCount = 0, imageCount = 0, audioCount = 0, documentCount = 0;
  for (const r of rows) {
    totalSize += Number(r.fileSize) || 0;
    if (r.type === "video") videoCount++;
    else if (r.type === "image") imageCount++;
    else if (r.type === "audio") audioCount++;
    else if (r.type === "document") documentCount++;
  }

  const gb = totalSize / (1024 * 1024 * 1024);
  const totalStorageDisplay = gb >= 1 ? `${gb.toFixed(1)}GB` : `${(totalSize / (1024 * 1024)).toFixed(0)}MB`;

  return { totalCount: rows.length, videoCount, imageCount, audioCount, documentCount, totalStorageDisplay };
}

export async function getAssetDetail(assetId: string): Promise<IntelligentAsset | undefined> {
  const row = await db.query.mediaAssets.findFirst({
    where: eq(mediaAssets.id, assetId),
  });
  if (!row) return undefined;

  const segments = await getAssetSegments(assetId);

  return {
    id: row.id,
    title: row.title,
    type: row.type,
    duration: row.duration || "",
    fileSize: row.fileSizeDisplay || "",
    thumbnailPlaceholder: row.title,
    status: row.understandingStatus,
    progress: row.understandingProgress,
    segments,
    totalTags: row.totalTags,
    createdAt: row.createdAt.toISOString(),
    processedAt: row.processedAt?.toISOString() || "",
  };
}

export async function getAssetForUnderstanding(): Promise<IntelligentAsset | undefined> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return undefined;

  const row = await db.query.mediaAssets.findFirst({
    where: and(
      eq(mediaAssets.organizationId, orgId),
      eq(mediaAssets.understandingStatus, "completed"),
    ),
    orderBy: [desc(mediaAssets.processedAt)],
  });

  if (!row) return undefined;
  return getAssetDetail(row.id);
}

export async function getAssetSegments(assetId: string): Promise<VideoSegment[]> {
  const segs = await db.query.assetSegments.findMany({
    where: eq(assetSegments.assetId, assetId),
    orderBy: [assetSegments.segmentOrder],
  });

  const result: VideoSegment[] = [];
  for (const seg of segs) {
    const tags = await db.query.assetTags.findMany({
      where: eq(assetTags.segmentId, seg.id),
    });
    const faces = await db.query.detectedFaces.findMany({
      where: eq(detectedFaces.segmentId, seg.id),
    });

    result.push({
      id: seg.id,
      startTime: seg.startTime || "",
      endTime: seg.endTime || "",
      transcript: seg.transcript || "",
      ocrTexts: (seg.ocrTexts as string[]) || [],
      nluSummary: seg.nluSummary || "",
      tags: tags.map((t) => ({
        id: t.id,
        category: t.category,
        label: t.label,
        confidence: t.confidence,
      })),
      detectedFaces: faces.map((f) => ({
        id: f.id,
        name: f.name,
        role: f.role || "",
        confidence: f.confidence,
        appearances: f.appearances || 1,
      })),
      sceneType: seg.sceneType || "",
      visualQuality: seg.visualQuality || 0,
    });
  }

  return result;
}

export async function getProcessingQueue(): Promise<ProcessingQueueItem[]> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return [];

  const rows = await db.query.mediaAssets.findMany({
    where: eq(mediaAssets.organizationId, orgId),
    orderBy: [desc(mediaAssets.createdAt)],
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type,
    status: r.understandingStatus,
    progress: r.understandingProgress,
    duration: r.duration || undefined,
  }));
}

export async function getQueueStats(): Promise<QueueStats> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { queued: 0, processing: 0, completed: 0, failed: 0 };

  const rows = await db.query.mediaAssets.findMany({
    where: eq(mediaAssets.organizationId, orgId),
  });

  const stats: QueueStats = { queued: 0, processing: 0, completed: 0, failed: 0 };
  for (const r of rows) {
    stats[r.understandingStatus]++;
  }
  return stats;
}

export async function getTagDistribution(): Promise<TagDistributionItem[]> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return [];

  const assetIds = await db.query.mediaAssets.findMany({
    where: eq(mediaAssets.organizationId, orgId),
    columns: { id: true },
  });

  if (assetIds.length === 0) return [];

  const colors: Record<string, string> = {
    topic: "#3b82f6", event: "#f59e0b", emotion: "#ec4899", person: "#6366f1",
    location: "#22c55e", shotType: "#a855f7", quality: "#14b8a6", object: "#f97316", action: "#ef4444",
  };

  const tags = await db.query.assetTags.findMany();
  const distribution = new Map<string, number>();
  for (const tag of tags) {
    distribution.set(tag.category, (distribution.get(tag.category) || 0) + 1);
  }

  return Array.from(distribution.entries()).map(([name, value]) => ({
    name,
    value,
    color: colors[name] || "#6b7280",
  }));
}

export interface TagCategorySummaryItem {
  category: string;
  count: number;
  examples: string[];
}

export async function getTagCategorySummary(): Promise<TagCategorySummaryItem[]> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return [];

  const assetIds = await db.query.mediaAssets.findMany({
    where: eq(mediaAssets.organizationId, orgId),
    columns: { id: true },
  });
  if (assetIds.length === 0) return [];

  const tags = await db.query.assetTags.findMany();

  const categoryMap = new Map<string, { count: number; labels: Set<string> }>();
  for (const tag of tags) {
    const entry = categoryMap.get(tag.category) || { count: 0, labels: new Set<string>() };
    entry.count++;
    entry.labels.add(tag.label);
    categoryMap.set(tag.category, entry);
  }

  return Array.from(categoryMap.entries()).map(([category, { count, labels }]) => ({
    category,
    count,
    examples: Array.from(labels).slice(0, 4),
  }));
}

export interface AssetTagListItem {
  id: string;
  title: string;
  tagCount: number;
  mainCategory: string;
  status: "queued" | "processing" | "completed" | "failed";
}

export async function getAssetTagList(): Promise<AssetTagListItem[]> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return [];

  const rows = await db.query.mediaAssets.findMany({
    where: eq(mediaAssets.organizationId, orgId),
    orderBy: [desc(mediaAssets.processedAt)],
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    tagCount: r.totalTags,
    mainCategory: (r.tags as string[])?.[0] || "topic",
    status: r.understandingStatus,
  }));
}

// ---------------------------------------------------------------------------
// Smart Media Asset module DAL
// ---------------------------------------------------------------------------

export interface AssetFilters {
  search?: string;
  type?: string;
  categoryId?: string;
}

export interface AssetSort {
  field: "createdAt" | "title" | "fileSize";
  direction: "asc" | "desc";
}

function mapRowToFull(r: typeof mediaAssets.$inferSelect & { category?: { name: string } | null; uploader?: { displayName: string | null } | null }): MediaAssetFull {
  return {
    id: r.id,
    title: r.title,
    type: r.type,
    duration: r.duration || undefined,
    fileSize: Number(r.fileSize) || 0,
    fileSizeDisplay: r.fileSizeDisplay || undefined,
    thumbnailUrl: r.thumbnailUrl || undefined,
    understandingStatus: r.understandingStatus,
    tags: (r.tags as string[]) || [],
    usageCount: r.usageCount,
    categoryName: r.category?.name,
    createdAt: r.createdAt.toISOString(),
    libraryType: r.libraryType,
    isPublic: r.isPublic,
    securityLevel: r.securityLevel,
    reviewStatus: r.reviewStatus,
    catalogStatus: r.catalogStatus,
    transcodeStatus: r.transcodeStatus,
    cdnStatus: r.cdnStatus,
    cmsStatus: r.cmsStatus,
    versionNumber: r.versionNumber,
    uploaderName: r.uploader?.displayName || undefined,
    description: r.description || undefined,
    fileName: r.fileName || undefined,
    width: r.width || undefined,
    height: r.height || undefined,
    tosObjectKey: r.tosObjectKey || undefined,
    mimeType: r.mimeType || undefined,
  };
}

export async function getAssetsByLibrary(
  library: MediaLibraryType,
  categoryId: string | null,
  page: number,
  pageSize: number,
  filters?: AssetFilters,
  sort?: AssetSort,
): Promise<PaginatedAssets> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { items: [], total: 0, page, pageSize, totalPages: 0 };

  const conditions = [
    eq(mediaAssets.organizationId, orgId),
    eq(mediaAssets.isDeleted, false),
  ];

  if (library === "personal") {
    conditions.push(eq(mediaAssets.libraryType, "personal"));
  } else if (library === "product") {
    conditions.push(eq(mediaAssets.libraryType, "product"));
    if (categoryId) {
      conditions.push(eq(mediaAssets.categoryId, categoryId));
    }
  } else if (library === "public") {
    conditions.push(eq(mediaAssets.isPublic, true));
  } else if (library === "recycle") {
    // Override: query deleted assets
    conditions.length = 0;
    conditions.push(
      eq(mediaAssets.organizationId, orgId),
      eq(mediaAssets.isDeleted, true),
    );
  }

  if (filters?.type && filters.type !== "all") {
    conditions.push(eq(mediaAssets.type, filters.type as "video" | "image" | "audio" | "document" | "manuscript"));
  }

  if (filters?.search) {
    conditions.push(ilike(mediaAssets.title, `%${filters.search}%`));
  }

  // Get total count
  const countResult = await db
    .select({ value: count() })
    .from(mediaAssets)
    .where(and(...conditions));
  const total = countResult[0]?.value || 0;

  // Determine ordering
  let orderBy;
  const dir = sort?.direction === "asc" ? asc : desc;
  if (sort?.field === "title") {
    orderBy = [dir(mediaAssets.title)];
  } else if (sort?.field === "fileSize") {
    orderBy = [dir(mediaAssets.fileSize)];
  } else {
    orderBy = [dir(mediaAssets.createdAt)];
  }

  const rows = await db.query.mediaAssets.findMany({
    where: and(...conditions),
    orderBy,
    limit: pageSize,
    offset: (page - 1) * pageSize,
    with: { category: true, uploader: true },
  });

  return {
    items: rows.map(mapRowToFull),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getLibraryStats(library: MediaLibraryType): Promise<MediaAssetStats> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { totalCount: 0, videoCount: 0, imageCount: 0, audioCount: 0, documentCount: 0, totalStorageDisplay: "0" };

  const conditions = [eq(mediaAssets.organizationId, orgId), eq(mediaAssets.isDeleted, false)];

  if (library === "personal") {
    conditions.push(eq(mediaAssets.libraryType, "personal"));
  } else if (library === "product") {
    conditions.push(eq(mediaAssets.libraryType, "product"));
  } else if (library === "public") {
    conditions.push(eq(mediaAssets.isPublic, true));
  } else if (library === "recycle") {
    conditions.length = 0;
    conditions.push(eq(mediaAssets.organizationId, orgId), eq(mediaAssets.isDeleted, true));
  }

  const rows = await db.query.mediaAssets.findMany({
    where: and(...conditions),
    columns: { type: true, fileSize: true },
  });

  let totalSize = 0;
  let videoCount = 0, imageCount = 0, audioCount = 0, documentCount = 0, manuscriptCount = 0;
  for (const r of rows) {
    totalSize += Number(r.fileSize) || 0;
    if (r.type === "video") videoCount++;
    else if (r.type === "image") imageCount++;
    else if (r.type === "audio") audioCount++;
    else if (r.type === "document") documentCount++;
    else if (r.type === "manuscript") manuscriptCount++;
  }

  const gb = totalSize / (1024 * 1024 * 1024);
  const totalStorageDisplay = gb >= 1 ? `${gb.toFixed(1)}GB` : `${(totalSize / (1024 * 1024)).toFixed(0)}MB`;

  return { totalCount: rows.length, videoCount, imageCount, audioCount, documentCount, manuscriptCount, totalStorageDisplay };
}

export async function getMediaCategoryTree(): Promise<MediaCategoryNode[]> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return [];

  const rows = await db.query.categories.findMany({
    where: and(
      eq(categories.organizationId, orgId),
      eq(categories.isActive, true),
      eq(categories.scope, "media"),
    ),
    orderBy: [categories.level, categories.sortOrder],
  });

  // Count media assets per category
  const allAssets = await db.query.mediaAssets.findMany({
    where: and(eq(mediaAssets.organizationId, orgId), eq(mediaAssets.isDeleted, false), eq(mediaAssets.libraryType, "product")),
    columns: { categoryId: true },
  });

  const assetCounts = new Map<string, number>();
  for (const a of allAssets) {
    if (a.categoryId) {
      assetCounts.set(a.categoryId, (assetCounts.get(a.categoryId) || 0) + 1);
    }
  }

  const flat: MediaCategoryNode[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description || undefined,
    parentId: r.parentId,
    sortOrder: r.sortOrder,
    articleCount: 0,
    mediaAssetCount: assetCounts.get(r.id) || 0,
    workflowId: r.workflowId || undefined,
    videoTranscodeGroup: r.videoTranscodeGroup || undefined,
    audioTranscodeGroup: r.audioTranscodeGroup || undefined,
  }));

  // Build tree
  const map = new Map<string, MediaCategoryNode>();
  for (const cat of flat) {
    map.set(cat.id, { ...cat, children: [] });
  }

  const roots: MediaCategoryNode[] = [];
  for (const cat of map.values()) {
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId)!.children!.push(cat);
    } else {
      roots.push(cat);
    }
  }

  return roots;
}

export async function getAssetDetailFull(assetId: string): Promise<AssetDetailFull | undefined> {
  const row = await db.query.mediaAssets.findFirst({
    where: eq(mediaAssets.id, assetId),
    with: { category: true, uploader: true },
  });
  if (!row) return undefined;

  const segments = await getAssetSegments(assetId);

  // Build category path
  let categoryPath: string | undefined;
  if (row.categoryId && row.category) {
    const pathParts = [row.category.name];
    let parentId = row.category.parentId;
    while (parentId) {
      const parent = await db.query.categories.findFirst({
        where: eq(categories.id, parentId),
      });
      if (!parent) break;
      pathParts.unshift(parent.name);
      parentId = parent.parentId;
    }
    categoryPath = pathParts.join(" > ");
  }

  return {
    id: row.id,
    title: row.title,
    type: row.type,
    description: row.description || undefined,
    fileUrl: row.fileUrl || undefined,
    thumbnailUrl: row.thumbnailUrl || undefined,
    fileName: row.fileName || undefined,
    fileSize: Number(row.fileSize) || 0,
    fileSizeDisplay: row.fileSizeDisplay || undefined,
    mimeType: row.mimeType || undefined,
    duration: row.duration || undefined,
    durationSeconds: row.durationSeconds || undefined,
    width: row.width || undefined,
    height: row.height || undefined,
    tosObjectKey: row.tosObjectKey || undefined,
    tosBucket: row.tosBucket || undefined,
    source: row.source || undefined,
    tags: (row.tags as string[]) || [],
    libraryType: row.libraryType,
    isPublic: row.isPublic,
    securityLevel: row.securityLevel,
    reviewStatus: row.reviewStatus,
    catalogStatus: row.catalogStatus,
    transcodeStatus: row.transcodeStatus,
    cdnStatus: row.cdnStatus,
    cmsStatus: row.cmsStatus,
    understandingStatus: row.understandingStatus,
    understandingProgress: row.understandingProgress,
    totalTags: row.totalTags,
    versionNumber: row.versionNumber,
    catalogData: row.catalogData as Record<string, unknown> | undefined,
    categoryId: row.categoryId || undefined,
    categoryPath,
    uploaderName: row.uploader?.displayName || undefined,
    uploadedBy: row.uploadedBy || undefined,
    usageCount: row.usageCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    processedAt: row.processedAt?.toISOString() || undefined,
    segments,
  };
}

export async function getKnowledgeGraph(): Promise<{ nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] }> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { nodes: [], edges: [] };

  const nodes = await db.query.knowledgeNodes.findMany({
    where: eq(knowledgeNodes.organizationId, orgId),
  });

  const edges = await db.query.knowledgeRelations_.findMany();

  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      label: n.entityName,
      type: n.entityType,
      connections: n.connectionCount,
    })),
    edges: edges
      .filter((e) => nodes.some((n) => n.id === e.sourceNodeId) && nodes.some((n) => n.id === e.targetNodeId))
      .map((e) => ({
        source: e.sourceNodeId,
        target: e.targetNodeId,
        relation: e.relationType,
      })),
  };
}
