/**
 * createMcpToolset — 工厂：连接 org 下所有启用的 MCP 服务器并返回合并 ToolSet。
 *
 * 设计原则：
 * - 单台服务器失败不阻塞其他服务器（degrade-don't-block）
 * - 每台服务器有独立连接超时（connectTimeoutMs），通过 AbortSignal 实现
 * - 工具名统一命名空间：mcp__{slug}__{tool}，再 sanitize 到 ^[a-zA-Z0-9_-]+$
 * - close() 用 Promise.allSettled 确保单个 close 失败不影响其他
 */

import { createMCPClient } from "@ai-sdk/mcp";
import type { ToolSet } from "ai";
import { listEnabledMcpServers } from "@/lib/dal/mcp-servers";
import { decryptHeaders } from "./crypto-headers";
import { db } from "@/db";
import { mcpServers } from "@/db/schema";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type McpServerRow = Awaited<ReturnType<typeof listEnabledMcpServers>>[number];

/** 连接单台服务器后返回的 handle */
export interface McpServerHandle {
  /** 服务器返回的原始工具名列表 */
  toolNames: string[];
  /** 关闭连接 */
  close: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 把工具名中非法字符替换为 _ */
function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

/**
 * 连接单台 MCP 服务器，列出工具，返回 handle。
 * 超时通过 AbortController + setTimeout 实现（@ai-sdk/mcp 无内置超时选项）。
 *
 * 失败时抛出异常（由调用方 createMcpToolset 捕获并降级处理）。
 */
export async function connectMcpServer(
  server: McpServerRow
): Promise<McpServerHandle> {
  const timeoutMs = server.connectTimeoutMs ?? 8000;

  // Build a custom fetch with abort signal for timeout
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = decryptHeaders(server.encryptedHeaders);

  let client: Awaited<ReturnType<typeof createMCPClient>> | undefined;

  try {
    // Use Promise.race so a hanging createMCPClient call is also covered
    const connectPromise = createMCPClient({
      transport: {
        type: "http",
        url: server.url,
        headers,
        fetch: (input, init) => {
          // Merge our abort signal with any signal already present in init
          const existingSignal = (init as RequestInit | undefined)?.signal;
          const signal = existingSignal
            ? AbortSignal.any([controller.signal, existingSignal])
            : controller.signal;
          return fetch(input, { ...(init as RequestInit), signal });
        },
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      // Reuse the same controller — if timer fires it aborts and this rejects
      controller.signal.addEventListener("abort", () =>
        reject(new Error(`MCP 服务器连接超时（${timeoutMs}ms）：${server.url}`))
      );
    });

    client = await Promise.race([connectPromise, timeoutPromise]);
    clearTimeout(timer);

    const rawTools = await client.tools();
    const toolNames = Object.keys(rawTools);

    return {
      toolNames,
      close: () => client!.close(),
    };
  } catch (err) {
    clearTimeout(timer);
    // If client was opened before error, close it best-effort
    if (client) {
      client.close().catch(() => {});
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * 创建 org 下所有启用 MCP 服务器的合并工具集。
 *
 * @param organizationId 租户 ID
 * @returns { tools, close }
 *   - tools: 合并后的 AI SDK ToolSet，键名格式 mcp__{slug}__{tool_name}
 *   - close: 关闭所有已连接客户端
 */
export async function createMcpToolset(organizationId: string): Promise<{
  tools: ToolSet;
  close: () => Promise<void>;
}> {
  const servers = await listEnabledMcpServers(organizationId);

  const closers: Array<() => Promise<void>> = [];
  const tools: ToolSet = {};

  await Promise.all(
    servers.map(async (server) => {
      try {
        // Connect + list — single-server helper handles timeout
        const timeoutMs = server.connectTimeoutMs ?? 8000;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const headers = decryptHeaders(server.encryptedHeaders);
        let client: Awaited<ReturnType<typeof createMCPClient>> | undefined;

        try {
          const connectPromise = createMCPClient({
            transport: {
              type: "http",
              url: server.url,
              headers,
              fetch: (input, init) => {
                const existingSignal = (init as RequestInit | undefined)
                  ?.signal;
                const signal = existingSignal
                  ? AbortSignal.any([controller.signal, existingSignal])
                  : controller.signal;
                return fetch(input, { ...(init as RequestInit), signal });
              },
            },
          });

          const timeoutPromise = new Promise<never>((_, reject) => {
            controller.signal.addEventListener("abort", () =>
              reject(
                new Error(
                  `MCP 服务器连接超时（${timeoutMs}ms）：${server.url}`
                )
              )
            );
          });

          client = await Promise.race([connectPromise, timeoutPromise]);
          clearTimeout(timer);
        } catch (err) {
          clearTimeout(timer);
          throw err;
        }

        // List tools from server
        const rawTools = await client.tools();
        closers.push(() => client!.close());

        // Merge into combined toolset with namespaced, sanitized keys
        for (const [name, def] of Object.entries(rawTools)) {
          const key = sanitize(`mcp__${server.slug}__${name}`);
          tools[key] = def as ToolSet[string];
        }

        // Record success in DB
        await db
          .update(mcpServers)
          .set({
            lastConnectedAt: new Date(),
            toolCount: Object.keys(rawTools).length,
            lastError: null,
          })
          .where(eq(mcpServers.id, server.id));
      } catch (err) {
        // Degrade: record error but don't throw — other servers continue
        const errMsg = err instanceof Error ? err.message : String(err);
        await db
          .update(mcpServers)
          .set({ lastError: errMsg })
          .where(eq(mcpServers.id, server.id))
          .catch(() => {
            // Ignore DB write failure for error recording
          });
      }
    })
  );

  return {
    tools,
    close: async () => {
      await Promise.allSettled(closers.map((c) => c()));
    },
  };
}
