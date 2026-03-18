import { tool, type ToolSet } from "ai";
import { z } from "zod/v4";
import { db } from "@/db";
import { mediaAssets } from "@/db/schema";
import { ilike, sql } from "drizzle-orm";
import type { AgentTool } from "./types";

// ---------------------------------------------------------------------------
// Tool definitions using Vercel AI SDK format
// ---------------------------------------------------------------------------

function createToolDefinitions(): ToolSet {
  return {
    web_search: tool({
      description: "搜索互联网获取最新信息和热点话题",
      inputSchema: z.object({
        query: z.string().describe("搜索关键词"),
        maxResults: z.number().optional().default(5).describe("最大结果数"),
      }),
      execute: async ({ query }) => ({
        results: [
          {
            title: `[模拟搜索结果] ${query}`,
            snippet: `这是关于「${query}」的模拟搜索结果。在生产环境中，此工具将连接真实的搜索API。`,
            url: "https://example.com",
          },
        ],
      }),
    }),
    content_generate: tool({
      description: "根据大纲和要求生成内容文本",
      inputSchema: z.object({
        outline: z.string().describe("内容大纲"),
        style: z
          .string()
          .optional()
          .default("professional")
          .describe("写作风格"),
        maxLength: z.number().optional().default(2000).describe("最大字数"),
      }),
      execute: async ({ outline, style }) => ({
        content: `[模拟生成内容] 基于大纲「${outline}」，以${style}风格生成的内容。`,
        wordCount: 100,
      }),
    }),
    fact_check: tool({
      description: "对给定文本进行事实核查",
      inputSchema: z.object({
        text: z.string().describe("需要核查的文本"),
        claims: z.array(z.string()).optional().describe("具体需要核查的声明"),
      }),
      execute: async ({ text }) => ({
        overallScore: 85,
        issues: [],
        summary: `[模拟核查] 文本（${text.slice(0, 50)}...）的事实核查结果：整体可信度 85/100。`,
      }),
    }),
    // F4.1.126: Media asset search — connects to media_assets table
    media_search: tool({
      description: "从媒资库中检索素材（图片、视频、音频、文档）",
      inputSchema: z.object({
        keyword: z.string().describe("搜索关键词"),
        type: z
          .enum(["image", "video", "audio", "document"])
          .optional()
          .describe("素材类型过滤"),
        limit: z.number().optional().default(10).describe("返回数量"),
      }),
      execute: async ({ keyword, type, limit }) => {
        const conditions = [ilike(mediaAssets.title, `%${keyword}%`)];
        if (type) {
          conditions.push(sql`${mediaAssets.type} = ${type}` as never);
        }
        const results = await db
          .select({
            id: mediaAssets.id,
            title: mediaAssets.title,
            type: mediaAssets.type,
            description: mediaAssets.description,
            fileUrl: mediaAssets.fileUrl,
            thumbnailUrl: mediaAssets.thumbnailUrl,
            tags: mediaAssets.tags,
            usageCount: mediaAssets.usageCount,
          })
          .from(mediaAssets)
          .where(conditions.length === 1 ? conditions[0] : sql`${conditions[0]} AND ${conditions[1]}`)
          .limit(limit || 10);

        return {
          count: results.length,
          assets: results.map((r) => ({
            id: r.id,
            title: r.title,
            type: r.type,
            description: r.description || "",
            url: r.fileUrl || "",
            thumbnail: r.thumbnailUrl || "",
            tags: r.tags || [],
          })),
        };
      },
    }),
    // F4.1.128: Data report tool — aggregate analytics
    data_report: tool({
      description: "生成数据分析报告，汇总渠道传播数据",
      inputSchema: z.object({
        reportType: z
          .enum(["daily", "weekly", "monthly"])
          .describe("报告周期"),
        metrics: z
          .array(z.string())
          .optional()
          .describe("关注的指标（如阅读量、互动率、粉丝增长）"),
      }),
      execute: async ({ reportType, metrics }) => {
        // Use DAL analytics summary for real data when available
        const periodLabels = {
          daily: "日报",
          weekly: "周报",
          monthly: "月报",
        };
        return {
          period: periodLabels[reportType],
          generatedAt: new Date().toISOString(),
          requestedMetrics: metrics || ["阅读量", "互动率", "发布数"],
          summary: `[数据${periodLabels[reportType]}] 已生成${periodLabels[reportType]}数据概览。`,
          note: "详细数据请查看数据分析仪表盘。",
        };
      },
    }),
  };
}

