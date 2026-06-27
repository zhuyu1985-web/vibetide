/**
 * createCliToolset — 工厂：把 org 下所有启用的 cli_tools 行转成 AI SDK ToolSet。
 *
 * M3.6 集成枢纽：把 M3.1~M3.5 的积木（allowlist / argv / asset-io / spawn /
 * scratch）拼成 LLM 可调用的同步执行工具。
 *
 * 设计原则：
 * - 纯 in-process：sync spawn 没有持久连接，返回普通 ToolSet，无需 close()。
 * - 权限闸门：write 类工具仅对 executor / coordinator 暴露；read 类始终暴露。
 * - 单条 cli_tools 行构建失败不阻塞整组（per-tool try/catch）。
 * - execute 永不向外抛：失败一律 return { success:false, error } 并落 run 行。
 * - async 模式工具落 queued run 行 + 派 cli/run.requested 事件 → 立即返回（fire-and-return）。
 */

import { tool, type ToolSet } from "ai";
import { z } from "zod/v4";
import { listEnabledCliTools, insertCliToolRun, updateCliToolRun } from "@/lib/dal/cli-tools";
import type { ArgsSchema, FieldSpec, ArgvTemplate } from "./argv";
import { validateParams } from "./argv";
import {
  executeCliPipeline,
  firstAssetParamValue,
  CliPipelineError,
} from "./pipeline";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CliToolRow = Awaited<ReturnType<typeof listEnabledCliTools>>[number];

const WRITE_AUTHORITY = new Set(["executor", "coordinator"]);

/**
 * toVercelTools 的 wrapToolExecuteWithContext（tool-registry.ts ~:2900-2916）会把
 * 这些上下文键**合并进**传给 execute 的 args。CLI 的 execute 随后调用
 * validateParams——它会拒绝任何不在 argsSchema 里的键。若不先剥离这些注入键，
 * 经 4 个真实调用点调用 CLI 工具必报 "未知参数 organizationId" → 端到端跑不通。
 *
 * 这里列全 wrap 实际写入的键（organizationId / operatorId / missionId / taskId /
 * conversationId / includeDomains，即 authorityDomains 写入时用的键名），再加
 * authorityDomains 本身做防御性冗余——execute 已闭包持有 orgId，不依赖任何注入键。
 */
const RESERVED_CONTEXT_KEYS = new Set([
  "organizationId",
  "operatorId",
  "missionId",
  "taskId",
  "conversationId",
  "authorityDomains",
  "includeDomains",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 把工具名 sanitize 到 ^[a-zA-Z0-9_-]+$ */
function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

/**
 * 把 cli_tools.argsSchema（FieldSpec map）转成 LLM 可见的 zod object schema。
 * 这是 LLM 看到的入参契约；execute 内部会用 validateParams 再做一次服务端校验。
 */
function buildInputSchema(argsSchema: ArgsSchema) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, spec] of Object.entries(argsSchema)) {
    let field: z.ZodTypeAny;
    switch (spec.type) {
      case "asset":
        field = z.string().describe("媒体资产 ID");
        break;
      case "enum":
        field = z.enum((spec.values ?? []) as [string, ...string[]]);
        break;
      case "number": {
        let n = z.number();
        if (spec.min !== undefined) n = n.min(spec.min);
        if (spec.max !== undefined) n = n.max(spec.max);
        field = n;
        break;
      }
      case "string":
      default: {
        let s = z.string();
        if (spec.regex !== undefined) s = s.regex(new RegExp(spec.regex));
        field = s;
        break;
      }
    }
    shape[key] = spec.required ? field : field.optional();
  }
  return z.object(shape);
}

// 输出/输入扩展名推断、media type 映射、scratch run 管道均已抽到 ./pipeline（M3.8 DRY）。

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * 构建 org 下所有启用 CLI 工具的合并 ToolSet。
 *
 * @param orgId 租户 ID
 * @param opts.authorityLevel 当前 agent 的权限层级；用于过滤 write 类工具
 * @returns 普通 AI SDK ToolSet（键名 cli__{slug}），无 close。
 */
