import { z } from "zod";

const CmcUserInfoSchema = z.object({
  login_name: z.string().min(1),
  user_mobile: z.string().min(1),
});

const CmcGroupUserResponseSchema = z
  .object({
    code: z.number().optional(),
    message: z.string().optional(),
    user_info: CmcUserInfoSchema.optional(),
    data: z
      .object({
        user_info: CmcUserInfoSchema.optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type CmcUserInfo = z.infer<typeof CmcUserInfoSchema>;

export class CmcConsoleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CmcConsoleError";
  }
}

function getCmcConsoleBase(): string {
  const base = process.env.CMC_CONSOLE?.trim();
  if (!base) {
    throw new CmcConsoleError("CMC_CONSOLE 未配置");
  }
  return base.replace(/\/$/, "");
}

export async function fetchCmcGroupUser(
  loginCmcId: string,
  loginCmcTid: string,
): Promise<CmcUserInfo> {
  const url = `${getCmcConsoleBase()}/v2/user/group-user`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        Cookie: `login_cmc_id=${loginCmcId}; login_cmc_tid=${loginCmcTid}`,
      },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new CmcConsoleError("CMC 用户信息请求超时");
    }
    throw new CmcConsoleError(
      err instanceof Error ? err.message : "CMC 网络错误",
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new CmcConsoleError(`CMC 用户信息请求失败 (${response.status})`);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new CmcConsoleError("CMC 响应不是有效 JSON");
  }

  const parsed = CmcGroupUserResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new CmcConsoleError("CMC 响应格式无效");
  }

  const code = parsed.data.code;
  if (code !== undefined && code !== 10000) {
    throw new CmcConsoleError(
      parsed.data.message ?? `CMC 登录已失效 (${code})`,
    );
  }

  const userInfo =
    parsed.data.user_info ?? parsed.data.data?.user_info ?? null;
  if (!userInfo) {
    throw new CmcConsoleError("CMC 响应缺少 user_info");
  }

  return userInfo;
}
