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
 * - async 模式工具走占位返回（M3b/M3.8 才真正异步执行）。
 */

import { tool, type ToolSet } from "ai";
import { z } from "zod/v4";
import { listEnabledCliTools, insertCliToolRun, updateCliToolRun } from "@/lib/dal/cli-tools";
import type { ArgsSchema, FieldSpec, ArgvTemplate, ValidatedParams } from "./argv";
import { validateParams, resolveArgv } from "./argv";
import { assertAllowedBinary } from "./allowlist";
import { runCli } from "./spawn";
import { withScratchDir } from "./scratch";
import {
  resolveOrgAsset,
  downloadObjectToFile,
  storeBufferAsAsset,
  probeMedia,
  type AssetMediaType,
} from "@/lib/media/asset-io";
import { promises as fs } from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CliToolRow = Awaited<ReturnType<typeof listEnabledCliTools>>[number];

const WRITE_AUTHORITY = new Set(["executor", "coordinator"]);

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

/** 从输出扩展名推断 media_assets.type 与 contentType。 */
function deriveOutputMeta(ext: string): {
  type: AssetMediaType;
  contentType: string;
} {
  const e = ext.toLowerCase();
  const video = new Set(["mp4", "mov", "mkv", "webm", "avi", "flv", "m4v"]);
  const image = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"]);
  const audio = new Set(["mp3", "wav", "aac", "flac", "ogg", "m4a"]);
  const CONTENT_TYPES: Record<string, string> = {
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    mkv: "video/x-matroska",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    aac: "audio/aac",
    flac: "audio/flac",
    ogg: "audio/ogg",
    srt: "application/x-subrip",
    vtt: "text/vtt",
    txt: "text/plain",
    pdf: "application/pdf",
  };
  const type: AssetMediaType = video.has(e)
    ? "video"
    : image.has(e)
      ? "image"
      : audio.has(e)
        ? "audio"
        : "document";
  return { type, contentType: CONTENT_TYPES[e] ?? "application/octet-stream" };
}

/**
 * 从 argsSchema + validatedParams 推断输出文件扩展名。
 * 优先取名为 `ext` / `format` / `outputFormat` 的字符串/枚举参数；否则按工具名兜底。
 */
function deriveOutputExt(
  argsSchema: ArgsSchema,
  validatedParams: ValidatedParams,
): string {
  for (const key of ["ext", "format", "outputFormat", "output_ext"]) {
    const v = validatedParams[key];
    if (typeof v === "string" && /^[a-zA-Z0-9]{1,8}$/.test(v)) return v.toLowerCase();
  }
  // 若 schema 声明了某个枚举字段且其值像扩展名，也接受
  for (const [key, spec] of Object.entries(argsSchema)) {
    if (spec.type === "enum") {
      const v = validatedParams[key];
      if (typeof v === "string" && /^[a-zA-Z0-9]{1,8}$/.test(v)) return v.toLowerCase();
    }
  }
  return "bin";
}

/** 从 asset 文件 url / objectKey 推断输入扩展名。 */
function extFromKey(key: string, fallback = "bin"): string {
  const base = key.split("?")[0];
  const m = base.match(/\.([a-zA-Z0-9]{1,8})$/);
  return m ? m[1].toLowerCase() : fallback;
}

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
  const argvTemplate = row.argvTemplate as ArgvTemplate;
  const inputSchema = buildInputSchema(argsSchema);

  return tool({
    description: row.description,
    inputSchema,
    execute: async (rawArgs: Record<string, unknown>) => {
      let runId: string | undefined;
      try {
        // 1. 服务端再校验（拒绝未知参数 / 类型 / 范围 / 正则）
        const params = validateParams(argsSchema, rawArgs);

        // 2. async 模式 → 占位返回，不实际运行（M3.8 替换此分支）
        if (row.executionMode === "async") {
          return {
            success: false,
            status: "pending",
            message: "该工具为异步执行，将在后续版本启用",
          };
        }

        // 3. 同步路径 —— 先建 run 行（processing）
        const inputAssetId = firstAssetParamValue(argsSchema, params);
        const created = await insertCliToolRun({
          organizationId: orgId,
          cliToolId: row.id,
          status: "processing",
          inputAssetId: inputAssetId ?? null,
        });
        runId = created.id;

        return await withScratchDir(async (dir) => {
          // 3a. 解析 + 下载所有 asset 类参数，替换为本地 scratch 输入路径
          const resolvedParams: ValidatedParams = { ...params };
          for (const [pKey, spec] of Object.entries(argsSchema)) {
            if (spec.type !== "asset") continue;
            const assetId = params[pKey];
            if (typeof assetId !== "string" || !assetId) continue;
            const asset = await resolveOrgAsset(orgId, assetId);
            if (!asset || !asset.tosObjectKey) {
              throw new Error("资产不存在或无权访问");
            }
            const inExt = extFromKey(asset.tosObjectKey);
            const inPath = path.join(dir, `in_${sanitize(pKey)}.${inExt}`);
            await downloadObjectToFile(asset.tosObjectKey, inPath);
            resolvedParams[pKey] = inPath;
          }

          // 3b. 白名单闸门
          assertAllowedBinary(row.command);

          // 3c. 输出 scratch 路径
          const outExt = deriveOutputExt(argsSchema, params);
          const outputPath = path.join(dir, `out.${outExt}`);

          // 3d. 解析 argv（每个 token → 恰好一个 argv 元素，零注入）
          const argv = resolveArgv(argvTemplate, resolvedParams, outputPath);

          // 3e. spawn（shell:false）
          const { exitCode, stderrTail } = await runCli(row.command, argv, {
            cwd: dir,
            timeoutMs: row.syncTimeoutMs,
          });

          if (exitCode !== 0) {
            await updateCliToolRun(runId!, {
              status: "failed",
              exitCode,
              stderrTail,
              argvResolved: argv,
              finishedAt: new Date(),
            });
            return {
              success: false,
              error: `CLI 退出码 ${exitCode}`,
              stderrTail,
            };
          }

          // 3f. 读输出 → 探测元数据 → 落 media_assets
          const buf = await fs.readFile(outputPath);
          const meta = await probeMedia(outputPath);
          const { type, contentType } = deriveOutputMeta(outExt);
          const { assetId, publicUrl } = await storeBufferAsAsset(buf, {
            organizationId: orgId,
            slug: row.slug,
            ext: outExt,
            contentType,
            type,
            title: `${row.name} 输出`,
            inputAssetId: inputAssetId ?? undefined,
            durationSeconds: meta.durationSeconds,
            width: meta.width,
            height: meta.height,
          });

          await updateCliToolRun(runId!, {
            status: "done",
            outputAssetId: assetId,
            argvResolved: argv,
            exitCode,
            finishedAt: new Date(),
          });

          return { success: true, assetId, publicUrl };
        });
      } catch (e) {
        // execute 永不抛 —— 落 run 行后返回 {success:false,error}
        const errMsg = e instanceof Error ? e.message : String(e);
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

/** 取第一个 asset 类参数的值（用于 run 行的 inputAssetId 记录）。 */
function firstAssetParamValue(
  argsSchema: ArgsSchema,
  params: ValidatedParams,
): string | undefined {
  for (const [key, spec] of Object.entries(argsSchema)) {
    if (spec.type === "asset" && typeof params[key] === "string") {
      return params[key] as string;
    }
  }
  return undefined;
}

// re-export for downstream typing convenience
export type { FieldSpec };
