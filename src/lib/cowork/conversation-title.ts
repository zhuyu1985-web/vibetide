/**
 * 从用户首句派生会话标题:去换行、压缩空白、截断到 ~24 字。
 * 纯函数,独立于 "use server"(server action 文件不能导出同步函数),便于单测。
 */
export function deriveConversationTitle(message: string): string {
  const cleaned = message.replace(/\s+/g, " ").trim();
  if (!cleaned) return "新对话";
  return cleaned.length > 24 ? `${cleaned.slice(0, 24)}…` : cleaned;
}
