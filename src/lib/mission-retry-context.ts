export function buildRetryMissionInput(original: {
  title: string;
  scenario: string;
  userInstruction: string;
  workflowTemplateId: string | null;
  inputParams: Record<string, unknown> | null;
}) {
  return {
    title: `${original.title}（重新执行）`,
    scenario: original.scenario,
    userInstruction: original.userInstruction,
    workflowTemplateId: original.workflowTemplateId ?? undefined,
    inputParams: original.inputParams ?? {},
  };
}

export function shouldExecuteMissionRetryDirectly(
  nodeEnv: string | undefined,
  inngestEventKey: string | undefined,
): boolean {
  return nodeEnv !== "production" && !inngestEventKey?.trim();
}
