/**
 * smoke-cli-tool.ts — CLI 工具管道端到端冒烟测试
 *
 * 用法:
 *   pnpm exec tsx scripts/smoke-cli-tool.ts [--org <orgId>] [--keep]
 *
 * 无需手动准备任何数据——脚本自行合成测试视频、注册临时工具、运行管道、清理。
 *
 * 前置条件:
 *   - .env.local 配置了 DATABASE_URL, STORAGE_*, CLI_ALLOWED_BINARIES=ffmpeg
 *   - 本机已安装 ffmpeg
 *
 * 步骤:
 *   1. Env/preflight 检查
 *   2. 解析 org
 *   3. 合成测试视频 (ffmpeg testsrc)
 *   4. 上传为 media_asset (input)
 *   5. 注册临时 cli_tools 行 (ffmpeg 转 gif)
 *   6. 通过 createCliToolset 执行工具
 *   7. 验证输出 asset + run 记录
 *   8. 清理 (除非 --keep)
 */

import { config as loadEnv } from "dotenv";
// 必须在任何项目模块 import 前加载 env——@/db 读取 DATABASE_URL at module-init time。
loadEnv({ path: ".env.local" });
loadEnv();

import { execFile as execFileCb } from "node:child_process";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { promisify } from "node:util";

import { db } from "@/db";
import { organizations, cliTools, cliToolRuns, mediaAssets } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { storeBufferAsAsset, resolveOrgAsset } from "@/lib/media/asset-io";
import { allowedBinaries } from "@/lib/cli/allowlist";
import { deleteObject } from "@/lib/storage";
import { createCliToolset } from "@/lib/cli/toolset";

const execFile = promisify(execFileCb);

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const orgArgIdx = args.indexOf("--org");
const cliOrgId = orgArgIdx !== -1 ? args[orgArgIdx + 1] : undefined;
const keep = args.includes("--keep");

// ─── Helpers ──────────────────────────────────────────────────────────────────

let stepN = 0;
function step(label: string) {
  stepN++;
  process.stdout.write(`\n步骤 ${stepN}: ${label}\n`);
}

function ok(msg: string) {
  console.log(`  ✓ ${msg}`);
}

function fail(msg: string, hint?: string): never {
  console.error(`  ✗ ${msg}`);
  if (hint) console.error(`    提示: ${hint}`);
  process.exit(1);
}

// ─── 追踪已创建资源 (用于清理) ────────────────────────────────────────────────

