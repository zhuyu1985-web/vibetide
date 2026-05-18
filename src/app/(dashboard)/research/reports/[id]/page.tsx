import { redirect } from "next/navigation";

export default async function ResearchReportDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/data-collection/reports/${id}`);
}
