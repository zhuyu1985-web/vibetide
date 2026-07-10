import { db } from "@/db";
import { mcpServers } from "@/db/schema";
import { and, eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// DAL — mcp_servers（只读，按 org 隔离）
// ---------------------------------------------------------------------------

/** 返回指定 org 下所有已启用（enabled=1）的 MCP 服务器配置。 */
export async function listEnabledMcpServers(orgId: string) {
  return db.query.mcpServers.findMany({
    where: and(eq(mcpServers.organizationId, orgId), eq(mcpServers.enabled, 1)),
  });
}

/** 返回指定 org 下的全部 MCP 服务器配置（不过滤 enabled）。 */
export async function listMcpServersByOrg(orgId: string) {
  return db.query.mcpServers.findMany({
    where: eq(mcpServers.organizationId, orgId),
  });
}

/** 按 id 查单条 MCP 服务器配置（含 org 隔离校验）。 */
export async function getMcpServerById(orgId: string, id: string) {
  return db.query.mcpServers.findFirst({
    where: and(eq(mcpServers.id, id), eq(mcpServers.organizationId, orgId)),
  });
}
