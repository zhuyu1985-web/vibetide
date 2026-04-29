"use server";

import { db } from "@/db";
import { mediaAssets, assetTags, userProfiles } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { deleteObject } from "@/lib/volc-tos";
import { getAssetsByLibrary } from "@/lib/dal/assets";
import type { MediaAssetType, SecurityLevel, MediaLibraryType } from "@/lib/types";
async function getProfile(authUserId: string) {
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, authUserId),
  });
  if (!profile) throw new Error("Profile not found");
  return profile;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

const REVALIDATE_PATHS = ["/media-assets", "/asset-intelligence"];
function revalidateAll() {
  for (const p of REVALIDATE_PATHS) revalidatePath(p);
}

// --- Original actions (kept) ---

export async function createAsset(data: {
  organizationId: string;
  title: string;
  type: "video" | "image" | "audio" | "document";
  description?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileSizeDisplay?: string;
  mimeType?: string;
  duration?: string;
  durationSeconds?: number;
  source?: string;
  tags?: string[];
  categoryId?: string;
}) {
  await requireAuth();
  const [asset] = await db.insert(mediaAssets).values(data).returning();
  revalidateAll();
  return { assetId: asset.id };
}

export async function updateAsset(assetId: string, data: {
  title?: string;
  description?: string;
  tags?: string[];
  categoryId?: string;
}) {
  await requireAuth();
  await db.update(mediaAssets).set({ ...data, updatedAt: new Date() }).where(eq(mediaAssets.id, assetId));
  revalidateAll();
}

export async function deleteAsset(assetId: string) {
  await requireAuth();
  await db.delete(mediaAssets).where(eq(mediaAssets.id, assetId));
  revalidateAll();
}

export async function triggerUnderstanding(assetId: string) {
  await requireAuth();
  await db.update(mediaAssets).set({
    understandingStatus: "processing",
    understandingProgress: 0,
    updatedAt: new Date(),
  }).where(eq(mediaAssets.id, assetId));
  revalidateAll();
}

export async function batchTriggerUnderstanding(assetIds: string[]) {
  await requireAuth();
  for (const id of assetIds) {
    await db.update(mediaAssets).set({
      understandingStatus: "processing",
      understandingProgress: 0,
      updatedAt: new Date(),
    }).where(eq(mediaAssets.id, id));
  }
  revalidateAll();
}

export async function correctTag(tagId: string, correctedLabel: string, correctedCategory?: string) {
  await requireAuth();
  const updates: Record<string, unknown> = {
    label: correctedLabel,
    source: "human_correct",
  };
  if (correctedCategory) {
    updates.category = correctedCategory;
  }
  await db.update(assetTags).set(updates).where(eq(assetTags.id, tagId));
  revalidatePath("/asset-intelligence");
}

// --- Smart Media Asset module actions ---

export async function confirmUpload(data: {
  title: string;
  type: MediaAssetType;
  fileName: string;
  fileSize: number;
  mimeType: string;
  tosObjectKey: string;
  tosBucket: string;
  libraryType: "personal" | "product";
  categoryId?: string;
  securityLevel?: SecurityLevel;
  width?: number;
  height?: number;
  duration?: string;
  durationSeconds?: number;
}) {
  const user = await requireAuth();
  const profile = await getProfile(user.id);

  const [asset] = await db.insert(mediaAssets).values({
    organizationId: profile.organizationId!,
    title: data.title,
    type: data.type,
    fileName: data.fileName,
    fileSize: data.fileSize,
    fileSizeDisplay: formatFileSize(data.fileSize),
    mimeType: data.mimeType,
    tosObjectKey: data.tosObjectKey,
    tosBucket: data.tosBucket,
    libraryType: data.libraryType,
    categoryId: data.categoryId,
    securityLevel: data.securityLevel || "public",
    width: data.width,
    height: data.height,
    duration: data.duration,
    durationSeconds: data.durationSeconds,
    uploadedBy: profile.id,
    source: "upload",
    understandingStatus: "queued",
  }).returning();

  revalidateAll();
  return { assetId: asset.id };
}

export async function moveToProductLibrary(assetId: string, categoryId: string) {
  await requireAuth();
  await db.update(mediaAssets).set({
    libraryType: "product",
    categoryId,
    updatedAt: new Date(),
  }).where(eq(mediaAssets.id, assetId));
  revalidateAll();
}

export async function softDeleteAsset(assetId: string) {
  const user = await requireAuth();
  const profile = await getProfile(user.id);

  const asset = await db.query.mediaAssets.findFirst({
    where: eq(mediaAssets.id, assetId),
  });

  await db.update(mediaAssets).set({
    isDeleted: true,
    deletedAt: new Date(),
    deletedBy: profile.id,
    originalCategoryId: asset?.categoryId || undefined,
    updatedAt: new Date(),
  }).where(eq(mediaAssets.id, assetId));
  revalidateAll();
}

