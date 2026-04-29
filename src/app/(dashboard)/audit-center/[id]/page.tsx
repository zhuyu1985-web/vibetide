import { notFound } from "next/navigation";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { getAuditRecord, getTrailLogs, getAuditHistory } from "@/lib/dal/audit";
import { AuditDetailClient } from "./audit-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AuditDetailPage({ params }: Props) {
  const { id } = await params;
  const orgId = await getCurrentUserOrg();

  // First fetch audit record
  const record = await getAuditRecord(id);
  if (!record) notFound();

  // Then fetch trail logs and history in parallel (require contentId/contentType from record)
  const [trailLogs, auditHistory] = orgId
    ? await Promise.all([
        getTrailLogs(orgId, record.contentId, record.contentType),
        getAuditHistory(orgId, record.contentId, record.contentType),
      ])
    : [[], []];

  return (
    <AuditDetailClient
      record={record}
      trailLogs={trailLogs}
      auditHistory={auditHistory}
    />
  );
}
