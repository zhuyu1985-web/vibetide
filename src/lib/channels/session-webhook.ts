import { formatForPlatform } from "./format";

export interface SessionReplyPayload {
  type: "text" | "markdown" | "card";
  title?: string;
  content: string;
  actions?: { label: string; url: string }[];
}

/**
 * 把消息 POST 到钉钉回调自带的 sessionWebhook（临时会话地址）。
 * 复用 formatForPlatform 拼钉钉消息体。失败不抛，返回 {ok:false}。
 */
export async function postToSessionWebhook(
  sessionWebhook: string,
  payload: SessionReplyPayload
): Promise<{ ok: boolean; error?: string }> {
  try {
    const body = formatForPlatform("dingtalk", payload);
    const res = await fetch(sessionWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { errcode?: number; errmsg?: string };
    if (data.errcode !== 0) return { ok: false, error: data.errmsg ?? "未知错误" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "未知错误" };
  }
}
