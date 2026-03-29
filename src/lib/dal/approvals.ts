/**
 * Approval DAL — stub (approval workflow removed in mission migration).
 * Will be re-implemented if mission-level approvals are added.
 */

export interface PendingApproval {
  stepId: string;
  workflowInstanceId: string;
  workflowName: string;
  stepLabel: string;
  teamId?: string;
  teamName?: string;
  employeeSlug?: string;
  employeeNickname?: string;
  outputPreview?: string;
  createdAt: string;
}

export interface ApprovalStats {
  pending: number;
  approvedToday: number;
  rejectedToday: number;
  timedOut: number;
}

export interface ApprovalHistoryItem {
  stepId: string;
  workflowName: string;
  stepLabel: string;
  teamName?: string;
  employeeSlug?: string;
  employeeNickname?: string;
  status: string;
  completedAt?: string;
}

export async function getPendingApprovals(
  _orgId: string
): Promise<PendingApproval[]> {
  return [];
}

export async function getApprovalStats(
  _orgId: string
): Promise<ApprovalStats> {
  return { pending: 0, approvedToday: 0, rejectedToday: 0, timedOut: 0 };
}

export async function getApprovalHistory(
  _orgId: string,
  _limit?: number
): Promise<ApprovalHistoryItem[]> {
  return [];
}
