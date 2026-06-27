import { describe, test, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — vi.mock factories must NOT reference outer variables (hoisting)
// ---------------------------------------------------------------------------

vi.mock("@ai-sdk/mcp", () => ({
  createMCPClient: vi.fn(),
}));

vi.mock("@/lib/dal/mcp-servers", () => ({
  listEnabledMcpServers: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  },
}));

vi.mock("@/db/schema", () => ({
  mcpServers: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import after mocks (so mocked versions are used)
// ---------------------------------------------------------------------------
import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import { listEnabledMcpServers } from "@/lib/dal/mcp-servers";
import { createMcpToolset, connectMcpServer } from "../toolset";

// Typed aliases for convenience
const mockCreateMCPClient = vi.mocked(createMCPClient);
const mockListEnabledMcpServers = vi.mocked(listEnabledMcpServers);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeServer(overrides: Record<string, unknown> = {}) {
  return {
    id: "srv-1",
    organizationId: "org-1",
    name: "Test Server",
    slug: "test-server",
    url: "https://mcp.example.com/",
    encryptedHeaders: null,
    connectTimeoutMs: 8000,
    enabled: 1,
    lastConnectedAt: null,
    lastError: null,
    toolCount: 0,
    createdAt: new Date(),
    defaultToolClass: "write",
    ...overrides,
  };
}

function makeClient(toolsMap: Record<string, unknown> = {}): MCPClient {
  return {
    close: vi.fn().mockResolvedValue(undefined),
    tools: vi.fn().mockResolvedValue(toolsMap),
  } as unknown as MCPClient;
}

// ---------------------------------------------------------------------------
// Reset mocks between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createMcpToolset", () => {
  test("① tools are namespaced mcp__{slug}__{tool} and sanitized", async () => {
    const server = makeServer({ slug: "my-server" });
    mockListEnabledMcpServers.mockResolvedValue([server]);

    // Tools with names containing spaces / special chars
    mockCreateMCPClient.mockResolvedValue(
      makeClient({
        "get data": { description: "get data", execute: vi.fn() },
        "search-items": { description: "search", execute: vi.fn() },
      })
    );

    const { tools, close } = await createMcpToolset("org-1");

    const keys = Object.keys(tools);
    // Space should be sanitized to _
    expect(keys).toContain("mcp__my-server__get_data");
    // Hyphens are allowed by the sanitize regex
    expect(keys).toContain("mcp__my-server__search-items");
    expect(keys).toHaveLength(2);

    // All keys must be safe characters only
    for (const k of keys) {
      expect(k).toMatch(/^[a-zA-Z0-9_-]+$/);
    }

    await close();
  });

  test("② server A succeeds + server B throws → A's tools present, B's absent, createMcpToolset does NOT throw", async () => {
    const serverA = makeServer({ id: "srv-a", slug: "server-a" });
    const serverB = makeServer({ id: "srv-b", slug: "server-b" });
    mockListEnabledMcpServers.mockResolvedValue([serverA, serverB]);

    let callCount = 0;
    mockCreateMCPClient.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // Server A succeeds
        return makeClient({ search: { description: "search", execute: vi.fn() } });
      }
      // Server B throws
      throw new Error("connection refused");
    });

    // Must NOT throw
    const { tools, close } = await createMcpToolset("org-1");

    expect(tools["mcp__server-a__search"]).toBeDefined();
    expect(
      Object.keys(tools).some((k) => k.startsWith("mcp__server-b__"))
    ).toBe(false);

    await close();
  });

  test("③ close() calls client.close() on all opened clients", async () => {
    const serverA = makeServer({ id: "srv-a", slug: "server-a" });
    const serverB = makeServer({ id: "srv-b", slug: "server-b" });
    mockListEnabledMcpServers.mockResolvedValue([serverA, serverB]);

    const clientA = makeClient({ toolX: { execute: vi.fn() } });
    const clientB = makeClient({ toolY: { execute: vi.fn() } });

    mockCreateMCPClient
      .mockResolvedValueOnce(clientA)
      .mockResolvedValueOnce(clientB);

    const { close } = await createMcpToolset("org-1");
    await close();

    expect(clientA.close).toHaveBeenCalledTimes(1);
    expect(clientB.close).toHaveBeenCalledTimes(1);
  });

  test("④ empty/no servers → empty tools, no error", async () => {
    mockListEnabledMcpServers.mockResolvedValue([]);

    const { tools, close } = await createMcpToolset("org-1");

    expect(Object.keys(tools)).toHaveLength(0);
    await expect(close()).resolves.toBeUndefined();
  });

  test("⑤ close() with one failing close still runs all others (allSettled)", async () => {
    const serverA = makeServer({ id: "srv-a", slug: "server-a" });
    const serverB = makeServer({ id: "srv-b", slug: "server-b" });
    mockListEnabledMcpServers.mockResolvedValue([serverA, serverB]);

    const clientA = {
      close: vi.fn().mockRejectedValue(new Error("close error")),
      tools: vi.fn().mockResolvedValue({ t1: { execute: vi.fn() } }),
    } as unknown as MCPClient;
    const clientB = makeClient({ t2: { execute: vi.fn() } });

    mockCreateMCPClient
      .mockResolvedValueOnce(clientA)
      .mockResolvedValueOnce(clientB);

    const { close } = await createMcpToolset("org-1");
    // Should NOT throw even if clientA.close() rejects
    await expect(close()).resolves.toBeUndefined();
    expect(clientA.close).toHaveBeenCalled();
    expect(clientB.close).toHaveBeenCalled();
  });
});

describe("connectMcpServer (helper)", () => {
  test("returns toolNames and close on success", async () => {
    const server = makeServer({ slug: "helper-server" });
    const client = makeClient({ toolA: { execute: vi.fn() }, toolB: { execute: vi.fn() } });
    mockCreateMCPClient.mockResolvedValue(client);

    const result = await connectMcpServer(server);

    expect(result.toolNames).toEqual(expect.arrayContaining(["toolA", "toolB"]));
    expect(result.toolNames).toHaveLength(2);
    expect(typeof result.close).toBe("function");

    await result.close();
    expect(client.close).toHaveBeenCalledTimes(1);
  });

  test("throws on connection failure", async () => {
    const server = makeServer({ slug: "bad-server" });
    mockCreateMCPClient.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(connectMcpServer(server)).rejects.toThrow("ECONNREFUSED");
  });
});
