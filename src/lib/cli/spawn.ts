/**
 * spawn — 注入安全的 CLI 子进程封装
 *
 * 安全不变量：
 * - `shell: false`：argv 数组中每个元素直接作为操作系统级参数传递，
 *   永不经过 shell 解释，彻底消除 shell 注入风险。
 * - 超时必须杀死子进程（SIGKILL）并 reject，防止悬空进程阻塞调用方。
 * - stderr 捕获有上界（最后 4000 字节），防止高吞吐进程耗尽内存。
 * - 非零退出码不 reject——以 { exitCode, stderrTail } 正常 resolve，
 *   由上层（M3.6/M3.8）决定如何处理"运行了但失败了"的情况。
 * - 只有 spawn 失败（如 ENOENT）和超时才 reject。
 */

import { spawn } from "node:child_process";

/** runCli 的返回值 */
export interface CliResult {
  /** 子进程退出码（超时强杀时为 -1） */
  exitCode: number;
  /** stderr 的最后 ~4000 字节（高吞吐时截断旧内容） */
  stderrTail: string;
}

/**
 * 安全地在独立子进程中运行已注册的 CLI 工具。
 *
 * @param command   可执行文件路径或名称（不经 shell 解析，因此路径分隔符必须正确）
 * @param argv      参数数组（由 resolveArgv 生成，每个元素为单个参数）
 * @param opts.cwd        子进程工作目录（应为 withScratchDir 分配的临时目录）
 * @param opts.timeoutMs  超时毫秒数；超时后发送 SIGKILL 并 reject
 * @returns Promise<{ exitCode, stderrTail }>
 * @throws 当可执行文件不存在（ENOENT 等 spawn 错误）或超时时 reject
 */
export function runCli(
  command: string,
  argv: string[],
  opts: { cwd: string; timeoutMs: number }
): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    // shell:false — argv 元素直接传递给操作系统，不经 shell 解释
    const child = spawn(command, argv, { cwd: opts.cwd, shell: false });

    let stderr = "";

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("CLI 超时"));
    }, opts.timeoutMs);

    child.stderr.on("data", (d: Buffer) => {
      // 只保留最后 4000 字节，防止高吞吐 stderr 无限占用内存
      stderr = (stderr + d.toString()).slice(-4000);
    });

    child.on("error", (e: Error) => {
      clearTimeout(timer);
      reject(e);
    });

    child.on("close", (code: number | null) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? -1, stderrTail: stderr });
    });
  });
}
