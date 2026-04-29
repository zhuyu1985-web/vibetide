"use server";

import { db } from "@/db";
import { articleAnnotations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { AnnotationColor } from "@/app/(dashboard)/articles/[id]/types";
export async function createAnnotation(
  articleId: string,
  data: {
    organizationId: string;
    quote: string;
    note?: string;
    color?: AnnotationColor;
    position: number;
    timecode?: number;
    frameSnapshot?: string;
    isPinned?: boolean;
    pinnedPosition?: { x: number; y: number } | null;
  }
) {
  const user = await requireAuth();

  const [row] = await db
    .insert(articleAnnotations)
    .values({
      articleId,
      organizationId: data.organizationId,
      userId: user.id,
      quote: data.quote,
      note: data.note,
      color: data.color ?? "yellow",
      position: data.position,
      timecode: data.timecode != null ? String(data.timecode) : undefined,
      frameSnapshot: data.frameSnapshot,
      isPinned: data.isPinned ?? false,
      pinnedPosition: data.pinnedPosition,
    })
    .returning();

  revalidatePath(`/articles/${articleId}`);
  return { annotationId: row.id };
}

export async function updateAnnotation(
  annotationId: string,
  data: {
    note?: string;
    color?: AnnotationColor;
    isPinned?: boolean;
    pinnedPosition?: { x: number; y: number } | null;
  }
) {
  await requireAuth();

  await db
    .update(articleAnnotations)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(articleAnnotations.id, annotationId));

  // We don't know the articleId here, so revalidate the articles root
  revalidatePath("/articles");
}

export async function deleteAnnotation(annotationId: string) {
  await requireAuth();

  await db
    .delete(articleAnnotations)
    .where(eq(articleAnnotations.id, annotationId));

  revalidatePath("/articles");
}
