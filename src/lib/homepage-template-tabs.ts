/**
 * 首页"共享 tab" 白名单 —— 接受 pin / reorder 操作的 9 个 tab。
 *
 * 抽到本模块是为了让 client 组件也能 import：server action 文件
 * (`src/app/actions/homepage-template-order.ts`) 有 `"use server"` 指令，
 * 只允许 export async 函数，不能 export 常量 / 同步函数给客户端使用。
 *
 * `"custom"` 不在此清单里 —— 自定义 tab 不参与置顶 / 排序。
 */
export const ALLOWED_TAB_KEYS = [
  "featured",
  "xiaolei",
  "xiaoce",
  "xiaozi",
  "xiaowen",
  "xiaojian",
  "xiaoshen",
  "xiaofa",
  "xiaoshu",
] as const;

export type AllowedTabKey = (typeof ALLOWED_TAB_KEYS)[number];

export function isAllowedTabKey(key: string): key is AllowedTabKey {
  return (ALLOWED_TAB_KEYS as readonly string[]).includes(key);
}

/**
 * 首页 server action 的错误码集合。
 *
 * 抽到本模块同为 Next.js "use server" 限制：server action 文件只能 export
 * async 函数；同步 const 对象必须放在独立模块里，供 server action、client
 * 组件、测试共同 import。
 */
export const SHARED_HOMEPAGE_ACTION_ERROR = {
  FORBIDDEN: "FORBIDDEN",
  INVALID_TAB: "INVALID_TAB",
  CONFLICT: "CONFLICT",
} as const;

export type HomepageActionResult =
  | { ok: true }
  | {
      ok: false;
      error: keyof typeof SHARED_HOMEPAGE_ACTION_ERROR;
      message?: string;
    };
