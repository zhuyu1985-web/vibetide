/**
 * scratch — 临时目录生命周期管理
 *
 * 为 CLI 工具调用提供一个独立的临时工作目录，确保：
 * 1. 每次调用获得唯一的隔离目录（避免并发冲突）
 * 2. 无论 fn 成功还是抛出，finally 块都会删除该目录（防止临时文件堆积）
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * 创建一个以 `vibetide-cli-` 为前缀的唯一临时目录，
 * 将其路径传给 `fn`，并在 `fn` 执行完毕后（无论成功或异常）删除该目录。
 *
 * @param fn 接收临时目录绝对路径的异步函数
 * @returns fn 的返回值
 * @throws fn 抛出的任何异常（清理完成后原样重新抛出）
 */
export async function withScratchDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vibetide-cli-"));
  try {
    return await fn(dir);
  } finally {
    // 无论 fn 是否抛出，均清理临时目录
    await fs.rm(dir, { recursive: true, force: true });
  }
}
