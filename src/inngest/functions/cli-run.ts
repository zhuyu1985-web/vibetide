import { inngest } from "@/inngest/client";
import type { InngestEvents } from "@/inngest/events";
import { getCliToolById, updateCliToolRun } from "@/lib/dal/cli-tools";
import {
  executeCliPipeline,
  type CliPipelineTool,
} from "@/lib/cli/pipeline";
import { surfaceCliOutput } from "@/lib/cli/surface";
import type { ArgsSchema, ArgvTemplate, ValidatedParams } from "@/lib/cli/argv";
import { appendMessage } from "@/lib/dal/cowork-conversations";

type Data = InngestEvents["cli/run.requested"]["data"];

/**
 * cliRun — 异步 CLI 工具执行（M3.8）。
 *
 * createCliToolset 的 async 分支落 queued run 行 + 派 cli/run.requested 后立即返回；
 * 本函数把重活搬到后台 durable step：
 *   mark-processing → run-cli（共享 executeCliPipeline）→ surface（呈现产物）→ finish（done）
 *
 * 每步用 step.run 包裹保证幂等可重放；与 tingwu-analyze 同结构（durable，非自轮询）。
 * 失败由 cliRunFailureHandler 兜底标 failed。
 */
export const cliRun = inngest.createFunction(
  {
    id: "cli-run",
    name: "[CLI] 媒体处理",
    concurrency: { limit: 4, key: "event.data.organizationId" },
    retries: 2,
  },
  { event: "cli/run.requested" },
  async ({ event, step }) => {
    const d = event.data as Data;

    await step.run("mark-processing", () =>
      updateCliToolRun(d.runId, { status: "processing" }),
    );

    // run-cli：取工具行 → 跑共享管道。工具名一并带出供呈现卡片用。
    const out = await step.run("run-cli", async () => {
      const tool = await getCliToolById(d.organizationId, d.cliToolId);
      if (!tool) throw new Error("CLI 工具不存在");
      const pipelineTool: CliPipelineTool = {
        id: tool.id,
        name: tool.name,
        slug: tool.slug,
        command: tool.command,
        argsSchema: tool.argsSchema as ArgsSchema,
        argvTemplate: tool.argvTemplate as ArgvTemplate,
        syncTimeoutMs: tool.syncTimeoutMs,
      };
      const result = await executeCliPipeline(
        d.organizationId,
        pipelineTool,
        d.resolvedParams as ValidatedParams,
      );
      return { ...result, toolName: tool.name };
    });

    await step.run("surface", () =>
      surfaceCliOutput(
        {
          organizationId: d.organizationId,
          missionId: d.missionId,
          taskId: d.taskId,
          conversationId: d.conversationId,
          cliToolName: out.toolName,
        },
        {
          assetId: out.assetId,
          publicUrl: out.publicUrl,
          assetType: out.assetType,
          title: `${out.toolName} 输出`,
        },
      ),
    );

    await step.run("finish", () =>
      updateCliToolRun(d.runId, {
        status: "done",
        outputAssetId: out.assetId,
        exitCode: out.exitCode,
        finishedAt: new Date(),
      }),
    );

    return { ok: true, runId: d.runId, assetId: out.assetId };
  },
);

/**
 * 终态失败（重试耗尽 / 管道抛错）→ 标 run 行 failed + 若有 conversationId 追加失败卡片。
 * 与 tingwu-analyze 的失败兜底同结构：从 inngest/function.failed 的嵌套原事件读 data。
 */
export const cliRunFailureHandler = inngest.createFunction(
  { id: "cli-run-failure", retries: 1 },
  { event: "inngest/function.failed" },
  async ({ event, step }) => {
    const f = event.data as Record<string, unknown>;
    if (f?.function_id !== "cli-run") return;
    const orig = (f?.event as { data?: Data } | undefined)?.data;
    if (!orig) return;

    await step.run("mark-failed", async () => {
      const errMsg =
        (f?.error as { message?: string } | undefined)?.message ?? "CLI 执行失败";
      await updateCliToolRun(orig.runId, {
        status: "failed",
        errorMessage: errMsg,
        finishedAt: new Date(),
      });
      if (orig.conversationId) {
        await appendMessage(orig.conversationId, {
          role: "assistant",
          kind: "import_card",
          content: `❌ 媒体处理失败：${errMsg}`,
          meta: { stage: "failed", runId: orig.runId, cliToolId: orig.cliToolId },
        });
      }
    });
  },
);
