export class KieConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KieConfigError";
  }
}

export class KieError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KieError";
  }
}

function base() {
  return process.env.KIE_BASE_URL || "https://api.kie.ai";
}

function authHeaders() {
  const key = process.env.KIE_API_KEY;
  if (!key) throw new KieConfigError("KIE_API_KEY 未配置");
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

export async function kieCreateTask(
  model: string,
  input: Record<string, unknown>
): Promise<string> {
  const res = await fetch(`${base()}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ model, input }),
  });
  const json = (await res.json()) as {
    code: number;
    msg?: string;
    data?: { taskId?: string };
  };
  if (json.code !== 200 || !json.data?.taskId) {
    throw new KieError(`createTask 失败：${json.msg ?? json.code}`);
  }
  return json.data.taskId;
}

export async function kiePollTask(
  taskId: string,
  opts?: { timeoutMs?: number; intervalMs?: number }
): Promise<string[]> {
  const timeoutMs = opts?.timeoutMs ?? 180_000;
  const intervalMs = opts?.intervalMs ?? 5_000;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(
      `${base()}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
      { headers: authHeaders() }
    );
    const json = (await res.json()) as {
      code: number;
      data?: { state?: string; resultJson?: string; failMsg?: string };
    };
    const d = json.data;
    if (d?.state === "success") {
      const parsed = JSON.parse(d.resultJson ?? "{}") as {
        resultUrls?: string[];
      };
      if (!parsed.resultUrls?.length) {
        throw new KieError("kie 成功但无 resultUrls");
      }
      return parsed.resultUrls;
    }
    if (d?.state === "fail") {
      throw new KieError(`kie 生成失败：${d.failMsg ?? "unknown"}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new KieError("kie 生成超时");
}

export async function kieGenerateImage(args: {
  prompt: string;
  aspectRatio?: string;
}): Promise<string[]> {
  const model = process.env.KIE_IMAGE_MODEL || "nano-banana-pro";
  const taskId = await kieCreateTask(model, {
    prompt: args.prompt,
    aspect_ratio: args.aspectRatio ?? "1:1",
  });
  return kiePollTask(taskId);
}
