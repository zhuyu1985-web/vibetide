import { notFound } from "next/navigation";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { getTopicCompareDetail } from "@/lib/dal/topic-compare";
import { TopicDetailClient } from "./topic-detail-client";

export const dynamic = "force-dynamic";

export default async function TopicCompareDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await getCurrentUserOrg();
  if (!orgId) notFound();

  const detail = await getTopicCompareDetail(orgId, id);
  if (!detail) notFound();

  return <TopicDetailClient detail={detail} />;
}
