import "server-only";
import OpenApi, { Config, Params, OpenApiRequest } from "@alicloud/openapi-client";
import { RuntimeOptions } from "@alicloud/tea-util";
import { requireTingwuConfig } from "./config";
import type { TingwuCreateTaskResult, TingwuTaskInfo, TingwuTaskStatus } from "./types";

export class TingwuApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "TingwuApiError";
    this.code = code;
  }
}

const VERSION = "2023-09-30";

function buildClient(): { client: OpenApi; appKey: string } {
  const cfg = requireTingwuConfig();
  const config = new Config({
    accessKeyId: cfg.accessKeyId,
    accessKeySecret: cfg.accessKeySecret,
    endpoint: cfg.endpoint,
  });
  return { client: new OpenApi(config), appKey: cfg.appKey };
}

// callApi 返回 { statusCode, headers, body }（bodyType:json → body 已解析）；
// 跨版本兜底 res.body ?? res。
function extractBody(res: Record<string, unknown>): Record<string, unknown> {
  return (res.body ?? res) as Record<string, unknown>;
}

/** 提交离线转写任务。FileUrl 须公网直连（域名形式，TOS/COS publicUrl 可直接喂）。 */
export async function createTask(input: {
  fileUrl: string;
  sourceLanguage?: string;
  taskKey?: string;
}): Promise<TingwuCreateTaskResult> {
  const { client, appKey } = buildClient();
  const params = new Params({
    action: "CreateTask",
    version: VERSION,
    protocol: "HTTPS",
    method: "PUT",
    authType: "AK",
    style: "ROA",
    pathname: "/openapi/tingwu/v2/tasks",
    reqBodyType: "json",
    bodyType: "json",
  });
  const request = new OpenApiRequest({
    query: { type: "offline" },
    body: {
      AppKey: appKey,
      Input: {
        SourceLanguage: input.sourceLanguage ?? "cn", // 中文是 cn 不是 zh
        TaskKey: input.taskKey ?? `vt-${Date.now()}`,
        FileUrl: input.fileUrl,
      },
      Parameters: {
        Transcription: { DiarizationEnabled: true },
        SummarizationEnabled: true,
        Summarization: { Types: ["Paragraph"] },
        AutoChaptersEnabled: true,
      },
    },
  });
  const res = await client.callApi(params, request, new RuntimeOptions({}));
  const body = extractBody(res);
  const data = (body.Data ?? body.data) as Record<string, unknown> | undefined;
  const taskId = (data?.TaskId ?? data?.taskId) as string | undefined;
  if (!taskId) {
    throw new TingwuApiError(
      `CreateTask 未返回 TaskId：${String(body.Message ?? body.Code ?? JSON.stringify(body).slice(0, 200))}`,
      body.Code as string | undefined,
    );
  }
  return {
    taskId,
    taskKey: data?.TaskKey as string | undefined,
    status: data?.TaskStatus as TingwuTaskStatus | undefined,
  };
}

/** 查询任务状态 + 结果下载 URL 集。 */
export async function getTaskInfo(taskId: string): Promise<TingwuTaskInfo> {
  const { client } = buildClient();
  const params = new Params({
    action: "GetTaskInfo",
    version: VERSION,
    protocol: "HTTPS",
    method: "GET",
    authType: "AK",
    style: "ROA",
    pathname: `/openapi/tingwu/v2/tasks/${taskId}`,
    reqBodyType: "json",
    bodyType: "json",
  });
  const res = await client.callApi(
    params,
    new OpenApiRequest({}),
    new RuntimeOptions({}),
  );
  const body = extractBody(res);
  const data = (body.Data ?? body.data ?? {}) as Record<string, unknown>;
  return {
    status: (data.TaskStatus ?? "ONGOING") as TingwuTaskStatus,
    result: data.Result as TingwuTaskInfo["result"],
    errorMessage: data.ErrorMessage as string | undefined,
  };
}

/** 二次拉取结果文件 JSON（Result.* 是 30 天有效下载链，须立即落库）。 */
export async function fetchResultJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new TingwuApiError(`拉取听悟结果失败：HTTP ${res.status}`);
  }
  return res.json();
}
