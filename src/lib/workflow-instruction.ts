/**
 * 工作流模板 → mission 用户指令的文案生成(纯函数)。
 *
 * 从 `app/actions/workflow-launch.ts` 提取:cowork 场景启动需要把同一段
 * 指令文案作为会话里的用户消息落库,server action 文件的导出都会被包装成
 * action,纯函数必须住在独立 lib 模块里供两边复用。
 */

/**
 * Replace `{{key}}` placeholders in a prompt template with values from `params`.
 * Unknown keys are replaced with empty string. Non-primitive values are JSON-encoded.
 */
export function renderTemplate(
  tpl: string,
  params: Record<string, unknown>,
): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = params[k];
    if (v === undefined || v === null) return "";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  });
}

/**
 * Build a natural-language user instruction for the mission from the template
 * definition + user-provided params.
 *
 * Priority:
 *   1. If `promptTemplate` is present and renders to non-empty, use rendered result.
 *   2. Otherwise fall back to a human-readable "启动场景 + 参数列表" dump.
 */
export function buildUserInstruction(
  templateName: string,
  cleaned: Record<string, unknown>,
  promptTemplate: string | null,
): string {
  if (promptTemplate) {
    const rendered = renderTemplate(promptTemplate, cleaned);
    if (rendered.trim().length > 0) return rendered;
  }
  const paramLines = Object.entries(cleaned)
    .map(
      ([k, v]) => `- ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`,
    )
    .join("\n");
  if (paramLines.length === 0) {
    return `启动场景：${templateName}`;
  }
  return `启动场景：${templateName}\n参数：\n${paramLines}`;
}
