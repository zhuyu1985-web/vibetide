import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { listConversationsByUser } from "@/lib/dal/cowork-conversations";
import { listProjectsByOrg } from "@/lib/dal/projects";
import {
  listSchedulesWithTemplateName,
  migrateLegacyTemplateSchedules,
} from "@/lib/dal/workflow-template-schedules";
import { listWorkflowTemplatesByOrg } from "@/lib/dal/workflow-templates";
import { CoworkSidebar } from "@/components/cowork/cowork-sidebar";
import { SchedulesClient, type OrgScheduleRow } from "./schedules-client";
import type { Project } from "@/db/schema/projects";
import type { Conversation } from "@/db/schema/conversations";

export const dynamic = "force-dynamic";

function toIso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function scheduleSortKey(row: OrgScheduleRow): number {
  const parts = row.cronExpression.trim().split(/\s+/);
  if (parts.length < 5) return Number.MAX_SAFE_INTEGER;
  const [minute, hour, , , dayOfWeek] = parts;
  const m = Number(minute) || 0;
  const h = Number(hour) || 0;
  const d = dayOfWeek === "*" ? 0 : Number(dayOfWeek) || 7;
  return d * 1440 + h * 60 + m;
}

function compareSchedulesStable(a: OrgScheduleRow, b: OrgScheduleRow): number {
  const cronDiff = scheduleSortKey(a) - scheduleSortKey(b);
  if (cronDiff !== 0) return cronDiff;
  const createdDiff = a.createdAt.localeCompare(b.createdAt);
  if (createdDiff !== 0) return createdDiff;
  return a.id.localeCompare(b.id);
}

export default async function CoworkSchedulesPage() {
  let projects: Project[] = [];
  let conversations: Conversation[] = [];
  let schedules: OrgScheduleRow[] = [];
  let workflowSuggestions: { id: string; name: string }[] = [];

  const ctx = await getCurrentUserAndOrg();
  const currentUserId = ctx?.userId ?? "";
  if (ctx) {
    const { organizationId: orgId, userId } = ctx;

    try {
      await migrateLegacyTemplateSchedules(orgId);
    } catch (err) {
      console.warn("[cowork/schedules] legacy migration failed:", err);
    }

    const [projResult, convResult, workflowResult, scheduleResult] =
      await Promise.allSettled([
        listProjectsByOrg(orgId),
        listConversationsByUser(orgId, userId),
        listWorkflowTemplatesByOrg(orgId),
        listSchedulesWithTemplateName(orgId),
      ]);

    if (projResult.status === "fulfilled") projects = projResult.value;
    if (convResult.status === "fulfilled") conversations = convResult.value;
    if (workflowResult.status === "fulfilled") {
      workflowSuggestions = workflowResult.value.slice(0, 8).map((w) => ({
        id: w.id,
        name: w.name,
      }));
    }
    if (scheduleResult.status === "fulfilled") {
      schedules = scheduleResult.value
        .map(({ schedule, templateName, templateIsBuiltin, templateCreatedBy }) => ({
          id: schedule.id,
          displayName: schedule.displayName,
          description: schedule.description,
          cronExpression: schedule.cronExpression,
          timezone: schedule.timezone,
          enabled: schedule.enabled,
          nextRunAt: toIso(schedule.nextRunAt),
          lastRunAt: toIso(schedule.lastRunAt),
          workflowTemplateId: schedule.workflowTemplateId,
          templateName: templateName ?? null,
          templateIsBuiltin: templateIsBuiltin ?? false,
          templateCreatedBy: templateCreatedBy ?? null,
          createdAt: toIso(schedule.createdAt) ?? schedule.id,
        }))
        .sort(compareSchedulesStable);
    } else {
      console.warn(
        "[cowork/schedules] listSchedulesWithTemplateName failed:",
        scheduleResult.reason,
      );
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      <CoworkSidebar
        conversations={conversations}
        projects={projects}
        activeId={null}
      />
      <div className="flex-1 overflow-y-auto">
        <SchedulesClient
          schedules={schedules}
          currentUserId={currentUserId}
          workflowSuggestions={workflowSuggestions}
        />
      </div>
    </div>
  );
}
