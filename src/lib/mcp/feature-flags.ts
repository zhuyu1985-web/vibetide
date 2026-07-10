export function isMcpEnabled(): boolean {
  return process.env.VIBETIDE_MCP_ENABLED === "true";
}
