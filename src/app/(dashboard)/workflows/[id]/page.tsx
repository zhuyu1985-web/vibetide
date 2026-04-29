import { notFound } from "next/navigation";
import { db } from "@/db";
import { workflowTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { WorkflowDetailClient } from "./workflow-detail-client";

export default async function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const workflow = await db.query.workflowTemplates.findFirst({
    where: eq(workflowTemplates.id, id),
  });

  if (!workflow) notFound();

  return <WorkflowDetailClient workflow={workflow} />;
}
