import { notFound, redirect } from "next/navigation";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { getAccountReportDetail } from "@/lib/dal/account-analytics";
import { ReportDetailClient } from "./report-detail-client";

export const dynamic = "force-dynamic";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ accountId: string; reportId: string }>;
}) {
  const { accountId, reportId } = await params;
  const orgId = await getCurrentUserOrg();
  if (!orgId) redirect("/login");

  const detail = await getAccountReportDetail(orgId, reportId);
  if (!detail) notFound();

  return <ReportDetailClient accountId={accountId} detail={detail} />;
}
