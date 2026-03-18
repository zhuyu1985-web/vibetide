# Module 4: AI Team Engine — Critical Gaps Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the 8 critical gaps in Module 4 (AI Team Engine) that directly impact the core user experience: workflow launch/approval UI, employee status auto-switching, performance auto-updates, preference/sensitive-topic injection into Agent prompts, and flexible approval points.

**Architecture:** Backend-first approach — fix the Inngest execute-workflow pipeline first (status switching, performance updates, preference injection), then build the missing Team Hub UI components (workflow launcher dialog, approval buttons). Each task targets a single concern with minimal cross-file changes.

**Tech Stack:** Next.js 16, React 19, Drizzle ORM, Inngest, Vercel AI SDK, shadcn/ui, Tailwind CSS v4

---

## Task 1: Employee Status Auto-Switch in Workflow Execution

**Covers:** F4.1.12 — Status auto-switch (working/idle)

**Files:**
- Modify: `src/inngest/functions/execute-workflow.ts`

**Step 1: Add status update calls to execute-workflow.ts**

In `execute-workflow.ts`, within the `activate-${wfStep.key}` step, set the employee status to `working`. After step completion (in `save-${wfStep.key}`), set it back to `idle`. After workflow completion, ensure all employees are set to `idle`.

```typescript
// In activate-${wfStep.key}, after the status message insert:
await db
  .update(aiEmployees)
  .set({ status: "working", currentTask: `正在执行「${wfStep.label}」` })
  .where(eq(aiEmployees.id, wfStep.employeeId));

// In save-${wfStep.key}, after saving output:
await db
  .update(aiEmployees)
  .set({ status: "idle", currentTask: null })
  .where(eq(aiEmployees.id, wfStep.employeeId));
```

Add `import { aiEmployees } from "@/db/schema"` at the top (aiEmployees is not currently imported).

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/inngest/functions/execute-workflow.ts
git commit -m "feat(workflow): auto-switch employee status working/idle during execution"
```

---

## Task 2: Performance Auto-Update After Workflow Step Completion

**Covers:** F4.1.26 — Performance auto-update

**Files:**
- Modify: `src/inngest/functions/execute-workflow.ts`

**Step 1: Increment tasksCompleted after each step**

In the `save-${wfStep.key}` step of `execute-workflow.ts`, after saving the output and setting the employee back to idle, increment the employee's `tasksCompleted` counter and update `avgResponseTime`:

```typescript
// After setting employee back to idle in save step:
await db
  .update(aiEmployees)
  .set({
    tasksCompleted: sql`${aiEmployees.tasksCompleted} + 1`,
    avgResponseTime: `${Math.round(executionResult.durationMs / 1000)}s`,
    updatedAt: new Date(),
  })
  .where(eq(aiEmployees.id, wfStep.employeeId));
```

Add `import { sql } from "drizzle-orm"` to the imports.

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/inngest/functions/execute-workflow.ts
git commit -m "feat(workflow): auto-update employee performance metrics after step completion"
```

---

## Task 3: Inject Work Preferences into Agent System Prompt

**Covers:** F4.1.22 — Preferences inject into Agent prompt

**Files:**
- Modify: `src/lib/agent/types.ts` (add workPreferences field)
- Modify: `src/lib/agent/assembly.ts` (load and pass preferences)
- Modify: `src/lib/agent/prompt-templates.ts` (inject into Layer 5)

**Step 1: Add workPreferences to AssembledAgent type**

In `types.ts`, add to the `AssembledAgent` interface:

```typescript
workPreferences?: {
  proactivity: string;
  reportingFrequency: string;
  autonomyLevel: number;
  communicationStyle: string;
  workingHours: string;
} | null;
```

**Step 2: Load preferences in assembly.ts**

In `assembly.ts`, pass `employee.workPreferences` when building the agent:

```typescript
// Add to the agent object:
workPreferences: employee.workPreferences as AssembledAgent["workPreferences"],
```

**Step 3: Inject preferences into prompt Layer 5 in prompt-templates.ts**

Replace the hardcoded Layer 5 (Work style) with dynamic content:

```typescript
// Layer 5: Work style — inject actual preferences if available
if (agent.workPreferences) {
  const wp = agent.workPreferences;
  const proactivityLabels: Record<string, string> = {
    passive: "等待指令再行动",
    moderate: "适度主动提出建议",
    proactive: "积极主动发现和解决问题",
  };
  layers.push(`# 工作风格
- 主动性：${proactivityLabels[wp.proactivity] || wp.proactivity}
- 汇报频率：${wp.reportingFrequency}
- 自主权等级：${wp.autonomyLevel}%
- 沟通风格：${wp.communicationStyle}
- 工作时间：${wp.workingHours}`);
} else {
  layers.push(`# 工作风格
