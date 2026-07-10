/**
 * executeCliPipeline — CLI 工具「跑一次」的共享核心管道（M3.8 DRY 抽取）。
 *
 * 把 M3.6 同步 execute 里的 run 逻辑提炼为可复用函数，供两条路径共用：
 * - 同步路径：createCliToolset 的 execute（executionMode==='sync'）
 * - 异步路径：cliRun Inngest 函数（executionMode==='async'）
 *
 * 管道步骤（与 M3.6 行为完全一致，behavior-preserving）：
 *   withScratchDir(
 *     解析 + 下载所有 asset 类参数 → 替换为本地 scratch 输入路径
 *     → assertAllowedBinary（白名单闸门）
 *     → resolveArgv（每个 token 恰好一个 argv 元素，零注入）
 *     → runCli（shell:false）
 *     → exitCode!==0 → 抛 CliPipelineError（带 exitCode/stderrTail）
 *     → 读输出 → probeMedia → storeBufferAsAsset
 *   ) → 返回 { assetId, publicUrl, assetType, exitCode, stderrTail, argvResolved }
 *
 * 关键：本函数**不碰 cli_tool_runs 表**——run 行的 insert/update 由调用方各自负责
 * （同步路径在 execute 内、异步路径在 Inngest step 内），让本函数纯粹聚焦「跑」。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { ArgsSchema, ArgvTemplate, ValidatedParams } from "./argv";
import { resolveArgv } from "./argv";
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

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** CLI 非零退出码错误——携带 exitCode/stderrTail/argv 供调用方落 run 行。 */
export class CliPipelineError extends Error {
  readonly exitCode: number;
  readonly stderrTail: string;
  readonly argvResolved: string[];
  constructor(exitCode: number, stderrTail: string, argvResolved: string[]) {
    super(`CLI 退出码 ${exitCode}`);
    this.name = "CliPipelineError";
    this.exitCode = exitCode;
    this.stderrTail = stderrTail;
    this.argvResolved = argvResolved;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** executeCliPipeline 所需的 cli_tools 行最小子集。 */
export interface CliPipelineTool {
  id: string;
  name: string;
  slug: string;
  command: string;
  argsSchema: ArgsSchema;
  argvTemplate: ArgvTemplate;
  syncTimeoutMs: number;
}

export interface CliPipelineResult {
  assetId: string;
  publicUrl: string;
  assetType: AssetMediaType;
  exitCode: number;
  stderrTail: string;
  argvResolved: string[];
}

// ---------------------------------------------------------------------------
// Shared helpers（同步 / 异步路径共用）
// ---------------------------------------------------------------------------

/** 把工具名 sanitize 到 ^[a-zA-Z0-9_-]+$（scratch 文件名用）。 */
export function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

/** 从输出扩展名推断 media_assets.type 与 contentType。 */
export function deriveOutputMeta(ext: string): {
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
 * 优先取名为 `ext` / `format` / `outputFormat` 的字符串/枚举参数；否则按工具兜底。
 */
export function deriveOutputExt(
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
export function extFromKey(key: string, fallback = "bin"): string {
  const base = key.split("?")[0];
  const m = base.match(/\.([a-zA-Z0-9]{1,8})$/);
  return m ? m[1].toLowerCase() : fallback;
}

/** 取第一个 asset 类参数的值（用于 run 行的 inputAssetId 记录）。 */
export function firstAssetParamValue(
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

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/**
 * 跑一次 CLI 工具：下载输入 asset → 校验白名单 → spawn → 落输出 asset。
 *
 * @param orgId 租户 ID
 * @param tool  cli_tools 行（最小子集）
 * @param validatedParams 已经过 validateParams 校验的参数
 * @throws {CliPipelineError} CLI 非零退出码
 * @throws {Error} 资产不存在 / 白名单拒绝 / 其它 I/O 错误
 * @returns 输出资产 + 退出元信息（调用方据此落 run 行）
 */
export async function executeCliPipeline(
  orgId: string,
  tool: CliPipelineTool,
  validatedParams: ValidatedParams,
): Promise<CliPipelineResult> {
  const argsSchema = tool.argsSchema;
  const argvTemplate = tool.argvTemplate;
  const inputAssetId = firstAssetParamValue(argsSchema, validatedParams);

  return withScratchDir(async (dir) => {
    // 1. 解析 + 下载所有 asset 类参数，替换为本地 scratch 输入路径
    const resolvedParams: ValidatedParams = { ...validatedParams };
    for (const [pKey, spec] of Object.entries(argsSchema)) {
      if (spec.type !== "asset") continue;
      const assetId = validatedParams[pKey];
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

    // 2. 白名单闸门
    assertAllowedBinary(tool.command);

    // 3. 输出 scratch 路径
    const outExt = deriveOutputExt(argsSchema, validatedParams);
    const outputPath = path.join(dir, `out.${outExt}`);

    // 4. 解析 argv（每个 token → 恰好一个 argv 元素，零注入）
    const argv = resolveArgv(argvTemplate, resolvedParams, outputPath);

    // 5. spawn（shell:false）
    const { exitCode, stderrTail } = await runCli(tool.command, argv, {
      cwd: dir,
      timeoutMs: tool.syncTimeoutMs,
    });

    if (exitCode !== 0) {
      throw new CliPipelineError(exitCode, stderrTail, argv);
    }

    // 6. 读输出 → 探测元数据 → 落 media_assets
    const buf = await fs.readFile(outputPath);
    const meta = await probeMedia(outputPath);
    const { type, contentType } = deriveOutputMeta(outExt);
    const { assetId, publicUrl } = await storeBufferAsAsset(buf, {
      organizationId: orgId,
      slug: tool.slug,
      ext: outExt,
      contentType,
      type,
      title: `${tool.name} 输出`,
      inputAssetId: inputAssetId ?? undefined,
      durationSeconds: meta.durationSeconds,
      width: meta.width,
      height: meta.height,
    });

    return {
      assetId,
      publicUrl,
      assetType: type,
      exitCode,
      stderrTail,
      argvResolved: argv,
    };
  });
}
