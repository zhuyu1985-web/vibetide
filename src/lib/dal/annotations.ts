import { db } from "@/db";
import { articleAnnotations } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { getCurrentUserOrg } from "./auth";
import type { Annotation } from "@/app/(dashboard)/articles/[id]/types";

export async function getAnnotations(articleId: string): Promise<Annotation[]> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return [];

  try {
    const rows = await db
      .select()
      .from(articleAnnotations)
      .where(eq(articleAnnotations.articleId, articleId))
      .orderBy(asc(articleAnnotations.position));

    return rows.map((r) => ({
      id: r.id,
      articleId: r.articleId,
      quote: r.quote,
      note: r.note ?? undefined,
      color: r.color as Annotation["color"],
      position: r.position,
      timecode: r.timecode != null ? Number(r.timecode) : undefined,
      frameSnapshot: r.frameSnapshot ?? undefined,
      isPinned: r.isPinned,
      pinnedPosition: r.pinnedPosition ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  } catch {
    console.warn("[dal/annotations] getAnnotations failed, returning []");
    return [];
  }
}
