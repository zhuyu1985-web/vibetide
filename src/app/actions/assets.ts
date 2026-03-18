"use server";

import { db } from "@/db";
import { mediaAssets, assetTags } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

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
  revalidatePath("/media-assets");
  revalidatePath("/asset-intelligence");
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
  revalidatePath("/media-assets");
  revalidatePath("/asset-intelligence");
}

export async function deleteAsset(assetId: string) {
  await requireAuth();
  await db.delete(mediaAssets).where(eq(mediaAssets.id, assetId));
  revalidatePath("/media-assets");
  revalidatePath("/asset-intelligence");
}

export async function triggerUnderstanding(assetId: string) {
  await requireAuth();
  await db.update(mediaAssets).set({
    understandingStatus: "processing",
    understandingProgress: 0,
    updatedAt: new Date(),
  }).where(eq(mediaAssets.id, assetId));
  revalidatePath("/media-assets");
  revalidatePath("/asset-intelligence");
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
  revalidatePath("/media-assets");
  revalidatePath("/asset-intelligence");
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
