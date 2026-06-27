/**
 * CLI 工具特性开关（M3.6）。
 *
 * 与 MCP（VIBETIDE_MCP_ENABLED）一致的灰度模式：默认关闭，运维在 .env.local
 * 显式设 `VIBETIDE_CLI_TOOLS_ENABLED=true` 后才把 cli_tools 暴露为 agent 工具。
 */
export function isCliToolsEnabled(): boolean {
  return process.env.VIBETIDE_CLI_TOOLS_ENABLED === "true";
}
