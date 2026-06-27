import { execFile } from "node:child_process";
import { promisify } from "node:util";

const pexec = promisify(execFile);

/**
 * 从环境变量 CLI_ALLOWED_BINARIES 读取允许执行的 binary 名称列表。
 * 格式：逗号分隔，自动修剪空白、过滤空项。
 *
 * 这是 CLI 安全模型的闸门①：运维人员在部署时通过此 env 显式授权可用的 binary，
 * 即使管理员在 cli_tools 表注册了某条记录，若 binary 不在此列表中也无法执行。
 */
export function allowedBinaries(): string[] {
  return (process.env.CLI_ALLOWED_BINARIES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 断言命令在白名单中，不在则抛出错误。
 * 调用方（执行层、注册层）在任何 execFile 前必须先调用此函数。
 */
export function assertAllowedBinary(cmd: string): void {
  if (!allowedBinaries().includes(cmd)) {
    throw new Error(`命令未在 CLI_ALLOWED_BINARIES 白名单：${cmd}`);
  }
}

/**
 * 预检：验证 binary 在白名单中且在系统上实际可用。
 * 使用 execFile（非 exec）确保无 shell 注入风险。
 * 建议在 cli_tools 注册时或服务冷启动时调用一次。
 */
export async function probeBinary(
  cmd: string
): Promise<{ ok: boolean; error?: string }> {
  assertAllowedBinary(cmd);
  try {
    await pexec(cmd, ["-version"], { timeout: 5000 });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `binary 不可用：${cmd}（${String(e)}）` };
  }
}
