"use server";

import { db } from "@/db";
import { mcpServers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { validatePluginUrl } from "@/lib/plugin-security";
import { encryptHeaders } from "@/lib/mcp/crypto-headers";
import { getMcpServerById } from "@/lib/dal/mcp-servers";

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
// 1. createMcpServer — 新建 MCP 服务器配置
// ---------------------------------------------------------------------------
export async function createMcpServer(input: {
  name: string;
  url: string;
  headers?: Record<string, string>;
  defaultToolClass?: "read" | "write";
  connectTimeoutMs?: number;
}): Promise<{ id: string }> {
  const orgId = await requireOrg();

  const trimmedName = input.name.trim();
  if (!trimmedName) throw new Error("服务器名称不能为空");

  // SSRF guard — validatePluginUrl returns { valid, error? }, does NOT throw
  const check = validatePluginUrl(input.url);
  if (!check.valid) throw new Error(check.error!);

  const slug = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const [created] = await db
    .insert(mcpServers)
    .values({
      organizationId: orgId,
      name: trimmedName,
      slug,
      url: input.url,
      encryptedHeaders: input.headers ? encryptHeaders(input.headers) : null,
      defaultToolClass: input.defaultToolClass ?? "write",
      connectTimeoutMs: input.connectTimeoutMs ?? 8000,
    })
    .returning({ id: mcpServers.id });

  revalidatePath("/settings/mcp");
  return { id: created.id };
}

// ---------------------------------------------------------------------------
// 2. updateMcpServer — 更新已有 MCP 服务器配置（含 org 所有权校验）
// ---------------------------------------------------------------------------
export async function updateMcpServer(
  serverId: string,
  updates: {
    name?: string;
    url?: string;
    headers?: Record<string, string> | null;
    defaultToolClass?: "read" | "write";
    connectTimeoutMs?: number;
  }
) {
  const orgId = await requireOrg();

  // Ownership check via DAL (scoped by org)
  const existing = await getMcpServerById(orgId, serverId);
  if (!existing) throw new Error("MCP 服务器不存在或无权访问");

  const patch: Record<string, unknown> = {};

  if (updates.name !== undefined) {
    const trimmed = updates.name.trim();
    if (!trimmed) throw new Error("服务器名称不能为空");
    patch.name = trimmed;
    // Update slug when name changes
    patch.slug = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  if (updates.url !== undefined) {
    const check = validatePluginUrl(updates.url);
    if (!check.valid) throw new Error(check.error!);
    patch.url = updates.url;
  }

  if (updates.headers !== undefined) {
    patch.encryptedHeaders =
      updates.headers ? encryptHeaders(updates.headers) : null;
  }

  if (updates.defaultToolClass !== undefined) {
    patch.defaultToolClass = updates.defaultToolClass;
  }

  if (updates.connectTimeoutMs !== undefined) {
    patch.connectTimeoutMs = updates.connectTimeoutMs;
  }

  await db
    .update(mcpServers)
    .set(patch)
    .where(
      and(eq(mcpServers.id, serverId), eq(mcpServers.organizationId, orgId))
    );

  revalidatePath("/settings/mcp");
}

// ---------------------------------------------------------------------------
// 3. toggleMcpServer — 启用 / 禁用 MCP 服务器（含 org 所有权校验）
// ---------------------------------------------------------------------------
export async function toggleMcpServer(serverId: string, enabled: boolean) {
  const orgId = await requireOrg();

  const existing = await getMcpServerById(orgId, serverId);
  if (!existing) throw new Error("MCP 服务器不存在或无权访问");

  await db
    .update(mcpServers)
    .set({ enabled: enabled ? 1 : 0 })
    .where(
      and(eq(mcpServers.id, serverId), eq(mcpServers.organizationId, orgId))
    );

  revalidatePath("/settings/mcp");
}

// ---------------------------------------------------------------------------
// 4. deleteMcpServer — 删除 MCP 服务器配置（含 org 所有权校验）
// ---------------------------------------------------------------------------
export async function deleteMcpServer(serverId: string) {
  const orgId = await requireOrg();

  const existing = await getMcpServerById(orgId, serverId);
  if (!existing) throw new Error("MCP 服务器不存在或无权访问");

  await db
    .delete(mcpServers)
    .where(
      and(eq(mcpServers.id, serverId), eq(mcpServers.organizationId, orgId))
    );

  revalidatePath("/settings/mcp");
}

// ---------------------------------------------------------------------------
// 5. testMcpServer — 轻量可达性检测（M1 scope: HEAD 探测）
//
// NOTE: M2 将引入 createMcpToolset（@ai-sdk/mcp）做完整工具列表联通测试；
// 此处仅做 HTTP HEAD 探测，确认端点可达即可。届时把这里的 fetch 替换为
// createMcpToolset({ url, headers }) 并把 toolCount 写回数据库。
// ---------------------------------------------------------------------------
export async function testMcpServer(
  serverId: string
): Promise<{ ok: boolean; error?: string }> {
  const orgId = await requireOrg();

  const existing = await getMcpServerById(orgId, serverId);
  if (!existing) return { ok: false, error: "MCP 服务器不存在或无权访问" };

  // Re-validate URL defensively before sending any request
  const check = validatePluginUrl(existing.url);
  if (!check.valid) return { ok: false, error: check.error };

  try {
    const resp = await fetch(existing.url, {
      method: "HEAD",
      signal: AbortSignal.timeout(existing.connectTimeoutMs),
    });

    if (resp.ok || resp.status < 500) {
      // 2xx / 3xx / 4xx all mean the server is reachable
      await db
        .update(mcpServers)
        .set({ lastConnectedAt: new Date(), lastError: null })
        .where(
          and(eq(mcpServers.id, serverId), eq(mcpServers.organizationId, orgId))
        );
      return { ok: true };
    }

    const errMsg = `服务器返回 ${resp.status}`;
    await db
      .update(mcpServers)
      .set({ lastError: errMsg })
      .where(
        and(eq(mcpServers.id, serverId), eq(mcpServers.organizationId, orgId))
      );
    return { ok: false, error: errMsg };
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : "连接失败";
    await db
      .update(mcpServers)
      .set({ lastError: errMsg })
      .where(
        and(eq(mcpServers.id, serverId), eq(mcpServers.organizationId, orgId))
      );
    return { ok: false, error: errMsg };
  }
}
