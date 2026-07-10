import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────
const insertCalls = vi.hoisted(
  () => [] as Array<{ values: Record<string, unknown> }>
);
const findFirstMcpMock = vi.hoisted(() => vi.fn());
const updateSetCalls = vi.hoisted(
  () => [] as Array<{ values: Record<string, unknown> }>
);
const deleteCalls = vi.hoisted(() => [] as string[]);

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "u1" }),
}));
vi.mock("@/lib/dal/auth", () => ({
  getCurrentUserOrg: vi.fn().mockResolvedValue("org1"),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/mcp/crypto-headers", () => ({
  encryptHeaders: vi.fn((h: Record<string, string>) =>
    Buffer.from(JSON.stringify(h)).toString("base64")
  ),
  decryptHeaders: vi.fn(() => ({})),
}));

const connectMcpServerMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/mcp/toolset", () => ({
  connectMcpServer: connectMcpServerMock,
}));

vi.mock("@/lib/dal/mcp-servers", () => ({
  getMcpServerById: findFirstMcpMock,
}));

vi.mock("@/db/schema", () => ({
  mcpServers: {} as never,
}));

vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: (values: Record<string, unknown>) => {
        insertCalls.push({ values });
        return {
          returning: vi.fn().mockResolvedValue([{ id: "new-server-id" }]),
        };
      },
    })),
    update: vi.fn(() => ({
      set: (values: Record<string, unknown>) => {
        updateSetCalls.push({ values });
        return { where: vi.fn().mockResolvedValue(undefined) };
      },
    })),
    delete: vi.fn(() => ({
      where: vi.fn((where: unknown) => {
        deleteCalls.push(String(where));
        return Promise.resolve();
      }),
    })),
  },
}));

import {
  createMcpServer,
  updateMcpServer,
  toggleMcpServer,
  deleteMcpServer,
  testMcpServer,
} from "../mcp-servers";

beforeEach(() => {
  insertCalls.length = 0;
  updateSetCalls.length = 0;
  deleteCalls.length = 0;
  findFirstMcpMock.mockReset();
  findFirstMcpMock.mockResolvedValue({
    id: "server-1",
    organizationId: "org1",
    url: "https://mcp.example.com/sse",
    encryptedHeaders: null,
    connectTimeoutMs: 8000,
    lastConnectedAt: null,
    lastError: null,
  });
  connectMcpServerMock.mockReset();
  connectMcpServerMock.mockResolvedValue({
    toolNames: ["tool1", "tool2"],
    close: vi.fn().mockResolvedValue(undefined),
  });
});

// ─── createMcpServer ─────────────────────────────────────────────────────

describe("createMcpServer", () => {
  it("rejects non-HTTPS urls (SSRF guard must throw)", async () => {
    await expect(
      createMcpServer({ name: "test", url: "http://mcp.example.com/sse" })
    ).rejects.toThrow("HTTPS");
    // No insert should happen
    expect(insertCalls.length).toBe(0);
  });

  it("rejects internal IP addresses (SSRF guard must throw)", async () => {
    await expect(
      createMcpServer({ name: "test", url: "https://192.168.1.1/sse" })
    ).rejects.toThrow(/内网/);
    expect(insertCalls.length).toBe(0);
  });

  it("rejects localhost (SSRF guard must throw)", async () => {
    await expect(
      createMcpServer({ name: "test", url: "https://localhost/sse" })
    ).rejects.toThrow(/内网/);
    expect(insertCalls.length).toBe(0);
  });

  it("rejects 127.0.0.1 (SSRF guard must throw)", async () => {
    await expect(
      createMcpServer({ name: "test", url: "https://127.0.0.1/sse" })
    ).rejects.toThrow(/内网/);
    expect(insertCalls.length).toBe(0);
  });

  it("rejects empty name", async () => {
    await expect(
      createMcpServer({ name: "  ", url: "https://mcp.example.com/sse" })
    ).rejects.toThrow("不能为空");
  });

  it("inserts with correct fields for valid input", async () => {
    const result = await createMcpServer({
      name: "My MCP",
      url: "https://mcp.example.com/sse",
      defaultToolClass: "read",
      connectTimeoutMs: 5000,
    });

    expect(result).toEqual({ id: "new-server-id" });
    expect(insertCalls.length).toBe(1);
    const vals = insertCalls[0].values;
    expect(vals.organizationId).toBe("org1");
    expect(vals.name).toBe("My MCP");
    expect(vals.slug).toBe("my-mcp");
    expect(vals.url).toBe("https://mcp.example.com/sse");
    expect(vals.defaultToolClass).toBe("read");
    expect(vals.connectTimeoutMs).toBe(5000);
    expect(vals.encryptedHeaders).toBeNull();
  });

  it("encrypts headers when provided", async () => {
    await createMcpServer({
      name: "Secure",
      url: "https://mcp.example.com/sse",
      headers: { Authorization: "Bearer tok" },
    });
    const vals = insertCalls[0].values;
    expect(vals.encryptedHeaders).toBeTruthy();
    // Should not store plain-text
    expect(vals.encryptedHeaders).not.toContain("Bearer tok");
  });

  it("defaults defaultToolClass to 'write' and connectTimeoutMs to 8000", async () => {
    await createMcpServer({ name: "Default", url: "https://mcp.example.com/" });
    const vals = insertCalls[0].values;
    expect(vals.defaultToolClass).toBe("write");
    expect(vals.connectTimeoutMs).toBe(8000);
  });
});