// Singleton tool definitions
const ALL_TOOLS = createToolDefinitions();

// ---------------------------------------------------------------------------
// Resolve skill names to AgentTool descriptors
// ---------------------------------------------------------------------------

export function resolveTools(skillNames: string[]): AgentTool[] {
  return skillNames.map((name) => {
    const impl = ALL_TOOLS[name];
    if (impl) {
      return {
        name,
        description: impl.description ?? `执行「${name}」`,
        parameters: {},
      };
    }
    return {
      name,
      description: `执行「${name}」技能`,
      parameters: {},
    };
  });
}

// ---------------------------------------------------------------------------
// Plugin skill configuration type
// ---------------------------------------------------------------------------

interface PluginConfig {
  endpoint: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  authType?: "none" | "api_key" | "bearer";
  authKey?: string;
  requestTemplate?: string;
  responseMapping?: Record<string, string>;
  timeoutMs?: number;
}

/**
 * Create a dynamic tool from a plugin configuration.
 * Calls the configured external API endpoint.
 */
function createPluginTool(name: string, description: string, config: PluginConfig) {
  return tool({
    description,
    inputSchema: z.object({
      input: z.string().describe("任务输入"),
      parameters: z.record(z.string(), z.unknown()).optional().describe("额外参数"),
    }),
    execute: async ({ input, parameters }) => {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...(config.headers || {}),
        };

        if (config.authType === "bearer" && config.authKey) {
          headers["Authorization"] = `Bearer ${config.authKey}`;
        } else if (config.authType === "api_key" && config.authKey) {
          headers["X-API-Key"] = config.authKey;
        }

        const body = config.requestTemplate
          ? config.requestTemplate
              .replace("{{input}}", input)
              .replace("{{parameters}}", JSON.stringify(parameters || {}))
          : JSON.stringify({ input, parameters });

        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          config.timeoutMs || 30000
        );

        const response = await fetch(config.endpoint, {
          method: config.method || "POST",
          headers,
          body: config.method === "GET" ? undefined : body,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          return {
            error: `Plugin API returned ${response.status}: ${response.statusText}`,
            pluginName: name,
          };
        }

        const data = await response.json();
        return { result: data, pluginName: name };
      } catch (err) {
        return {
          error: `Plugin「${name}」执行失败: ${err instanceof Error ? err.message : String(err)}`,
          pluginName: name,
        };
      }
    },
  });
}

/**
 * Convert AgentTools to Vercel AI SDK ToolSet for generateText().
 * Returns only the tools that the agent has access to.
 */
export function toVercelTools(
  agentTools: AgentTool[],
  pluginConfigs?: Map<string, { description: string; config: PluginConfig }>
): ToolSet {
  const result: ToolSet = {};

  for (const t of agentTools) {
    if (ALL_TOOLS[t.name]) {
      result[t.name] = ALL_TOOLS[t.name];
    } else if (pluginConfigs?.has(t.name)) {
      // S2.15: Create dynamic tool from plugin configuration
      const plugin = pluginConfigs.get(t.name)!;
      result[t.name] = createPluginTool(t.name, plugin.description, plugin.config);
    } else {
      // Stub tool for unmapped skills
      result[t.name] = tool({
        description: t.description,
        inputSchema: z.object({
          input: z.string().optional().describe("任务输入"),
        }),
        execute: async ({ input }) => ({
          result: `[${t.name}] 已完成处理${input ? `：${input}` : ""}`,
        }),
      });
    }
  }

  return result;
}