- 保持专业、高效的工作态度
- 对不确定的信息明确标注
- 主动提出风险点和改进建议`);
}
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```bash
git add src/lib/agent/types.ts src/lib/agent/assembly.ts src/lib/agent/prompt-templates.ts
git commit -m "feat(agent): inject work preferences into system prompt"
```

---

## Task 4: Inject Sensitive Topics into Agent System Prompt

**Covers:** F4.1.58 — Sensitive topics injection

**Files:**
- Modify: `src/lib/agent/types.ts` (add sensitiveTopics field)
- Modify: `src/lib/agent/assembly.ts` (accept and pass sensitiveTopics)
- Modify: `src/lib/agent/prompt-templates.ts` (inject into prompt)
- Modify: `src/inngest/functions/execute-workflow.ts` (pass team rules to assembleAgent)

**Step 1: Add sensitiveTopics to AssembledAgent and assembleAgent**

In `types.ts`, add to `AssembledAgent`:
```typescript
sensitiveTopics?: string[];
```

In `assembly.ts`, add optional parameter:
```typescript
export async function assembleAgent(
  employeeId: string,
  modelOverride?: Partial<ModelConfig>,
  context?: { sensitiveTopics?: string[] }
): Promise<AssembledAgent> {
```

Then set it on the agent object:
```typescript
sensitiveTopics: context?.sensitiveTopics,
```

**Step 2: Inject sensitive topics into prompt**

In `prompt-templates.ts`, add after the Authority layer (Layer 3):

```typescript
// Layer 3.5: Sensitive topic guardrails
if (agent.sensitiveTopics && agent.sensitiveTopics.length > 0) {
  layers.push(`# 敏感话题规范
以下话题需要特别谨慎处理，涉及时必须标记为"需要审批"：
${agent.sensitiveTopics.map((t) => `- ${t}`).join("\n")}

处理要求：
- 涉及以上话题时，内容需经过人工审核后方可发布
- 避免使用可能引发争议的表述
- 确保事实准确，引用权威来源`);
}
```

**Step 3: Pass team rules from execute-workflow.ts**

In `execute-workflow.ts`, modify the `assembleAgent` call:

```typescript
const agent = await assembleAgent(wfStep.employeeId!, undefined, {
  sensitiveTopics: teamConfig?.rules?.sensitiveTopics,
});
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```bash
git add src/lib/agent/types.ts src/lib/agent/assembly.ts src/lib/agent/prompt-templates.ts src/inngest/functions/execute-workflow.ts
git commit -m "feat(agent): inject sensitive topics from team rules into agent prompt"
```

---

## Task 5: Workflow Launch UI — Start Workflow Dialog

**Covers:** F4.1.90 — Workflow start UI in Team Hub

**Files:**
- Create: `src/components/shared/start-workflow-dialog.tsx`
- Modify: `src/app/(dashboard)/team-hub/team-hub-client.tsx` (add launch button)
- Modify: `src/app/(dashboard)/team-hub/page.tsx` (pass workflow templates + org ID)
- Modify: `src/lib/dal/auth.ts` (re-use getOrganizationId)

**Step 1: Create StartWorkflowDialog component**

A dialog with:
- Topic title input (text field)
- Team selector (Select from available teams)
- Workflow template selector (auto-populates steps preview)
- Steps preview showing the 8-step pipeline
- "启动工作流" button that calls `startWorkflow` server action

```tsx
// src/components/shared/start-workflow-dialog.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { startWorkflow } from "@/app/actions/workflow-engine";
import { WORKFLOW_STEPS } from "@/lib/constants";
import type { Team } from "@/lib/types";
import { Play, Loader2 } from "lucide-react";

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  steps: { key: string; label: string; employeeSlug: string; order: number }[];
}

interface StartWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: Team[];
  templates: WorkflowTemplate[];
  organizationId: string;
}

export function StartWorkflowDialog({
  open,
  onOpenChange,
  teams,
  templates,
  organizationId,
}: StartWorkflowDialogProps) {
  const router = useRouter();
  const [topicTitle, setTopicTitle] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  async function handleStart() {
    if (!topicTitle || !selectedTeamId) return;
    setLoading(true);
    try {
      // Use template steps if selected, otherwise default WORKFLOW_STEPS
      const steps = selectedTemplate
        ? selectedTemplate.steps.map((s, i) => ({
            key: s.key,
            label: s.label,
            stepOrder: s.order,
          }))
        : WORKFLOW_STEPS.map((s, i) => ({
            key: s.key,
            label: s.label,
            stepOrder: i + 1,
          }));

      await startWorkflow({
        topicTitle,
        scenario: selectedTeam?.scenario || "custom",
        teamId: selectedTeamId,
        templateId: selectedTemplateId || undefined,
        organizationId,
        steps,
      });

      setTopicTitle("");
      setSelectedTeamId("");
      setSelectedTemplateId("");
      onOpenChange(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>启动新工作流</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>选题标题</Label>
            <Input
              placeholder="输入选题标题，如「AI手机大战」"
              value={topicTitle}
              onChange={(e) => setTopicTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>选择团队</Label>
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger>
                <SelectValue placeholder="选择执行团队" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {templates.length > 0 && (
            <div className="space-y-2">
              <Label>工作流模板（可选）</Label>
              <Select
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="使用默认8步流程" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Steps preview */}
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">执行步骤预览</Label>
            <div className="flex flex-wrap gap-1.5">
              {(selectedTemplate?.steps || WORKFLOW_STEPS).map((s, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200/50"
                >
                  {i + 1}. {"label" in s ? s.label : s.label}
                </span>
              ))}
            </div>
          </div>

          <Button
            className="w-full"
            onClick={handleStart}
            disabled={!topicTitle || !selectedTeamId || loading}
          >
            {loading ? (
              <Loader2 size={16} className="mr-2 animate-spin" />
            ) : (
              <Play size={16} className="mr-2" />
            )}
            启动工作流
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Add StartWorkflow button to team-hub-client.tsx**

Import and add a button + dialog above the Active Workflow section. Add `templates` and `organizationId` to the props interface.

**Step 3: Pass templates and orgId in team-hub page.tsx**

Fetch `getWorkflowTemplates()` and `getOrganizationId()` in the server component and pass to client.

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```bash
git add src/components/shared/start-workflow-dialog.tsx src/app/\(dashboard\)/team-hub/team-hub-client.tsx src/app/\(dashboard\)/team-hub/page.tsx
git commit -m "feat(ui): add workflow launcher dialog to Team Hub"
```

---

## Task 6: Approval UI — Connect Message Action Buttons

**Covers:** F4.1.105 — Approval UI in Team Hub

**Files:**
- Modify: `src/components/shared/message-bubble.tsx` (add click handlers)
- Modify: `src/components/shared/activity-feed.tsx` (pass workflow context)
- Modify: `src/lib/types.ts` (add workflowInstanceId + stepId to TeamMessage)
- Modify: `src/lib/dal/messages.ts` (return workflowInstanceId/stepKey)

**Step 1: Extend TeamMessage type with workflow context**

In `src/lib/types.ts`, add to `TeamMessage`:
```typescript
workflowInstanceId?: string;
workflowStepId?: string;
```

**Step 2: Return workflow context from DAL**

In `src/lib/dal/messages.ts`, add `workflowInstanceId` and pass step info:
```typescript
workflowInstanceId: msg.workflowInstanceId || undefined,
workflowStepId: msg.workflowStepKey || undefined,
```

**Step 3: Add approval handlers to MessageBubble**

In `message-bubble.tsx`, add `approveWorkflowStep` import and wire up action buttons:

```tsx
import { approveWorkflowStep } from "@/app/actions/workflow-engine";

// Inside the component, handle action button clicks:
const handleAction = async (action: MessageAction) => {
  if (!message.workflowInstanceId) return;

  if (action.label === "批准") {
    await approveWorkflowStep({
      workflowInstanceId: message.workflowInstanceId,
      stepId: message.workflowStepId || "",
      approved: true,
    });
  } else if (action.label === "驳回") {
    await approveWorkflowStep({
      workflowInstanceId: message.workflowInstanceId,
      stepId: message.workflowStepId || "",
      approved: false,
      feedback: "人工驳回",
    });
  }
};
```

Update the Button components to call `handleAction` on click.

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```bash
git add src/components/shared/message-bubble.tsx src/components/shared/activity-feed.tsx src/lib/types.ts src/lib/dal/messages.ts
git commit -m "feat(ui): wire approval/reject buttons in message feed to workflow actions"
```

---

## Task 7: Flexible Approval Points — Any Step Can Require Approval

**Covers:** F4.1.60 — Multi-step approval point configuration

**Files:**
- Modify: `src/db/schema/teams.ts` (extend rules type to include approvalSteps)
- Modify: `src/inngest/functions/execute-workflow.ts` (check per-step approval)
- Modify: `src/app/(dashboard)/team-builder/[id]/team-detail-client.tsx` (approval config UI)

**Step 1: Extend team rules schema**

In `src/db/schema/teams.ts`, add `approvalSteps` to the rules type:

```typescript
rules: jsonb("rules")
  .$type<{
    approvalRequired: boolean;
    reportFrequency: string;
    sensitiveTopics: string[];
    approvalSteps?: string[]; // NEW: list of step keys requiring approval
  }>()
  .notNull(),
```

Also update `src/lib/types.ts` Team.rules to match.

**Step 2: Update execute-workflow.ts to check per-step approval**

Replace the hardcoded `wfStep.key === "review"` check:

```typescript
const approvalSteps = teamConfig?.rules?.approvalSteps || [];
const needsApproval =
  approvalRequired &&
  (approvalSteps.length > 0
    ? approvalSteps.includes(wfStep.key)
    : wfStep.key === "review"); // fallback to review-only if no approvalSteps configured
```

Similarly update the `waitForEvent` block condition.

**Step 3: Add approval steps config UI**

In `team-detail-client.tsx`, add a multi-select for choosing which workflow steps need approval.

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```bash
git add src/db/schema/teams.ts src/lib/types.ts src/inngest/functions/execute-workflow.ts src/app/\(dashboard\)/team-builder/\[id\]/team-detail-client.tsx
git commit -m "feat(workflow): configurable approval points at any workflow step"
```

---

## Task 8: Send Team Message from Input Bar

**Covers:** F4.1.142 — Human message sending

**Files:**
- Modify: `src/components/shared/employee-input-bar.tsx` (connect to server action)
- Modify: `src/app/actions/teams.ts` (add sendTeamMessage if missing)
- Modify: `src/app/(dashboard)/team-hub/team-hub-client.tsx` (pass teamId to input bar)

**Step 1: Add/verify sendTeamMessage server action**

In `src/app/actions/teams.ts`, add or verify:

```typescript
export async function sendTeamMessage(data: {
  teamId: string;
  content: string;
}) {
  const user = await requireAuth();
  await db.insert(teamMessages).values({
    teamId: data.teamId,
    senderType: "human",
    userId: user.id,
    type: "status_update",
    content: data.content,
  });
  revalidatePath("/team-hub");
}
```

**Step 2: Wire up EmployeeInputBar**

Add `teamId` and `onSend` props to `EmployeeInputBar`. On send button click, call the server action.

**Step 3: Pass selectedTeamId from TeamHubClient to EmployeeInputBar**

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```bash
git add src/components/shared/employee-input-bar.tsx src/app/actions/teams.ts src/app/\(dashboard\)/team-hub/team-hub-client.tsx
git commit -m "feat(ui): connect input bar to send team messages"
```

---

## Task 9: Store Step ID in Approval Messages for Correct Routing

**Covers:** Prerequisite for Task 6 — messages need step IDs, not just step keys

**Files:**
- Modify: `src/inngest/functions/execute-workflow.ts` (store stepId in message actions metadata)
- Modify: `src/db/schema/messages.ts` (add optional stepId to actions type)

**Step 1: Include step ID in decision_request messages**

In `execute-workflow.ts`, when creating the approval message, add the step ID:

```typescript
actions: needsApproval
  ? [
      { label: "批准", variant: "primary" as const, stepId: wfStep.id },
      { label: "驳回", variant: "destructive" as const, stepId: wfStep.id },
    ]
  : undefined,
```

Update the `actions` JSONB type in `messages.ts` to include optional `stepId`:
```typescript
actions: jsonb("actions").$type<
  {
    label: string;
    variant: "default" | "primary" | "destructive";
    stepId?: string;
  }[]
>(),
```

Also update `MessageAction` in `src/lib/types.ts`:
```typescript
export interface MessageAction {
  label: string;
  variant: "default" | "primary" | "destructive";
  stepId?: string;
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/inngest/functions/execute-workflow.ts src/db/schema/messages.ts src/lib/types.ts
git commit -m "feat(workflow): include step ID in approval message actions for routing"
```

---

## Summary of Implementation Order

Execute tasks in this order due to dependencies:

1. **Task 1** — Employee status auto-switch (standalone)
2. **Task 2** — Performance auto-update (standalone, same file as Task 1)
3. **Task 3** — Work preferences injection (standalone)
4. **Task 4** — Sensitive topics injection (depends on Task 3 for types changes)
5. **Task 9** — Step ID in messages (prerequisite for Task 6)
6. **Task 6** — Approval UI (depends on Task 9)
7. **Task 5** — Workflow launch dialog (standalone)
8. **Task 7** — Flexible approval points (standalone)
9. **Task 8** — Send messages from input bar (standalone)

Note: Tasks 1-2 can be combined into one commit since they modify the same file. Tasks 3-4 can also be combined.
