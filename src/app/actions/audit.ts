"use server";

import { db } from "@/db";
import {
  auditRecords,
  auditRules,
  contentTrailLogs,
  sensitiveWordLists,
} from "@/db/schema/audit";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import type { AuditStage, AuditMode, TrailAction, TrailStage, AuditIssue } from "@/lib/dal/audit";

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

async function requireOrg(): Promise<string> {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("无法获取组织信息");
  return orgId;
}

// ---------------------------------------------------------------------------
// 1. createAuditRecord — create a new audit record + initial trail log
// ---------------------------------------------------------------------------

export async function createAuditRecord(input: {
  missionId?: string;
  articleId?: string;
  contentType: string;
  contentId: string;
  stage: AuditStage;
  mode: AuditMode;
  reviewerType: "ai" | "human";
  reviewerId: string;
  dimensions?: Record<string, unknown>;
  overallResult: "pass" | "warning" | "fail";
  issues?: AuditIssue[];
  comment?: string;
  contentSnapshot?: string;
  diff?: Record<string, unknown>;
}) {
  const orgId = await requireOrg();

  const [created] = await db
    .insert(auditRecords)
    .values({
      organizationId: orgId,
      missionId: input.missionId ?? null,
      articleId: input.articleId ?? null,
      contentType: input.contentType,
      contentId: input.contentId,
      stage: input.stage,
      mode: input.mode,
      reviewerType: input.reviewerType,
      reviewerId: input.reviewerId,
      dimensions: input.dimensions ?? null,
      overallResult: input.overallResult,
      issues: input.issues ?? [],
      comment: input.comment ?? null,
      contentSnapshot: input.contentSnapshot ?? null,
      diff: input.diff ?? null,
    })
    .returning();

  // Log trail entry for the review action
  await db.insert(contentTrailLogs).values({
    organizationId: orgId,
    contentId: input.contentId,
    contentType: input.contentType,
    operator: input.reviewerId,
    operatorType: input.reviewerType,
    action: "review",
    stage: input.stage as TrailStage,
    contentSnapshot: input.contentSnapshot ?? null,
    diff: input.diff ?? null,
    comment: input.comment ?? null,
    metadata: { auditRecordId: created.id, overallResult: input.overallResult },
  });

  revalidatePath("/audit-center");
  return created;
}

// ---------------------------------------------------------------------------
// 2. approveAudit — mark an audit record as passed
// ---------------------------------------------------------------------------

export async function approveAudit(auditId: string, comment?: string) {
  const orgId = await requireOrg();
  const user = await requireAuth();

  const record = await db.query.auditRecords.findFirst({
    where: and(
      eq(auditRecords.id, auditId),
      eq(auditRecords.organizationId, orgId)
    ),
  });
  if (!record) throw new Error("审核记录不存在或无权访问");

  await db
    .update(auditRecords)
    .set({
      overallResult: "pass",
      comment: comment ?? record.comment,
    })
    .where(eq(auditRecords.id, auditId));

  await db.insert(contentTrailLogs).values({
    organizationId: orgId,
    contentId: record.contentId,
    contentType: record.contentType,
    operator: user.id,
    operatorType: "human",
    action: "approve",
    stage: record.stage as TrailStage,
    comment: comment ?? null,
    metadata: { auditRecordId: auditId },
  });

  revalidatePath("/audit-center");

  // Return next stage hint so callers can decide if review_2/review_3 is needed
  const stageOrder: AuditStage[] = ["review_1", "review_2", "review_3"];
  const currentIndex = stageOrder.indexOf(record.stage as AuditStage);
  const nextStage = currentIndex >= 0 && currentIndex < stageOrder.length - 1
    ? stageOrder[currentIndex + 1]
    : null;

  return { approved: true, nextStage };
}

// ---------------------------------------------------------------------------
// 3. rejectAudit — mark an audit record as failed
// ---------------------------------------------------------------------------

export async function rejectAudit(
  auditId: string,
  comment: string,
  issues?: AuditIssue[]
) {
  const orgId = await requireOrg();
  const user = await requireAuth();

  const record = await db.query.auditRecords.findFirst({
    where: and(
      eq(auditRecords.id, auditId),
      eq(auditRecords.organizationId, orgId)
    ),
  });
  if (!record) throw new Error("审核记录不存在或无权访问");

  await db
    .update(auditRecords)
    .set({
      overallResult: "fail",
      comment,
      issues: issues ?? (record.issues as AuditIssue[]) ?? [],
    })
    .where(eq(auditRecords.id, auditId));

  await db.insert(contentTrailLogs).values({
    organizationId: orgId,
    contentId: record.contentId,
    contentType: record.contentType,
    operator: user.id,
    operatorType: "human",
    action: "reject",
    stage: record.stage as TrailStage,
    comment,
    metadata: {
      auditRecordId: auditId,
      issueCount: (issues ?? []).length,
    },
  });

  revalidatePath("/audit-center");
  return { rejected: true };
}

// ---------------------------------------------------------------------------
// 4. updateAuditRule — update existing rule
// ---------------------------------------------------------------------------

