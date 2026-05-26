// src/lib/dal/research/activity-datasets.ts
//
// 生态文明传播指数报告 - 线下活动数据集 DAL
//
// 多租户 scope, 主要导出:
// - listActivityDatasetsByOrg(orgId)
// - getActivityDatasetById(orgId, id)
// - createActivityDataset(input)
// - setActivityDatasetDefault(orgId, id)
// - countReportsUsingDataset(orgId, id)
// - deleteActivityDataset(orgId, id)

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  researchActivityDatasets,
  type ActivityDatasetInsert,
  type ActivityDataPoint,
} from "@/db/schema/research/activity-datasets";
import { researchReports } from "@/db/schema/research/reports";
import { userProfiles } from "@/db/schema/users";

export type ActivityDatasetSummary = {
  id: string;
  name: string;
  year: number;
  sourceFileName: string | null;
  districtCount: number;
  totalActivities: number;
  activityThemes: string[];
  isDefault: boolean;
  createdAt: Date;
  createdByName: string | null;
};

export type ActivityDatasetDetail = ActivityDatasetSummary & {
  data: ActivityDataPoint[];
};

export async function listActivityDatasetsByOrg(
  orgId: string,
): Promise<ActivityDatasetSummary[]> {
  const rows = await db
    .select({
      id: researchActivityDatasets.id,
      name: researchActivityDatasets.name,
      year: researchActivityDatasets.year,
      sourceFileName: researchActivityDatasets.sourceFileName,
      districtCount: researchActivityDatasets.districtCount,
      totalActivities: researchActivityDatasets.totalActivities,
      activityThemes: researchActivityDatasets.activityThemes,
      isDefault: researchActivityDatasets.isDefault,
      createdAt: researchActivityDatasets.createdAt,
      createdByName: userProfiles.displayName,
    })
    .from(researchActivityDatasets)
    .leftJoin(userProfiles, eq(userProfiles.id, researchActivityDatasets.createdBy))
    .where(eq(researchActivityDatasets.organizationId, orgId))
    .orderBy(desc(researchActivityDatasets.createdAt));
  return rows;
}

export async function getActivityDatasetById(
  orgId: string,
  datasetId: string,
): Promise<ActivityDatasetDetail | null> {
  const [dataset] = await db
    .select()
    .from(researchActivityDatasets)
    .where(and(
      eq(researchActivityDatasets.id, datasetId),
      eq(researchActivityDatasets.organizationId, orgId),
    ))
    .limit(1);
  if (!dataset) return null;

  let createdByName: string | null = null;
  if (dataset.createdBy) {
    const [byUser] = await db
      .select({ displayName: userProfiles.displayName })
      .from(userProfiles)
      .where(eq(userProfiles.id, dataset.createdBy))
      .limit(1);
    createdByName = byUser?.displayName ?? null;
  }

  return {
    id: dataset.id,
    name: dataset.name,
    year: dataset.year,
    sourceFileName: dataset.sourceFileName,
    districtCount: dataset.districtCount,
    totalActivities: dataset.totalActivities,
    activityThemes: dataset.activityThemes,
    isDefault: dataset.isDefault,
    createdAt: dataset.createdAt,
    createdByName,
    data: dataset.data as ActivityDataPoint[],
  };
}

export async function createActivityDataset(input: {
  data: Omit<ActivityDatasetInsert, "id" | "createdAt" | "updatedAt">;
}): Promise<{ datasetId: string }> {
  const [row] = await db
    .insert(researchActivityDatasets)
    .values(input.data)
    .returning({ id: researchActivityDatasets.id });
  if (!row) throw new Error("create activity dataset failed");
  return { datasetId: row.id };
}

export async function setActivityDatasetDefault(
  orgId: string,
  datasetId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(researchActivityDatasets)
      .set({ isDefault: false })
      .where(eq(researchActivityDatasets.organizationId, orgId));
    await tx
      .update(researchActivityDatasets)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(and(
        eq(researchActivityDatasets.id, datasetId),
        eq(researchActivityDatasets.organizationId, orgId),
      ));
  });
}

export async function countReportsUsingDataset(
  orgId: string,
  datasetId: string,
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(researchReports)
    .where(and(
      eq(researchReports.organizationId, orgId),
      sql`${researchReports.searchSnapshot}->>'activityDatasetId' = ${datasetId}`,
    ));
  return row?.n ?? 0;
}

export async function deleteActivityDataset(orgId: string, datasetId: string): Promise<void> {
  await db
    .delete(researchActivityDatasets)
    .where(and(
      eq(researchActivityDatasets.id, datasetId),
      eq(researchActivityDatasets.organizationId, orgId),
    ));
}
