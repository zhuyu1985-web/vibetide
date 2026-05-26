// src/lib/dal/research/media-scopes.ts
//
// 生态文明传播指数报告 - 媒体名单 DAL
// Spec: docs/superpowers/specs/2026-05-26-ecological-index-report-design.md §8.1
//
// 多租户 scope: 所有函数强制 organizationId 隔离
//
// 主要导出:
// - listMediaScopesByOrg(orgId)        分页列表
// - getMediaScopeById(orgId, id)       含 units 详情
// - createMediaScopeWithUnits(input)   事务创建主+子表
// - setMediaScopeDefault(orgId, id)    切换默认(事务: 先 reset 其他 isDefault=false, 再 set)
// - countReportsUsingScope(orgId, id)  判断引用计数,删前用
// - deleteMediaScope(orgId, id)        cascade 删 units

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  researchMediaScopes,
  researchMediaScopeUnits,
  type MediaScopeUnit,
  type MediaScopeInsert,
  type MediaScopeUnitInsert,
} from "@/db/schema/research/media-scopes";
import { researchReports } from "@/db/schema/research/reports";
import { userProfiles } from "@/db/schema/users";

export type MediaScopeSummary = {
  id: string;
  name: string;
  description: string | null;
  sourceFileName: string | null;
  totalUnits: number;
  centralCount: number;
  industryCount: number;
  municipalCount: number;
  districtRmtCount: number;
  districtGovCount: number;
  isDefault: boolean;
  createdAt: Date;
  createdByName: string | null;
};

export type MediaScopeDetail = MediaScopeSummary & {
  units: MediaScopeUnit[];
};

/**
 * 列出 org 下所有媒体名单 (按 createdAt 倒序, 含创建人姓名)
 */
export async function listMediaScopesByOrg(orgId: string): Promise<MediaScopeSummary[]> {
  const rows = await db
    .select({
      id: researchMediaScopes.id,
      name: researchMediaScopes.name,
      description: researchMediaScopes.description,
      sourceFileName: researchMediaScopes.sourceFileName,
      totalUnits: researchMediaScopes.totalUnits,
      centralCount: researchMediaScopes.centralCount,
      industryCount: researchMediaScopes.industryCount,
      municipalCount: researchMediaScopes.municipalCount,
      districtRmtCount: researchMediaScopes.districtRmtCount,
      districtGovCount: researchMediaScopes.districtGovCount,
      isDefault: researchMediaScopes.isDefault,
      createdAt: researchMediaScopes.createdAt,
      createdByName: userProfiles.displayName,
    })
    .from(researchMediaScopes)
    .leftJoin(userProfiles, eq(userProfiles.id, researchMediaScopes.createdBy))
    .where(eq(researchMediaScopes.organizationId, orgId))
    .orderBy(desc(researchMediaScopes.createdAt));
  return rows;
}

/**
 * 获取某个名单详情 (含 units)
 * org-scope 防越权
 */
export async function getMediaScopeById(
  orgId: string,
  scopeId: string,
): Promise<MediaScopeDetail | null> {
  const [scope] = await db
    .select()
    .from(researchMediaScopes)
    .where(and(
      eq(researchMediaScopes.id, scopeId),
      eq(researchMediaScopes.organizationId, orgId),
    ))
    .limit(1);
  if (!scope) return null;

  const units = await db
    .select()
    .from(researchMediaScopeUnits)
    .where(eq(researchMediaScopeUnits.scopeId, scopeId))
    .orderBy(researchMediaScopeUnits.xlsxRow);

  let createdByName: string | null = null;
  if (scope.createdBy) {
    const [byUser] = await db
      .select({ displayName: userProfiles.displayName })
      .from(userProfiles)
      .where(eq(userProfiles.id, scope.createdBy))
      .limit(1);
    createdByName = byUser?.displayName ?? null;
  }

  return {
    id: scope.id,
    name: scope.name,
    description: scope.description,
    sourceFileName: scope.sourceFileName,
    totalUnits: scope.totalUnits,
    centralCount: scope.centralCount,
    industryCount: scope.industryCount,
    municipalCount: scope.municipalCount,
    districtRmtCount: scope.districtRmtCount,
    districtGovCount: scope.districtGovCount,
    isDefault: scope.isDefault,
    createdAt: scope.createdAt,
    createdByName,
    units,
  };
}

/**
 * 事务创建名单 + 单位
 */
export async function createMediaScopeWithUnits(input: {
  organizationId: string;
  scopeData: Omit<MediaScopeInsert, "id" | "createdAt" | "updatedAt">;
  units: Array<Omit<MediaScopeUnitInsert, "id" | "scopeId">>;
}): Promise<{ scopeId: string }> {
  return await db.transaction(async (tx) => {
    const [scope] = await tx
      .insert(researchMediaScopes)
      .values(input.scopeData)
      .returning({ id: researchMediaScopes.id });
    if (!scope) throw new Error("create scope failed");
    if (input.units.length > 0) {
      await tx
        .insert(researchMediaScopeUnits)
        .values(input.units.map(u => ({ ...u, scopeId: scope.id })));
    }
    return { scopeId: scope.id };
  });
}

/**
 * 切换默认名单 (事务: 先 reset 同 org 所有 isDefault=false, 再 set 目标)
 */
export async function setMediaScopeDefault(orgId: string, scopeId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(researchMediaScopes)
      .set({ isDefault: false })
      .where(eq(researchMediaScopes.organizationId, orgId));
    await tx
      .update(researchMediaScopes)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(and(
        eq(researchMediaScopes.id, scopeId),
        eq(researchMediaScopes.organizationId, orgId),
      ));
  });
}

/**
 * 统计有多少 ready 报告引用了此名单
 * 用于删除前提示
 */
export async function countReportsUsingScope(
  orgId: string,
  scopeId: string,
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(researchReports)
    .where(and(
      eq(researchReports.organizationId, orgId),
      sql`${researchReports.searchSnapshot}->>'scopeId' = ${scopeId}`,
    ));
  return row?.n ?? 0;
}

/**
 * 删除名单(级联删 units)
 */
export async function deleteMediaScope(orgId: string, scopeId: string): Promise<void> {
  await db
    .delete(researchMediaScopes)
    .where(and(
      eq(researchMediaScopes.id, scopeId),
      eq(researchMediaScopes.organizationId, orgId),
    ));
  // research_media_scope_units 通过 cascade 自动清理
}
