export const INITIAL_PROCESSING_LEASE_MS = 3 * 60 * 1000;

export type InitialProcessingStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

export interface InitialProcessingState {
  status: InitialProcessingStatus;
  prompt: string;
  attempt: number;
  updatedAt: string;
  error?: string;
}

export function buildPendingInitialProcessing(
  prompt: string,
  now = new Date(),
): InitialProcessingState {
  return {
    status: "pending",
    prompt: prompt.trim(),
    attempt: 0,
    updatedAt: now.toISOString(),
  };
}

export function readInitialProcessing(
  metadata: Record<string, unknown> | null | undefined,
): InitialProcessingState | null {
  const raw = metadata?.initialProcessing;
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (
    !["pending", "running", "completed", "failed"].includes(
      String(value.status),
    ) ||
    typeof value.prompt !== "string" ||
    typeof value.attempt !== "number" ||
    typeof value.updatedAt !== "string"
  ) {
    return null;
  }
  return {
    status: value.status as InitialProcessingStatus,
    prompt: value.prompt,
    attempt: value.attempt,
    updatedAt: value.updatedAt,
    ...(typeof value.error === "string" ? { error: value.error } : {}),
  };
}

export function canClaimInitialProcessing(
  state: InitialProcessingState | null,
  now = new Date(),
): boolean {
  if (!state) return false;
  if (state.status === "pending") return true;
  if (state.status !== "running") return false;
  const updatedAt = Date.parse(state.updatedAt);
  return (
    !Number.isFinite(updatedAt) ||
    now.getTime() - updatedAt >= INITIAL_PROCESSING_LEASE_MS
  );
}