let createdToolId: string | undefined;
let createdToolSlug: string | undefined;
let inputAssetId: string | undefined;
let inputObjectKey: string | undefined;
let outputAssetId: string | undefined;
let outputObjectKey: string | undefined;
let tmpDir: string | undefined;

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== smoke-cli-tool: CLI 管道端到端冒烟测试 ===");

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 1: Env / preflight
  // ──────────────────────────────────────────────────────────────────────────
  step("Env / preflight");

  if (!process.env.DATABASE_URL) {
    fail("DATABASE_URL 未设置", "在 .env.local 中配置 DATABASE_URL");
  }
  ok("DATABASE_URL 已配置");

  // ffmpeg 是否可用
  try {
    await execFile("ffmpeg", ["-version"], { timeout: 5000 });
    ok("ffmpeg 可用");
  } catch (e) {
    fail(
      `ffmpeg 不可用: ${String(e)}`,
      "请安装 ffmpeg: brew install ffmpeg (macOS) / apt install ffmpeg (Ubuntu)",
    );
  }

  // CLI_ALLOWED_BINARIES 包含 ffmpeg
  const allowed = allowedBinaries();
  if (!allowed.includes("ffmpeg")) {
    fail(
      `CLI_ALLOWED_BINARIES 未包含 ffmpeg (当前: ${allowed.join(", ") || "(空)"})`,
      "在 .env.local 中设置: CLI_ALLOWED_BINARIES=ffmpeg",
    );
  }
  ok(`CLI_ALLOWED_BINARIES 包含 ffmpeg (完整列表: ${allowed.join(", ")})`);

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 2: 解析 org
  // ──────────────────────────────────────────────────────────────────────────
  step("解析目标 org");

  let orgId: string;
  if (cliOrgId) {
    orgId = cliOrgId;
    ok(`使用命令行指定 org: ${orgId}`);
  } else {
    const org = await db.query.organizations.findFirst({
      columns: { id: true, name: true },
      orderBy: (o, { asc }) => [asc(o.createdAt)],
    });
    if (!org) {
      fail("数据库中没有 organization 记录", "先运行 npm run db:seed 初始化数据");
    }
    orgId = org.id;
    ok(`自动选取第一个 org: ${org.name} (${orgId})`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 3: 合成测试视频
  // ──────────────────────────────────────────────────────────────────────────
  step("ffmpeg 合成测试视频 (testsrc, 1s, 320x240@10fps)");

  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "smoke-cli-"));
  const inVideoPath = path.join(tmpDir, "smoke-in.mp4");

  try {
    await execFile(
      "ffmpeg",
      [
        "-y",
        "-f", "lavfi",
        "-i", "testsrc=duration=1:size=320x240:rate=10",
        "-pix_fmt", "yuv420p",
        inVideoPath,
      ],
      { timeout: 30_000 },
    );
    ok(`测试视频写入: ${inVideoPath}`);
  } catch (e) {
    fail(`ffmpeg 合成视频失败: ${String(e)}`);
  }

  const videoBuf = await fs.readFile(inVideoPath);
  ok(`视频大小: ${(videoBuf.byteLength / 1024).toFixed(1)} KB`);

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 4: 上传为输入 media_asset
  // ──────────────────────────────────────────────────────────────────────────
  step("上传测试视频为 media_asset (input)");

  let inputPublicUrl: string;
  try {
    const res = await storeBufferAsAsset(videoBuf, {
      organizationId: orgId,
      slug: "smoke-cli",
      ext: "mp4",
      contentType: "video/mp4",
      type: "video",
      title: "[smoke] 测试输入",
    });
    inputAssetId = res.assetId;
    inputPublicUrl = res.publicUrl;

    // 记录 object key 供清理
    const row = await db.query.mediaAssets.findFirst({
      where: eq(mediaAssets.id, inputAssetId),
      columns: { tosObjectKey: true },
    });
    inputObjectKey = row?.tosObjectKey ?? undefined;

    ok(`media_asset 创建成功: ${inputAssetId}`);
    ok(`publicUrl: ${inputPublicUrl}`);
  } catch (e) {
    fail(
      `存储上传失败: ${String(e)}`,
      "检查 STORAGE_PROVIDER / TOS_* / COS_* 等 env 是否正确配置",
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 5: 注册临时 cli_tools 行
  // ──────────────────────────────────────────────────────────────────────────
  step("注册临时 CLI 工具 (ffmpeg 转 gif, executionMode=sync)");

  // 用时间戳+pid 组合避免 unique-index 冲突，无需 Math.random
  const suffix = `${Date.now()}-${process.pid}`;
  const slug = `smoke-ffmpeg-${suffix}`;

  const argsSchema = {
    input: { type: "asset" as const, required: true },
    outputFormat: {
      type: "enum" as const,
      values: ["gif", "mp4", "webm"],
      required: true,
    },
  };

  // argvTemplate: ffmpeg -y -i {input} -f {outputFormat} {output}
  // {output:"out"} token 会被管道替换为 out.{ext} 本地路径
  const argvTemplate = [
    "-y",
    "-i",
    { param: "input" },
    "-f",
    { param: "outputFormat" },
    { output: "out" },
  ];

  try {
    const [row] = await db
      .insert(cliTools)
      .values({
        organizationId: orgId,
        name: "[smoke] ffmpeg 转码",
        slug,
        description: "冒烟测试用临时工具，可在测试结束后删除",
        command: "ffmpeg",
        argsSchema,
        argvTemplate,
        executionMode: "sync",
        syncTimeoutMs: 60_000,
        outputKind: "media_asset",
        toolClass: "write",
        enabled: 1,
      })
      .returning({ id: cliTools.id });

    createdToolId = row.id;
    createdToolSlug = slug;
    ok(`cli_tools 行创建: ${createdToolId} (slug=${slug})`);
  } catch (e) {
    fail(`注册 CLI 工具失败: ${String(e)}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 6: 通过 createCliToolset 执行工具
  // ──────────────────────────────────────────────────────────────────────────
  step("createCliToolset + 执行 (input=mp4 → outputFormat=gif)");

  const toolset = await createCliToolset(orgId, { authorityLevel: "executor" });
  const toolKey = `cli__${slug.replace(/[^a-zA-Z0-9_-]+/g, "_")}`;
  const t = toolset[toolKey];

  if (!t) {
    const knownKeys = Object.keys(toolset).filter((k) => k.startsWith("cli__smoke"));
    fail(
      `ToolSet 中未找到键 "${toolKey}" (smoke 工具: ${knownKeys.join(", ") || "无"})`,
      "可能是 enabled=0 或 slug sanitize 不一致",
    );
  }
  ok(`ToolSet 键找到: ${toolKey}`);

  // 直接调用 execute（不经过 toVercelTools/wrap），rawArgs 即纯业务参数
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const execFn = (t as any).execute as (
    args: Record<string, unknown>,
    ctx: unknown,
  ) => Promise<unknown>;

  let res: Record<string, unknown>;
  try {
    res = (await execFn(
      { input: inputAssetId, outputFormat: "gif" },
      {},
    )) as Record<string, unknown>;
    ok(`execute 返回: ${JSON.stringify(res)}`);
  } catch (e) {
    fail(`execute 抛出异常 (不应该，execute 应内部捕获): ${String(e)}`);
  }

  if (!res.success) {
    fail(
      `执行失败: ${String(res.error ?? "unknown")}`,
      "查看上方 stderrTail 了解 ffmpeg 输出",
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 7: 验证输出 asset + run 记录
  // ──────────────────────────────────────────────────────────────────────────
  step("验证输出 asset 和 cli_tool_runs 记录");

  outputAssetId = String(res.assetId ?? "");
  if (!outputAssetId) {
    fail("返回值中无 assetId");
  }

  const outAsset = await resolveOrgAsset(orgId, outputAssetId);
  if (!outAsset) {
    fail(`输出 asset ${outputAssetId} 不存在或无权访问`);
  }
  outputObjectKey = outAsset.tosObjectKey ?? undefined;
  ok(`输出 asset 验证通过: ${outputAssetId}`);
  ok(`  类型: ${outAsset.type}  mimeType: ${outAsset.mimeType}`);
  ok(`  fileUrl: ${outAsset.fileUrl}`);

  // 查最新 run 记录
  const runRow = await db.query.cliToolRuns.findFirst({
    where: and(
      eq(cliToolRuns.organizationId, orgId),
      eq(cliToolRuns.cliToolId, createdToolId!),
    ),
    orderBy: [desc(cliToolRuns.createdAt)],
  });

  if (!runRow) {
    fail("未找到 cli_tool_runs 记录");
  }
  ok(`cli_tool_runs 记录: ${runRow.id}`);
  ok(`  status: ${runRow.status}  exitCode: ${runRow.exitCode}`);
  ok(`  outputAssetId: ${runRow.outputAssetId}`);

  if (runRow.status !== "done") {
    fail(`run 状态期望 "done", 实际 "${runRow.status}"`, runRow.errorMessage ?? runRow.stderrTail ?? "");
  }
  if (runRow.outputAssetId !== outputAssetId) {
    fail(`run.outputAssetId (${runRow.outputAssetId}) 与 execute 返回的 assetId (${outputAssetId}) 不一致`);
  }
  ok("run 记录验证通过 (status=done, outputAssetId 对齐)");

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 8: 清理
  // ──────────────────────────────────────────────────────────────────────────
  step(keep ? "跳过清理 (--keep)" : "清理临时资源");

  if (keep) {
    console.log("  保留资源 (--keep 模式，可在 UI / Drizzle Studio 中查看):");
    console.log(`    cli_tools.id:         ${createdToolId}`);
    console.log(`    input media_asset.id:  ${inputAssetId}`);
    console.log(`    output media_asset.id: ${outputAssetId}`);
  } else {
    await cleanup(orgId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 结果摘要
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n=== 冒烟测试通过 ✓ — CLI 管道端到端运行正常 ===\n");
  process.exit(0);
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

async function cleanup(orgId: string) {
  // cli_tool_runs 行（按 tool id 删）
  if (createdToolId) {
    try {
      await db
        .delete(cliToolRuns)
        .where(
          and(
            eq(cliToolRuns.organizationId, orgId),
            eq(cliToolRuns.cliToolId, createdToolId),
          ),
        );
      ok("cli_tool_runs 记录已删除");
    } catch (e) {
      console.error(`  ! cli_tool_runs 删除失败 (忽略): ${String(e)}`);
    }

    // cli_tools 行
    try {
      await db.delete(cliTools).where(eq(cliTools.id, createdToolId));
      ok(`cli_tools 行已删除 (${createdToolId})`);
    } catch (e) {
      console.error(`  ! cli_tools 删除失败 (忽略): ${String(e)}`);
    }
  }

  // 输出 asset（先删 storage object 再删 DB 行）
  if (outputAssetId) {
    if (outputObjectKey) {
      try {
        await deleteObject(outputObjectKey);
        ok(`输出 storage object 已删除 (${outputObjectKey})`);
      } catch (e) {
        console.error(`  ! 输出 storage object 删除失败 (忽略): ${String(e)}`);
      }
    }
    try {
      await db.delete(mediaAssets).where(eq(mediaAssets.id, outputAssetId));
      ok(`输出 media_assets 行已删除 (${outputAssetId})`);
    } catch (e) {
      console.error(`  ! 输出 media_assets 行删除失败 (忽略): ${String(e)}`);
    }
  }

  // 输入 asset
  if (inputAssetId) {
    if (inputObjectKey) {
      try {
        await deleteObject(inputObjectKey);
        ok(`输入 storage object 已删除 (${inputObjectKey})`);
      } catch (e) {
        console.error(`  ! 输入 storage object 删除失败 (忽略): ${String(e)}`);
      }
    }
    try {
      await db.delete(mediaAssets).where(eq(mediaAssets.id, inputAssetId));
      ok(`输入 media_assets 行已删除 (${inputAssetId})`);
    } catch (e) {
      console.error(`  ! 输入 media_assets 行删除失败 (忽略): ${String(e)}`);
    }
  }

  // 本地临时目录
  if (tmpDir) {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
      ok(`本地临时目录已删除 (${tmpDir})`);
    } catch {
      // 忽略
    }
  }
}

// ─── Entry ────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error("\n[smoke-cli-tool] 未捕获异常:", err);
  process.exit(1);
});
