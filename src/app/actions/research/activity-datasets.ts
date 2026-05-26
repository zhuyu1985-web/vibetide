"use server";
//
// 生态文明传播指数报告 - 活动数据集 Server Actions
// Spec: docs/superpowers/specs/2026-05-26-ecological-index-report-design.md §8.1
//
// 提供给 /data-collection/reports/resources 页面用:
// - listActivityDatasets()                列表
// - getActivityDatasetDetail(id)          详情(含 data)
// - uploadActivityDatasetXlsx(...)        上传 xlsx → 解析 → 写 DB
// - setDefaultActivityDataset(id)         设为默认
// - deleteActivityDatasetAction(id, force) 删除(检查引用)

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { parseActivityXlsx, ACTIVITY_THEMES } from "@/lib/research/ecological-index/activity-parser";
import {
  listActivityDatasetsByOrg,
  getActivityDatasetById,
  createActivityDataset,
  setActivityDatasetDefault,
  countReportsUsingDataset,
  deleteActivityDataset,
  type ActivityDatasetSummary,
  type ActivityDatasetDetail,
} from "@/lib/dal/research/activity-datasets";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

async function requireOrg(): Promise<{ orgId: string; userId: string }> {
  const user = await requireAuth();
  if (!user.organizationId) throw new Error("无法获取组织信息");
  return { orgId: user.organizationId, userId: user.id };
}

export async function listActivityDatasets(): Promise<ActivityDatasetSummary[]> {
  const { orgId } = await requireOrg();
  return await listActivityDatasetsByOrg(orgId);
}

export async function getActivityDatasetDetail(
  datasetId: string,
): Promise<ActivityDatasetDetail | null> {
  const { orgId } = await requireOrg();
  return await getActivityDatasetById(orgId, datasetId);
}

export type UploadDatasetResult = {
  datasetId: string;
  warnings: string[];
  totalActivities: number;
  districtCount: number;
};

export async function uploadActivityDatasetXlsx(input: {
  name: string;
  year: number;
  fileBase64: string;
  fileName: string;
}): Promise<UploadDatasetResult> {
  const { orgId, userId } = await requireOrg();

  if (!input.name?.trim()) throw new Error("数据集名称不能为空");
  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100) {
    throw new Error("年份必须是 2000-2100 之间的整数");
  }

  const buffer = Buffer.from(input.fileBase64, "base64");
  if (buffer.byteLength === 0) throw new Error("文件内容为空");
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new Error(`文件过大(${(buffer.byteLength / 1024 / 1024).toFixed(2)}MB), 限 5MB`);
  }

  const parsed = parseActivityXlsx(buffer);
  if (parsed.data.length === 0) {
    throw new Error("xlsx 解析后无有效区县, 请检查文件格式");
  }

  const { datasetId } = await createActivityDataset({
    data: {
      organizationId: orgId,
      name: input.name.trim(),
      year: input.year,
      sourceFileName: input.fileName,
      sourceFileUrl: null,
      districtCount: parsed.data.length,
      totalActivities: parsed.totalActivities,
      activityThemes: parsed.activityThemes,
      data: parsed.data,
      isDefault: false,
      createdBy: userId,
    },
  });

  revalidatePath("/data-collection/reports/resources");
  return {
    datasetId,
    warnings: parsed.warnings,
    totalActivities: parsed.totalActivities,
    districtCount: parsed.data.length,
  };
}

export async function setDefaultActivityDataset(datasetId: string): Promise<void> {
  const { orgId } = await requireOrg();
  await setActivityDatasetDefault(orgId, datasetId);
  revalidatePath("/data-collection/reports/resources");
}

export async function deleteActivityDatasetAction(
  datasetId: string,
  force = false,
): Promise<void> {
  const { orgId } = await requireOrg();
  if (!force) {
    const cnt = await countReportsUsingDataset(orgId, datasetId);
    if (cnt > 0) {
      throw new Error(`该数据集已被 ${cnt} 个报告引用, 删除将使快照失效, 请确认 force=true`);
    }
  }
  await deleteActivityDataset(orgId, datasetId);
  revalidatePath("/data-collection/reports/resources");
}

export { ACTIVITY_THEMES };
