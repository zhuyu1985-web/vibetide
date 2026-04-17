import { db } from "@/db";
import {
  auditRecords,
  auditRules,
  contentTrailLogs,
  sensitiveWordLists,
} from "@/db/schema/audit";
import { eq, and, desc, ne, sql, gte } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuditStage = "review_1" | "review_2" | "review_3";
export type AuditResult = "pass" | "warning" | "fail";
export type AuditMode = "auto" | "human" | "hybrid";
export type TrailAction = "create" | "edit" | "review" | "approve" | "reject" | "publish";
export type TrailStage = "planning" | "writing" | "review_1" | "review_2" | "review_3" | "publishing";

export type AuditIssue = {
  type: string;
  severity: string;
  location: string;
  description: string;
  suggestion: string;
};

export type AuditRecordRow = {
  id: string;
  organizationId: string;
  missionId: string | null;
  articleId: string | null;
  contentType: string;
  contentId: string;
  stage: AuditStage;
  mode: AuditMode;
  reviewerType: string;
  reviewerId: string;
  dimensions: Record<string, unknown> | null;
  overallResult: AuditResult;
  issues: AuditIssue[];
  comment: string | null;
  contentSnapshot: string | null;
  diff: Record<string, unknown> | null;
  createdAt: string;
};

export type AuditRuleRow = {
  id: string;
  organizationId: string;
  scenarioKey: string | null;
  name: string;
  dimensions: Record<string, unknown> | null;
  review1Mode: AuditMode;
  review2Mode: AuditMode;
  review3Mode: AuditMode;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ContentTrailLogRow = {
  id: string;
  organizationId: string;
  contentId: string;
  contentType: string;
  operator: string;
  operatorType: string;
  action: TrailAction;
  stage: TrailStage;
  contentSnapshot: string | null;
  diff: Record<string, unknown> | null;
  comment: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type SensitiveWordListRow = {
  id: string;
  organizationId: string;
  name: string;
  words: string[];
  category: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AuditStats = {
  pendingCount: number;
  approvedToday: number;
  rejectedToday: number;
  avgReviewTimeMs: number | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toIso(value: Date | string | null | undefined): string {
  if (!value) return "";
  return value instanceof Date ? value.toISOString() : value;
}

function toIsoNullable(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

// ---------------------------------------------------------------------------
// 1. listPendingAudits — records not yet passed
// ---------------------------------------------------------------------------

export type PendingAuditFilters = {
  stage?: AuditStage;
  contentType?: string;
  reviewerId?: string;
};

export async function listPendingAudits(
  organizationId: string,
  filters?: PendingAuditFilters
): Promise<AuditRecordRow[]> {
  const conditions = [
    eq(auditRecords.organizationId, organizationId),
    ne(auditRecords.overallResult, "pass"),
  ];

  if (filters?.stage) {
    conditions.push(eq(auditRecords.stage, filters.stage));
  }
  if (filters?.contentType) {
    conditions.push(eq(auditRecords.contentType, filters.contentType));
  }
  if (filters?.reviewerId) {
    conditions.push(eq(auditRecords.reviewerId, filters.reviewerId));
  }

  const rows = await db
    .select()
    .from(auditRecords)
    .where(and(...conditions))
    .orderBy(desc(auditRecords.createdAt));

  return rows.map(mapAuditRecord);
}

// ---------------------------------------------------------------------------
// 2. getAuditRecord — single record by ID
// ---------------------------------------------------------------------------

export async function getAuditRecord(
  auditId: string
): Promise<AuditRecordRow | null> {
  const row = await db.query.auditRecords.findFirst({
    where: eq(auditRecords.id, auditId),
  });
  if (!row) return null;
  return mapAuditRecord(row);
}

// ---------------------------------------------------------------------------
// 3. getAuditHistory — all audit records for a content item
// ---------------------------------------------------------------------------

export async function getAuditHistory(
  organizationId: string,
  contentId: string,
  contentType: string
): Promise<AuditRecordRow[]> {
  const rows = await db
    .select()
    .from(auditRecords)
    .where(
      and(
        eq(auditRecords.organizationId, organizationId),
        eq(auditRecords.contentId, contentId),
        eq(auditRecords.contentType, contentType)
      )
    )
    .orderBy(auditRecords.stage, auditRecords.createdAt);

  return rows.map(mapAuditRecord);
}

// ---------------------------------------------------------------------------
// 4. getAuditStats — dashboard summary stats
// ---------------------------------------------------------------------------

export async function getAuditStats(
  organizationId: string
): Promise<AuditStats> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [pendingRow, approvedRow, rejectedRow] = await Promise.all([
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(auditRecords)
      .where(
        and(
          eq(auditRecords.organizationId, organizationId),
          ne(auditRecords.overallResult, "pass")
        )
      ),
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(auditRecords)
      .where(
        and(
          eq(auditRecords.organizationId, organizationId),
          eq(auditRecords.overallResult, "pass"),
          gte(auditRecords.createdAt, todayStart)
        )
      ),
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(auditRecords)
      .where(
        and(
          eq(auditRecords.organizationId, organizationId),
          eq(auditRecords.overallResult, "fail"),
          gte(auditRecords.createdAt, todayStart)
        )
      ),
  ]);

  return {
    pendingCount: Number(pendingRow[0]?.count || 0),
    approvedToday: Number(approvedRow[0]?.count || 0),
    rejectedToday: Number(rejectedRow[0]?.count || 0),
    avgReviewTimeMs: null, // requires additional created_at/updated_at tracking; left for v2
  };
}

// ---------------------------------------------------------------------------
// 5. getTrailLogs — content lifecycle trail for a specific content item
// ---------------------------------------------------------------------------

export async function getTrailLogs(
  organizationId: string,
  contentId: string,
  contentType: string
): Promise<ContentTrailLogRow[]> {
  const rows = await db
    .select()
    .from(contentTrailLogs)
    .where(
      and(
        eq(contentTrailLogs.organizationId, organizationId),
        eq(contentTrailLogs.contentId, contentId),
        eq(contentTrailLogs.contentType, contentType)
      )
    )
    .orderBy(contentTrailLogs.createdAt);

  return rows.map(mapTrailLog);
}

// ---------------------------------------------------------------------------
// 6. getAuditRules — rules for org, optionally filtered by scenarioKey
// ---------------------------------------------------------------------------

export async function getAuditRules(
  organizationId: string,
  scenarioKey?: string
): Promise<AuditRuleRow[]> {
  const conditions = [eq(auditRules.organizationId, organizationId)];

  if (scenarioKey) {
    // Return scenario-specific rules; also include default rules as fallback
    conditions.push(
      sql`(${auditRules.scenarioKey} = ${scenarioKey} OR ${auditRules.isDefault} = true)`
    );
  }

  const rows = await db
    .select()
    .from(auditRules)
    .where(and(...conditions))
    .orderBy(auditRules.isDefault, auditRules.createdAt);

  return rows.map(mapAuditRule);
}

// ---------------------------------------------------------------------------
// 7. getSensitiveWords — active word lists for the org
// ---------------------------------------------------------------------------

export async function getSensitiveWords(
  organizationId: string
): Promise<SensitiveWordListRow[]> {
  const rows = await db
    .select()
    .from(sensitiveWordLists)
    .where(
      and(
        eq(sensitiveWordLists.organizationId, organizationId),
        eq(sensitiveWordLists.isActive, true)
      )
    )
    .orderBy(sensitiveWordLists.name);

  return rows.map(mapSensitiveWordList);
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function mapAuditRecord(
  r: typeof auditRecords.$inferSelect
): AuditRecordRow {
  return {
    id: r.id,
    organizationId: r.organizationId,
    missionId: r.missionId ?? null,
    articleId: r.articleId ?? null,
    contentType: r.contentType,
    contentId: r.contentId,
    stage: r.stage as AuditStage,
    mode: r.mode as AuditMode,
    reviewerType: r.reviewerType,
    reviewerId: r.reviewerId,
    dimensions: (r.dimensions as Record<string, unknown>) ?? null,
    overallResult: r.overallResult as AuditResult,
    issues: (r.issues as AuditIssue[]) ?? [],
    comment: r.comment ?? null,
    contentSnapshot: r.contentSnapshot ?? null,
    diff: (r.diff as Record<string, unknown>) ?? null,
    createdAt: toIso(r.createdAt),
  };
}

function mapAuditRule(
  r: typeof auditRules.$inferSelect
): AuditRuleRow {
  return {
    id: r.id,
    organizationId: r.organizationId,
    scenarioKey: r.scenarioKey ?? null,
    name: r.name,
    dimensions: (r.dimensions as Record<string, unknown>) ?? null,
    review1Mode: r.review1Mode as AuditMode,
    review2Mode: r.review2Mode as AuditMode,
    review3Mode: r.review3Mode as AuditMode,
    isDefault: r.isDefault,
    createdAt: toIso(r.createdAt),
    updatedAt: toIso(r.updatedAt),
  };
}

function mapTrailLog(
  r: typeof contentTrailLogs.$inferSelect
): ContentTrailLogRow {
  return {
    id: r.id,
    organizationId: r.organizationId,
    contentId: r.contentId,
    contentType: r.contentType,
    operator: r.operator,
    operatorType: r.operatorType,
    action: r.action as TrailAction,
    stage: r.stage as TrailStage,
    contentSnapshot: r.contentSnapshot ?? null,
    diff: (r.diff as Record<string, unknown>) ?? null,
    comment: r.comment ?? null,
    metadata: (r.metadata as Record<string, unknown>) ?? null,
    createdAt: toIso(r.createdAt),
  };
}

function mapSensitiveWordList(
  r: typeof sensitiveWordLists.$inferSelect
): SensitiveWordListRow {
  return {
    id: r.id,
    organizationId: r.organizationId,
    name: r.name,
    words: (r.words as string[]) ?? [],
    category: r.category ?? null,
    isActive: r.isActive,
    createdAt: toIso(r.createdAt),
    updatedAt: toIso(r.updatedAt),
  };
}
