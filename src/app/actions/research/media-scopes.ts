"use server";
//
// 生态文明传播指数报告 - 媒体名单 Server Actions
// Spec: docs/superpowers/specs/2026-05-26-ecological-index-report-design.md §8.1
//
// 提供给 /data-collection/reports/resources 页面用:
// - listMediaScopes()                列表
// - getMediaScopeDetail(id)          详情(含 units)
// - uploadMediaScopeXlsx(...)        上传 xlsx → 解析 → 写 DB(事务)
// - setDefaultMediaScope(id)         设为默认
// - deleteMediaScopeAction(id, force) 删除(检查引用)

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { parseMediaScopeXlsx } from "@/lib/research/ecological-index/scope-parser";
import type { ParsedScope } from "@/lib/research/ecological-index/types";
import {
  listMediaScopesByOrg,
  getMediaScopeById,
  createMediaScopeWithUnits,
  setMediaScopeDefault,
  countReportsUsingScope,
  deleteMediaScope,
  type MediaScopeSummary,
  type MediaScopeDetail,
} from "@/lib/dal/research/media-scopes";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB

async function requireOrg(): Promise<{ orgId: string; userId: string }> {
  const user = await requireAuth();
  if (!user.organizationId) throw new Error("无法获取组织信息");
  return { orgId: user.organizationId, userId: user.id };
}

export async function listMediaScopes(): Promise<MediaScopeSummary[]> {
  const { orgId } = await requireOrg();
  return await listMediaScopesByOrg(orgId);
}

export async function getMediaScopeDetail(scopeId: string): Promise<MediaScopeDetail | null> {
  const { orgId } = await requireOrg();
  return await getMediaScopeById(orgId, scopeId);
}

export type UploadScopeResult = {
  scopeId: string;
  warnings: string[];
  stats: ParsedScope["stats"];
};

export async function uploadMediaScopeXlsx(input: {
  name: string;
  description?: string;
  fileBase64: string;
  fileName: string;
}): Promise<UploadScopeResult> {
  const { orgId, userId } = await requireOrg();

  if (!input.name?.trim()) throw new Error("名单名称不能为空");

  const buffer = Buffer.from(input.fileBase64, "base64");
  if (buffer.byteLength === 0) throw new Error("文件内容为空");
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new Error(`文件过大(${(buffer.byteLength / 1024 / 1024).toFixed(2)}MB), 限 5MB`);
  }

  const parsed = parseMediaScopeXlsx(buffer);
  if (parsed.units.length === 0) {
    throw new Error("xlsx 解析后无有效单位, 请检查文件格式");
  }

  const { scopeId } = await createMediaScopeWithUnits({
    organizationId: orgId,
    scopeData: {
      organizationId: orgId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      sourceFileName: input.fileName,
      sourceFileUrl: null, // P2 阶段不立即存原文件 (留 P3+ 集成 Storage)
      totalUnits: parsed.stats.totalUnits,
      centralCount: parsed.stats.centralCount,
      industryCount: parsed.stats.industryCount,
      municipalCount: parsed.stats.municipalCount,
      districtRmtCount: parsed.stats.districtRmtCount,
      districtGovCount: parsed.stats.districtGovCount,
      isDefault: false,
      createdBy: userId,
    },
    units: parsed.units.map(u => ({
      name: u.name,
      tier: u.tier,
      districtOrig: u.districtOrig,
      districtNormalized: u.districtNormalized,
      websites: u.websites,
      wechatNames: u.wechatNames,
      wechatGhid: u.wechatGhid,
      weiboUid: u.weiboUid,
      weiboHandle: u.weiboHandle,
      douyinUrl: u.douyinUrl,
      kuaishouUrl: u.kuaishouUrl,
      xlsxRow: u.xlsxRow,
      notes: u.notes,
    })),
  });

  revalidatePath("/data-collection/reports/resources");
  return { scopeId, warnings: parsed.warnings, stats: parsed.stats };
}

export async function setDefaultMediaScope(scopeId: string): Promise<void> {
  const { orgId } = await requireOrg();
  await setMediaScopeDefault(orgId, scopeId);
  revalidatePath("/data-collection/reports/resources");
}

export async function deleteMediaScopeAction(
  scopeId: string,
  force = false,
): Promise<void> {
  const { orgId } = await requireOrg();
  if (!force) {
    const cnt = await countReportsUsingScope(orgId, scopeId);
    if (cnt > 0) {
      throw new Error(`该名单已被 ${cnt} 个报告引用, 删除将使快照失效, 请确认 force=true`);
    }
  }
  await deleteMediaScope(orgId, scopeId);
  revalidatePath("/data-collection/reports/resources");
}
