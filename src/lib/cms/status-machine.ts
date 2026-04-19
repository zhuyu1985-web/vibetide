/**
 * CMS publications 状态机。
 *
 * 设计文档 §3.6 + §11.3 enum（严格一致，不含 pending）
 */

export type CmsPublicationState =
  | "submitting"
  | "submitted"
  | "synced"
  | "retrying"
  | "rejected_by_cms"
  | "failed";

/**
 * CMS article.status（string 枚举）→ VibeTide publication state
 *
 * CMS 约定：
 *   "0"  初稿
 *   "20" 待发布
 *   "30" 已发布        → synced（终态）
 *   "60" 重新编辑      → rejected_by_cms（终态，回 VibeTide 审核台）
 *
 * 返回 null 表示未知，调用方自行决定是否继续轮询。
 */
export function mapCmsStatusToPublicationState(
  cmsStatus: string | undefined | null,
): CmsPublicationState | null {
  if (!cmsStatus) return null;
  switch (cmsStatus) {
    case "0":
    case "20":
      return "submitted";
    case "30":
      return "synced";
    case "60":
      return "rejected_by_cms";
    default:
      return null;
  }
}

/**
 * 允许的状态迁移。
 *
 * submitting ─→ submitted (成功) / retrying (可重试错) / failed (不可重试错)
 * retrying   ─→ submitted / failed
 * submitted  ─→ synced (轮询到 status=30) / rejected_by_cms (status=60) / failed (轮询超时)
 * synced / failed / rejected_by_cms 均为终态（任何迁移都被拒绝）
 */
type NonTerminalState = Exclude<
  CmsPublicationState,
  "synced" | "failed" | "rejected_by_cms"
>;

export function canTransition(
  from: CmsPublicationState,
  to: CmsPublicationState,
): boolean {
  if (isTerminalState(from)) return false;

  const allowed: Record<NonTerminalState, CmsPublicationState[]> = {
    submitting: ["submitted", "retrying", "failed"],
    retrying: ["submitted", "failed"],
    submitted: ["synced", "rejected_by_cms", "failed"],
  };

  return allowed[from as NonTerminalState].includes(to);
}

export function isTerminalState(state: CmsPublicationState): boolean {
  return state === "synced" || state === "failed" || state === "rejected_by_cms";
}
