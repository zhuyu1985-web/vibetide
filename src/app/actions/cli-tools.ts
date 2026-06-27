"use server";

import { db } from "@/db";
import { cliTools } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { getCliToolById } from "@/lib/dal/cli-tools";
import {
  assertAllowedBinary,
  probeBinary,
} from "@/lib/cli/allowlist";
import { createCliToolset } from "@/lib/cli/toolset";

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
async function requireOrg(): Promise<string> {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("无法获取组织信息");
  return orgId;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function parseJsonObject(raw: string, label: string): Record<string, unknown> {
  if (!raw.trim()) throw new Error(`${label} 不能为空`);
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new Error(`${label} 必须是 JSON 对象`);
    }
    return parsed as Record<string, unknown>;
  } catch (e) {
    if (e instanceof SyntaxError) throw new Error(`${label} JSON 格式错误`);
    throw e;
  }
}

function parseJsonArray(raw: string, label: string): unknown[] {
  if (!raw.trim()) throw new Error(`${label} 不能为空`);
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error(`${label} 必须是 JSON 数组`);
    return parsed;
  } catch (e) {
    if (e instanceof SyntaxError) throw new Error(`${label} JSON 格式错误`);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// 1. createCliTool — 注册新 CLI 工具
// ---------------------------------------------------------------------------
export async function createCliTool(input: {
  name: string;
  description: string;
  command: string;
  argsSchemaJson: string;
  argvTemplateJson: string;
  executionMode: "sync" | "async";
  toolClass: "read" | "write";
  syncTimeoutMs?: number;
}): Promise<{ id: string; probeWarning?: string }> {
  const orgId = await requireOrg();

  const trimmedName = input.name.trim();
  if (!trimmedName) throw new Error("工具名称不能为空");
  if (!input.description.trim()) throw new Error("工具描述不能为空");

  // 安全闸门：command 必须在白名单
  assertAllowedBinary(input.command);

  // 校验 JSON 字段
  const argsSchema = parseJsonObject(input.argsSchemaJson, "参数 Schema");
  const argvTemplate = parseJsonArray(input.argvTemplateJson, "Argv 模板");

  const slug = trimmedName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const [created] = await db
    .insert(cliTools)
    .values({
      organizationId: orgId,
      name: trimmedName,
      slug,
      description: input.description.trim(),
      command: input.command,
      argsSchema,
      argvTemplate,
      executionMode: input.executionMode,
      toolClass: input.toolClass,
      syncTimeoutMs: input.syncTimeoutMs ?? 20000,
    })
    .returning({ id: cliTools.id });

  revalidatePath("/settings/cli-tools");

  // 探测 binary 是否安装（不硬失败，只作为警告返回）
  const probe = await probeBinary(input.command).catch(() => ({
    ok: false,
    error: "探测超时",
  }));

  return {
    id: created.id,
    probeWarning: probe.ok ? undefined : probe.error,
  };
}

// ---------------------------------------------------------------------------
// 2. updateCliTool — 更新已有 CLI 工具配置（含 org 所有权校验）
// ---------------------------------------------------------------------------
export async function updateCliTool(
  toolId: string,
  updates: {
    name?: string;
    description?: string;
    command?: string;
    argsSchemaJson?: string;
    argvTemplateJson?: string;
    executionMode?: "sync" | "async";
    toolClass?: "read" | "write";
    syncTimeoutMs?: number;
  }
): Promise<{ probeWarning?: string }> {
  const orgId = await requireOrg();

  const existing = await getCliToolById(orgId, toolId);
  if (!existing) throw new Error("CLI 工具不存在或无权访问");

  const patch: Record<string, unknown> = {};

  if (updates.name !== undefined) {
    const trimmed = updates.name.trim();
    if (!trimmed) throw new Error("工具名称不能为空");
    patch.name = trimmed;
    patch.slug = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  if (updates.description !== undefined) {
    if (!updates.description.trim()) throw new Error("工具描述不能为空");
    patch.description = updates.description.trim();
  }

  let probeWarning: string | undefined;
  if (updates.command !== undefined) {
    // 安全闸门：新 command 也必须在白名单
    assertAllowedBinary(updates.command);
    patch.command = updates.command;

    // 探测新 binary
    const probe = await probeBinary(updates.command).catch(() => ({
      ok: false,
      error: "探测超时",
    }));
    if (!probe.ok) probeWarning = probe.error;
  }

  if (updates.argsSchemaJson !== undefined) {
    patch.argsSchema = parseJsonObject(updates.argsSchemaJson, "参数 Schema");
  }

  if (updates.argvTemplateJson !== undefined) {
    patch.argvTemplate = parseJsonArray(updates.argvTemplateJson, "Argv 模板");
  }

  if (updates.executionMode !== undefined) {
    patch.executionMode = updates.executionMode;
  }

  if (updates.toolClass !== undefined) {
    patch.toolClass = updates.toolClass;
  }

  if (updates.syncTimeoutMs !== undefined) {
    patch.syncTimeoutMs = updates.syncTimeoutMs;
  }

  await db
    .update(cliTools)
    .set(patch)
    .where(
      and(eq(cliTools.id, toolId), eq(cliTools.organizationId, orgId))
    );

  revalidatePath("/settings/cli-tools");
  return { probeWarning };
}

// ---------------------------------------------------------------------------
// 3. toggleCliTool — 启用 / 禁用 CLI 工具（含 org 所有权校验）
// ---------------------------------------------------------------------------
export async function toggleCliTool(toolId: string, enabled: boolean) {
  const orgId = await requireOrg();

  const existing = await getCliToolById(orgId, toolId);
  if (!existing) throw new Error("CLI 工具不存在或无权访问");

  await db
    .update(cliTools)
    .set({ enabled: enabled ? 1 : 0 })
    .where(
      and(eq(cliTools.id, toolId), eq(cliTools.organizationId, orgId))
    );

  revalidatePath("/settings/cli-tools");
}

// ---------------------------------------------------------------------------
// 4. deleteCliTool — 删除 CLI 工具配置（含 org 所有权校验）
// ---------------------------------------------------------------------------
export async function deleteCliTool(toolId: string) {
  const orgId = await requireOrg();

  const existing = await getCliToolById(orgId, toolId);
  if (!existing) throw new Error("CLI 工具不存在或无权访问");

  await db
    .delete(cliTools)
    .where(
      and(eq(cliTools.id, toolId), eq(cliTools.organizationId, orgId))
    );

  revalidatePath("/settings/cli-tools");
}

// ---------------------------------------------------------------------------
// 5. testRunCliTool — 管理员验证用：同步执行一次 CLI 工具
//
// 从 createCliToolset 中找到对应工具并调用 execute。
// 永不抛出——所有错误作为 { ok:false, error } 返回。
// ---------------------------------------------------------------------------
export async function testRunCliTool(
  toolId: string,
  params: Record<string, unknown>
): Promise<{
  ok: boolean;
  assetId?: string;
  publicUrl?: string;
  error?: string;
  stderrTail?: string;
}> {
  try {
    const orgId = await requireOrg();

    const existing = await getCliToolById(orgId, toolId);
    if (!existing) return { ok: false, error: "CLI 工具不存在或无权访问" };

    // 用 executor 权限构建工具集，确保 write 类工具也被包含
    const toolset = await createCliToolset(orgId, {
      authorityLevel: "executor",
    });

    const toolKey = `cli__${existing.slug.replace(/[^a-zA-Z0-9_-]+/g, "_")}`;
    const toolDef = toolset[toolKey];

    if (!toolDef || typeof toolDef.execute !== "function") {
      return { ok: false, error: `工具 ${toolKey} 未找到（可能已禁用或 slug 不匹配）` };
    }

    const result = (await toolDef.execute(params, {
      toolCallId: `test-${toolId}`,
      messages: [],
      abortSignal: new AbortController().signal,
    })) as {
      success?: boolean;
      assetId?: string;
      publicUrl?: string;
      error?: string;
      stderrTail?: string;
    };

    if (result.success) {
      return {
        ok: true,
        assetId: result.assetId,
        publicUrl: result.publicUrl,
      };
    }

    return {
      ok: false,
      error: result.error ?? "执行失败",
      stderrTail: result.stderrTail,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "未知错误",
    };
  }
}