// ─── updateMcpServer ─────────────────────────────────────────────────────

describe("updateMcpServer", () => {
  it("throws when server not found (org isolation)", async () => {
    findFirstMcpMock.mockResolvedValueOnce(null);
    await expect(
      updateMcpServer("missing-id", { name: "new name" })
    ).rejects.toThrow("不存在或无权访问");
    expect(updateSetCalls.length).toBe(0);
  });

  it("rejects URL update with internal address (SSRF guard)", async () => {
    await expect(
      updateMcpServer("server-1", { url: "https://10.0.0.1/sse" })
    ).rejects.toThrow(/内网/);
    expect(updateSetCalls.length).toBe(0);
  });

  it("rejects URL update with HTTP (SSRF guard)", async () => {
    await expect(
      updateMcpServer("server-1", { url: "http://mcp.example.com/sse" })
    ).rejects.toThrow("HTTPS");
  });

  it("updates only provided fields", async () => {
    await updateMcpServer("server-1", { defaultToolClass: "read" });
    expect(updateSetCalls.length).toBe(1);
    expect(updateSetCalls[0].values.defaultToolClass).toBe("read");
    // Other fields should not be present
    expect(updateSetCalls[0].values.name).toBeUndefined();
    expect(updateSetCalls[0].values.url).toBeUndefined();
  });
});

// ─── toggleMcpServer ─────────────────────────────────────────────────────

describe("toggleMcpServer", () => {
  it("throws when server not found", async () => {
    findFirstMcpMock.mockResolvedValueOnce(null);
    await expect(toggleMcpServer("missing", true)).rejects.toThrow(
      "不存在或无权访问"
    );
  });

  it("sets enabled=1 when enabling", async () => {
    await toggleMcpServer("server-1", true);
    expect(updateSetCalls[0].values.enabled).toBe(1);
  });

  it("sets enabled=0 when disabling", async () => {
    await toggleMcpServer("server-1", false);
    expect(updateSetCalls[0].values.enabled).toBe(0);
  });
});

// ─── deleteMcpServer ─────────────────────────────────────────────────────

describe("deleteMcpServer", () => {
  it("throws when server not found", async () => {
    findFirstMcpMock.mockResolvedValueOnce(null);
    await expect(deleteMcpServer("missing")).rejects.toThrow("不存在或无权访问");
    expect(deleteCalls.length).toBe(0);
  });

  it("deletes when server exists in org", async () => {
    await deleteMcpServer("server-1");
    expect(deleteCalls.length).toBe(1);
  });
});

// ─── testMcpServer ────────────────────────────────────────────────────────

describe("testMcpServer", () => {
  it("returns error when server not found", async () => {
    findFirstMcpMock.mockResolvedValueOnce(null);
    const result = await testMcpServer("missing");
    expect(result).toEqual({
      ok: false,
      error: "MCP 服务器不存在或无权访问",
    });
  });

  it("returns ok:true and toolCount on successful MCP connect", async () => {
    const result = await testMcpServer("server-1");
    expect(result.ok).toBe(true);
    expect(result.toolCount).toBe(2);
    expect(connectMcpServerMock).toHaveBeenCalledTimes(1);
  });

  it("writes lastConnectedAt and toolCount to DB on success", async () => {
    await testMcpServer("server-1");
    expect(updateSetCalls.length).toBeGreaterThan(0);
    const lastSet = updateSetCalls[updateSetCalls.length - 1].values;
    expect(lastSet.toolCount).toBe(2);
    expect(lastSet.lastError).toBeNull();
    expect(lastSet.lastConnectedAt).toBeInstanceOf(Date);
  });

  it("returns ok:false and error message when connectMcpServer throws", async () => {
    connectMcpServerMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await testMcpServer("server-1");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("ECONNREFUSED");
  });

  it("writes lastError to DB when connectMcpServer throws", async () => {
    connectMcpServerMock.mockRejectedValue(new Error("timeout"));

    await testMcpServer("server-1");
    expect(updateSetCalls.length).toBeGreaterThan(0);
    const lastSet = updateSetCalls[updateSetCalls.length - 1].values;
    expect(lastSet.lastError).toBe("timeout");
  });
});
