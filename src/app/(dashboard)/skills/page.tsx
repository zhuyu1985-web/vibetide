import { getSkillsWithBindCount } from "@/lib/dal/skills";
import { listWorkflowTemplatesByOrg } from "@/lib/dal/workflow-templates";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import type { WorkflowTemplateRow } from "@/db/types";
import { SkillsClient } from "./skills-client";

export default async function SkillsPage() {
  let skills: Awaited<ReturnType<typeof getSkillsWithBindCount>> = [];
  let workflows: WorkflowTemplateRow[] = [];

  try {
    skills = await getSkillsWithBindCount();
  } catch {
    skills = [];
  }

  // B.1 unified scenario workflow — fetch workflows for the "场景工作流" tab
  try {
    const orgId = await getCurrentUserOrg();
    if (orgId) {
      workflows = await listWorkflowTemplatesByOrg(orgId, { isEnabled: true });
    }
  } catch {
    workflows = [];
  }

  return <SkillsClient skills={skills} workflows={workflows} />;
}