export async function createCliToolset(
  orgId: string,
  opts: { authorityLevel?: string },
): Promise<ToolSet> {
  const rows = await listEnabledCliTools(orgId);
  const result: ToolSet = {};

  for (const row of rows) {
    try {
      // ── 权限闸门：write 类仅对 executor / coordinator 暴露 ──────────────
      if (
        row.toolClass === "write" &&
        !(opts.authorityLevel && WRITE_AUTHORITY.has(opts.authorityLevel))
      ) {
        continue;
      }

      const key = sanitize(`cli__${row.slug}`);
      result[key] = buildCliTool(orgId, row);
    } catch (err) {
      // per-tool 构建失败不阻塞整组
      console.error(
        `[createCliToolset] 构建 CLI 工具失败 slug=${row.slug}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Single tool builder
// ---------------------------------------------------------------------------

function buildCliTool(orgId: string, row: CliToolRow) {
  const argsSchema = row.argsSchema as ArgsSchema;
  const inputSchema = buildInputSchema(argsSchema);

  return tool({
    description: row.description,
    inputSchema,
    execute: async (rawArgs: Record<string, unknown>) => {
      let runId: string | undefined;
      try {
        // 0. 剥离 wrapToolExecuteWithContext 注入的上下文键 —— 否则 validateParams
        //    会因 "未知参数 organizationId" 拒掉每一次真实调用（见 RESERVED_CONTEXT_KEYS）。
        //    注意：execute 仍能从 rawArgs **读** missionId/taskId/operatorId/conversationId
        //    供异步路径填进 run 行 + 事件（均由 wrap 注入，在此被剥离出 cliArgs）。
        const cliArgs = Object.fromEntries(
          Object.entries(rawArgs).filter(([k]) => !RESERVED_CONTEXT_KEYS.has(k)),
        );

        // 1. 服务端再校验（拒绝未知参数 / 类型 / 范围 / 正则）
        const params = validateParams(argsSchema, cliArgs);
        const inputAssetId = firstAssetParamValue(argsSchema, params);

        // 2. async 模式 → 落 queued run 行 + 派 cli/run.requested 事件 → 立即返回。
        //    重活（下载/转码/落库/呈现）全由 cliRun Inngest 函数后台跑，绝不在此 await。
        if (row.executionMode === "async") {
          // wrap 注入的上下文键（已被剥离出 cliArgs，但仍可从 rawArgs 读原值）。
          const missionId = readContextString(rawArgs, "missionId");
          const taskId = readContextString(rawArgs, "taskId");
          // conversationId 由 wrapToolExecuteWithContext 注入（ToolContext.conversationId）。
          // surfaceCliOutput 据此把产物呈现为 cowork import_card（纯会话路径）。
          const conversationId = readContextString(rawArgs, "conversationId");

          const created = await insertCliToolRun({
            organizationId: orgId,
            cliToolId: row.id,
            status: "queued",
            inputAssetId: inputAssetId ?? null,
            missionId: missionId ?? null,
            taskId: taskId ?? null,
            conversationId: conversationId ?? null,
          });
          runId = created.id;

          const { inngest } = await import("@/inngest/client");
          await inngest.send({
            // 去重 id：同 run 行只派一次（Inngest event dedup）。
            id: runId,
            name: "cli/run.requested",
            data: {
              organizationId: orgId,
              cliToolId: row.id,
              runId,
              resolvedParams: params as Record<string, unknown>,
              inputAssetId: inputAssetId ?? undefined,
              missionId: missionId ?? undefined,
              taskId: taskId ?? undefined,
              conversationId: conversationId ?? undefined,
            },
          });

          return {
            success: true,
            status: "queued",
            runId,
            message: "已提交，完成后产物会出现在任务产出区",
          };
        }

        // 3. 同步路径 —— 先建 run 行（processing）
        const created = await insertCliToolRun({
          organizationId: orgId,
          cliToolId: row.id,
          status: "processing",
          inputAssetId: inputAssetId ?? null,
        });
        runId = created.id;

        // 4. 跑共享管道（下载 → 白名单 → spawn → 落 asset）。
        //    row.argsSchema/argvTemplate 是 jsonb（unknown），收窄到管道契约类型。
        const out = await executeCliPipeline(orgId, {
          id: row.id,
          name: row.name,
          slug: row.slug,
          command: row.command,
          argsSchema,
          argvTemplate: row.argvTemplate as ArgvTemplate,
          syncTimeoutMs: row.syncTimeoutMs,
        }, params);

        await updateCliToolRun(runId, {
          status: "done",
          outputAssetId: out.assetId,
          argvResolved: out.argvResolved,
          exitCode: out.exitCode,
          finishedAt: new Date(),
        });

        return { success: true, assetId: out.assetId, publicUrl: out.publicUrl };
      } catch (e) {
        // execute 永不抛 —— 落 run 行后返回 {success:false,error}
        // CLI 非零退出码（CliPipelineError）额外回传 exitCode/stderrTail。
        const errMsg = e instanceof Error ? e.message : String(e);
        if (e instanceof CliPipelineError) {
          if (runId) {
            await updateCliToolRun(runId, {
              status: "failed",
              exitCode: e.exitCode,
              stderrTail: e.stderrTail,
              argvResolved: e.argvResolved,
              finishedAt: new Date(),
            }).catch(() => {});
          }
          return { success: false, error: errMsg, stderrTail: e.stderrTail };
        }
        if (runId) {
          await updateCliToolRun(runId, {
            status: "failed",
            errorMessage: errMsg,
            finishedAt: new Date(),
          }).catch(() => {
            // 忽略 run 更新失败，避免遮蔽原始错误
          });
        }
        return { success: false, error: errMsg };
      }
    },
  });
}

/** 从 rawArgs 读注入的上下文字符串值（非空字符串才返回）。 */
function readContextString(
  rawArgs: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = rawArgs[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

// re-export for downstream typing convenience
export type { FieldSpec };