export async function updateAuditRule(
  ruleId: string,
  updates: {
    name?: string;
    dimensions?: Record<string, unknown>;
    review1Mode?: AuditMode;
    review2Mode?: AuditMode;
    review3Mode?: AuditMode;
    isDefault?: boolean;
  }
) {
  const orgId = await requireOrg();

  const rule = await db.query.auditRules.findFirst({
    where: and(
      eq(auditRules.id, ruleId),
      eq(auditRules.organizationId, orgId)
    ),
  });
  if (!rule) throw new Error("审核规则不存在或无权访问");

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.name !== undefined) patch.name = updates.name.trim();
  if (updates.dimensions !== undefined) patch.dimensions = updates.dimensions;
  if (updates.review1Mode !== undefined) patch.review1Mode = updates.review1Mode;
  if (updates.review2Mode !== undefined) patch.review2Mode = updates.review2Mode;
  if (updates.review3Mode !== undefined) patch.review3Mode = updates.review3Mode;
  if (updates.isDefault !== undefined) patch.isDefault = updates.isDefault;

  await db.update(auditRules).set(patch).where(eq(auditRules.id, ruleId));

  revalidatePath("/audit-center");
}

// ---------------------------------------------------------------------------
// 5. createAuditRule — insert a new rule
// ---------------------------------------------------------------------------

export async function createAuditRule(input: {
  scenarioKey?: string;
  name: string;
  dimensions?: Record<string, unknown>;
  review1Mode: AuditMode;
  review2Mode: AuditMode;
  review3Mode: AuditMode;
  isDefault?: boolean;
}) {
  const orgId = await requireOrg();

  const trimmedName = input.name.trim();
  if (!trimmedName) throw new Error("规则名称不能为空");

  const [created] = await db
    .insert(auditRules)
    .values({
      organizationId: orgId,
      scenarioKey: input.scenarioKey ?? null,
      name: trimmedName,
      dimensions: input.dimensions ?? null,
      review1Mode: input.review1Mode,
      review2Mode: input.review2Mode,
      review3Mode: input.review3Mode,
      isDefault: input.isDefault ?? false,
    })
    .returning();

  revalidatePath("/audit-center");
  return created;
}

// ---------------------------------------------------------------------------
// 6. addSensitiveWords — insert a new word list
// ---------------------------------------------------------------------------

export async function addSensitiveWords(
  name: string,
  words: string[],
  category?: string
) {
  const orgId = await requireOrg();

  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("词库名称不能为空");
  if (!words.length) throw new Error("词库不能为空");

  const cleanWords = words.map((w) => w.trim()).filter(Boolean);

  const [created] = await db
    .insert(sensitiveWordLists)
    .values({
      organizationId: orgId,
      name: trimmedName,
      words: cleanWords,
      category: category?.trim() || null,
      isActive: true,
    })
    .returning();

  revalidatePath("/audit-center");
  return created;
}

// ---------------------------------------------------------------------------
// 7. updateSensitiveWords — update an existing word list
// ---------------------------------------------------------------------------

export async function updateSensitiveWords(
  listId: string,
  updates: {
    name?: string;
    words?: string[];
    category?: string | null;
    isActive?: boolean;
  }
) {
  const orgId = await requireOrg();

  const list = await db.query.sensitiveWordLists.findFirst({
    where: and(
      eq(sensitiveWordLists.id, listId),
      eq(sensitiveWordLists.organizationId, orgId)
    ),
  });
  if (!list) throw new Error("敏感词库不存在或无权访问");

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.name !== undefined) {
    const trimmed = updates.name.trim();
    if (!trimmed) throw new Error("词库名称不能为空");
    patch.name = trimmed;
  }
  if (updates.words !== undefined) {
    patch.words = updates.words.map((w) => w.trim()).filter(Boolean);
  }
  if (updates.category !== undefined) {
    patch.category = updates.category?.trim() || null;
  }
  if (updates.isActive !== undefined) {
    patch.isActive = updates.isActive;
  }

  await db.update(sensitiveWordLists).set(patch).where(eq(sensitiveWordLists.id, listId));

  revalidatePath("/audit-center");
}

// ---------------------------------------------------------------------------
// 8. logTrailEntry — standalone utility for other modules to log trail entries
// ---------------------------------------------------------------------------

export async function logTrailEntry(input: {
  organizationId: string;
  contentId: string;
  contentType: string;
  operator: string;
  operatorType: "ai" | "human";
  action: TrailAction;
  stage: TrailStage;
  contentSnapshot?: string;
  diff?: Record<string, unknown>;
  comment?: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(contentTrailLogs).values({
    organizationId: input.organizationId,
    contentId: input.contentId,
    contentType: input.contentType,
    operator: input.operator,
    operatorType: input.operatorType,
    action: input.action,
    stage: input.stage,
    contentSnapshot: input.contentSnapshot ?? null,
    diff: input.diff ?? null,
    comment: input.comment ?? null,
    metadata: input.metadata ?? null,
  });
}
