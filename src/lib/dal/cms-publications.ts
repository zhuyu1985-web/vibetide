import { db } from "@/db";
import { cmsPublications } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

export type CmsPublicationState =
  | "submitting"
  | "submitted"
  | "synced"
  | "rejected_by_cms"
  | "failed"
  | "retrying";

export interface CreatePublicationInput {
  organizationId: string;
  articleId: string;
  cmsType: number;
  requestHash: string;
  requestPayload: unknown;
  operatorId: string;
  triggerSource: string;
}

export async function createPublication(
  input: CreatePublicationInput,
): Promise<string> {
  const [row] = await db
    .insert(cmsPublications)
    .values({
      organizationId: input.organizationId,
      articleId: input.articleId,
      cmsType: input.cmsType,
      cmsState: "submitting",
      requestHash: input.requestHash,
      requestPayload: input.requestPayload as object,
      operatorId: input.operatorId,
      triggerSource: input.triggerSource,
      attempts: 1,
      lastAttemptAt: new Date(),
    })
    .returning({ id: cmsPublications.id });
  return row.id;
}

export interface UpdateToSubmittedInput {
  cmsArticleId: string;
  cmsCatalogId?: string;
  cmsSiteId?: number;
  publishedUrl?: string;
  previewUrl?: string;
  responsePayload?: unknown;
}

export async function updateToSubmitted(
  id: string,
  input: UpdateToSubmittedInput,
): Promise<void> {
  await db
    .update(cmsPublications)
    .set({
      cmsState: "submitted",
      cmsArticleId: input.cmsArticleId,
      cmsCatalogId: input.cmsCatalogId ?? null,
      cmsSiteId: input.cmsSiteId ?? null,
      publishedUrl: input.publishedUrl ?? null,
      previewUrl: input.previewUrl ?? null,
      responsePayload: (input.responsePayload ?? null) as object | null,
      submittedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(cmsPublications.id, id));
}

export async function markAsSynced(id: string): Promise<void> {
  await db
    .update(cmsPublications)
    .set({
      cmsState: "synced",
      syncedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(cmsPublications.id, id));
}

export async function markAsRejectedByCms(id: string): Promise<void> {
  await db
    .update(cmsPublications)
    .set({
      cmsState: "rejected_by_cms",
      updatedAt: new Date(),
    })
    .where(eq(cmsPublications.id, id));
}

export interface MarkAsFailedInput {
  errorCode: string;
  errorMessage: string;
  retriable: boolean;
}

export async function markAsFailed(
  id: string,
  input: MarkAsFailedInput,
): Promise<void> {
  await db
    .update(cmsPublications)
    .set({
      cmsState: input.retriable ? "retrying" : "failed",
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      updatedAt: new Date(),
    })
    .where(eq(cmsPublications.id, id));
}

export async function incrementAttempt(id: string): Promise<void> {
  await db
    .update(cmsPublications)
    .set({
      attempts: sql`${cmsPublications.attempts} + 1`,
      lastAttemptAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(cmsPublications.id, id));
}

export async function findLatestSuccessByArticle(articleId: string) {
  const row = await db.query.cmsPublications.findFirst({
    where: and(eq(cmsPublications.articleId, articleId)),
    orderBy: [desc(cmsPublications.createdAt)],
  });
  if (!row) return null;
  if (!["submitted", "synced"].includes(row.cmsState)) return null;
  return row;
}

export async function getPublicationById(id: string) {
  const row = await db.query.cmsPublications.findFirst({
    where: eq(cmsPublications.id, id),
  });
  return row ?? null;
}

export async function listByState(
  organizationId: string,
  state: CmsPublicationState,
  options: { limit?: number } = {},
) {
  return await db.query.cmsPublications.findMany({
    where: and(
      eq(cmsPublications.organizationId, organizationId),
      eq(cmsPublications.cmsState, state),
    ),
    orderBy: [desc(cmsPublications.createdAt)],
    limit: options.limit ?? 100,
  });
}
