import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { mcpServers, organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  listEnabledMcpServers,
  listMcpServersByOrg,
  getMcpServerById,
} from "../mcp-servers";

describe("DAL mcp-servers", () => {
  const orgId = randomUUID();
  const otherOrgId = randomUUID();

  beforeAll(async () => {
    const stamp = Date.now();
    await db
      .insert(organizations)
      .values([
        { id: orgId, name: "mcp-servers-test-A", slug: `mcp-servers-test-a-${stamp}` },
        { id: otherOrgId, name: "mcp-servers-test-B", slug: `mcp-servers-test-b-${stamp}` },
      ])
      .onConflictDoNothing();
  });

  beforeEach(async () => {
    await db.delete(mcpServers).where(eq(mcpServers.organizationId, orgId));
    await db.delete(mcpServers).where(eq(mcpServers.organizationId, otherOrgId));
  });

  afterAll(async () => {
    await db.delete(mcpServers).where(eq(mcpServers.organizationId, orgId));
    await db.delete(mcpServers).where(eq(mcpServers.organizationId, otherOrgId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
    await db.delete(organizations).where(eq(organizations.id, otherOrgId));
  });

  it("listMcpServersByOrg 返回 org 下的全部记录", async () => {
    await db.insert(mcpServers).values([
      { organizationId: orgId, name: "服务器A", slug: "server-a", url: "https://a.example.com", enabled: 1 },
      { organizationId: orgId, name: "服务器B", slug: "server-b", url: "https://b.example.com", enabled: 0 },
      { organizationId: otherOrgId, name: "服务器C", slug: "server-c", url: "https://c.example.com", enabled: 1 },
    ]);

    const rows = await listMcpServersByOrg(orgId);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.slug).sort()).toEqual(["server-a", "server-b"]);
  });

  it("listEnabledMcpServers 只返回 enabled=1 的记录", async () => {
    await db.insert(mcpServers).values([
      { organizationId: orgId, name: "服务器A", slug: "server-a", url: "https://a.example.com", enabled: 1 },
      { organizationId: orgId, name: "服务器B", slug: "server-b", url: "https://b.example.com", enabled: 0 },
    ]);

    const rows = await listEnabledMcpServers(orgId);
    expect(rows).toHaveLength(1);
    expect(rows[0].slug).toBe("server-a");
  });

  it("getMcpServerById 按 id + org 查单条", async () => {
    const [inserted] = await db
      .insert(mcpServers)
      .values({ organizationId: orgId, name: "服务器A", slug: "server-a", url: "https://a.example.com" })
      .returning({ id: mcpServers.id });

    const found = await getMcpServerById(orgId, inserted.id);
    expect(found?.slug).toBe("server-a");

    // 跨 org 应返回 undefined
    const notFound = await getMcpServerById(otherOrgId, inserted.id);
    expect(notFound).toBeUndefined();
  });

  it("getMcpServerById 查不存在的 id 返回 undefined", async () => {
    const result = await getMcpServerById(orgId, randomUUID());
    expect(result).toBeUndefined();
  });
});
