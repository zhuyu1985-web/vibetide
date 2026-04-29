import { notFound } from "next/navigation";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { getMissingTopicDetail } from "@/lib/dal/missing-topics";
import { MissingTopicDetailClient } from "./missing-topic-detail-client";

export default async function MissingTopicDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await getCurrentUserOrg();
  if (!orgId) notFound();

  const detail = await getMissingTopicDetail(orgId, id);
  if (!detail) notFound();

  return <MissingTopicDetailClient detail={detail} />;
}
