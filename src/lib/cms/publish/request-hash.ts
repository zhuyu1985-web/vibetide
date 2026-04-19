import { createHash } from "node:crypto";

/** 生成 hash 时忽略的易变字段（避免重试时 hash 变化） */
const VOLATILE_FIELDS = new Set(["addTime", "publishDate"]);

/**
 * 计算稳定的 payload hash。
 *
 * 用于：
 *  - 幂等：同一 hash 视作同一请求，跳过重发
 *  - 审计：快速判断两次 request 是否内容一致
 *
 * 设计决策：
 *  - key 排序 → 相同字段不同顺序产生相同 hash
 *  - 过滤 `addTime/publishDate` → 重试时 payload 会重新生成时间戳，不应改变 hash
 *  - SHA-256 → 64 字符 hex，冲突概率忽略不计
 */
export function hashRequestPayload(payload: unknown): string {
  const normalized = stableStringify(payload);
  return createHash("sha256").update(normalized).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  const keys = Object.keys(value as Record<string, unknown>)
    .filter((k) => !VOLATILE_FIELDS.has(k))
    .sort();
  const parts = keys.map(
    (k) =>
      JSON.stringify(k) +
      ":" +
      stableStringify((value as Record<string, unknown>)[k]),
  );
  return "{" + parts.join(",") + "}";
}