export async function batchSoftDelete(assetIds: string[]) {
  const user = await requireAuth();
  const profile = await getProfile(user.id);

  for (const id of assetIds) {
    const asset = await db.query.mediaAssets.findFirst({
      where: eq(mediaAssets.id, id),
    });
    await db.update(mediaAssets).set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: profile.id,
      originalCategoryId: asset?.categoryId || undefined,
      updatedAt: new Date(),
    }).where(eq(mediaAssets.id, id));
  }
  revalidateAll();
}

export async function restoreAsset(assetId: string, targetCategoryId?: string) {
  await requireAuth();

  const asset = await db.query.mediaAssets.findFirst({
    where: eq(mediaAssets.id, assetId),
  });
  if (!asset) throw new Error("Asset not found");

  await db.update(mediaAssets).set({
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    categoryId: targetCategoryId || asset.originalCategoryId || null,
    originalCategoryId: null,
    updatedAt: new Date(),
  }).where(eq(mediaAssets.id, assetId));
  revalidateAll();
}

export async function permanentDelete(assetId: string) {
  await requireAuth();

  const asset = await db.query.mediaAssets.findFirst({
    where: eq(mediaAssets.id, assetId),
  });

  if (asset?.tosObjectKey) {
    try { await deleteObject(asset.tosObjectKey); } catch { /* TOS deletion is best-effort */ }
  }

  await db.delete(mediaAssets).where(eq(mediaAssets.id, assetId));
  revalidateAll();
}

export async function emptyRecycleBin() {
  const user = await requireAuth();
  const profile = await getProfile(user.id);

  const deletedAssets = await db.query.mediaAssets.findMany({
    where: and(
      eq(mediaAssets.organizationId, profile.organizationId!),
      eq(mediaAssets.isDeleted, true),
    ),
  });

  for (const asset of deletedAssets) {
    if (asset.tosObjectKey) {
      try { await deleteObject(asset.tosObjectKey); } catch { /* best-effort */ }
    }
    await db.delete(mediaAssets).where(eq(mediaAssets.id, asset.id));
  }
  revalidateAll();
}

export async function togglePublic(assetId: string) {
  await requireAuth();
  const asset = await db.query.mediaAssets.findFirst({
    where: eq(mediaAssets.id, assetId),
  });
  if (!asset) throw new Error("Asset not found");

  await db.update(mediaAssets).set({
    isPublic: !asset.isPublic,
    updatedAt: new Date(),
  }).where(eq(mediaAssets.id, assetId));
  revalidateAll();
}

export async function moveAsset(assetId: string, targetCategoryId: string) {
  await requireAuth();
  await db.update(mediaAssets).set({
    categoryId: targetCategoryId,
    updatedAt: new Date(),
  }).where(eq(mediaAssets.id, assetId));
  revalidateAll();
}

export async function batchMove(assetIds: string[], targetCategoryId: string) {
  await requireAuth();
  for (const id of assetIds) {
    await db.update(mediaAssets).set({
      categoryId: targetCategoryId,
      updatedAt: new Date(),
    }).where(eq(mediaAssets.id, id));
  }
  revalidateAll();
}

export async function renameAsset(assetId: string, newTitle: string) {
  await requireAuth();
  await db.update(mediaAssets).set({
    title: newTitle,
    updatedAt: new Date(),
  }).where(eq(mediaAssets.id, assetId));
  revalidateAll();
}

export async function updateCatalog(assetId: string, catalogData: Record<string, unknown>) {
  await requireAuth();
  await db.update(mediaAssets).set({
    catalogData,
    catalogStatus: "cataloged",
    updatedAt: new Date(),
  }).where(eq(mediaAssets.id, assetId));
  revalidateAll();
}

export async function submitForReview(assetId: string) {
  await requireAuth();
  await db.update(mediaAssets).set({
    reviewStatus: "pending",
    updatedAt: new Date(),
  }).where(eq(mediaAssets.id, assetId));
  revalidateAll();
}

export async function batchSubmitForReview(assetIds: string[]) {
  await requireAuth();
  for (const id of assetIds) {
    await db.update(mediaAssets).set({
      reviewStatus: "pending",
      updatedAt: new Date(),
    }).where(eq(mediaAssets.id, id));
  }
  revalidateAll();
}

// ── Infinite scroll fetch ──────────────────────

export async function fetchMoreAssets(
  library: MediaLibraryType,
  categoryId: string | null,
  page: number,
  pageSize: number,
  search?: string,
  typeFilter?: string,
) {
  await requireAuth();
  const filters = {
    search: search || undefined,
    type: typeFilter && typeFilter !== "all" ? typeFilter : undefined,
  };
  return getAssetsByLibrary(library, categoryId, page, pageSize, filters);
}
